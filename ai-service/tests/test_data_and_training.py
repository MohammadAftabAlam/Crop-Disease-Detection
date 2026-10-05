import json

import numpy as np
import pytest

from cropcare_ai.data.manifest import read_manifest
from cropcare_ai.inference.decision import decide
from cropcare_ai.settings import get_settings
from cropcare_ai.taxonomy import Taxonomy
from cropcare_ai.training import export_onnx, report
from cropcare_ai.training.calibrate import conformal_qhat
from cropcare_ai.training.metrics import expected_calibration_error, macro_f1, risk_coverage


def test_taxonomy_maps_dataset_folder_names():
    taxonomy = Taxonomy.load(get_settings().taxonomy_path)
    assert taxonomy.resolve("Tomato___Late_blight") == "tomato__late_blight"
    assert taxonomy.resolve("Tomato leaf late blight") == "tomato__late_blight"
    assert taxonomy.resolve("Corn_(maize)___Common_rust_") == "maize__common_rust"
    assert taxonomy.resolve("Healthy", crop="rice") == "rice__healthy"
    assert taxonomy.resolve("Healthy") is None              # ambiguous without a crop
    assert taxonomy.resolve("Rust", crop="wheat") is None   # "Rust" alone means maize rust
    assert taxonomy.resolve("Apple Scab Leaf") is None
    assert taxonomy.grade_for(0.5).label == "None"
    assert taxonomy.grade_for(30).label == "High"


def test_prepare_splits_dedupes_and_skips_unknown(workspace):
    pv = read_manifest(workspace / "manifests" / "plantvillage.csv")
    assert {r.split for r in pv} == {"train", "val", "test"}
    assert len(pv) == 90                                     # the duplicate was dropped
    summary = json.loads((workspace / "manifests" / "plantvillage.summary.json").read_text())
    assert summary["duplicates_removed"] == 1

    pd = read_manifest(workspace / "manifests" / "plantdoc.csv")
    assert {r.split for r in pd} == {"train", "val", "test"}
    assert "apple" not in {r.class_id.split("__")[0] for r in pd}
    pd_summary = json.loads((workspace / "manifests" / "plantdoc.summary.json").read_text())
    assert pd_summary["unmapped_folders"] == ["Apple Scab Leaf"]


def test_training_calibration_and_metrics_files(workspace):
    model_dir = workspace / "classifier"
    bundle = json.loads((model_dir / "bundle.json").read_text())
    assert bundle["class_ids"] == ["potato__early_blight", "tomato__late_blight", "tomato__healthy"]
    assert len(bundle["training"]["history"]) >= 1

    calibration = json.loads((model_dir / "calibration.json").read_text())
    assert calibration["temperature"] > 0 and 0 <= calibration["qhat"] <= 1

    metrics = json.loads((model_dir / "metrics" / "plantdoc_test.json").read_text())
    assert metrics["num_images"] == 24
    assert metrics["skipped_unsupported_classes"] == 0      # apple was never in the manifest
    assert 0 <= metrics["accuracy"] <= 1


def test_report_lists_every_test_set(workspace):
    text = report.build_report([workspace / "classifier"])
    assert "PlantDoc test (field)" in text


def test_onnx_export_matches_pytorch(workspace):
    export_onnx.main(["--model-dir", str(workspace / "classifier")])
    info = json.loads((workspace / "classifier" / "onnx_export.json").read_text())
    assert info["fp32"]["max_abs_diff"] < 1e-3


def test_metric_functions():
    y = np.array([0, 1, 2, 2])
    assert macro_f1(y, y, 3) == 1.0
    probs = np.eye(3)[y]
    assert expected_calibration_error(probs, y) == pytest.approx(0.0)
    assert risk_coverage(probs, y)["aurc"] == pytest.approx(0.0)


def test_conformal_threshold_and_decisions():
    rng = np.random.default_rng(0)
    logits = rng.normal(size=(500, 4)) + np.eye(4)[rng.integers(0, 4, 500)] * 3
    labels = logits.argmax(1)
    probs = np.exp(logits) / np.exp(logits).sum(1, keepdims=True)
    qhat = conformal_qhat(probs, labels, alpha=0.1)
    covered = probs[np.arange(500), labels] >= 1 - qhat
    assert covered.mean() >= 0.9

    assert decide(np.array([0.97, 0.01, 0.01, 0.01]), qhat=0.5).status == "confident"
    assert decide(np.array([0.48, 0.47, 0.03, 0.02]), qhat=0.6).status == "ambiguous"
    assert decide(np.array([0.25, 0.25, 0.25, 0.25]), qhat=0.5).status == "unknown"
    # one-class set but low probability: not allowed to be "confident"
    assert decide(np.array([0.40, 0.25, 0.20, 0.15]), qhat=0.65).status == "unknown"
