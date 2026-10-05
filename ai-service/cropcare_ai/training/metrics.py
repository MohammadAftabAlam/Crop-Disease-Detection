"""Evaluation metrics, written with numpy only so every number is easy to explain."""

from __future__ import annotations

import numpy as np


def softmax(logits: np.ndarray, temperature: float = 1.0) -> np.ndarray:
    z = logits / temperature
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def confusion(y_true: np.ndarray, y_pred: np.ndarray, num_classes: int) -> np.ndarray:
    matrix = np.zeros((num_classes, num_classes), dtype=np.int64)
    np.add.at(matrix, (y_true, y_pred), 1)
    return matrix


def per_class_scores(matrix: np.ndarray) -> dict[str, np.ndarray]:
    tp = np.diag(matrix).astype(float)
    support = matrix.sum(axis=1).astype(float)
    predicted = matrix.sum(axis=0).astype(float)
    precision = np.divide(tp, predicted, out=np.zeros_like(tp), where=predicted > 0)
    recall = np.divide(tp, support, out=np.zeros_like(tp), where=support > 0)
    f1 = np.divide(2 * precision * recall, precision + recall, out=np.zeros_like(tp), where=(precision + recall) > 0)
    return {"precision": precision, "recall": recall, "f1": f1, "support": support}


def macro_f1(y_true: np.ndarray, y_pred: np.ndarray, num_classes: int) -> float:
    """Mean F1 over the classes that actually occur in y_true."""
    scores = per_class_scores(confusion(y_true, y_pred, num_classes))
    present = scores["support"] > 0
    return float(scores["f1"][present].mean()) if present.any() else 0.0


def expected_calibration_error(probs: np.ndarray, y_true: np.ndarray, bins: int = 15) -> float:
    """How far confidence is from accuracy, averaged over confidence bins (0 = perfectly calibrated)."""
    confidence = probs.max(axis=1)
    correct = probs.argmax(axis=1) == y_true
    edges = np.linspace(0, 1, bins + 1)
    ece = 0.0
    for low, high in zip(edges[:-1], edges[1:]):
        in_bin = (confidence > low) & (confidence <= high)
        if in_bin.any():
            ece += in_bin.mean() * abs(correct[in_bin].mean() - confidence[in_bin].mean())
    return float(ece)


def risk_coverage(probs: np.ndarray, y_true: np.ndarray) -> dict:
    """If the model only answers its most confident X% of images, how accurate is it?

    Returns the curve (for plotting), the area under the risk curve (AURC, lower is better)
    and accuracy at 50/80/90% coverage.
    """
    confidence = probs.max(axis=1)
    correct = (probs.argmax(axis=1) == y_true).astype(float)
    order = np.argsort(-confidence)
    cumulative_accuracy = np.cumsum(correct[order]) / np.arange(1, len(order) + 1)
    coverage = np.arange(1, len(order) + 1) / len(order)

    def accuracy_at(target: float) -> float:
        index = max(int(np.ceil(target * len(order))) - 1, 0)
        return float(cumulative_accuracy[index])

    step = max(len(order) // 50, 1)
    return {
        "aurc": float(np.mean(1 - cumulative_accuracy)),
        "accuracy_at_coverage": {"50": accuracy_at(0.5), "80": accuracy_at(0.8), "90": accuracy_at(0.9)},
        "curve": {"coverage": coverage[::step].round(4).tolist(),
                  "accuracy": cumulative_accuracy[::step].round(4).tolist()},
    }
