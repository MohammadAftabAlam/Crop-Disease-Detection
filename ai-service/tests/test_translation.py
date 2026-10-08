"""Translation endpoint and helpers, with the NLLB model replaced by a fake (no 2.5 GB download)."""

from fastapi.testclient import TestClient

from cropcare_ai.api.main import create_app
from cropcare_ai.settings import SERVICE_DIR, Settings
from cropcare_ai.translation import Translator, TranslationUnavailable, load_glossary, split_sentences

GLOSSARY = SERVICE_DIR / "configs" / "glossary_hi.yaml"


class FakeModel(Translator):
    """Records what reaches the model and "translates" by wrapping each sentence in [hi: ...]."""

    def __init__(self):
        super().__init__("fake", GLOSSARY)
        self.seen: list[str] = []

    def _load(self):
        self._model = object()

    def _generate(self, sentences, target):
        self.seen.extend(sentences)
        return [f"[{target}: {s}]" for s in sentences]


def test_sentences_are_split_but_not_after_abbreviations():
    assert split_sentences("Act today. Spray e.g. neem oil; then check again!  Done") == [
        "Act today.", "Spray e.g. neem oil;", "then check again!", "Done"]
    assert split_sentences("Grade 2.5 is moderate.") == ["Grade 2.5 is moderate."]


def test_glossary_puts_the_right_farming_words_in_before_translation():
    translator = FakeModel()
    text = translator.prepare("Check the whorl for Caterpillars and fall armyworm; avoid a fungicide.", "hi")
    assert "गोभ" in text and "इल्लियों" in text and "फफूंदनाशक" in text
    assert text.count("फॉल आर्मीवर्म") == 1          # the longer phrase wins, no "fall फॉल ..."
    assert translator.prepare("rusty brown spots", "hi") == "rusty brown spots"   # whole words only
    assert len(load_glossary(GLOSSARY)) > 50


def test_each_sentence_is_translated_once_and_texts_are_rebuilt_in_order():
    translator = FakeModel()
    out = translator.translate(["Wash hands. Remove weeds.", "Remove weeds.", "Wash hands."])
    assert out == ["[hi: Wash hands.] [hi: Remove weeds.]", "[hi: Remove weeds.]", "[hi: Wash hands.]"]
    assert sorted(translator.seen) == ["Remove weeds.", "Wash hands."]
    translator.translate(["Wash hands."])
    assert len(translator.seen) == 2                 # served from memory the second time


def test_reviewed_translations_are_used_instead_of_the_model():
    translator = FakeModel()
    out = translator.translate(["Inspect leaves every week", "Act today. Remove weeds.", "Remove weeds."])
    assert out[0] == "हर सप्ताह पत्तियों की जाँच करें"            # whole text reviewed
    assert out[1] == "आज ही कदम उठाएं। [hi: Remove weeds.]"       # one reviewed sentence, one from the model
    assert translator.seen == ["Remove weeds."]                     # the model never saw the reviewed ones


def test_translate_endpoint(tmp_path):
    with TestClient(create_app(Settings(classifier_dir=tmp_path, severity_dir=tmp_path))) as client:
        client.app.state.translator = FakeModel()
        response = client.post("/translate", json={"texts": ["Install pheromone traps to monitor the moths"]})
        assert response.status_code == 200
        body = response.json()
        assert body["success"] and body["target"] == "hi" and "NLLB" in body["provider"]
        assert body["translations"] == ["[hi: Install फेरोमोन ट्रैप to monitor the पतंगों]"]

        assert client.post("/translate", json={"texts": ["x"], "target": "fr"}).status_code == 400
        assert client.get("/health").json()["translation"]["loaded"] is True


def test_translate_endpoint_reports_a_missing_model(tmp_path):
    settings = Settings(classifier_dir=tmp_path, severity_dir=tmp_path, translation_enabled=False)
    with TestClient(create_app(settings)) as client:
        response = client.post("/translate", json={"texts": ["Wash hands."]})
        assert response.status_code == 503
        assert "turned off" in response.json()["message"]


def test_disabled_translator_raises():
    translator = Translator("fake", GLOSSARY, enabled=False)
    try:
        translator.translate(["Wash hands."])
    except TranslationUnavailable:
        pass
    else:
        raise AssertionError("expected TranslationUnavailable")
