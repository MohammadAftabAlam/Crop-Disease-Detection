"""Gate: decide whether a photo is something the classifier should answer at all.

energy  - uses the classifier's own logits. A photo unlike anything in training
          (a hand, a wall, an unknown crop) usually gets a high energy score.
bioclip - additionally asks BioCLIP (a vision-language model trained on the tree
          of life) whether the photo shows a leaf of one of our crops.
          Needs `pip install open_clip_torch`; downloads ~600 MB on first use.
"""

from __future__ import annotations

import logging

import numpy as np
from PIL import Image

from cropcare_ai.inference.decision import energy

log = logging.getLogger(__name__)

NEGATIVE_PROMPTS = [
    "a photo of a person", "a photo of a human hand", "a photo of an animal", "a photo of a building",
    "a photo of a document with text", "a photo of food on a plate", "a photo of a vehicle",
    "a photo of a flower", "a photo of a tree trunk", "a photo of bare soil", "a screenshot of a phone screen",
]


class EnergyGate:
    """Energy is computed on raw logits (T=1), independent of the calibration temperature."""

    def __init__(self, threshold: float | None):
        self.threshold = threshold

    def check(self, logits: np.ndarray) -> list[dict]:
        scores = energy(logits)
        return [{"passed": self.threshold is None or bool(score <= self.threshold), "energy": round(float(score), 3)}
                for score in scores]


class BioClipGate:
    def __init__(self, crop_names: list[str], device: str = "cpu", min_plant_probability: float = 0.3):
        import open_clip
        import torch

        self.torch = torch
        self.device = device
        self.min_plant_probability = min_plant_probability
        self.model, _, self.preprocess = open_clip.create_model_and_transforms("hf-hub:imageomics/bioclip")
        self.model = self.model.to(device).eval()
        tokenizer = open_clip.get_tokenizer("hf-hub:imageomics/bioclip")

        self.crop_names = crop_names
        positives = [f"a photo of a {name.lower()} leaf" for name in crop_names]
        with torch.no_grad():
            text = self.model.encode_text(tokenizer(positives + NEGATIVE_PROMPTS).to(device))
        self.text_features = text / text.norm(dim=-1, keepdim=True)
        self.num_positive = len(positives)

    def check(self, images: list[Image.Image]) -> list[dict]:
        torch = self.torch
        with torch.no_grad():
            batch = torch.stack([self.preprocess(image) for image in images]).to(self.device)
            features = self.model.encode_image(batch)
            features = features / features.norm(dim=-1, keepdim=True)
            probs = (100.0 * features @ self.text_features.T).softmax(dim=-1).cpu().numpy()

        results = []
        for row in probs:
            plant_probability = float(row[: self.num_positive].sum())
            results.append({
                "passed": plant_probability >= self.min_plant_probability,
                "plantProbability": round(plant_probability, 3),
                "likelyCrop": self.crop_names[int(row[: self.num_positive].argmax())],
            })
        return results


def build_bioclip_gate(crop_names: list[str], device: str, threshold: float = 0.3) -> BioClipGate | None:
    try:
        return BioClipGate(crop_names, device, threshold)
    except Exception as error:  # missing package, no internet, ...
        log.warning("BioCLIP gate unavailable (%s); using the energy gate only", error)
        return None
