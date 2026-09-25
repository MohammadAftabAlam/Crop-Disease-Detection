import os
import tensorflow as tf

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TEST_DIR = os.path.join(BASE_DIR, "dataset", "test")
MODEL_PATH = os.path.join(BASE_DIR, "model", "crop_disease_model.h5")

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32

# Load test dataset
test_dataset = tf.keras.utils.image_dataset_from_directory(
    TEST_DIR,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    shuffle=False
)

# Load trained model
model = tf.keras.models.load_model(MODEL_PATH)

# Evaluate model
loss, accuracy = model.evaluate(test_dataset, verbose=1)

print("\nTest Accuracy:", round(accuracy * 100, 2), "%")
print("Test Loss:", round(loss, 4))