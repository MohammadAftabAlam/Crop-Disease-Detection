import pytest
from fastapi.testclient import TestClient

from cropcare_ai.api.main import create_app
from cropcare_ai.inference.engine import ModelNotLoaded, Predictor
from cropcare_ai.settings import Settings

from conftest import image_bytes

STATUSES = {"confident", "ambiguous", "unknown", "rejected"}


@pytest.fixture(scope="module")
def predictor(settings):
    return Predictor(settings)


@pytest.fixture(scope="module")
def client(settings):
    with TestClient(create_app(settings)) as test_client:
        yield test_client


def test_predictor_returns_full_result(predictor):
    result = predictor.predict([image_bytes(0)], explain=True)
    assert result["status"] in STATUSES
    if result["status"] != "rejected":
        assert result["classId"] in predictor.bundle.class_ids
        assert result["candidates"] and result["candidates"][0]["classId"]
        assert result["explanation"]["heatmap"].startswith("data:image/jpeg;base64,")
    assert result["perImage"][0]["gate"]["energy"] is not None


def test_multi_photo_uses_every_image(predictor):
    result = predictor.predict([image_bytes(0, seed=1), image_bytes(0, seed=2), image_bytes(0, seed=3, fmt="PNG")])
    assert result["imagesReceived"] == 3
    assert len(result["perImage"]) == 3


def test_severity_is_reported_for_diseased_predictions(predictor):
    result = predictor.predict([image_bytes(0)], explain=True)
    if result["status"] in ("confident", "ambiguous") and not result["isHealthy"]:
        assert 0 <= result["severity"]["percent"] <= 100
        assert result["severity"]["label"]
        assert result["explanation"]["lesions"].startswith("data:image/jpeg")


def test_missing_model_is_reported(tmp_path):
    predictor = Predictor(Settings(classifier_dir=tmp_path / "none", severity_dir=tmp_path / "none"))
    assert not predictor.loaded
    with pytest.raises(ModelNotLoaded):
        predictor.predict([image_bytes(0)])


def test_api_health_and_model_info(client, settings):
    # evaluate_checks writes metrics/checks.json, which is not a test set and must be skipped
    (settings.classifier_dir / "metrics" / "checks.json").write_text('{"photos": 1}')
    assert client.get("/health").json()["modelLoaded"] is True
    info = client.get("/model-info").json()
    assert info["modelLoaded"] and len(info["classes"]) == 3
    assert "plantdoc_test" in info["metrics"]
    assert info["classes"][0]["crop"] and info["classes"][0]["disease"]


def test_api_predict_single_and_multiple(client):
    single = client.post("/predict", files={"image": ("leaf.jpg", image_bytes(1), "image/jpeg")})
    assert single.status_code == 200 and single.json()["status"] in STATUSES

    many = client.post("/predict?explain=true", files=[("images", (f"{i}.jpg", image_bytes(1, seed=i), "image/jpeg"))
                                                      for i in range(3)])
    assert many.status_code == 200 and many.json()["imagesReceived"] == 3


def test_api_rejects_bad_input(client):
    response = client.post("/predict", files={"image": ("leaf.jpg", b"not an image", "image/jpeg")})
    assert response.status_code == 400
    assert response.json() == {"success": False, "message": "The uploaded file is not a readable image."}

    assert client.post("/predict").status_code == 400

    too_many = [("images", (f"{i}.jpg", image_bytes(0, seed=i), "image/jpeg")) for i in range(6)]
    assert client.post("/predict", files=too_many).status_code == 400


def test_crop_selection_limits_answers_to_that_crop(predictor):
    result = predictor.predict([image_bytes(0)], crop="potato")
    assert result["selectedCrop"] == "potato"
    if result["status"] != "rejected":
        assert all(c["classId"].startswith("potato__") for c in result["candidates"])
        assert result["classId"].startswith("potato__")


def test_unknown_crop_is_a_clear_error(client):
    response = client.post("/predict?crop=banana", files={"image": ("leaf.jpg", image_bytes(0), "image/jpeg")})
    assert response.status_code == 400
    assert "banana" in response.json()["message"]


def test_lesion_cross_check_downgrades_spotless_disease(settings, monkeypatch):
    predictor = Predictor(settings)
    predictor.min_lesion_percent = 1.0
    # Pretend the lesion model finds almost nothing on the leaf
    monkeypatch.setattr(predictor.severity, "estimate",
                        lambda image: {"percent": 0.2, "grade": 0, "label": "None", "leafAreaFound": True,
                                       "_lesion_mask": __import__("numpy").zeros((8, 8), bool)})
    for color in range(3):
        result = predictor.predict([image_bytes(color, seed=11)])
        disease = predictor.taxonomy.classes.get(result["classId"]) if result["classId"] else None
        if disease is not None and disease.lesions:
            # a lesion-type disease with 0.2% lesions is never shown as a diagnosis
            assert result["status"] == "unknown" and result["reason"] == "no_lesions"
