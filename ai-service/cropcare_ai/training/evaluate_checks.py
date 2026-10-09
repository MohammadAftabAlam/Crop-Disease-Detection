"""Measure two safety checks on field test photos before switching them on.

  python -m cropcare_ai.training.evaluate_checks \\
      --manifest data/manifests/plantdoc.csv --manifest data/manifests/plantwild.csv

1. Crop selection: the farmer names the crop and the model chooses only among that crop's
   classes. Compared with no crop given: accuracy, coverage, statuses.
2. Lesion cross-check: a diagnosis of a lesion-type disease (spots, blights, rusts...) whose
   lesion model finds less than X% diseased area becomes "unknown". For several thresholds X:
   how many CORRECT diagnoses would be wrongly downgraded, and how many WRONG ones caught.

Writes metrics/checks.json in the model folder.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

import numpy as np
import torch

from cropcare_ai.data.datasets import load_rgb
from cropcare_ai.data.manifest import read_manifest, select
from cropcare_ai.inference.decision import UNCALIBRATED, decide
from cropcare_ai.inference.imaging import to_tensor
from cropcare_ai.inference.severity import SeverityEstimator
from cropcare_ai.models.bundle import load_classifier, load_segmenter, read_json, write_json
from cropcare_ai.settings import get_settings
from cropcare_ai.taxonomy import Taxonomy
from cropcare_ai.training.common import forward, resolve_path
from cropcare_ai.training.metrics import softmax

THRESHOLDS = [0.5, 1.0, 2.0, 3.0, 5.0]


def restrict(probs: np.ndarray, mask: np.ndarray) -> np.ndarray:
    kept = probs * mask
    return kept / kept.sum()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", default=str(get_settings().classifier_dir))
    parser.add_argument("--severity-dir", default=str(get_settings().severity_dir))
    parser.add_argument("--manifest", action="append", required=True)
    parser.add_argument("--split", default="test")
    args = parser.parse_args(argv)

    settings = get_settings()
    taxonomy = Taxonomy.load(settings.taxonomy_path)
    model_dir = resolve_path(args.model_dir)
    model, bundle = load_classifier(model_dir, "cpu")
    calibration = read_json(model_dir / "calibration.json") or UNCALIBRATED
    seg_model, seg_bundle = load_segmenter(resolve_path(args.severity_dir), "cpu")
    severity = SeverityEstimator(seg_model, seg_bundle, taxonomy, "cpu")

    classes = [taxonomy[c] for c in bundle.class_ids]
    index = {c: i for i, c in enumerate(bundle.class_ids)}
    crop_of = np.array([c.crop for c in classes])
    rows = [r for m in args.manifest for r in select(read_manifest(resolve_path(m)), args.split) if r.class_id in index]
    qhat, tta = calibration["qhat"], bool(calibration.get("tta"))

    records = []
    for n, row in enumerate(rows, 1):
        image = load_rgb(row.path)
        x = to_tensor(image, bundle.image_size, bundle.mean, bundle.std)[None]
        with torch.no_grad():
            probs = softmax(forward(model, x, tta).numpy(), calibration["temperature"])[0]
        label = index[row.class_id]
        crop_probs = restrict(probs, (crop_of == classes[label].crop).astype(float))
        free, chosen = decide(probs, qhat), decide(crop_probs, qhat)
        lesion_percent = severity.estimate(image)["percent"]
        records.append({
            "label": label,
            "free": (int(probs.argmax()), free.status, label in free.set_indices),
            "crop": (int(crop_probs.argmax()), chosen.status, label in chosen.set_indices),
            "lesion_percent": lesion_percent,
        })
        if n % 100 == 0:
            print(f"  {n}/{len(rows)} photos")

    def summary(key: str) -> dict:
        tops = np.array([r[key][0] for r in records])
        labels = np.array([r["label"] for r in records])
        statuses = np.array([r[key][1] for r in records])
        confident = statuses == "confident"
        return {
            "accuracy": float((tops == labels).mean()),
            "coverage": float(np.mean([r[key][2] for r in records])),
            "status_rates": {s: float((statuses == s).mean()) for s in ("confident", "ambiguous", "unknown")},
            "accuracy_when_confident": float((tops[confident] == labels[confident]).mean()) if confident.any() else None,
        }

    def cross_check(key: str) -> list[dict]:
        out = []
        candidates = [r for r in records if r[key][1] in ("confident", "ambiguous") and classes[r[key][0]].lesions]
        correct = [r for r in candidates if r[key][0] == r["label"]]
        wrong = [r for r in candidates if r[key][0] != r["label"]]
        for t in THRESHOLDS:
            out.append({
                "threshold_percent": t,
                "correct_diagnoses": len(correct),
                "correct_downgraded": sum(r["lesion_percent"] < t for r in correct),
                "wrong_diagnoses": len(wrong),
                "wrong_caught": sum(r["lesion_percent"] < t for r in wrong),
            })
        return out

    result = {
        "photos": len(rows),
        "test_sets": args.manifest,
        "model": bundle.architecture,
        "no_crop_given": summary("free"),
        "crop_given": summary("crop"),
        "lesion_cross_check": {"no_crop_given": cross_check("free"), "crop_given": cross_check("crop")},
        "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    write_json(result, model_dir / "metrics" / "checks.json")

    for key, title in (("no_crop_given", "No crop given"), ("crop_given", "Crop given by farmer")):
        s = result[key]
        print(f"{title:22s} accuracy {s['accuracy']:.3f} | coverage {s['coverage']:.3f} | "
              f"confident {s['status_rates']['confident']:.3f} -> right {s['accuracy_when_confident']}")
    print("Lesion cross-check (crop given):")
    for c in result["lesion_cross_check"]["crop_given"]:
        print(f"  below {c['threshold_percent']:>4}% lesions: correct downgraded {c['correct_downgraded']}/{c['correct_diagnoses']}"
              f" | wrong caught {c['wrong_caught']}/{c['wrong_diagnoses']}")


if __name__ == "__main__":
    main()
