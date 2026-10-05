"""HTTP API for the Spring Boot backend.

  python -m cropcare_ai.api.main          (or: uvicorn cropcare_ai.api.main:app --port 8000)

GET  /health       is the service up, which models are loaded
GET  /model-info   classes, calibration, measured metrics per test set
POST /predict      multipart field "images" (1-5 photos of one plant) or "image" (one photo)
                   query: explain=true adds Grad-CAM + lesion overlays, severity=false skips severity
Interactive docs: http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from cropcare_ai import __version__
from cropcare_ai.inference.engine import ModelNotLoaded, Predictor
from cropcare_ai.inference.imaging import InvalidImage
from cropcare_ai.settings import Settings, get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("cropcare_ai")


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.predictor = Predictor(settings)
        yield

    app = FastAPI(title="CropCare AI service", version=__version__, lifespan=lifespan)

    @app.exception_handler(ApiError)
    async def api_error(_: Request, error: ApiError):
        return JSONResponse({"success": False, "message": error.message}, status_code=error.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, error: RequestValidationError):
        return JSONResponse({"success": False, "message": "Invalid request: " + str(error.errors()[0].get("msg"))},
                            status_code=400)

    @app.get("/health")
    def health(request: Request):
        predictor: Predictor = request.app.state.predictor
        return {"success": True, "status": "ok", "version": __version__, "modelLoaded": predictor.loaded,
                "severityModel": predictor.severity is not None}

    @app.get("/model-info")
    def model_info(request: Request):
        return request.app.state.predictor.info()

    @app.post("/predict")
    def predict(
        request: Request,
        images: list[UploadFile] | None = File(None),
        image: UploadFile | None = File(None),
        explain: bool = Query(False),
        severity: bool = Query(True),
    ):
        uploads = list(images or []) + ([image] if image else [])
        if not uploads:
            raise ApiError(400, "No image uploaded")
        if len(uploads) > settings.max_images:
            raise ApiError(400, f"Send at most {settings.max_images} photos at a time")

        limit = settings.max_image_mb * 1024 * 1024
        data = []
        for upload in uploads:
            content = upload.file.read(limit + 1)
            if len(content) > limit:
                raise ApiError(413, f"Each image must be {settings.max_image_mb} MB or less")
            data.append(content)

        try:
            return request.app.state.predictor.predict(data, explain=explain, with_severity=severity)
        except InvalidImage as error:
            raise ApiError(400, str(error))
        except ModelNotLoaded as error:
            raise ApiError(503, str(error))

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    current = get_settings()
    uvicorn.run(app, host=current.host, port=current.port)
