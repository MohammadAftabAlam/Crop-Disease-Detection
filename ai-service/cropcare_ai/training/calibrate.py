"""Calibrate a trained classifier on held-out images (never the training images).

  python -m cropcare_ai.training.calibrate --manifest data/manifests/plantdoc.csv --split val

Produces calibration.json in the model folder with:
  temperature       makes the confidence numbers honest (temperature scaling)
  qhat              conformal threshold for ~(1-alpha) coverage of the true class
  energy_threshold  images scoring above this look unlike anything seen in training

Calibrate on photos that look like real use (field photos) whenever you have them;
PlantVillage-only calibration will be over-confident in the field.
"""

from __future__ import annotations

import argparse
import math
from datetime import datetime, timezone

import numpy as np
import torch
from torch.utils.data import DataLoader

from cropcare_ai.data.datasets import ManifestDataset
from cropcare_ai.data.transforms import eval_transform
from cropcare_ai.inference.decision import energy
from cropcare_ai.models.bundle import load_classifier, write_json
from cropcare_ai.settings import get_settings
from cropcare_ai.training.common import collect_logits, load_sources, pick_device, resolve_path
from cropcare_ai.training.metrics import expected_calibration_error, softmax


MIN_TEMPERATURE, MAX_TEMPERATURE = 0.5, 10.0
MIN_BIOCLIP_THRESHOLD = 0.01


def fit_temperature(logits: np.ndarray, labels: np.ndarray) -> float:
    logits_t = torch.tensor(logits, dtype=torch.float64)
    labels_t = torch.tensor(labels)
    log_t = torch.zeros(1, dtype=torch.float64, requires_grad=True)
    optimizer = torch.optim.LBFGS([log_t], lr=0.1, max_iter=200)

    def closure():
        optimizer.zero_grad()
        loss = torch.nn.functional.cross_entropy(logits_t / log_t.exp(), labels_t)
        loss.backward()
        return loss

    optimizer.step(closure)
    # Real models land around 0.5-3; the clamp guards against tiny or perfectly separable calibration sets
    return float(log_t.detach().exp().clamp(MIN_TEMPERATURE, MAX_TEMPERATURE))


def nll(probs: np.ndarray, labels: np.ndarray) -> float:
    return float(-np.log(np.clip(probs[np.arange(len(labels)), labels], 1e-12, 1)).mean())


def conformal_qhat(probs: np.ndarray, labels: np.ndarray, alpha: float) -> float:
    scores = 1.0 - probs[np.arange(len(labels)), labels]
    n = len(scores)
    level = min(math.ceil((n + 1) * (1 - alpha)) / n, 1.0)
    return float(np.quantile(scores, level, method="higher"))


