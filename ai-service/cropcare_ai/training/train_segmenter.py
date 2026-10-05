"""Train the lesion segmentation model used for severity (% of leaf area diseased).

PlantSeg (COCO annotations):
  python -m cropcare_ai.training.train_segmenter \\
      --train-coco PlantSeg/annotations/train.json --train-images PlantSeg/images/train \\
      --val-coco PlantSeg/annotations/val.json --val-images PlantSeg/images/val

Image + mask folders (mask pixels > 0 = lesion, same file name as the image):
  python -m cropcare_ai.training.train_segmenter --train-masks imgs/ masks/ --val-masks val_imgs/ val_masks/
"""

from __future__ import annotations

import argparse
import time

import torch
from torch import nn
from torch.utils.data import DataLoader

from cropcare_ai.data.datasets import LesionSegmentationDataset
from cropcare_ai.models.bundle import SegmenterBundle, create_segmenter, save_segmenter
from cropcare_ai.settings import get_settings
from cropcare_ai.training.common import pick_device, resolve_path, seed_everything


def dice_loss(logits: torch.Tensor, target: torch.Tensor, eps: float = 1.0) -> torch.Tensor:
    probs = torch.sigmoid(logits)
    intersection = (probs * target).sum(dim=(1, 2, 3))
    union = probs.sum(dim=(1, 2, 3)) + target.sum(dim=(1, 2, 3))
    return (1 - (2 * intersection + eps) / (union + eps)).mean()


@torch.no_grad()
def validate(model: nn.Module, loader: DataLoader, device: str) -> dict:
    model.eval()
    intersection = union = 0.0
    abs_error, count = 0.0, 0
    for images, masks in loader:
        images, masks = images.to(device), masks.to(device)
        predicted = (torch.sigmoid(model(images)) > 0.5).float()
        intersection += (predicted * masks).sum().item()
        union += ((predicted + masks) > 0).float().sum().item()
        # Lesion-area error, the quantity severity is built on
        abs_error += (predicted.mean(dim=(1, 2, 3)) - masks.mean(dim=(1, 2, 3))).abs().sum().item()
        count += len(images)
    return {"iou": intersection / max(union, 1.0), "area_mae": abs_error / max(count, 1)}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--train-coco"), parser.add_argument("--train-images")
    parser.add_argument("--val-coco"), parser.add_argument("--val-images")
    parser.add_argument("--train-masks", nargs=2, metavar=("IMAGES", "MASKS"))
    parser.add_argument("--val-masks", nargs=2, metavar=("IMAGES", "MASKS"))
    parser.add_argument("--architecture", default="Unet")
    parser.add_argument("--encoder", default="resnet18")
    parser.add_argument("--image-size", type=int, default=384)
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=12)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--num-workers", type=int, default=4)
    parser.add_argument("--no-pretrained", action="store_true")
    parser.add_argument("--max-steps-per-epoch", type=int)
    parser.add_argument("--output", default=str(get_settings().severity_dir))
    parser.add_argument("--device")
    args = parser.parse_args(argv)

    seed_everything(42)
    device = pick_device(args.device)

    def dataset(coco_file, image_dir, mask_dirs, augment):
        if coco_file:
            return LesionSegmentationDataset(args.image_size, coco=(coco_file, image_dir), augment=augment)
        return LesionSegmentationDataset(args.image_size, mask_dirs=mask_dirs, augment=augment)

    train_set = dataset(args.train_coco, args.train_images, args.train_masks, True)
    val_set = dataset(args.val_coco, args.val_images, args.val_masks, False)
    print(f"{len(train_set)} train / {len(val_set)} val images, device={device}")

    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, drop_last=True,
                              num_workers=args.num_workers, pin_memory=device == "cuda")
    val_loader = DataLoader(val_set, batch_size=args.batch_size, num_workers=args.num_workers)

    bundle = SegmenterBundle(architecture=args.architecture, encoder=args.encoder, image_size=args.image_size)
    model = create_segmenter(bundle, pretrained=not args.no_pretrained).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    bce = nn.BCEWithLogitsLoss()
    use_amp = device == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    best_iou, history = -1.0, []
    output = resolve_path(args.output)
    for epoch in range(args.epochs):
        model.train()
        started, total = time.time(), 0.0
        for step, (images, masks) in enumerate(train_loader):
            if args.max_steps_per_epoch and step >= args.max_steps_per_epoch:
                break
            images, masks = images.to(device), masks.to(device)
            with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=use_amp):
                logits = model(images)
                loss = bce(logits, masks) + dice_loss(logits.float(), masks)
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            total += loss.item()
        scheduler.step()

        scores = validate(model, val_loader, device)
        record = {"epoch": epoch + 1, "train_loss": total / max(step + 1, 1), **scores,
                  "seconds": round(time.time() - started, 1)}
        history.append(record)
        print(record)

        if scores["iou"] > best_iou:
            best_iou = scores["iou"]
            bundle.training = {"best_val_iou": best_iou, "best_epoch": epoch + 1, "history": history,
                               "train_images": len(train_set), "val_images": len(val_set)}
            save_segmenter(model, bundle, output)

    print(f"Best val IoU {best_iou:.4f}. Saved to {output}")


if __name__ == "__main__":
    main()
