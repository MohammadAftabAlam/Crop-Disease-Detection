"""Runtime settings, read from environment variables prefixed with CROPCARE_ (or ai-service/.env)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CROPCARE_", env_file=SERVICE_DIR / ".env", extra="ignore")

    host: str = "127.0.0.1"
    port: int = 8000

    taxonomy_path: Path = SERVICE_DIR / "configs" / "taxonomy.yaml"
    classifier_dir: Path = SERVICE_DIR / "artifacts" / "classifier"
    severity_dir: Path = SERVICE_DIR / "artifacts" / "severity"

    device: str = "cpu"

    # "energy" uses the classifier's own logits; "bioclip" adds a zero-shot plant check
    # (needs open_clip_torch and a ~600 MB download); "off" disables the gate.
    gate: str = "energy"
    # BioCLIP: minimum probability that the photo shows a leaf of a supported crop. Only used
    # when calibration.json has no learnt "bioclip_threshold" (calibrate --bioclip).
    # Non-plant photos scored below 0.01 in testing; real field rice leaves can score ~0.1-0.3.
    bioclip_threshold: float = 0.05

    # Lesion cross-check: a lesion-type diagnosis with less diseased area than this (%) becomes
    # "unknown". 0 turns it off. Chosen from field test photos (training/evaluate_checks.py).
    min_lesion_percent: float = 1.0

    max_images: int = 5
    max_image_mb: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
