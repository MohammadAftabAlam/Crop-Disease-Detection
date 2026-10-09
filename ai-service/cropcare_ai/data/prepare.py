"""Build a manifest from a dataset folder.

Two layouts are supported (default "auto" picks the right one):
  random  <root>/<class folder>/*.jpg                  -> split 80/10/10 per class
  keep    <root>/<train|val|test>/<class folder>/*.jpg -> keep the dataset's own splits
                                                          (PlantDoc ships train/ and test/)

--search looks below --root for the folder that holds the class folders, so on Kaggle
you can pass the dataset's top folder (e.g. /kaggle/input/rice-leaf-disease-image).

Examples (run from the ai-service folder):
  python -m cropcare_ai.data.prepare --name plantvillage --root "D:/data/plantvillage/color"
  python -m cropcare_ai.data.prepare --name plantdoc --root "D:/data/PlantDoc-Dataset" --layout keep
  python -m cropcare_ai.data.prepare --name rice --root /kaggle/input/rice-leaf-disease-image --crop rice --search
  python -m cropcare_ai.data.prepare --name field --root "D:/data/our_field_photos" --all-test

Folders that are not in configs/taxonomy.yaml (e.g. PlantDoc's apple classes) are listed and skipped.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from cropcare_ai.data.manifest import (
    IMAGE_EXTENSIONS, Row, file_hashes, stratified_split, summarize, write_manifest,
)
from cropcare_ai.settings import SERVICE_DIR, get_settings
from cropcare_ai.taxonomy import Taxonomy

SPLIT_ALIASES = {"train": "train", "training": "train", "val": "val", "valid": "val",
                 "validation": "val", "test": "test", "testing": "test"}


def list_images(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS)


def split_dirs_of(folder: Path) -> list[tuple[Path, str]]:
    return [(d, SPLIT_ALIASES[d.name.lower()]) for d in sorted(folder.iterdir())
            if d.is_dir() and d.name.lower() in SPLIT_ALIASES]


def mapped_children(folder: Path, taxonomy: Taxonomy, crop: str | None) -> int:
    return sum(1 for d in folder.iterdir() if d.is_dir() and taxonomy.resolve(d.name, crop))


def find_dataset_root(root: Path, taxonomy: Taxonomy, crop: str | None, max_depth: int = 5) -> tuple[Path, str]:
    """Find the folder below `root` whose sub-folders are our classes (or train/val/test splits of them)."""
    best, best_score, best_layout = root, 0, "random"
    for current, dirs, _ in os.walk(root):
        folder = Path(current)
        if len(folder.relative_to(root).parts) > max_depth:
            dirs.clear()
            continue
        splits = split_dirs_of(folder)
        if splits:
            score, layout = sum(mapped_children(d, taxonomy, crop) for d, _ in splits), "keep"
        else:
            score, layout = mapped_children(folder, taxonomy, crop), "random"
        if score > best_score:
            best, best_score, best_layout = folder, score, layout
    if best_score == 0:
        raise SystemExit(f"No class folders found below {root} (crop={crop}). Check the dataset or --crop.")
    return best, best_layout


def collect(root: Path, layout: str, taxonomy: Taxonomy, crop: str | None) -> tuple[list[tuple[Path, str, str | None]], set[str]]:
    """Return [(image path, class id, split or None)] and the set of unmapped folder names."""
    found: list[tuple[Path, str, str | None]] = []
    unmapped: set[str] = set()

    if layout == "keep":
        split_dirs = split_dirs_of(root)
        if not split_dirs:
            raise SystemExit(f"--layout keep expects train/ val/ test/ folders inside {root}")
    else:
        split_dirs = [(root, None)]

    for split_dir, split in split_dirs:
        for class_dir in sorted(d for d in split_dir.iterdir() if d.is_dir()):
            class_id = taxonomy.resolve(class_dir.name, crop)
            if class_id is None:
                unmapped.add(class_dir.name)
                continue
            found.extend((image, class_id, split) for image in list_images(class_dir))
    return found, unmapped


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name", required=True, help="Source name stored in the manifest, e.g. plantvillage")
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--layout", choices=["auto", "random", "keep"], default="auto")
    parser.add_argument("--search", action="store_true", help="Find the class folders anywhere below --root")
    parser.add_argument("--crop", help="Crop key for crop-specific datasets (rice, wheat, maize, ...)")
    parser.add_argument("--all-test", action="store_true", help="Put every image in the test split (field photos)")
    parser.add_argument("--val-from-train", type=float, default=0.0,
                        help="With --layout keep: move this fraction of train into val/calib (e.g. 0.2)")
    parser.add_argument("--min-class-images", type=int, default=0,
                        help="Drop classes with fewer images than this (too few to learn from); 0 keeps all")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=Path, help="Default: data/manifests/<name>.csv")
    args = parser.parse_args(argv)

    taxonomy = Taxonomy.load(get_settings().taxonomy_path)
    if args.crop and args.crop not in {c.crop for c in taxonomy.classes.values()}:
        parser.error(f"Unknown crop '{args.crop}'")

    root, layout = args.root, args.layout
    if args.search:
        root, found_layout = find_dataset_root(root, taxonomy, args.crop)
        layout = found_layout if layout == "auto" else layout
        print(f"Using class folders in {root} (layout: {layout})")
    elif layout == "auto":
        layout = "keep" if split_dirs_of(root) else "random"

    found, unmapped = collect(root, layout, taxonomy, args.crop)
    if not found:
        raise SystemExit("No images matched any class. Check --root, --layout and --crop.")

    # Exact duplicates leak between splits, so keep the first copy only
    rows: list[Row] = []
    seen: set[str] = set()
    duplicates = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        hashes = list(pool.map(file_hashes, [path for path, _, _ in found]))
    for (path, class_id, split), (sha1, dhash) in zip(found, hashes):
        if sha1 in seen:
            duplicates += 1
            continue
        seen.add(sha1)
        rows.append(Row(str(path.resolve()), class_id, args.name, split or "", sha1, dhash))

    # Classes too small to learn from would only add noise
    small = {}
    if args.min_class_images > 0:
        counts = {}
        for r in rows:
            counts[r.class_id] = counts.get(r.class_id, 0) + 1
        small = {c: n for c, n in counts.items() if n < args.min_class_images}
        rows = [r for r in rows if r.class_id not in small]
        if not rows:
            raise SystemExit("Every class is below --min-class-images.")

    if args.all_test:
        rows = [dataclasses.replace(r, split="test") for r in rows]
    elif layout == "random":
        assignment = stratified_split([(Path(r.path), r.class_id) for r in rows],
                                      {"train": 0.8, "val": 0.1, "test": 0.1}, args.seed)
        rows = [dataclasses.replace(r, split=assignment[Path(r.path)]) for r in rows]
    else:
        if not any(r.split == "val" for r in rows) and args.val_from_train > 0:
            train = [r for r in rows if r.split == "train"]
            assignment = stratified_split([(Path(r.path), r.class_id) for r in train],
                                          {"train": 1 - args.val_from_train, "val": args.val_from_train}, args.seed)
            rows = [dataclasses.replace(r, split=assignment[Path(r.path)]) if r.split == "train" else r for r in rows]

    out = args.out or SERVICE_DIR / "data" / "manifests" / f"{args.name}.csv"
    write_manifest(rows, out)

    summary = summarize(rows)
    summary.update({"duplicates_removed": duplicates, "unmapped_folders": sorted(unmapped), "root": str(root),
                    "dropped_small_classes": small,
                    "layout": layout})
    out.with_suffix(".summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"Wrote {len(rows)} images to {out}")
    print("Splits:", summary["splits"])
    print("Classes:", len(summary["classes"]))
    print("Duplicates removed:", duplicates)
    if unmapped:
        print("Skipped folders (not in taxonomy):", ", ".join(sorted(unmapped)))
    if small:
        print(f"Dropped classes with fewer than {args.min_class_images} images:", small)


if __name__ == "__main__":
    main()
