"""Builds a tiny synthetic dataset and trains a tiny model once per test session (CPU, ~1 minute)."""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from cropcare_ai.data import prepare
from cropcare_ai.models.bundle import SegmenterBundle, create_segmenter, save_segmenter
from cropcare_ai.settings import Settings
from cropcare_ai.training import calibrate, evaluate, train_classifier

# Folder names as the real datasets spell them
PLANTVILLAGE_FOLDERS = {"Tomato_Late_blight": 0, "Tomato_healthy": 1, "Potato___Early_blight": 2}
PLANTDOC_FOLDERS = {"Tomato leaf late blight": 0, "Tomato leaf": 1, "Potato leaf early blight": 2, "Apple Scab Leaf": 3}
COLORS = [(150, 60, 40), (40, 160, 50), (170, 150, 40), (90, 90, 200)]


def leaf_image(color_index: int, seed: int, size: int = 72) -> Image.Image:
    rng = np.random.default_rng(seed)
    base = np.array(COLORS[color_index], dtype=np.float32)
    pixels = base + rng.normal(0, 18, (size, size, 3))
    return Image.fromarray(pixels.clip(0, 255).astype(np.uint8))


def image_bytes(color_index: int, seed: int = 0, fmt: str = "JPEG") -> bytes:
    buffer = io.BytesIO()
    leaf_image(color_index, seed).save(buffer, format=fmt)
    return buffer.getvalue()


@pytest.fixture(scope="session")
def workspace(tmp_path_factory) -> Path:
    root = tmp_path_factory.mktemp("cropcare")

    for folder, color in PLANTVILLAGE_FOLDERS.items():
        target = root / "plantvillage" / folder
        target.mkdir(parents=True)
        for i in range(30):
            leaf_image(color, seed=color * 1000 + i).save(target / f"{i}.jpg")
    # An exact duplicate that prepare must drop
    (root / "plantvillage" / "Tomato_healthy" / "dup.jpg").write_bytes(
        (root / "plantvillage" / "Tomato_healthy" / "0.jpg").read_bytes())

    for split, count in (("train", 12), ("test", 8)):
        for folder, color in PLANTDOC_FOLDERS.items():
            target = root / "plantdoc" / split / folder
            target.mkdir(parents=True)
            for i in range(count):
                leaf_image(color, seed=50_000 + color * 1000 + i + (500 if split == "test" else 0)).save(target / f"{i}.png")

    manifests = root / "manifests"
    prepare.main(["--name", "plantvillage", "--root", str(root / "plantvillage"),
                  "--out", str(manifests / "plantvillage.csv")])
    prepare.main(["--name", "plantdoc", "--root", str(root / "plantdoc"), "--layout", "keep",
                  "--val-from-train", "0.25", "--out", str(manifests / "plantdoc.csv")])

    model_dir = root / "classifier"
    train_classifier.train({
        "model": "resnet10t", "pretrained": False, "image_size": 64, "epochs": 3, "freeze_epochs": 0,
        "batch_size": 16, "lr": 3e-3, "num_workers": 0, "warmup_epochs": 0, "device": "cpu",
        "train": [{"manifest": str(manifests / "plantvillage.csv"), "split": "train"},
                  {"manifest": str(manifests / "plantdoc.csv"), "split": "train"}],
        "val": [{"manifest": str(manifests / "plantvillage.csv"), "split": "val"}],
        "check_leakage_against": [{"manifest": str(manifests / "plantdoc.csv"), "split": "test"}],
        "output": str(model_dir),
    })
    calibrate.main(["--model-dir", str(model_dir), "--manifest", str(manifests / "plantdoc.csv"),
                    "--split", "val", "--num-workers", "0", "--device", "cpu"])
    evaluate.main(["--model-dir", str(model_dir), "--manifest", str(manifests / "plantdoc.csv"),
                   "--name", "plantdoc_test", "--description", "PlantDoc test (field)", "--num-workers", "0",
                   "--device", "cpu"])

    # Untrained but valid severity model, enough to exercise the pipeline
    severity_dir = root / "severity"
    bundle = SegmenterBundle(encoder="resnet18", image_size=64)
    save_segmenter(create_segmenter(bundle, pretrained=False), bundle, severity_dir)
    return root


@pytest.fixture(scope="session")
def settings(workspace: Path) -> Settings:
    return Settings(classifier_dir=workspace / "classifier", severity_dir=workspace / "severity", gate="energy")
