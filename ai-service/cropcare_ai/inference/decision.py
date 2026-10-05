"""Turns class probabilities into a decision the app can show.

Conformal prediction (LAC): after calibration we know a threshold `qhat` such that
the set {classes with probability >= 1 - qhat} contains the true class for about
(1 - alpha) of images, e.g. 90%. The size of that set tells us how sure we are:

  1 class        -> "confident"   show the diagnosis (only if its probability >= 50%)
  2-3 classes    -> "ambiguous"   "could be A or B, take a closer photo"
  0 or >3        -> "unknown"     "cannot tell, ask an expert / KVK"

"rejected" is decided separately by the gate (not a plant / not a supported crop).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

MAX_AMBIGUOUS_SET = 3

# Safety floor on top of conformal prediction: never call a diagnosis "confident"
# below this probability, even if a badly calibrated model gives a one-class set.
MIN_CONFIDENT_PROBABILITY = 0.5

# Used only when no calibration.json exists yet (model not calibrated)
UNCALIBRATED = {"temperature": 1.0, "qhat": 0.8, "energy_threshold": None, "alpha": None}


@dataclass
class Decision:
    status: str                 # confident | ambiguous | unknown
    set_indices: list[int]      # prediction set, most likely first


def prediction_set(probs: np.ndarray, qhat: float) -> list[int]:
    threshold = 1.0 - qhat
    members = np.flatnonzero(probs >= threshold)
    return members[np.argsort(-probs[members])].tolist()


def decide(probs: np.ndarray, qhat: float) -> Decision:
    members = prediction_set(probs, qhat)
    if len(members) == 1:
        if probs[members[0]] < MIN_CONFIDENT_PROBABILITY:
            return Decision("unknown", members)
        return Decision("confident", members)
    if 2 <= len(members) <= MAX_AMBIGUOUS_SET:
        return Decision("ambiguous", members)
    return Decision("unknown", members)


def energy(logits: np.ndarray, temperature: float = 1.0) -> np.ndarray:
    """Free energy score: higher means the image looks less like the training data."""
    z = logits / temperature
    top = z.max(axis=-1, keepdims=True)
    return -(temperature * (top.squeeze(-1) + np.log(np.exp(z - top).sum(axis=-1))))
