from fastapi import APIRouter, Response
from app.config import settings
from app.schemas.health import HealthResponse, ReadinessResponse
from app.database.connection import check_database_connection

router = APIRouter(tags=["Health & Telemetry"])

@router.get("/health", response_model=HealthResponse)
def health_check():
    """
    Liveness probe: verifies process is alive and responsive.
    """
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT
    )

@router.get("/ready", response_model=ReadinessResponse)
def readiness_check():
    """
    Readiness probe: verifies external dependencies (database connectivity).
    """
    db_connected = check_database_connection()
    # In future phases, embedding model readiness will also be probed
    is_ready = db_connected
    return ReadinessResponse(
        ready=is_ready,
        database_connected=db_connected,
        embedding_model_loaded=True,
        details={
            "app_name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "groq_model": settings.GROQ_MODEL
        }
    )

@router.get("/metrics")
def metrics():
    """
    Prometheus metrics exposition endpoint.
    """
    try:
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except ImportError:
        return Response(content="# Prometheus client not installed\n", media_type="text/plain")
