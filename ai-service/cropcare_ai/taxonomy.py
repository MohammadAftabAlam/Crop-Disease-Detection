"""Canonical class list (configs/taxonomy.yaml) and mapping of dataset folder names onto it."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml


def normalize(name: str) -> str:
    """'Corn_(maize)___Common_rust_' -> 'cornmaizecommonrust'."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


@dataclass(frozen=True)
class DiseaseClass:
    id: str
    crop: str          # crop key, e.g. "tomato"
    crop_name: str     # display name, e.g. "Tomato"
    disease: str       # display name, e.g. "Late Blight"
    healthy: bool
    lesions: bool = True   # leaves spot/blight lesions (false: viruses, mites, insect damage, healthy)

    def as_dict(self) -> dict:
        return {
            "classId": self.id,
            "crop": self.crop_name,
            "disease": self.disease,
            "isHealthy": self.healthy,
        }


@dataclass(frozen=True)
class SeverityGrade:
    grade: int
    label: str
    max_percent: float


@dataclass
class Taxonomy:
    classes: dict[str, DiseaseClass]
    severity_grades: list[SeverityGrade]
    _aliases: dict[str, str] = field(default_factory=dict, repr=False)

    @classmethod
    def load(cls, path: str | Path) -> "Taxonomy":
        data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
        crops = data["crops"]

        classes: dict[str, DiseaseClass] = {}
        aliases: dict[str, str] = {}

        def add_alias(alias: str, class_id: str) -> None:
            key = normalize(alias)
            if key in aliases and aliases[key] != class_id:
                raise ValueError(f"Alias '{alias}' maps to both {aliases[key]} and {class_id}")
            aliases[key] = class_id

        for item in data["classes"]:
            crop_key = item["crop"]
            if crop_key not in crops:
                raise ValueError(f"Class {item['id']} uses unknown crop '{crop_key}'")
            disease_class = DiseaseClass(
                id=item["id"],
                crop=crop_key,
                crop_name=crops[crop_key]["name"],
                disease=item["disease"],
                healthy=bool(item.get("healthy", False)),
                lesions=bool(item.get("lesions", not item.get("healthy", False))),
            )
            if disease_class.id in classes:
                raise ValueError(f"Duplicate class id {disease_class.id}")
            classes[disease_class.id] = disease_class

            add_alias(disease_class.id, disease_class.id)
            add_alias(crop_key + disease_class.disease, disease_class.id)
            add_alias(disease_class.crop_name + disease_class.disease, disease_class.id)
            for alias in item.get("aliases", []):
                add_alias(alias, disease_class.id)

        grades = [SeverityGrade(**grade) for grade in data.get("severity_grades", [])]
        return cls(classes=classes, severity_grades=grades, _aliases=aliases)

    def __getitem__(self, class_id: str) -> DiseaseClass:
        return self.classes[class_id]

    def resolve(self, folder_name: str, crop: str | None = None) -> str | None:
        """Map a dataset folder name to a class id, or None if it is not one of our classes.

        With `crop` given (for crop-specific datasets whose folders are just "Healthy", "Blast"...),
        the crop-prefixed name is tried first, and a bare match must belong to that crop.
        """
        if crop:
            prefixed = self._aliases.get(normalize(crop + folder_name))
            if prefixed:
                return prefixed
            crop_name = next((c.crop_name for c in self.classes.values() if c.crop == crop), crop)
            prefixed = self._aliases.get(normalize(crop_name + folder_name))
            if prefixed:
                return prefixed

        match = self._aliases.get(normalize(folder_name))
        if match and crop and self.classes[match].crop != crop:
            return None
        return match

    def grade_for(self, percent: float) -> SeverityGrade:
        for grade in self.severity_grades:
            if percent <= grade.max_percent:
                return grade
        return self.severity_grades[-1]


@lru_cache
def load_taxonomy(path: str) -> Taxonomy:
    return Taxonomy.load(path)
