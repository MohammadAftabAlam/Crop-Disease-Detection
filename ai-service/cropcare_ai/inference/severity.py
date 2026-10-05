"""Severity = diseased area / leaf area.

Lesions come from the trained segmentation model. The leaf itself is found with
the Excess-Green index (2G - R - B) and Otsu's threshold, which separates green
leaf from soil/sky well enough for an area ratio; lesion pixels are always
counted as leaf.
"""

from __future__ import annotations

import numpy as np
import torch
from PIL import Image, ImageFilter

from cropcare_ai.inference.imaging import to_tensor
from cropcare_ai.models.bundle import SegmenterBundle
from cropcare_ai.taxonomy import Taxonomy

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def otsu_threshold(values: np.ndarray, bins: int = 256) -> float:
    hist, edges = np.histogram(values, bins=bins)
    centers = (edges[:-1] + edges[1:]) / 2
    weight_low = np.cumsum(hist)
    weight_high = weight_low[-1] - weight_low
    mean_low = np.cumsum(hist * centers) / np.maximum(weight_low, 1)
    total_mean = (hist * centers).sum() / max(weight_low[-1], 1)
    mean_high = (total_mean * weight_low[-1] - np.cumsum(hist * centers)) / np.maximum(weight_high, 1)
    between = weight_low * weight_high * (mean_low - mean_high) ** 2
    return float(centers[int(np.argmax(between))])


def leaf_mask(image: Image.Image) -> np.ndarray:
    rgb = np.asarray(image, dtype=np.float32)
    total = rgb.sum(axis=2) + 1e-6
    r, g, b = (rgb[..., i] / total for i in range(3))
    excess_green = 2 * g - r - b
    mask = excess_green > otsu_threshold(excess_green)
    # Morphological close then open to fill small holes and drop specks
    pil = Image.fromarray(mask.astype(np.uint8) * 255)
    pil = pil.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    pil = pil.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    return np.asarray(pil) > 0


class SeverityEstimator:
    def __init__(self, model: torch.nn.Module, bundle: SegmenterBundle, taxonomy: Taxonomy, device: str = "cpu"):
        self.model = model
        self.bundle = bundle
        self.taxonomy = taxonomy
        self.device = device

    @torch.no_grad()
    def lesion_mask(self, image: Image.Image) -> np.ndarray:
        size = self.bundle.image_size
        tensor = to_tensor(image, size, IMAGENET_MEAN, IMAGENET_STD)[None].to(self.device)
        return (torch.sigmoid(self.model(tensor))[0, 0] > 0.5).cpu().numpy()

    def estimate(self, image: Image.Image) -> dict:
        size = self.bundle.image_size
        lesions = self.lesion_mask(image)
        leaf = leaf_mask(image.resize((size, size), Image.Resampling.BILINEAR)) | lesions

        leaf_fraction = float(leaf.mean())
        reliable = leaf_fraction >= 0.05
        if not reliable:
            leaf = np.ones_like(leaf)   # leaf not found: fall back to the whole photo

        percent = float(lesions.sum() / max(leaf.sum(), 1) * 100)
        grade = self.taxonomy.grade_for(percent)
        return {
            "percent": round(percent, 1),
            "grade": grade.grade,
            "label": grade.label,
            "leafAreaFound": reliable,
            "_lesion_mask": lesions,
        }
