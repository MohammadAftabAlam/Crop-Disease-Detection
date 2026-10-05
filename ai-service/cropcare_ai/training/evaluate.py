"""Evaluate a trained classifier on one test set and save metrics/<name>.json in the model folder.

  python -m cropcare_ai.training.evaluate --manifest data/manifests/plantvillage.csv --name plantvillage_test \\
      --description "PlantVillage held-out test (lab photos)"
  python -m cropcare_ai.training.evaluate --manifest data/manifests/plantdoc.csv --name plantdoc_test \\
      --description "PlantDoc test (field photos)"

Then `python -m cropcare_ai.training.report` puts all test sets side by side.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

import numpy as np
from torch.utils.data import DataLoader

from cropcare_ai.data.datasets import ManifestDataset
from cropcare_ai.data.manifest import read_manifest, select
from cropcare_ai.data.transforms import eval_transform
from cropcare_ai.inference.decision import UNCALIBRATED, decide, energy
from cropcare_ai.models.bundle import load_classifier, read_json, write_json
from cropcare_ai.settings import get_settings
from cropcare_ai.taxonomy import Taxonomy
from cropcare_ai.training.common import collect_logits, pick_device, resolve_path
from cropcare_ai.training.metrics import (
    confusion, expected_calibration_error, macro_f1, per_class_scores, risk_coverage, softmax,
)


def evaluate_logits(logits: np.ndarray, labels: np.ndarray, class_ids: list[str], taxonomy: Taxonomy,
                    calibration: dict) -> dict:
    num_classes = len(class_ids)
    temperature = calibration["temperature"]
    probs = softmax(logits, temperature)
    predictions = probs.argmax(1)

    crops = np.array([taxonomy[c].crop for c in class_ids])
    matrix = confusion(labels, predictions, num_classes)
    scores = per_class_scores(matrix)

    decisions = [decide(row, calibration["qhat"]) for row in probs]
    statuses = np.array([d.status for d in decisions])
    in_set = np.array([label in d.set_indices for d, label in zip(decisions, labels)])
    confident = statuses == "confident"

    energy_threshold = calibration.get("energy_threshold")
    rejected = (energy(logits) > energy_threshold) if energy_threshold is not None else np.zeros(len(labels), bool)

    present = [i for i in range(num_classes) if scores["support"][i] > 0]
    return {
        "num_images": int(len(labels)),
        "accuracy": float((predictions == labels).mean()),
        "macro_f1": macro_f1(labels, predictions, num_classes),
        "crop_accuracy": float((crops[predictions] == crops[labels]).mean()),
        "ece": expected_calibration_error(probs, labels),
        "ece_uncalibrated": expected_calibration_error(softmax(logits), labels),
        "risk_coverage": risk_coverage(probs, labels),
        "conformal": {
            "calibrated": calibration.get("alpha") is not None,
            "target_coverage": 1 - calibration["alpha"] if calibration.get("alpha") else None,
            "coverage": float(in_set.mean()),
            "mean_set_size": float(np.mean([len(d.set_indices) for d in decisions])),
        },
        "status_rates": {status: float((statuses == status).mean()) for status in ("confident", "ambiguous", "unknown")},
        "accuracy_when_confident": float((predictions[confident] == labels[confident]).mean()) if confident.any() else None,
        "energy_gate_rejection_rate": float(rejected.mean()),
        "per_class": {
            class_ids[i]: {"precision": float(scores["precision"][i]), "recall": float(scores["recall"][i]),
                           "f1": float(scores["f1"][i]), "support": int(scores["support"][i])}
            for i in present
        },
        "class_ids": class_ids,
        "confusion_matrix": matrix.tolist(),
    }


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", default=str(get_settings().classifier_dir))
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--split", default="test", help="Split to evaluate; use 'all' for every row")
    parser.add_argument("--name", required=True, help="Short id, e.g. plantdoc_test")
    parser.add_argument("--description", default="")
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--num-workers", type=int, default=2)
    parser.add_argument("--device")
    args = parser.parse_args(argv)

    device = pick_device(args.device)
    model_dir = resolve_path(args.model_dir)
    model, bundle = load_classifier(model_dir, device)
    taxonomy = Taxonomy.load(get_settings().taxonomy_path)
    calibration = read_json(model_dir / "calibration.json") or UNCALIBRATED

    rows = select(read_manifest(resolve_path(args.manifest)), None if args.split == "all" else args.split)
    dataset = ManifestDataset(rows, bundle.class_ids, eval_transform(bundle.image_size, bundle.mean, bundle.std))
    if not len(dataset):
        raise SystemExit("No images of the model's classes in this split.")
    loader = DataLoader(dataset, batch_size=args.batch_size, num_workers=args.num_workers)
    logits, labels = collect_logits(model, loader, device)

    metrics = evaluate_logits(logits, labels, bundle.class_ids, taxonomy, calibration)
    metrics.update({
        "name": args.name,
        "description": args.description or args.name,
        "manifest": args.manifest,
        "split": args.split,
        "skipped_unsupported_classes": dataset.dropped,
        "model": bundle.architecture,
        "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    })
    write_json(metrics, model_dir / "metrics" / f"{args.name}.json")

    print(f"{metrics['description']}: {metrics['num_images']} images")
    print(f"  accuracy {metrics['accuracy']:.4f} | macro-F1 {metrics['macro_f1']:.4f} | crop accuracy {metrics['crop_accuracy']:.4f}")
    print(f"  ECE {metrics['ece']:.4f} | conformal coverage {metrics['conformal']['coverage']:.3f} "
          f"(mean set size {metrics['conformal']['mean_set_size']:.2f})")
    print(f"  status rates {metrics['status_rates']} | accuracy when confident {metrics['accuracy_when_confident']}")
    if dataset.dropped:
        print(f"  skipped {dataset.dropped} images of classes the model was not trained on")


if __name__ == "__main__":
    main()
