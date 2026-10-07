"""A trained model is saved as a folder ("bundle"):

  model.pt          weights (state_dict)
  bundle.json       architecture, classes, image size, normalisation, training info
  calibration.json  temperature + conformal threshold + energy threshold (after calibrate)
  metrics/*.json    one file per evaluated test set (after evaluate)
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import timm
import torch
from torch import nn

from cropcare_ai.data.transforms import IMAGENET_MEAN, IMAGENET_STD


@dataclass
class ClassifierBundle:
    architecture: str                 # timm model name, e.g. "convnext_tiny.fb_in22k"
    class_ids: list[str]
    image_size: int
    mean: tuple = IMAGENET_MEAN
    std: tuple = IMAGENET_STD
    model_kwargs: dict = field(default_factory=dict)   # extra timm arguments, e.g. {"img_size": 224}
    training: dict = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))


def create_classifier(architecture: str, num_classes: int, pretrained: bool = True, **model_kwargs) -> nn.Module:
    return timm.create_model(architecture, pretrained=pretrained, num_classes=num_classes, **model_kwargs)


def save_classifier(model: nn.Module, bundle: ClassifierBundle, directory: str | Path) -> Path:
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), directory / "model.pt")
    (directory / "bundle.json").write_text(json.dumps(asdict(bundle), indent=2), encoding="utf-8")
    return directory


def load_classifier(directory: str | Path, device: str = "cpu") -> tuple[nn.Module, ClassifierBundle]:
    directory = Path(directory)
    info = json.loads((directory / "bundle.json").read_text(encoding="utf-8"))
    bundle = ClassifierBundle(**{**info, "mean": tuple(info["mean"]), "std": tuple(info["std"])})
    model = create_classifier(bundle.architecture, len(bundle.class_ids), pretrained=False, **bundle.model_kwargs)
    model.load_state_dict(torch.load(directory / "model.pt", map_location=device, weights_only=True))
    return model.to(device).eval(), bundle


def read_json(path: Path) -> dict | None:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def write_json(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Lesion segmentation model (severity)
# ---------------------------------------------------------------------------

@dataclass
class SegmenterBundle:
    architecture: str = "Unet"
    encoder: str = "resnet18"
    image_size: int = 384
    training: dict = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))


def create_segmenter(bundle: SegmenterBundle, pretrained: bool = True) -> nn.Module:
    import segmentation_models_pytorch as smp

    model_class = getattr(smp, bundle.architecture)
    return model_class(encoder_name=bundle.encoder, encoder_weights="imagenet" if pretrained else None,
                       in_channels=3, classes=1)


def save_segmenter(model: nn.Module, bundle: SegmenterBundle, directory: str | Path) -> Path:
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), directory / "model.pt")
    (directory / "bundle.json").write_text(json.dumps(asdict(bundle), indent=2), encoding="utf-8")
    return directory


def load_segmenter(directory: str | Path, device: str = "cpu") -> tuple[nn.Module, SegmenterBundle]:
    directory = Path(directory)
    bundle = SegmenterBundle(**json.loads((directory / "bundle.json").read_text(encoding="utf-8")))
    model = create_segmenter(bundle, pretrained=False)
    model.load_state_dict(torch.load(directory / "model.pt", map_location=device, weights_only=True))
    return model.to(device).eval(), bundle
