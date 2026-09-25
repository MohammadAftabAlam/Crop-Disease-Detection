import os
import json
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras import layers, models


# ============================================================
# PATHS
# ============================================================

# Original PlantVillage dataset
SOURCE_DIR = os.path.join(
    os.path.expanduser("~"),
    "OneDrive",
    "Documents",
    "archive",
    "PlantVillage",
    "PlantVillage"
)

# Project model folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODEL_DIR = os.path.join(BASE_DIR, "model")

MODEL_PATH = os.path.join(
    MODEL_DIR,
    "crop_disease_model.h5"
)

CLASS_NAMES_PATH = os.path.join(
    MODEL_DIR,
    "class_names.json"
)


# ============================================================
# IMAGE SETTINGS
# ============================================================

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32


# ============================================================
# LOAD DATASET
# ============================================================

print("Loading PlantVillage dataset...")
print("Dataset path:", SOURCE_DIR)

train_dataset = tf.keras.utils.image_dataset_from_directory(
    SOURCE_DIR,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    validation_split=0.2,
    subset="training",
    seed=42,
    shuffle=True
)

validation_dataset = tf.keras.utils.image_dataset_from_directory(
    SOURCE_DIR,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    validation_split=0.2,
    subset="validation",
    seed=42,
    shuffle=False
)


# ============================================================
# GET CLASS NAMES
# ============================================================

class_names = train_dataset.class_names
num_classes = len(class_names)

print("\nClasses:")
print(class_names)

print("\nNumber of classes:", num_classes)


# ============================================================
# SAVE CLASS NAMES
# ============================================================

os.makedirs(MODEL_DIR, exist_ok=True)

with open(CLASS_NAMES_PATH, "w") as file:
    json.dump(class_names, file, indent=4)

print("\nClass names saved successfully.")


# ============================================================
# MOBILE NET V2
# ============================================================

print("\nLoading MobileNetV2...")

base_model = MobileNetV2(
    weights="imagenet",
    include_top=False,
    input_shape=(224, 224, 3)
)

# Freeze the base model
base_model.trainable = False


# ============================================================
# BUILD MODEL
# ============================================================

model = models.Sequential([
    layers.Input(shape=(224, 224, 3)),

    # Normalize pixel values
    layers.Rescaling(1.0 / 255),

    # MobileNetV2
    base_model,

    # Convert feature maps into a vector
    layers.GlobalAveragePooling2D(),

    # Reduce overfitting
    layers.Dropout(0.3),

    # Final classification layer
    layers.Dense(
        num_classes,
        activation="softmax"
    )
])


# ============================================================
# COMPILE MODEL
# ============================================================

model.compile(
    optimizer="adam",
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)


# ============================================================
# DISPLAY MODEL
# ============================================================

model.summary()


# ============================================================
# TRAIN MODEL
# ============================================================

print("\nStarting model training...\n")

history = model.fit(
    train_dataset,
    validation_data=validation_dataset,
    epochs=10
)


# ============================================================
# SAVE MODEL
# ============================================================

model.save(MODEL_PATH)

print("\n========================================")
print("Training completed successfully!")
print("========================================")

print("\nModel saved at:")
print(MODEL_PATH)

print("\nClass names saved at:")
print(CLASS_NAMES_PATH)