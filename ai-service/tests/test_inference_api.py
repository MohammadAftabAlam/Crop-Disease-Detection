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


def test_api_health_and_model_info(client):
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
