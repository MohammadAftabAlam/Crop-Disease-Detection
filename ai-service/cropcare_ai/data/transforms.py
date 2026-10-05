"""Image transforms. Training uses heavy augmentation to imitate field photos
(random crops, lighting changes, blur, JPEG artefacts) so the model relies less
on PlantVillage's clean lab look."""

from __future__ import annotations

import torch
from torchvision.transforms import v2 as T

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def _to_tensor(mean, std):
    return [T.ToImage(), T.ToDtype(torch.float32, scale=True), T.Normalize(mean, std)]


def train_transform(size: int, mean=IMAGENET_MEAN, std=IMAGENET_STD) -> T.Compose:
    field_like = [
        T.RandomResizedCrop(size, scale=(0.35, 1.0), ratio=(0.75, 1.33), antialias=True),
        T.RandomHorizontalFlip(),
        T.RandomVerticalFlip(),
        T.RandomApply([T.RandomRotation(25)], p=0.4),
        T.ColorJitter(brightness=0.35, contrast=0.35, saturation=0.35, hue=0.04),
        T.RandomApply([T.GaussianBlur(kernel_size=5, sigma=(0.1, 2.0))], p=0.25),
        T.RandomGrayscale(p=0.03),
    ]
    if hasattr(T, "JPEG"):
        field_like.append(T.RandomApply([T.JPEG((40, 95))], p=0.3))
    return T.Compose([T.ToImage(), *field_like, *_to_tensor(mean, std)[1:],
                      T.RandomErasing(p=0.2, scale=(0.02, 0.12))])


def eval_transform(size: int, mean=IMAGENET_MEAN, std=IMAGENET_STD) -> T.Compose:
    # Plain resize (no centre crop) so lesions near the leaf edge are not cut off
    return T.Compose([T.ToImage(), T.Resize((size, size), antialias=True), *_to_tensor(mean, std)[1:]])
