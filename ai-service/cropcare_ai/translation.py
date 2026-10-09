"""English -> Hindi translation of advice text, run locally (no account or API key).

Uses Meta's NLLB-200 distilled 600M model (facebook/nllb-200-distilled-600M, CC-BY-NC 4.0:
fine for this academic project). The model is downloaded on first use (~2.5 GB, into the
Hugging Face cache) and loaded only when the first translation is requested.

A general model gets farming words wrong, so three things are done around it:
1. reviewed translations: sentences the model got wrong have a checked Hindi version
   (configs/translations_hi.yaml), used instead of the model;
2. glossary: farming terms are swapped for the correct Hindi term before translation
   (configs/glossary_hi.yaml);
3. sentences are translated one at a time (the model drops sentences from longer texts).

The backend stores every translation in MySQL, so each sentence is translated only once.
"""

from __future__ import annotations

import logging
import os
import re
import threading
from pathlib import Path

import yaml

log = logging.getLogger(__name__)

# NLLB language codes for the languages the app offers
LANGUAGES = {"en": "eng_Latn", "hi": "hin_Deva"}

# Split after . ! ? or ; followed by space, but not after "e.g." / "i.e." / "etc." / "approx."
_SENTENCE_END = re.compile(r"(?<!\be\.g\.)(?<!\bi\.e\.)(?<!\betc\.)(?<!approx\.)(?<=[.!?;])\s+")


class TranslationUnavailable(RuntimeError):
    pass


class UnsupportedLanguage(ValueError):
    pass


def split_sentences(text: str) -> list[str]:
    return [part for part in _SENTENCE_END.split(text.strip()) if part]


def load_reviewed(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    return {str(k).strip(): str(v).strip() for k, v in (yaml.safe_load(path.read_text(encoding="utf-8")) or {}).items()}


def load_glossary(path: Path) -> list[tuple[re.Pattern, str]]:
    if not path.exists():
        return []
    entries = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    # Longest phrase first, so "fall armyworm" wins over "armyworm"
    ordered = sorted(entries.items(), key=lambda kv: -len(str(kv[0])))
    return [(re.compile(r"(?<![\w-])" + re.escape(str(english)) + r"(?![\w-])", re.IGNORECASE), str(hindi))
            for english, hindi in ordered]


class Translator:
    """Lazy-loading NLLB translator. Thread-safe; one translation runs at a time."""

    def __init__(self, model_name: str, glossary_path: Path, enabled: bool = True, num_beams: int = 2,
                 batch_size: int = 16, reviewed_path: Path | None = None):
        self.model_name = model_name
        self.enabled = enabled
        self.num_beams = num_beams
        self.batch_size = batch_size
        self.glossaries = {"hi": load_glossary(glossary_path)}
        reviewed_path = reviewed_path or glossary_path.with_name("translations_hi.yaml")
        self.reviewed = {"hi": load_reviewed(reviewed_path)}
        self._model = None
        self._tokenizer = None
        self._lock = threading.Lock()
        self._cache: dict[tuple[str, str], str] = {}
        self.load_error: str | None = None

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def _load(self) -> None:
        if self._model is not None:
            return
        if not self.enabled:
            raise TranslationUnavailable("Translation is turned off (CROPCARE_TRANSLATION_ENABLED=false)")
        os.environ.setdefault("USE_TF", "0")  # transformers must not pull in TensorFlow
        os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
        try:
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        except ImportError as error:
            self.load_error = "transformers is not installed: pip install transformers sentencepiece"
            raise TranslationUnavailable(self.load_error) from error
        try:
            log.info("Loading translation model %s (first time downloads ~2.5 GB)", self.model_name)
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name, src_lang=LANGUAGES["en"])
            self._model = AutoModelForSeq2SeqLM.from_pretrained(self.model_name).eval()
        except Exception as error:  # network, disk, corrupt download...
            self.load_error = f"Could not load {self.model_name}: {error}"
            raise TranslationUnavailable(self.load_error) from error
        self.load_error = None

    def prepare(self, sentence: str, target: str) -> str:
        for pattern, replacement in self.glossaries.get(target, []):
            sentence = pattern.sub(replacement, sentence)
        return sentence

    def _generate(self, sentences: list[str], target: str) -> list[str]:
        import torch

        out: list[str] = []
        for start in range(0, len(sentences), self.batch_size):
            batch = sentences[start:start + self.batch_size]
            with torch.inference_mode():
                encoded = self._tokenizer(batch, return_tensors="pt", padding=True, truncation=True, max_length=256)
                generated = self._model.generate(
                    **encoded,
                    forced_bos_token_id=self._tokenizer.convert_tokens_to_ids(LANGUAGES[target]),
                    num_beams=self.num_beams,
                    max_new_tokens=256,
                )
            out.extend(self._tokenizer.batch_decode(generated, skip_special_tokens=True))
        return out

    def translate(self, texts: list[str], source: str = "en", target: str = "hi") -> list[str]:
        if source != "en" or target not in LANGUAGES or target == "en":
            raise UnsupportedLanguage(f"Only English to {', '.join(k for k in LANGUAGES if k != 'en')} is supported")

        reviewed = self.reviewed.get(target, {})
        # Each text -> its sentences (a reviewed whole text stays one piece); each sentence once
        pieces = [[text.strip()] if text.strip() in reviewed else split_sentences(text) for text in texts]
        with self._lock:
            for parts in pieces:
                for s in parts:
                    if s in reviewed:
                        self._cache[(target, s)] = reviewed[s]
            todo = sorted({s for parts in pieces for s in parts if (target, s) not in self._cache})
            if todo:
                self._load()
                translated = self._generate([self.prepare(s, target) for s in todo], target)
                self._cache.update({(target, s): t.strip() for s, t in zip(todo, translated)})
            return [" ".join(self._cache[(target, s)] for s in parts) for parts in pieces]
