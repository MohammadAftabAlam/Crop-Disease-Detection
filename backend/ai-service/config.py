import os

# AI service configuration

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Model paths
MODEL_PATH = os.path.join(
    BASE_DIR,
    "model",
    "crop_disease_model.h5"
)

CLASS_NAMES_PATH = os.path.join(
    BASE_DIR,
    "model",
    "class_names.json"
)

# Image settings
IMAGE_SIZE = (224, 224)

# Server settings
HOST = "127.0.0.1"
PORT = 8000