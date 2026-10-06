"""Shared helpers for the training scripts."""

from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import torch
import yaml
from torch.utils.data import DataLoader

from cropcare_ai.data.manifest import Row, read_manifest, select
from cropcare_ai.settings import SERVICE_DIR


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def pick_device(requested: str | None = None) -> str:
    if requested:
        return requested
    return "cuda" if torch.cuda.is_available() else "cpu"


def resolve_path(path: str | Path) -> Path:
    path = Path(path)
    return path if path.is_absolute() else SERVICE_DIR / path


def load_config(path: str | Path) -> dict:
    return yaml.safe_load(resolve_path(path).read_text(encoding="utf-8"))


def load_sources(sources: list[dict]) -> list[Row]:
    """sources: [{manifest: data/manifests/plantvillage.csv, split: train}, ...]"""
    rows: list[Row] = []
    for source in sources:
        path = resolve_path(source["manifest"])
        if not path.exists():
            print(f"WARNING: {source['manifest']} not found, skipping it (prepare it with cropcare_ai.data.prepare)")
            continue
        rows.extend(select(read_manifest(path), source.get("split")))
    return rows


def forward(model: torch.nn.Module, images: torch.Tensor, tta: bool = False) -> torch.Tensor:
    """Logits; with tta, averaged with the horizontally flipped images (test-time augmentation)."""
    logits = model(images).float()
    if tta:
        logits = (logits + model(torch.flip(images, dims=[3])).float()) / 2
    return logits


@torch.no_grad()
def collect_logits(model: torch.nn.Module, loader: DataLoader, device: str,
                   tta: bool = False) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    all_logits, all_labels = [], []
    for images, labels in loader:
        all_logits.append(forward(model, images.to(device), tta).cpu())
        all_labels.append(labels)
    return torch.cat(all_logits).numpy(), torch.cat(all_labels).numpy()
