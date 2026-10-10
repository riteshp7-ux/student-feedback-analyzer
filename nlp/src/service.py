import time
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from .config import settings
from .inference import engine
from .schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    HealthResponse,
    ReadinessResponse,
    ErrorDetail
)

# Configure structured logging (avoids printing sensitive feedback text)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("nlp.service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: loads and warms up model artifacts on startup."""
    logger.info("Initializing %s (version %s)...", settings.service_name, settings.version)
    success = engine.load_artifacts()
    if not success:
        logger.warning("Service started with UNAVAILABLE model artifacts: %s", engine.load_error)
    else:
        logger.info("Model pipeline ready for inference.")
    yield
    logger.info("Shutting down %s...", settings.service_name)

app = FastAPI(
    title=settings.service_name,
    version=settings.version,
    description="Isolated Python inference microservice for student feedback sentiment and topic analysis.",
    lifespan=lifespan
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Standardizes client validation error responses without leaking internals."""
    errors = exc.errors()
    error_msg = errors[0].get("msg", "Invalid request body.") if errors else "Validation error."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "UNPROCESSABLE_ENTITY",
            "detail": error_msg,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catches unhandled errors and returns safe generic responses."""
    logger.error("Unhandled exception processing request: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "detail": "An unexpected error occurred during analysis.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )

# -----------------------------------------------------------------------------
# Health and Readiness Probes
# -----------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
def health_check():
    """System health and liveness probe."""
    is_ready = engine.is_ready
    return HealthResponse(
        status="healthy" if is_ready else "degraded",
        version=settings.version,
        timestamp=datetime.now(timezone.utc).isoformat(),
        model_status="ready" if is_ready else "unavailable",
        sentiment_model_version=settings.model_version,
        topic_model_version=settings.model_version,
        dataset_version=settings.dataset_version
    )

@app.get("/api/v1/health", response_model=HealthResponse)
def api_v1_health_check():
    """Versioned health probe."""
    return health_check()

@app.get("/ready", response_model=ReadinessResponse)
def readiness_check():
    """Readiness probe: returns 200 OK if model is loaded and ready, 503 otherwise."""
    if not engine.is_ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unavailable",
                "ready": False,
                "model_version": settings.model_version,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
    return ReadinessResponse(
        status="ready",
        ready=True,
        model_version=settings.model_version,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

# -----------------------------------------------------------------------------
# Inference Endpoints
# -----------------------------------------------------------------------------

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_feedback(payload: AnalyzeRequest):
    """
    Performs deterministic sentiment and multi-label topic inference on student comment.
    Sensitive text is never logged to stdout/stderr.
    """
    if not engine.is_ready:
        logger.error("Rejecting /analyze request: inference engine not ready (%s)", engine.load_error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inference service temporarily unavailable. Model artifacts not loaded."
        )

    start_time = time.perf_counter()
    try:
        result = engine.analyze(payload.text)
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        logger.info(
            "Inference completed in %.2fms | sentiment: %s (%.2f) | topics: %d",
            duration_ms,
            result.sentiment.label,
            result.sentiment.confidence,
            len(result.topics)
        )
        return result
    except Exception as exc:
        logger.error("Inference execution failure: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Inference execution failed."
        )

@app.post("/api/v1/analyze", response_model=AnalyzeResponse)
def api_v1_analyze_feedback(payload: AnalyzeRequest):
    """Versioned inference endpoint matching /analyze contract."""
    return analyze_feedback(payload)
