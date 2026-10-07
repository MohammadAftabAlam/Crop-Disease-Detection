"""The predictor used by the API: one call takes 1-5 photos of the same plant and returns
a diagnosis with an honest status, severity and (optionally) a Grad-CAM heat map."""

from __future__ import annotations

import logging
import threading
from pathlib import Path

import numpy as np
import torch

from cropcare_ai.inference.decision import UNCALIBRATED, decide
from cropcare_ai.inference.gate import EnergyGate, build_bioclip_gate
from cropcare_ai.inference.gradcam import grad_cam
from cropcare_ai.inference.imaging import decode, heatmap_overlay, mask_overlay, to_data_uri, to_tensor
from cropcare_ai.inference.severity import SeverityEstimator
from cropcare_ai.models.bundle import load_classifier, load_segmenter, read_json
from cropcare_ai.settings import Settings
from cropcare_ai.taxonomy import Taxonomy
from cropcare_ai.training.common import forward
from cropcare_ai.training.metrics import softmax

log = logging.getLogger(__name__)


class ModelNotLoaded(RuntimeError):
    pass


class UnknownCrop(ValueError):
    pass


class Predictor:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.device = settings.device
        self.taxonomy = Taxonomy.load(settings.taxonomy_path)
        self._lock = threading.Lock()

        self.model = None
        self.bundle = None
        self.calibration = UNCALIBRATED
        self.severity: SeverityEstimator | None = None
        self.bioclip = None
        self.load_error: str | None = None
        self.min_lesion_percent = settings.min_lesion_percent
        self._load()

    # ------------------------------------------------------------------ loading

    def _load(self) -> None:
        classifier_dir = Path(self.settings.classifier_dir)
        if not (classifier_dir / "bundle.json").exists():
            self.load_error = (f"No trained classifier in {classifier_dir}. Train one (see ai-service/README.md) "
                               "or copy the artifacts folder from Kaggle.")
            log.warning(self.load_error)
            return

        self.model, self.bundle = load_classifier(classifier_dir, self.device)
        unknown = [c for c in self.bundle.class_ids if c not in self.taxonomy.classes]
        if unknown:
            raise ValueError(f"Model classes missing from taxonomy.yaml: {unknown}")
        self.calibration = read_json(classifier_dir / "calibration.json") or UNCALIBRATED
        gate_threshold = None if self.settings.gate == "off" else self.calibration.get("energy_threshold")
        self.energy_gate = EnergyGate(gate_threshold)

        severity_dir = Path(self.settings.severity_dir)
        if (severity_dir / "bundle.json").exists():
            model, bundle = load_segmenter(severity_dir, self.device)
            self.severity = SeverityEstimator(model, bundle, self.taxonomy, self.device)

        if self.settings.gate == "bioclip":
            # A threshold learnt during calibration (calibrate --bioclip) beats the generic default
            threshold = self.calibration.get("bioclip_threshold", self.settings.bioclip_threshold)
            self.bioclip = build_bioclip_gate(self.crop_names, self.device, threshold)

    @property
    def loaded(self) -> bool:
        return self.model is not None

    @property
    def crop_names(self) -> list[str]:
        names = []
        for class_id in self.bundle.class_ids:
            name = self.taxonomy[class_id].crop_name
            if name not in names:
                names.append(name)
        return names

    def info(self) -> dict:
        if not self.loaded:
            return {"success": True, "modelLoaded": False, "message": self.load_error}
        model_dir = Path(self.settings.classifier_dir)
        metrics = {}
        for path in sorted((model_dir / "metrics").glob("*.json")):
            m = read_json(path)
            metrics[m["name"]] = {k: m.get(k) for k in (
                "description", "num_images", "accuracy", "macro_f1", "crop_accuracy", "ece",
                "conformal", "status_rates", "accuracy_when_confident", "evaluated_at")}
        training = self.bundle.training
        return {
            "success": True,
            "modelLoaded": True,
            "architecture": self.bundle.architecture,
            "imageSize": self.bundle.image_size,
            "createdAt": self.bundle.created_at,
            "crops": self.crop_names,
            "classes": [self.taxonomy[c].as_dict() for c in self.bundle.class_ids],
            "training": {k: training.get(k) for k in ("train_images", "val_images", "best_epoch", "best_val_macro_f1",
                                                     "train_sources")},
            "calibration": {k: self.calibration.get(k) for k in ("temperature", "alpha", "qhat", "energy_threshold",
                                                                "calibrated_on", "ece")},
            "gate": "bioclip+energy" if self.bioclip else "energy",
            "severityModel": self.severity is not None,
            "lesionCrossCheckPercent": self.min_lesion_percent,
            "metrics": metrics,
        }

    # --------------------------------------------------------------- prediction

    def _candidate(self, index: int, probs: np.ndarray) -> dict:
        return {**self.taxonomy[self.bundle.class_ids[index]].as_dict(), "confidence": round(float(probs[index]) * 100, 2)}

    def crop_key(self, crop: str | None) -> str | None:
        """'Rice' / 'rice' -> 'rice'; None = no crop chosen. Raises UnknownCrop for crops the model lacks."""
        if not crop:
            return None
        wanted = crop.strip().lower()
        for class_id in self.bundle.class_ids:
            c = self.taxonomy[class_id]
            if wanted in (c.crop, c.crop_name.lower()):
                return c.crop
        raise UnknownCrop(f"This model does not cover the crop '{crop}'. Supported: {', '.join(self.crop_names)}.")

    def predict(self, images_bytes: list[bytes], explain: bool = False, with_severity: bool = True,
                crop: str | None = None) -> dict:
        if not self.loaded:
            raise ModelNotLoaded(self.load_error)
        crop = self.crop_key(crop)

        images = [decode(data) for data in images_bytes]
        size, mean, std = self.bundle.image_size, self.bundle.mean, self.bundle.std
        batch = torch.stack([to_tensor(image, size, mean, std) for image in images]).to(self.device)

        with self._lock, torch.no_grad():
            logits = forward(self.model, batch, tta=bool(self.calibration.get("tta"))).cpu().numpy()
        probs = softmax(logits, self.calibration["temperature"])

        gate_results = self.energy_gate.check(logits)
        if self.bioclip:
            for result, clip in zip(gate_results, self.bioclip.check(images)):
                result.update(clip, passed=result["passed"] and clip["passed"])

        per_image = [{"index": i, "gate": gate_results[i], "top": self._candidate(int(probs[i].argmax()), probs[i])}
                     for i in range(len(images))]
        passed = [i for i, result in enumerate(gate_results) if result["passed"]]

        response = {
            "success": True,
            "imagesReceived": len(images),
            "imagesUsed": len(passed),
            "perImage": per_image,
            "model": {"architecture": self.bundle.architecture, "createdAt": self.bundle.created_at,
                      "calibrated": self.calibration.get("alpha") is not None},
            "severity": None,
            "explanation": None,
            "selectedCrop": crop,
            "reason": None,
        }

        if not passed:
            return {**response, "status": "rejected", "classId": None, "crop": None, "disease": None,
                    "isHealthy": None, "confidence": None, "candidates": [],
                    "message": ("This does not look like a leaf of a supported crop ("
                                + ", ".join(self.crop_names) + "). Photograph a single leaf of a supported crop.")}

        # Several photos of the same plant: average their probabilities
        combined = probs[passed].mean(axis=0)
        if crop:
            # The farmer named the crop: only that crop's classes can be the answer
            mask = np.array([self.taxonomy[c].crop == crop for c in self.bundle.class_ids], dtype=float)
            combined = combined * mask / (combined * mask).sum()
        decision = decide(combined, self.calibration["qhat"])
        best = int(combined.argmax())
        shown = decision.set_indices or [int(i) for i in np.argsort(-combined)[:3]]
        best_class = self.taxonomy[self.bundle.class_ids[best]]

        response.update({
            "status": decision.status,
            **best_class.as_dict(),
            "confidence": round(float(combined[best]) * 100, 2),
            "candidates": [self._candidate(i, combined) for i in shown],
            "message": self._message(decision.status, best_class, [self.taxonomy[self.bundle.class_ids[i]] for i in shown]),
        })

        first = passed[0]
        severity_mask = None
        # Severity only for diseases that leave lesions (not viruses, mites or insect damage)
        if self.severity and decision.status != "unknown" and best_class.lesions and (with_severity or self.min_lesion_percent):
            estimates = [self.severity.estimate(images[i]) for i in passed]
            severity_mask = estimates[0].pop("_lesion_mask")
            for estimate in estimates[1:]:
                estimate.pop("_lesion_mask")
            percent = float(np.mean([e["percent"] for e in estimates]))
            grade = self.taxonomy.grade_for(percent)
            response["severity"] = {"percent": round(percent, 1), "grade": grade.grade, "label": grade.label,
                                    "leafAreaFound": all(e["leafAreaFound"] for e in estimates),
                                    "perImage": [e["percent"] for e in estimates]}

            # Lesion cross-check: a spot/blight/rust diagnosis with almost no lesions on the leaf is not
            # trusted (e.g. insect holes read as brown spot). Threshold chosen with evaluate_checks.py.
            if self.min_lesion_percent and percent < self.min_lesion_percent:
                response.update({
                    "status": "unknown",
                    "reason": "no_lesions",
                    "message": ("No disease spots were found on this leaf, so it does not look like a disease the model "
                                "knows. It may be insect damage, a nutrient problem or something else: please ask an "
                                "agricultural expert or your nearest Krishi Vigyan Kendra."),
                })
            if not with_severity:
                response["severity"] = None

        if explain:
            with self._lock:
                heat = grad_cam(self.model, batch[first:first + 1], best)
            response["explanation"] = {
                "imageIndex": first,
                "heatmap": to_data_uri(heatmap_overlay(images[first], heat)),
                "lesions": to_data_uri(mask_overlay(images[first], severity_mask)) if severity_mask is not None else None,
            }
        return response

    @staticmethod
    def _message(status: str, best, shown) -> str:
        if status == "confident":
            if best.healthy:
                return f"The {best.crop_name.lower()} leaf looks healthy."
            return f"{best.crop_name}: {best.disease}."
        if status == "ambiguous":
            options = " or ".join(f"{c.crop_name} {c.disease}" for c in shown)
            return f"Not sure between {options}. Take a closer, well-lit photo of one affected leaf."
        return ("The model cannot identify this reliably. Please consult an agricultural expert "
                "or your nearest Krishi Vigyan Kendra.")