def bioclip_threshold(rows, bundle, pass_rate: float, device: str) -> dict:
    """Pick the BioCLIP plant-probability cut-off that lets `pass_rate` of real calibration leaves through."""
    from cropcare_ai.data.datasets import load_rgb
    from cropcare_ai.inference.gate import BioClipGate
    from cropcare_ai.settings import get_settings
    from cropcare_ai.taxonomy import Taxonomy

    taxonomy = Taxonomy.load(get_settings().taxonomy_path)
    crops = list(dict.fromkeys(taxonomy[c].crop_name for c in bundle.class_ids))
    gate = BioClipGate(crops, device)
    supported = [row for row in rows if row.class_id in set(bundle.class_ids)]
    scores = []
    for start in range(0, len(supported), 32):
        images = [load_rgb(row.path) for row in supported[start:start + 32]]
        scores += [result["plantProbability"] for result in gate.check(images)]
    quantiles = {f"{q:.0%}": round(float(np.quantile(scores, q)), 4) for q in (0.01, 0.02, 0.05, 0.10, 0.50)}
    # Floor: never accept everything. Non-plant photos (blank, noise, people, objects) score ~0.001-0.003.
    threshold = max(float(np.quantile(scores, 1 - pass_rate)), MIN_BIOCLIP_THRESHOLD)
    actual_pass = float(np.mean(np.array(scores) >= threshold))
    print(f"BioCLIP scores of real leaves (quantiles): {quantiles}")
    print(f"BioCLIP threshold {threshold:.4f}: {actual_pass:.1%} of {len(scores)} real leaves pass")
    return {"bioclip_threshold": threshold, "bioclip_pass_rate": actual_pass, "bioclip_score_quantiles": quantiles}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", default=str(get_settings().classifier_dir))
    parser.add_argument("--manifest", action="append",
                        help="Calibration manifest(s); default: the validation sources used in training")
    parser.add_argument("--split", default="val")
    parser.add_argument("--alpha", type=float, default=0.1, help="Allowed miss rate of the prediction set")
    parser.add_argument("--energy-pass-rate", type=float, default=0.99,
                        help="Fraction of calibration images that must pass the energy gate")
    parser.add_argument("--bioclip", action="store_true",
                        help="Also learn the BioCLIP gate threshold (needs open_clip_torch)")
    parser.add_argument("--bioclip-pass-rate", type=float, default=0.99,
                        help="Fraction of real calibration leaves the BioCLIP gate must accept")
    parser.add_argument("--tta", action="store_true", help="Average with flipped images (also used by evaluate and the API)")
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--num-workers", type=int, default=2)
    parser.add_argument("--device")
    args = parser.parse_args(argv)

    device = pick_device(args.device)
    model_dir = resolve_path(args.model_dir)
    model, bundle = load_classifier(model_dir, device)

    if args.manifest:
        sources = [{"manifest": m, "split": args.split} for m in args.manifest]
        rows = load_sources(sources)            # missing manifests are skipped with a warning
        sources = [s for s in sources if resolve_path(s["manifest"]).exists()]
    else:
        sources = bundle.training["val_sources"]
        rows = load_sources(sources)

    dataset = ManifestDataset(rows, bundle.class_ids, eval_transform(bundle.image_size, bundle.mean, bundle.std))
    if len(dataset) < 100:
        print(f"WARNING: only {len(dataset)} calibration images; thresholds will be noisy. Aim for 300+.")
    loader = DataLoader(dataset, batch_size=args.batch_size, num_workers=args.num_workers)
    logits, labels = collect_logits(model, loader, device, tta=args.tta)

    temperature = fit_temperature(logits, labels)
    raw, scaled = softmax(logits), softmax(logits, temperature)
    qhat = conformal_qhat(scaled, labels, args.alpha)
    energy_threshold = float(np.quantile(energy(logits), args.energy_pass_rate))

    set_sizes = (scaled >= 1 - qhat).sum(axis=1)
    calibration = {
        "temperature": temperature,
        "alpha": args.alpha,
        "tta": args.tta,
        "qhat": qhat,
        "energy_threshold": energy_threshold,
        "energy_pass_rate": args.energy_pass_rate,
        "calibrated_on": {"sources": sources, "images": int(len(labels))},
        "nll": {"before": nll(raw, labels), "after": nll(scaled, labels)},
        "ece": {"before": expected_calibration_error(raw, labels), "after": expected_calibration_error(scaled, labels)},
        "calibration_set": {
            "coverage": float((scaled[np.arange(len(labels)), labels] >= 1 - qhat).mean()),
            "mean_set_size": float(set_sizes.mean()),
            "singleton_rate": float((set_sizes == 1).mean()),
        },
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    if args.bioclip:
        calibration.update(bioclip_threshold(rows, bundle, args.bioclip_pass_rate, device))
    write_json(calibration, model_dir / "calibration.json")

    print(f"Temperature {temperature:.3f} | ECE {calibration['ece']['before']:.4f} -> {calibration['ece']['after']:.4f}")
    print(f"Conformal qhat {qhat:.4f} (alpha={args.alpha}) | mean set size {calibration['calibration_set']['mean_set_size']:.2f}")
    print(f"Energy threshold {energy_threshold:.3f}")


if __name__ == "__main__":
    main()
