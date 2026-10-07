"""Train a disease classifier from a YAML config.

  python -m cropcare_ai.training.train_classifier --config configs/train/convnext_tiny.yaml

Stage 1 (freeze_epochs): only the new classification head learns.
Stage 2: the whole network is fine-tuned, with a smaller learning rate for the backbone.
The checkpoint with the best validation macro-F1 is kept.
"""

from __future__ import annotations

import argparse
import math
import time
from collections import Counter
from pathlib import Path

import torch
import yaml
from torch import nn
from torch.utils.data import DataLoader

from cropcare_ai.data.datasets import ManifestDataset, balanced_sampler
from cropcare_ai.data.manifest import near_duplicates
from cropcare_ai.data.transforms import eval_transform, train_transform
from cropcare_ai.models.bundle import ClassifierBundle, create_classifier, read_json, save_classifier, write_json
from cropcare_ai.settings import get_settings
from cropcare_ai.taxonomy import Taxonomy
from cropcare_ai.training.common import (
    collect_logits, load_config, load_sources, pick_device, resolve_path, seed_everything,
)
from cropcare_ai.training.metrics import macro_f1

DEFAULTS = {
    "image_size": 224,
    "epochs": 15,
    "freeze_epochs": 1,
    "batch_size": 32,
    "lr": 1e-3,
    "backbone_lr_mult": 0.1,
    "weight_decay": 0.05,
    "label_smoothing": 0.1,
    "warmup_epochs": 1,
    "sampling": "class_source",     # class_source | class | none
    "balanced_sampling": True,     # old name; false means sampling: none
    "patience": 4,
    "num_workers": 4,
    "pretrained": True,
    "seed": 42,
    "max_steps_per_epoch": None,   # only for quick smoke tests
    "check_leakage_against": [],   # manifests whose test/val images must not be in train
    "near_duplicate_distance": 4,  # dhash bits; -1 = exact copies only
    "model_kwargs": {},            # extra timm arguments, e.g. {img_size: 224} for DINOv2
}


def set_backbone_trainable(model: nn.Module, trainable: bool) -> None:
    head = set(model.get_classifier().parameters())
    for param in model.parameters():
        if param not in head:
            param.requires_grad = trainable


def build_optimizer(model: nn.Module, cfg: dict) -> torch.optim.Optimizer:
    head = list(model.get_classifier().parameters())
    head_ids = {id(p) for p in head}
    backbone = [p for p in model.parameters() if id(p) not in head_ids]
    return torch.optim.AdamW([
        {"params": backbone, "lr": cfg["lr"] * cfg["backbone_lr_mult"]},
        {"params": head, "lr": cfg["lr"]},
    ], weight_decay=cfg["weight_decay"])


def cosine_with_warmup(optimizer, warmup_steps: int, total_steps: int):
    def factor(step: int) -> float:
        if step < warmup_steps:
            return (step + 1) / max(warmup_steps, 1)
        progress = (step - warmup_steps) / max(total_steps - warmup_steps, 1)
        return 0.5 * (1 + math.cos(math.pi * min(progress, 1.0)))
    return torch.optim.lr_scheduler.LambdaLR(optimizer, factor)


