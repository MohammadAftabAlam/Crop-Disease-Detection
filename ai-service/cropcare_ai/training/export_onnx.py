"""Export the classifier to ONNX (and optionally a smaller int8 version) for offline use.

  python -m cropcare_ai.training.export_onnx --model-dir artifacts/c_mobilenetv3
  python -m cropcare_ai.training.export_onnx --model-dir artifacts/c_mobilenetv3 \\
      --int8-calibration data/manifests/plantdoc.csv --int8-calibration data/manifests/plantwild.csv

model.onnx       float32, checked against PyTorch
model.int8.onnx  static int8 (per-channel weights, QDQ), calibrated on real images. Only made when
                 --int8-calibration is given. Dynamic int8 is NOT used: on MobileNetV3 it dropped
                 field accuracy from 62.5% to 22%. Always check an int8 model with export_web --check.
"""

from __future__ import annotations

import argparse
import random

import numpy as np
import torch

from cropcare_ai.data.datasets import load_rgb
from cropcare_ai.data.manifest import read_manifest, select
from cropcare_ai.inference.imaging import to_tensor
from cropcare_ai.models.bundle import load_classifier, read_json, write_json
from cropcare_ai.settings import get_settings
from cropcare_ai.training.common import resolve_path


def quantize_static_int8(onnx_path, int8_path, bundle, manifests: list[str], split: str, limit: int) -> int:
    from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static
    from onnxruntime.quantization.shape_inference import quant_pre_process

    index = set(bundle.class_ids)
    rows = [r for m in manifests for r in select(read_manifest(resolve_path(m)), split) if r.class_id in index]
    random.Random(0).shuffle(rows)
    rows = rows[:limit]

    class Reader(CalibrationDataReader):
        def __init__(self):
            self.items = iter(rows)

        def get_next(self):
            row = next(self.items, None)
            if row is None:
                return None
            x = to_tensor(load_rgb(row.path), bundle.image_size, bundle.mean, bundle.std)[None].numpy()
            return {"image": x}

    prepared = onnx_path.with_name("model.prep.onnx")
    quant_pre_process(str(onnx_path), str(prepared))
    quantize_static(str(prepared), str(int8_path), Reader(), quant_format=QuantFormat.QDQ, per_channel=True,
                    weight_type=QuantType.QInt8, activation_type=QuantType.QUInt8)
    prepared.unlink(missing_ok=True)
    return len(rows)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", default=str(get_settings().classifier_dir))
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument("--int8-calibration", action="append", default=[],
                        help="Manifest(s) of real photos to calibrate int8 quantization on")
    parser.add_argument("--int8-split", default="val")
    parser.add_argument("--int8-images", type=int, default=300)
    parser.add_argument("--skip-int8", action="store_true", help="(kept for old commands) same as giving no calibration")
    args = parser.parse_args(argv)

    import onnxruntime as ort

    model_dir = resolve_path(args.model_dir)
    model, bundle = load_classifier(model_dir, "cpu")
    dummy = torch.randn(1, 3, bundle.image_size, bundle.image_size)
    onnx_path = model_dir / "model.onnx"

    torch.onnx.export(model, dummy, str(onnx_path), input_names=["image"], output_names=["logits"],
                      dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}}, opset_version=args.opset,
                      dynamo=False)

    with torch.no_grad():
        expected = model(dummy).numpy()
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    actual = session.run(None, {"image": dummy.numpy()})[0]
    max_diff = float(np.abs(expected - actual).max())
    print(f"ONNX export OK ({onnx_path.stat().st_size / 1e6:.1f} MB), max difference vs PyTorch {max_diff:.2e}")

    info = {"fp32": {"file": "model.onnx", "max_abs_diff": max_diff, "mb": onnx_path.stat().st_size / 1e6}}
    if args.int8_calibration and not args.skip_int8:
        int8_path = model_dir / "model.int8.onnx"
        used = quantize_static_int8(onnx_path, int8_path, bundle, args.int8_calibration, args.int8_split, args.int8_images)
        info["int8"] = {"file": "model.int8.onnx", "mb": int8_path.stat().st_size / 1e6, "method": "static QDQ, per-channel",
                        "calibration_images": used, "calibration_sources": args.int8_calibration}
        print(f"int8 model {info['int8']['mb']:.1f} MB, calibrated on {used} images. Check it: "
              f"python -m cropcare_ai.training.export_web --model-dir {args.model_dir} --check <manifest>")

    export = {**info, "class_ids": bundle.class_ids, "image_size": bundle.image_size,
              "mean": list(bundle.mean), "std": list(bundle.std),
              "calibration": read_json(model_dir / "calibration.json")}
    write_json(export, model_dir / "onnx_export.json")


if __name__ == "__main__":
    main()
