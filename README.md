# CropCare AI: Crop Disease Detection

Upload a photo of a crop leaf, get the likely disease, the model's confidence, and treatment advice.

```
frontend/    React 19 + Vite                    http://localhost:5173
backend/     Java 17, Spring Boot 4, MySQL      http://localhost:5000/api
ai-service/  Python, PyTorch, FastAPI           http://127.0.0.1:8000
```

The browser only talks to the Spring Boot backend. The backend stores users, predictions and the
disease library in MySQL, and sends each uploaded image to the AI service for classification.

`backend-old/` is the previous Node.js/MongoDB backend, kept for reference only.

## The AI

See [ai-service/README.md](ai-service/README.md). In short:

- 26 classes across pepper, potato, tomato, maize, rice and wheat (`ai-service/configs/taxonomy.yaml`)
- trained on lab (PlantVillage) **and** field (PlantDoc, crop datasets) photos on Kaggle,
  and evaluated separately on each, so the lab-to-field accuracy gap is measured, not hidden
- every answer has a status: `confident`, `ambiguous` ("could be A or B"), `unknown` or `rejected`
  (not a supported crop leaf), from calibrated probabilities + conformal prediction + a BioCLIP gate
- severity (% of leaf diseased), Grad-CAM heat maps, and 1-5 photos per diagnosis
- the backend adds weather risk (Open-Meteo forecast) and template-based advice that only
  suggests treatment for confident diagnoses
- Hindi: reviewed disease names in the app; advice machine-translated by the AI service itself
  (Meta's NLLB-200 model run locally with a Hindi farming glossary, `POST /translate`; no account
  or API key). The model (~2.5 GB) downloads on the first Hindi request, then each sentence is
  translated once and stored in MySQL. Bhashini keys in `backend/.env` are optional and take over when set.
- offline mode: an installable app (PWA); after a one-time 31 MB download (Profile → Offline mode)
  the phone diagnoses with MobileNetV3 in the browser and saves photos for full analysis later.
  Try it with `npm run build && npm run preview` (the service worker only runs in a production build).

## Running locally

### 1. MySQL

Start MySQL (WAMP). The backend creates the `cropcare` database and its tables on first start.

### 2. AI service

```bash
cd ai-service
pip install -r requirements-dev.txt
python -m cropcare_ai.api.main
```

It needs a trained model in `ai-service/artifacts/`. Train it with
`ai-service/kaggle/cropcare_training.ipynb` on Kaggle and unzip the downloaded artifacts there.

### 3. Backend

Requires JDK 17 or newer (`JAVA_HOME` must point to it).

```bash
cd backend
cp .env.example .env        # then fill in DB_PASSWORD and JWT_SECRET
./mvnw spring-boot:run      # Windows: mvnw.cmd spring-boot:run
./mvnw test                 # integration tests (in-memory database, MySQL not needed)
```

Without `EMAIL_USER`/`EMAIL_PASSWORD`, password-reset links are printed in the backend console.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

## API

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | – |
| POST | `/api/auth/forgot-password`, `/api/auth/reset-password/{token}` | – |
| GET | `/api/auth/me` | ✔ |
| POST | `/api/auth/change-password` | ✔ |
| POST | `/api/predictions/detect`: multipart `images` (1-5) or `image`; optional `lat`, `lon`, `explain=true` | ✔ |
| GET | `/api/predictions/history`, `/api/predictions/{id}` (includes advice) | ✔ |
| GET | `/api/predictions/{id}/images/{index}` | ✔ |
| POST | `/api/predictions/{id}/feedback` `{"correct": false, "actualClassId": "...", "comment": "..."}` | ✔ |
| GET | `/api/weather/risk?crop=potato&lat=..&lon=..` | ✔ |
| GET | `/api/diseases`, `/api/diseases/search?q=`, `/api/diseases/crop/{crop}`, `/api/diseases/{id}` | – |
| GET | `/api/model/info` (classes, calibration, measured accuracy per test set) | – |

Errors always come back as `{"success": false, "message": "..."}`.

## Knowledge base

`backend/src/main/resources/seed/diseases.json` holds symptoms, causes, management, organic options
and sources for every class, and is synced into MySQL on each start. The `chemicalControl` lists are
intentionally empty: fill them only from the CIB&RC registration list / ICAR package of practices
(active ingredient, dose, waiting period, source). Until then the app tells farmers to get a
registered product from their KVK.
