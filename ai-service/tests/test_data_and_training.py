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


# ---------------------------------------------------------------- Step 3 additions

def test_near_duplicates_catch_resaved_copies(tmp_path):
    from collections import Counter
    from PIL import Image
    from cropcare_ai.data.manifest import Row, file_hashes, near_duplicates
    from conftest import leaf_image

    original = leaf_image(0, seed=1, size=200)
    # Real-looking photo: smooth gradient + noise so the hash has structure
    import numpy as np
    gradient = np.linspace(0, 255, 200, dtype=np.float32)[None, :, None].repeat(200, 0).repeat(3, 2)
    photo = Image.fromarray(((np.asarray(original, np.float32) + gradient) / 2).astype("uint8"))
    photo.save(tmp_path / "a.png")
    photo.resize((120, 120)).save(tmp_path / "a_small.jpg", quality=70)        # same photo, re-saved
    Image.fromarray(np.asarray(photo)[:, ::-1]).save(tmp_path / "other.png")  # different (mirrored) image

    def row(name):
        sha1, dhash = file_hashes(tmp_path / name)
        return Row(name, "tomato__healthy", "x", "train", sha1, dhash)

    references = [row("a.png")]
    flags = near_duplicates([row("a.png"), row("a_small.jpg"), row("other.png")], references, max_distance=4)
    assert flags == [True, True, False]
    # exact-only mode misses the re-saved copy
    assert near_duplicates([row("a_small.jpg")], references, max_distance=-1) == [False]


def test_prepare_finds_nested_dataset_folders(tmp_path):
    from conftest import leaf_image
    from cropcare_ai.data import prepare
    from cropcare_ai.data.manifest import read_manifest

    # Kaggle-style nesting: <input>/<dataset>/<some folder>/<train|test>/<class>/
    for split in ("train", "test"):
        for folder in ("Blast", "Brownspot", "Tungro"):
            target = tmp_path / "input" / "rice-ds" / "RiceLeaf" / split / folder
            target.mkdir(parents=True)
            for i in range(6):
                leaf_image(1, seed=hash((split, folder, i)) % 10_000).save(target / f"{i}.jpg")
    out = tmp_path / "rice.csv"
    prepare.main(["--name", "rice", "--root", str(tmp_path / "input"), "--crop", "rice", "--search",
                  "--val-from-train", "0.2", "--out", str(out)])
    rows = read_manifest(out)
    assert {r.class_id for r in rows} == {"rice__leaf_blast", "rice__brown_spot"}   # Tungro skipped
    assert {r.split for r in rows} == {"train", "val", "test"}
    assert all(r.dhash for r in rows)


def test_source_balanced_sampler_shares_each_class():
    from cropcare_ai.data.datasets import balanced_sampler

    labels = [0] * 100 + [0] * 4 + [1] * 50
    sources = ["lab"] * 100 + ["field"] * 4 + ["lab"] * 50
    weights = balanced_sampler(labels, sources).weights.numpy()
    class0, class1 = weights[:104].sum(), weights[104:].sum()
    assert class0 == pytest.approx(class1)                      # classes equally likely
    field_share = weights[100:104].sum() / class0
    assert field_share == pytest.approx(2 / (10 + 2))           # sqrt(4) / (sqrt(100) + sqrt(4))
    assert weights[100] > weights[0] * 4                         # each field photo drawn far more often


def test_tta_setting_flows_from_calibration_to_api(workspace):
    import json
    from cropcare_ai.inference.engine import Predictor
    from cropcare_ai.settings import Settings
    from cropcare_ai.training import calibrate, evaluate
    from conftest import image_bytes

    model_dir = workspace / "classifier"
    manifests = workspace / "manifests"
    original = (model_dir / "calibration.json").read_text()
    try:
        calibrate.main(["--model-dir", str(model_dir), "--manifest", str(manifests / "plantdoc.csv"), "--split", "val",
                        "--num-workers", "0", "--device", "cpu", "--tta"])
        assert json.loads((model_dir / "calibration.json").read_text())["tta"] is True
        evaluate.main(["--model-dir", str(model_dir), "--manifest", str(manifests / "plantdoc.csv"),
                       "--name", "tta_check", "--num-workers", "0", "--device", "cpu"])
        assert json.loads((model_dir / "metrics" / "tta_check.json").read_text())["tta"] is True
        result = Predictor(Settings(classifier_dir=model_dir, severity_dir=workspace / "severity")).predict([image_bytes(0)])
        assert result["status"] in {"confident", "ambiguous", "unknown", "rejected"}
    finally:
        (model_dir / "calibration.json").write_text(original)
        (model_dir / "metrics" / "tta_check.json").unlink(missing_ok=True)


def test_prepare_drops_classes_that_are_too_small(tmp_path):
    from conftest import leaf_image
    from cropcare_ai.data import prepare
    import json as _json

    for folder, count in (("Aphid", 3), ("Healthy", 12), ("Mite", 12)):
        target = tmp_path / "wheat" / folder
        target.mkdir(parents=True)
        for i in range(count):
            leaf_image(1, seed=hash((folder, i)) % 10_000).save(target / f"{i}.jpg")
    out = tmp_path / "wheat.csv"
    prepare.main(["--name", "wheat", "--root", str(tmp_path / "wheat"), "--crop", "wheat",
                  "--min-class-images", "10", "--out", str(out)])
    summary = _json.loads(out.with_suffix(".summary.json").read_text())
    assert summary["dropped_small_classes"] == {"wheat__aphid": 3}
    assert set(summary["classes"]) == {"wheat__healthy", "wheat__mite"}
