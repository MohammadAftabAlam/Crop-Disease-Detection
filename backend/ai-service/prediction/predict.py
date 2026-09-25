import json
import numpy as np
import tensorflow as tf

from config import MODEL_PATH, CLASS_NAMES_PATH
from preprocessing.preprocess import preprocess_image


model = None
class_names = []


def load_resources():
    global model
    global class_names

    model = tf.keras.models.load_model(MODEL_PATH)

    with open(CLASS_NAMES_PATH, "r") as file:
        class_names = json.load(file)


def predict_image(image_path):

    if model is None:
        load_resources()

    image = preprocess_image(image_path)

    predictions = model.predict(image, verbose=0)

    predicted_index = int(np.argmax(predictions[0]))

    confidence = float(
        predictions[0][predicted_index] * 100
    )

    disease = class_names[predicted_index]

    return {
        "disease": disease,
        "confidence": round(confidence, 2)
    }