def train(cfg: dict) -> Path:
    cfg = {**DEFAULTS, **cfg}
    seed_everything(cfg["seed"])
    device = pick_device(cfg.get("device"))
    taxonomy = Taxonomy.load(get_settings().taxonomy_path)

    train_rows = load_sources(cfg["train"])
    val_rows = load_sources(cfg["val"])

    # Drop training images that are (near-)copies of any validation/test image, e.g. the same
    # web photo in PlantWild-train and PlantDoc-test. Otherwise field accuracy is inflated.
    reference_rows = val_rows + load_sources(cfg["check_leakage_against"])
    duplicate = near_duplicates(train_rows, reference_rows, cfg["near_duplicate_distance"])
    removed = Counter(row.source for row, dup in zip(train_rows, duplicate) if dup)
    train_rows = [row for row, dup in zip(train_rows, duplicate) if not dup]
    if removed:
        print(f"Removed {sum(removed.values())} training images that duplicate validation/test images: {dict(removed)}")

    # Classes = taxonomy classes that have training images, in taxonomy order
    present = {row.class_id for row in train_rows}
    class_ids = [class_id for class_id in taxonomy.classes if class_id in present]
    print(f"{len(class_ids)} classes, {len(train_rows)} train / {len(val_rows)} val images, device={device}")

    size = cfg["image_size"]
    train_set = ManifestDataset(train_rows, class_ids, train_transform(size))
    val_set = ManifestDataset(val_rows, class_ids, eval_transform(size))
    if val_set.dropped:
        print(f"Note: {val_set.dropped} validation images belong to classes without training data and are skipped")

    sampling = cfg["sampling"] if cfg["balanced_sampling"] else "none"
    if sampling == "class_source":
        sampler = balanced_sampler(train_set.labels(), train_set.sources)
    elif sampling == "class":
        sampler = balanced_sampler(train_set.labels())
    else:
        sampler = None
    train_loader = DataLoader(train_set, batch_size=cfg["batch_size"], sampler=sampler, shuffle=sampler is None,
                              num_workers=cfg["num_workers"], pin_memory=device == "cuda", drop_last=True,
                              persistent_workers=cfg["num_workers"] > 0)
    val_loader = DataLoader(val_set, batch_size=cfg["batch_size"] * 2, num_workers=cfg["num_workers"],
                            pin_memory=device == "cuda")

    model = create_classifier(cfg["model"], len(class_ids), pretrained=cfg["pretrained"], **cfg["model_kwargs"]).to(device)
    data_cfg = model.pretrained_cfg if hasattr(model, "pretrained_cfg") else {}
    mean = tuple(data_cfg.get("mean", (0.485, 0.456, 0.406)))
    std = tuple(data_cfg.get("std", (0.229, 0.224, 0.225)))
    if (mean, std) != ((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)):
        train_set.transform = train_transform(size, mean, std)
        val_set.transform = eval_transform(size, mean, std)

    steps_per_epoch = len(train_loader)
    if cfg["max_steps_per_epoch"]:
        steps_per_epoch = min(steps_per_epoch, cfg["max_steps_per_epoch"])

    optimizer = build_optimizer(model, cfg)
    scheduler = cosine_with_warmup(optimizer, cfg["warmup_epochs"] * steps_per_epoch, cfg["epochs"] * steps_per_epoch)
    criterion = nn.CrossEntropyLoss(label_smoothing=cfg["label_smoothing"])
    use_amp = device == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    output = resolve_path(cfg["output"])
    best_f1, best_epoch, history = -1.0, -1, []

    for epoch in range(cfg["epochs"]):
        set_backbone_trainable(model, epoch >= cfg["freeze_epochs"])
        model.train()
        started, total_loss, correct, seen = time.time(), 0.0, 0, 0

        for step, (images, labels) in enumerate(train_loader):
            if step >= steps_per_epoch:
                break
            images, labels = images.to(device, non_blocking=True), labels.to(device, non_blocking=True)
            with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=use_amp):
                logits = model(images)
                loss = criterion(logits, labels)
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()

            total_loss += loss.item() * len(labels)
            correct += (logits.argmax(1) == labels).sum().item()
            seen += len(labels)

        logits, labels = collect_logits(model, val_loader, device)
        predictions = logits.argmax(1)
        val_acc = float((predictions == labels).mean()) if len(labels) else 0.0
        val_f1 = macro_f1(labels, predictions, len(class_ids)) if len(labels) else 0.0

        record = {"epoch": epoch + 1, "train_loss": total_loss / max(seen, 1), "train_acc": correct / max(seen, 1),
                  "val_acc": val_acc, "val_macro_f1": val_f1, "seconds": round(time.time() - started, 1)}
        history.append(record)
        print(" | ".join(f"{k}={v:.4f}" if isinstance(v, float) else f"{k}={v}" for k, v in record.items()))

        if val_f1 > best_f1:
            best_f1, best_epoch = val_f1, epoch + 1
            bundle = ClassifierBundle(
                architecture=cfg["model"], class_ids=class_ids, image_size=size, mean=mean, std=std,
                model_kwargs=cfg["model_kwargs"],
                training={"config": {k: v for k, v in cfg.items() if k not in ("train", "val")},
                          "train_sources": cfg["train"], "val_sources": cfg["val"],
                          "train_images": len(train_set), "val_images": len(val_set),
                          "train_images_by_source": dict(Counter(train_set.sources)),
                          "removed_duplicates": dict(removed),
                          "best_epoch": best_epoch, "best_val_macro_f1": best_f1, "history": history},
            )
            save_classifier(model, bundle, output)
        elif epoch + 1 - best_epoch >= cfg["patience"]:
            print(f"Stopping early: no improvement for {cfg['patience']} epochs")
            break

    # Keep the full history in the saved bundle
    info = read_json(output / "bundle.json")
    info["training"]["history"] = history
    write_json(info, output / "bundle.json")

    print(f"Best val macro-F1 {best_f1:.4f} at epoch {best_epoch}. Saved to {output}")
    print("Next: python -m cropcare_ai.training.calibrate, then python -m cropcare_ai.training.evaluate")
    return output


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", required=True)
    parser.add_argument("--set", nargs="*", default=[], metavar="KEY=VALUE",
                        help="Override config values, e.g. --set epochs=3 batch_size=16")
    args = parser.parse_args(argv)

    cfg = load_config(args.config)
    for item in args.set:
        key, value = item.split("=", 1)
        cfg[key] = yaml.safe_load(value)
    train(cfg)


if __name__ == "__main__":
    main()
