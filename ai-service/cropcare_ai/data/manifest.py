"""Manifests: CSV files listing every image with its class and split.

Images are never copied. A manifest row points at the original file, so the
same code works on a laptop and on Kaggle's read-only /kaggle/input.

Columns: path, class_id, source, split, sha1
"""

from __future__ import annotations

import csv
import hashlib
import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
FIELDS = ["path", "class_id", "source", "split", "sha1"]


@dataclass(frozen=True)
class Row:
    path: str
    class_id: str
    source: str
    split: str
    sha1: str


def file_sha1(path: Path) -> str:
    digest = hashlib.sha1()
    with open(path, "rb") as file:
        for chunk in iter(lambda: file.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_manifest(path: str | Path) -> list[Row]:
    with open(path, newline="", encoding="utf-8") as file:
        return [Row(**{key: row[key] for key in FIELDS}) for row in csv.DictReader(file)]


def write_manifest(rows: list[Row], path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row.__dict__)


def select(rows: list[Row], split: str | None) -> list[Row]:
    return [row for row in rows if split is None or row.split == split]


def stratified_split(items: list[tuple[Path, str]], ratios: dict[str, float], seed: int) -> dict[Path, str]:
    """Assign each (path, class_id) to a split, keeping class proportions in every split."""
    by_class: dict[str, list[Path]] = defaultdict(list)
    for path, class_id in items:
        by_class[class_id].append(path)

    rng = random.Random(seed)
    assignment: dict[Path, str] = {}
    names = list(ratios)
    for class_id in sorted(by_class):
        paths = sorted(by_class[class_id])
        rng.shuffle(paths)
        start = 0
        for index, name in enumerate(names):
            if index == len(names) - 1:
                end = len(paths)
            else:
                end = start + int(round(len(paths) * ratios[name]))
            for path in paths[start:end]:
                assignment[path] = name
            start = end
    return assignment


def summarize(rows: list[Row]) -> dict:
    per_split = Counter(row.split for row in rows)
    per_class: dict[str, Counter] = defaultdict(Counter)
    for row in rows:
        per_class[row.class_id][row.split] += 1
    return {"total": len(rows), "splits": dict(per_split), "classes": {k: dict(v) for k, v in sorted(per_class.items())}}


def check_leakage(train_rows: list[Row], eval_rows: list[Row]) -> int:
    """Number of evaluation images whose exact bytes also appear in the training rows."""
    train_hashes = {row.sha1 for row in train_rows}
    return sum(1 for row in eval_rows if row.sha1 in train_hashes)
