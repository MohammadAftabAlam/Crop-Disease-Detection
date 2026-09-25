import os
import shutil
import random
from pathlib import Path

# PlantVillage source folder
SOURCE_DIR = Path.home() / "OneDrive" / "Documents" / "archive" / "PlantVillage" / "PlantVillage"

# Project dataset folder
BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset"

TRAIN_DIR = DATASET_DIR / "train"
VAL_DIR = DATASET_DIR / "validation"
TEST_DIR = DATASET_DIR / "test"

# Create folders
TRAIN_DIR.mkdir(parents=True, exist_ok=True)
VAL_DIR.mkdir(parents=True, exist_ok=True)
TEST_DIR.mkdir(parents=True, exist_ok=True)

random.seed(42)

# Get disease/crop class folders
classes = [
    folder for folder in SOURCE_DIR.iterdir()
    if folder.is_dir()
]

print(f"Found {len(classes)} classes.")

for class_folder in classes:

    images = [
        file for file in class_folder.iterdir()
        if file.suffix.lower() in [".jpg", ".jpeg", ".png", ".bmp", ".gif"]
    ]

    random.shuffle(images)

    total = len(images)

    train_end = int(total * 0.80)
    val_end = int(total * 0.90)

    train_images = images[:train_end]
    val_images = images[train_end:val_end]
    test_images = images[val_end:]

    # Create class folders
    train_class = TRAIN_DIR / class_folder.name
    val_class = VAL_DIR / class_folder.name
    test_class = TEST_DIR / class_folder.name

    train_class.mkdir(parents=True, exist_ok=True)
    val_class.mkdir(parents=True, exist_ok=True)
    test_class.mkdir(parents=True, exist_ok=True)

    # Copy images
    for image in train_images:
        shutil.copy2(image, train_class / image.name)

    for image in val_images:
        shutil.copy2(image, val_class / image.name)

    for image in test_images:
        shutil.copy2(image, test_class / image.name)

    print(
        f"{class_folder.name}: "
        f"Train={len(train_images)}, "
        f"Validation={len(val_images)}, "
        f"Test={len(test_images)}"
    )

print("\nDataset splitting completed successfully!")