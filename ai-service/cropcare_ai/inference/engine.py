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
from cropcare_ai.training.metrics import softmax

log = logging.getLogger(__name__)


class ModelNotLoaded(RuntimeError):
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
            self.bioclip = build_bioclip_gate(self.crop_names, self.device, self.settings.bioclip_threshold)

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
            "metrics": metrics,
        }

    # --------------------------------------------------------------- prediction

    def _candidate(self, index: int, probs: np.ndarray) -> dict:
        return {**self.taxonomy[self.bundle.class_ids[index]].as_dict(), "confidence": round(float(probs[index]) * 100, 2)}

    def predict(self, images_bytes: list[bytes], explain: bool = False, with_severity: bool = True) -> dict:
        if not self.loaded:
            raise ModelNotLoaded(self.load_error)

        images = [decode(data) for data in images_bytes]
        size, mean, std = self.bundle.image_size, self.bundle.mean, self.bundle.std
        batch = torch.stack([to_tensor(image, size, mean, std) for image in images]).to(self.device)

        with self._lock, torch.no_grad():
            logits = self.model(batch).float().cpu().numpy()
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
        }

        if not passed:
            return {**response, "status": "rejected", "classId": None, "crop": None, "disease": None,
                    "isHealthy": None, "confidence": None, "candidates": [],
                    "message": ("This does not look like a leaf of a supported crop ("
                                + ", ".join(self.crop_names) + "). Photograph a single leaf of a supported crop.")}

        # Several photos of the same plant: average their probabilities
        combined = probs[passed].mean(axis=0)
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
        if with_severity and self.severity and decision.status != "unknown" and not best_class.healthy:
            estimates = [self.severity.estimate(images[i]) for i in passed]
            severity_mask = estimates[0].pop("_lesion_mask")
            for estimate in estimates[1:]:
                estimate.pop("_lesion_mask")
            percent = float(np.mean([e["percent"] for e in estimates]))
            grade = self.taxonomy.grade_for(percent)
            response["severity"] = {"percent": round(percent, 1), "grade": grade.grade, "label": grade.label,
                                    "leafAreaFound": all(e["leafAreaFound"] for e in estimates),
                                    "perImage": [e["percent"] for e in estimates]}

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
