"""PyTorch datasets for classification (manifests) and lesion segmentation (PlantSeg)."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageOps
from torch.utils.data import Dataset, WeightedRandomSampler

from cropcare_ai.data.manifest import IMAGE_EXTENSIONS, Row


def load_rgb(path: str | Path) -> Image.Image:
    image = Image.open(path)
    return ImageOps.exif_transpose(image).convert("RGB")


class ManifestDataset(Dataset):
    """Images listed in manifest rows. Rows whose class is not in `class_ids` are dropped."""

    def __init__(self, rows: list[Row], class_ids: list[str], transform=None):
        index = {class_id: i for i, class_id in enumerate(class_ids)}
        kept = [row for row in rows if row.class_id in index]
        self.items = [(row.path, index[row.class_id]) for row in kept]
        self.sources = [row.source for row in kept]
        self.dropped = len(rows) - len(self.items)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, i: int):
        path, label = self.items[i]
        image = load_rgb(path)
        if self.transform:
            image = self.transform(image)
        return image, label

    def labels(self) -> list[int]:
        return [label for _, label in self.items]


def balanced_sampler(labels: list[int], sources: list[str] | None = None) -> WeightedRandomSampler:
    """Draw every class about equally often.

    With `sources`, each class's share is also split between datasets in proportion to
    sqrt(images in that dataset), so 80 PlantDoc photos of a disease are not drowned out
    by 1,500 PlantVillage photos of it, without repeating the small set excessively.
    """
    if sources is None:
        counts = Counter(labels)
        weights = [1.0 / counts[label] for label in labels]
    else:
        pair_counts = Counter(zip(labels, sources))
        class_totals: Counter = Counter()
        for (label, _), n in pair_counts.items():
            class_totals[label] += n ** 0.5
        weights = [1.0 / (pair_counts[(l, s)] ** 0.5 * class_totals[l]) for l, s in zip(labels, sources)]
    return WeightedRandomSampler(torch.tensor(weights, dtype=torch.double), num_samples=len(labels), replacement=True)


# ---------------------------------------------------------------------------
# Segmentation (severity)
# ---------------------------------------------------------------------------

def coco_lesion_masks(annotation_file: str | Path, image_dir: str | Path) -> list[tuple[Path, list[list[float]]]]:
    """Read a COCO json (PlantSeg ships these) into [(image path, [polygon, ...])].

    Every annotated region counts as lesion, whatever its disease class.
    """
    data = json.loads(Path(annotation_file).read_text(encoding="utf-8"))
    polygons: dict[int, list[list[float]]] = {img["id"]: [] for img in data["images"]}
    for ann in data["annotations"]:
        segmentation = ann.get("segmentation")
        if isinstance(segmentation, list):
            polygons[ann["image_id"]].extend(poly for poly in segmentation if len(poly) >= 6)
    image_dir = Path(image_dir)
    return [(image_dir / img["file_name"], polygons[img["id"]]) for img in data["images"]
            if (image_dir / img["file_name"]).exists()]


def rasterize(polygons: list[list[float]], size: tuple[int, int]) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for poly in polygons:
        draw.polygon(list(zip(poly[0::2], poly[1::2])), fill=1)
    return mask


class LesionSegmentationDataset(Dataset):
    """Pairs of (image, binary lesion mask).

    Pass either `coco=(annotation json, image folder)` or `mask_dirs=(image folder, mask folder)`
    where each mask has the same file stem as its image and non-zero pixels mark lesions.
    """

    def __init__(self, size: int, coco: tuple[str, str] | None = None,
                 mask_dirs: tuple[str, str] | None = None, augment: bool = False):
        self.size = size
        self.augment = augment
        self.samples: list[tuple[Path, object]] = []
        if coco:
            self.samples = [(path, polys) for path, polys in coco_lesion_masks(*coco)]
        elif mask_dirs:
            image_dir, mask_dir = map(Path, mask_dirs)
            masks = {p.stem: p for p in mask_dir.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS}
            self.samples = [(p, masks[p.stem]) for p in sorted(image_dir.iterdir())
                            if p.suffix.lower() in IMAGE_EXTENSIONS and p.stem in masks]
        else:
            raise ValueError("Give coco=... or mask_dirs=...")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, i: int):
        path, target = self.samples[i]
        image = load_rgb(path)
        if isinstance(target, Path):
            mask = Image.open(target).convert("L").point(lambda v: 1 if v > 0 else 0)
        else:
            mask = rasterize(target, image.size)

        image = image.resize((self.size, self.size), Image.Resampling.BILINEAR)
        mask = mask.resize((self.size, self.size), Image.Resampling.NEAREST)

        image_np = np.asarray(image, dtype=np.float32) / 255.0
        mask_np = np.asarray(mask, dtype=np.float32)

        if self.augment:
            if np.random.rand() < 0.5:
                image_np, mask_np = image_np[:, ::-1], mask_np[:, ::-1]
            if np.random.rand() < 0.5:
                image_np, mask_np = image_np[::-1], mask_np[::-1]
            image_np = np.clip(image_np * np.random.uniform(0.75, 1.25), 0, 1)

        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        image_np = (image_np - mean) / std
        return (torch.from_numpy(np.ascontiguousarray(image_np.transpose(2, 0, 1))),
                torch.from_numpy(np.ascontiguousarray(mask_np))[None])
