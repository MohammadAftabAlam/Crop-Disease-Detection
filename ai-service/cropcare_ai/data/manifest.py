"""Manifests: CSV files listing every image with its class and split.

Images are never copied. A manifest row points at the original file, so the
same code works on a laptop and on Kaggle's read-only /kaggle/input.

Columns: path, class_id, source, split, sha1, dhash
  sha1   exact file hash (catches byte-identical copies)
  dhash  64-bit perceptual "difference hash" (catches the same photo re-saved,
         resized or recompressed, which happens a lot between web-scraped
         datasets such as PlantDoc and PlantWild)
"""

from __future__ import annotations

import csv
import hashlib
import io
import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
FIELDS = ["path", "class_id", "source", "split", "sha1", "dhash"]


@dataclass(frozen=True)
class Row:
    path: str
    class_id: str
    source: str
    split: str
    sha1: str
    dhash: str = ""


def file_hashes(path: Path) -> tuple[str, str]:
    """(sha1, dhash) of an image file. dhash is "" if the file cannot be decoded."""
    data = Path(path).read_bytes()
    sha1 = hashlib.sha1(data).hexdigest()
    try:
        image = Image.open(io.BytesIO(data)).convert("L").resize((9, 8), Image.Resampling.BILINEAR)
        pixels = np.asarray(image, dtype=np.int16)
        bits = (pixels[:, 1:] > pixels[:, :-1]).flatten()
        dhash = f"{int(''.join('1' if b else '0' for b in bits), 2):016x}"
    except Exception:
        dhash = ""
    return sha1, dhash


def file_sha1(path: Path) -> str:
    return file_hashes(path)[0]


def read_manifest(path: str | Path) -> list[Row]:
    with open(path, newline="", encoding="utf-8") as file:
        return [Row(**{key: row.get(key, "") or "" for key in FIELDS}) for row in csv.DictReader(file)]


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


# ---------------------------------------------------------------------------
# Near-duplicate detection
# ---------------------------------------------------------------------------

_POPCOUNT = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)


def _to_uint64(hashes: list[str]) -> np.ndarray:
    return np.array([int(h, 16) for h in hashes], dtype=np.uint64)


def near_duplicates(candidates: list[Row], references: list[Row], max_distance: int = 4,
                    chunk: int = 512) -> list[bool]:
    """For each candidate row: is it the same image as some reference row?

    Same image = identical sha1, or dhash Hamming distance <= max_distance.
    Rows without a dhash are only compared by sha1.
    """
    ref_sha1 = {row.sha1 for row in references}
    result = [row.sha1 in ref_sha1 for row in candidates]
    if max_distance < 0:
        return result

    ref_hashes = [row.dhash for row in references if row.dhash]
    if not ref_hashes:
        return result
    refs = _to_uint64(ref_hashes)

    todo = [i for i, row in enumerate(candidates) if row.dhash and not result[i]]
    for start in range(0, len(todo), chunk):
        indices = todo[start:start + chunk]
        values = _to_uint64([candidates[i].dhash for i in indices])
        xor = values[:, None] ^ refs[None, :]
        distances = _POPCOUNT[xor.view(np.uint8)].reshape(len(indices), len(refs), 8).sum(axis=2)
        hits = (distances <= max_distance).any(axis=1)
        for i, hit in zip(indices, hits):
            result[i] = bool(hit)
    return result
