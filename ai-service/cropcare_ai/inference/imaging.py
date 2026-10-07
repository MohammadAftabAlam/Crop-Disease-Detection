"""Image decoding, preprocessing and overlay rendering."""

from __future__ import annotations

import base64
import io

import numpy as np
import torch
from PIL import Image, ImageOps, UnidentifiedImageError

OVERLAY_MAX_SIDE = 512


class InvalidImage(ValueError):
    pass


def decode(data: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError) as error:
        raise InvalidImage("The uploaded file is not a readable image.") from error
    # Phone photos store rotation in EXIF; apply it so the leaf is upright
    return ImageOps.exif_transpose(image).convert("RGB")


def to_tensor(image: Image.Image, size: int, mean, std) -> torch.Tensor:
    resized = image.resize((size, size), Image.Resampling.BILINEAR)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    array = (array - np.asarray(mean, dtype=np.float32)) / np.asarray(std, dtype=np.float32)
    return torch.from_numpy(array.transpose(2, 0, 1).copy())


def thumbnail(image: Image.Image) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((OVERLAY_MAX_SIDE, OVERLAY_MAX_SIDE))
    return copy


def _jet(values: np.ndarray) -> np.ndarray:
    """Blue (0) -> green -> red (1) colour map, without matplotlib."""
    v = np.clip(values, 0, 1)
    r = np.clip(1.5 - np.abs(4 * v - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * v - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * v - 1), 0, 1)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def heatmap_overlay(image: Image.Image, heat: np.ndarray, alpha: float = 0.45) -> Image.Image:
    base = thumbnail(image)
    heat_image = Image.fromarray((np.clip(heat, 0, 1) * 255).astype(np.uint8)).resize(base.size, Image.Resampling.BILINEAR)
    colored = Image.fromarray(_jet(np.asarray(heat_image, dtype=np.float32) / 255.0))
    return Image.blend(base, colored, alpha)


def mask_overlay(image: Image.Image, mask: np.ndarray, color=(220, 38, 38), alpha: float = 0.5) -> Image.Image:
    base = thumbnail(image)
    mask_image = Image.fromarray((mask > 0).astype(np.uint8) * 255).resize(base.size, Image.Resampling.NEAREST)
    tint = Image.new("RGB", base.size, color)
    blended = Image.blend(base, tint, alpha)
    return Image.composite(blended, base, mask_image)


def to_data_uri(image: Image.Image) -> str:
    # JPEG keeps overlays small (tens of KB instead of hundreds for PNG)
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
