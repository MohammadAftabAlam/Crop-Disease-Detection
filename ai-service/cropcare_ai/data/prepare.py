"""Build a manifest from a dataset folder.

Two layouts are supported:
  random  <root>/<class folder>/*.jpg                  -> split 80/10/10 per class
  keep    <root>/<train|val|test>/<class folder>/*.jpg -> keep the dataset's own splits
                                                          (PlantDoc ships train/ and test/)

Examples (run from the ai-service folder):
  python -m cropcare_ai.data.prepare --name plantvillage --root "D:/data/plantvillage/color"
  python -m cropcare_ai.data.prepare --name plantdoc --root "D:/data/PlantDoc-Dataset" --layout keep
  python -m cropcare_ai.data.prepare --name rice --root "D:/data/rice" --crop rice
  python -m cropcare_ai.data.prepare --name field --root "D:/data/our_field_photos" --all-test

Folders that are not in configs/taxonomy.yaml (e.g. PlantDoc's apple classes) are listed and skipped.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from cropcare_ai.data.manifest import (
    IMAGE_EXTENSIONS, Row, file_sha1, stratified_split, summarize, write_manifest,
)
from cropcare_ai.settings import SERVICE_DIR, get_settings
from cropcare_ai.taxonomy import Taxonomy

SPLIT_ALIASES = {"train": "train", "training": "train", "val": "val", "valid": "val",
                 "validation": "val", "test": "test", "testing": "test"}


def list_images(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS)


def collect(root: Path, layout: str, taxonomy: Taxonomy, crop: str | None) -> tuple[list[tuple[Path, str, str | None]], set[str]]:
    """Return [(image path, class id, split or None)] and the set of unmapped folder names."""
    found: list[tuple[Path, str, str | None]] = []
    unmapped: set[str] = set()

    if layout == "keep":
        split_dirs = [(d, SPLIT_ALIASES[d.name.lower()]) for d in sorted(root.iterdir())
                      if d.is_dir() and d.name.lower() in SPLIT_ALIASES]
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
    parser.add_argument("--layout", choices=["random", "keep"], default="random")
    parser.add_argument("--crop", help="Crop key for crop-specific datasets (rice, wheat, maize, ...)")
    parser.add_argument("--all-test", action="store_true", help="Put every image in the test split (field photos)")
    parser.add_argument("--val-from-train", type=float, default=0.0,
                        help="With --layout keep: move this fraction of train into val/calib (e.g. 0.2)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=Path, help="Default: data/manifests/<name>.csv")
    args = parser.parse_args(argv)

    taxonomy = Taxonomy.load(get_settings().taxonomy_path)
    if args.crop and args.crop not in {c.crop for c in taxonomy.classes.values()}:
        parser.error(f"Unknown crop '{args.crop}'")

    found, unmapped = collect(args.root, args.layout, taxonomy, args.crop)
    if not found:
        raise SystemExit("No images matched any class. Check --root, --layout and --crop.")

    # Exact duplicates leak between splits, so keep the first copy only
    rows: list[Row] = []
    seen: set[str] = set()
    duplicates = 0
    hashed = [(path, class_id, split, file_sha1(path)) for path, class_id, split in found]
    for path, class_id, split, sha1 in hashed:
        if sha1 in seen:
            duplicates += 1
            continue
        seen.add(sha1)
        rows.append(Row(str(path.resolve()), class_id, args.name, split or "", sha1))

    if args.all_test:
        rows = [Row(r.path, r.class_id, r.source, "test", r.sha1) for r in rows]
    elif args.layout == "random":
        assignment = stratified_split([(Path(r.path), r.class_id) for r in rows],
                                      {"train": 0.8, "val": 0.1, "test": 0.1}, args.seed)
        rows = [Row(r.path, r.class_id, r.source, assignment[Path(r.path)], r.sha1) for r in rows]
    elif args.val_from_train > 0:
        train = [r for r in rows if r.split == "train"]
        assignment = stratified_split([(Path(r.path), r.class_id) for r in train],
                                      {"train": 1 - args.val_from_train, "val": args.val_from_train}, args.seed)
        rows = [Row(r.path, r.class_id, r.source, assignment[Path(r.path)], r.sha1) if r.split == "train" else r
                for r in rows]

    out = args.out or SERVICE_DIR / "data" / "manifests" / f"{args.name}.csv"
    write_manifest(rows, out)

    summary = summarize(rows)
    summary.update({"duplicates_removed": duplicates, "unmapped_folders": sorted(unmapped), "root": str(args.root)})
    out.with_suffix(".summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"Wrote {len(rows)} images to {out}")
    print("Splits:", summary["splits"])
    print("Classes:", len(summary["classes"]))
    print("Duplicates removed:", duplicates)
    if unmapped:
        print("Skipped folders (not in taxonomy):", ", ".join(sorted(unmapped)))


if __name__ == "__main__":
    main()
