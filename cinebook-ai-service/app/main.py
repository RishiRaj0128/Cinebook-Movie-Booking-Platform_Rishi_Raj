import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.logging import setup_logging, logger
from app.core.exceptions import register_exception_handlers
from app.api.v1.health import router as health_router
from app.api.v1.search import router as search_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.chat import router as chat_router
from app.api.v1.feedback import router as feedback_router
from app.api.v1.memory import router as memory_router
from app.observability.metrics import prometheus_metrics_middleware, create_metrics_app

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging(settings.LOG_LEVEL)
    logger.info(
        f"Starting {settings.APP_NAME} v{settings.APP_VERSION} [env={settings.ENVIRONMENT}]",
        extra={"environment": settings.ENVIRONMENT}
    )
    yield
    # Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}...")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Dedicated microservice for CineBook Agentic AI, semantic search, hybrid retrieval & recommendation workflows.",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG or settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.DEBUG or settings.ENVIRONMENT != "production" else None,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Correlation ID and Request Timing Middleware
@app.middleware("http")
async def correlation_id_and_timing_middleware(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
    start_time = time.time()

    # Pass correlation ID to response headers
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Response-Time-Ms"] = str(duration_ms)

    # Log request summary
    logger.info(
        f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
        extra={
            "correlation_id": correlation_id,
            "path": request.url.path,
            "duration_ms": duration_ms,
        }
    )
    return response

# Register Exception Handlers
register_exception_handlers(app)

# Prometheus Observability Middleware & Endpoint
app.middleware("http")(prometheus_metrics_middleware)
metrics_app = create_metrics_app()
app.mount("/metrics", metrics_app)

# Include Routers
app.include_router(health_router)
app.include_router(search_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(feedback_router, prefix="/api/v1")
app.include_router(memory_router, prefix="/api/v1")

@app.get("/")
def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs"
    }
