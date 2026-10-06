# CropCare AI service

PyTorch models behind a FastAPI server. The Spring Boot backend calls it; the browser never does.

```
cropcare_ai/
  taxonomy.py         one class list for all datasets (configs/taxonomy.yaml)
  data/               manifests (CSV lists of images), transforms, datasets
  models/bundle.py    how a trained model is saved and loaded
  training/           train, calibrate, evaluate, report, severity model, ONNX export
  inference/          predictor, uncertainty decision, gate, Grad-CAM, severity
  api/main.py         HTTP API
configs/              taxonomy + training configs
kaggle/               notebook that runs the whole training pipeline on a free GPU
tests/                end-to-end tests on a tiny synthetic dataset (CPU, ~15 s)
```

## What a prediction contains

`POST /predict` takes 1-5 photos of the same plant (`images`, or `image` for one photo).

| Field | Meaning |
|---|---|
| `status` | `confident` (one disease), `ambiguous` (2-3 possible), `unknown` (cannot tell), `rejected` (not a supported crop leaf) |
| `classId`, `crop`, `disease`, `confidence` | most likely class, calibrated probability in % |
| `candidates` | the conformal prediction set: diseases that cannot be ruled out |
| `severity` | % of leaf area with lesions, grade 0-4 (only for diseased, non-`unknown` results) |
| `explanation` | with `?explain=true`: Grad-CAM heat map and lesion overlay (JPEG data URIs) |
| `perImage` | per-photo gate result and top guess |

## How it decides (for the report / viva)

1. **Gate.** Each photo must look like something the model knows:
   - energy score of the logits must be below a threshold learnt during calibration;
   - optionally (`CROPCARE_GATE=bioclip`) BioCLIP must agree it is a leaf of a supported crop.
     In testing, real PlantDoc leaves scored 0.44–0.98 and non-plant images < 0.01.
2. **Several photos** of one plant: their calibrated probabilities are averaged.
3. **Temperature scaling** makes the probabilities honest (fit on held-out photos).
4. **Conformal prediction (LAC)** gives the set of diseases that contains the true one ~90% of the
   time. Set size → status. A one-disease set below 50% probability is still reported as `unknown`.
5. **Severity**: U-Net lesion mask ÷ leaf mask (Excess-Green + Otsu), mapped to grades in
   `configs/taxonomy.yaml`.
6. **Grad-CAM** shows which pixels drove the prediction; the lesion overlay shows what the
   severity model found. If the heat map sits on the background, the prediction is suspect.

## Train (on Kaggle)

Step 3 (current): `kaggle/cropcare_step3.ipynb` trains **Experiment C**: PlantVillage + PlantDoc +
PlantWild + rice + wheat, source-balanced sampling, 288 px, test-time flip averaging, and training
photos that are near-duplicates (perceptual hash) of any validation/test photo removed. It compares
ConvNeXt-Tiny, DINOv2-Small, EfficientNetV2-B0 and MobileNetV3 and writes to `artifacts/c_*`.
To serve one of them: `CROPCARE_CLASSIFIER_DIR=artifacts/c_convnext_tiny`.

Steps 1-2: `kaggle/cropcare_training.ipynb` (experiments A and B, severity model).

Push this repo to GitHub, then upload the notebook to Kaggle and run it.
It prepares the datasets, runs experiment A (lab only) and B (lab + field), calibrates,
evaluates, prints the comparison table, trains the severity model and zips `artifacts/`.
Unzip that file into `ai-service/artifacts/` on your laptop.

The same steps by hand:

```bash
# 1. Manifests (images are not copied)
python -m cropcare_ai.data.prepare --name plantvillage --root <PlantVillage/color>
python -m cropcare_ai.data.prepare --name plantdoc --root <PlantDoc-Dataset> --layout keep --val-from-train 0.2
python -m cropcare_ai.data.prepare --name rice --root <rice dataset> --crop rice          # optional
python -m cropcare_ai.data.prepare --name field --root <your own photos> --all-test       # your test set

# 2. Train (see configs/train/*.yaml; override with --set epochs=3)
python -m cropcare_ai.training.train_classifier --config configs/train/b_mixed_convnext_tiny.yaml

# 3. Calibrate on field photos the model has not seen, then evaluate every test set
python -m cropcare_ai.training.calibrate --manifest data/manifests/plantdoc.csv --split val
python -m cropcare_ai.training.evaluate --manifest data/manifests/plantvillage.csv --name plantvillage_test --description "PlantVillage test (lab)"
python -m cropcare_ai.training.evaluate --manifest data/manifests/plantdoc.csv --name plantdoc_test --description "PlantDoc test (field)"
python -m cropcare_ai.training.evaluate --manifest data/manifests/field.csv --name field_test --description "Our field photos"
python -m cropcare_ai.training.report --model-dir artifacts/exp_a_pv_only_mobilenetv3 artifacts/classifier

# 4. Severity model (PlantSeg COCO annotations) and offline export
python -m cropcare_ai.training.train_segmenter --train-coco ... --train-images ... --val-coco ... --val-images ...
python -m cropcare_ai.training.export_onnx
```

Training refuses to start if any validation/test image is byte-identical to a training image.

## Run the API

```bash
pip install -r requirements-dev.txt     # CPU PyTorch: see the note in requirements.txt
python -m cropcare_ai.api.main          # http://127.0.0.1:8000/docs
python -m pytest                        # tests
```

Settings (environment variables or `ai-service/.env`):

| Variable | Default |
|---|---|
| `CROPCARE_CLASSIFIER_DIR` | `artifacts/classifier` |
| `CROPCARE_SEVERITY_DIR` | `artifacts/severity` (optional; no severity if missing) |
| `CROPCARE_GATE` | `energy`; `bioclip` adds the BioCLIP check (`pip install open_clip_torch`, ~600 MB download); `off` disables |
| `CROPCARE_BIOCLIP_THRESHOLD` | `0.3` |
| `CROPCARE_DEVICE` | `cpu` |
| `CROPCARE_PORT` | `8000` |

## Adding a crop or disease

1. Add the class to `configs/taxonomy.yaml` with the folder-name aliases of its datasets.
2. Add an entry with the same `code` to `backend/src/main/resources/seed/diseases.json`
   (and a rule to `weather_rules.json` if weather matters).
3. Prepare the dataset, add its manifest to the training config, retrain.
