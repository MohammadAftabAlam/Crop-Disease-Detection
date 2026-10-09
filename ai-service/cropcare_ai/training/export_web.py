"""Package the small classifier for offline use in the browser (ONNX Runtime Web).

  python -m cropcare_ai.training.export_web --model-dir artifacts/c_mobilenetv3 \\
      --check data/manifests/plantdoc.csv --check data/manifests/plantwild.csv

Writes into frontend/public/model/:
  cropcare-mobile.onnx   the ONNX model (made by training/export_onnx.py); float32 by default because
                         int8 lost too much field accuracy (dynamic 22%, static 51% vs 62.5% float32)
  cropcare-mobile.json   classes with display names, preprocessing and calibration, so the
                         browser makes the same decisions as the server (statuses, gate, TTA)

--check evaluates the chosen ONNX model on the test split of each manifest with the same
preprocessing as the browser, and compares it with the PyTorch model.
"""

from __future__ import annotations

import argparse
import shutil
from datetime import datetime, timezone

import numpy as np
import torch

from cropcare_ai.data.datasets import load_rgb
from cropcare_ai.data.manifest import read_manifest, select
from cropcare_ai.inference.decision import decide
from cropcare_ai.inference.imaging import to_tensor
from cropcare_ai.models.bundle import load_classifier, read_json, write_json
from cropcare_ai.settings import SERVICE_DIR, get_settings
from cropcare_ai.taxonomy import Taxonomy
from cropcare_ai.training.common import forward, resolve_path
from cropcare_ai.training.metrics import softmax

WEB_DIR = SERVICE_DIR.parent / "frontend" / "public" / "model"


def check(manifests: list[str], onnx_path, model_dir, bundle, calibration) -> dict:
    import onnxruntime as ort

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    torch_model, _ = load_classifier(model_dir, "cpu")
    tta = bool(calibration.get("tta"))
    index = {c: i for i, c in enumerate(bundle.class_ids)}

    rows = [r for m in manifests for r in select(read_manifest(resolve_path(m)), "test") if r.class_id in index]
    hits_onnx = hits_torch = agree = confident = confident_right = 0
    for row in rows:
        x = to_tensor(load_rgb(row.path), bundle.image_size, bundle.mean, bundle.std)[None]
        batch = np.concatenate([x.numpy(), torch.flip(x, dims=[3]).numpy()]) if tta else x.numpy()
        logits_onnx = session.run(None, {"image": batch})[0].mean(axis=0, keepdims=True)
        with torch.no_grad():
            logits_torch = forward(torch_model, x, tta).numpy()
        probs = softmax(logits_onnx, calibration["temperature"])[0]
        label = index[row.class_id]
        top_onnx, top_torch = int(probs.argmax()), int(logits_torch.argmax())
        hits_onnx += top_onnx == label
        hits_torch += top_torch == label
        agree += top_onnx == top_torch
        if decide(probs, calibration["qhat"]).status == "confident":
            confident += 1
            confident_right += top_onnx == label
    n = len(rows)
    return {"images": n, "onnx_file": onnx_path.name, "accuracy_onnx": hits_onnx / n, "accuracy_pytorch": hits_torch / n,
            "top1_agreement": agree / n, "confident_rate": confident / n,
            "accuracy_when_confident": confident_right / confident if confident else None,
            "test_sets": manifests}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", default="artifacts/c_mobilenetv3")
    parser.add_argument("--out", default=str(WEB_DIR))
    parser.add_argument("--onnx-file", default="model.onnx", help="model.onnx (float32) or model.int8.onnx")
    parser.add_argument("--check", action="append", default=[], help="Manifest(s) whose test split to evaluate")
    args = parser.parse_args(argv)

    model_dir = resolve_path(args.model_dir)
    onnx_path = model_dir / args.onnx_file
    if not onnx_path.exists():
        raise SystemExit(f"{onnx_path} not found. Run: python -m cropcare_ai.training.export_onnx --model-dir {args.model_dir}")

    _, bundle = load_classifier(model_dir, "cpu")
    calibration = read_json(model_dir / "calibration.json")
    if not calibration:
        raise SystemExit("Calibrate the model first (calibration.json missing).")
    taxonomy = Taxonomy.load(get_settings().taxonomy_path)

    out = resolve_path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(onnx_path, out / "cropcare-mobile.onnx")

    info = {
        "model": bundle.architecture,
        "precision": "int8" if "int8" in args.onnx_file else "float32",
        "version": datetime.now(timezone.utc).strftime("%Y%m%d%H%M"),
        "imageSize": bundle.image_size,
        "mean": list(bundle.mean),
        "std": list(bundle.std),
        "inputName": "image",
        "classes": [taxonomy[c].as_dict() for c in bundle.class_ids],
        "crops": list(dict.fromkeys(taxonomy[c].crop_name for c in bundle.class_ids)),
        "temperature": calibration["temperature"],
        "qhat": calibration["qhat"],
        "energyThreshold": calibration.get("energy_threshold"),
        "tta": bool(calibration.get("tta")),
        "minConfidentProbability": 0.5,
        "maxAmbiguousSet": 3,
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    if args.check:
        info["check"] = check(args.check, onnx_path, model_dir, bundle, calibration)
        print("Check:", {k: (round(v, 4) if isinstance(v, float) else v) for k, v in info["check"].items()})
    write_json(info, out / "cropcare-mobile.json")
    print(f"Wrote {out / 'cropcare-mobile.onnx'} ({onnx_path.stat().st_size / 1e6:.1f} MB) and cropcare-mobile.json")


if __name__ == "__main__":
    main()
