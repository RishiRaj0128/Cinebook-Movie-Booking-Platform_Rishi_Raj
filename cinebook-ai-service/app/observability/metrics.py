"""Prometheus observability and telemetry metrics for CineBook AI Service."""

import time
from typing import Callable
from fastapi import Request, Response
from prometheus_client import (
    Counter,
    Histogram,
    make_asgi_app,
    REGISTRY,
)

# HTTP Request Metrics
REQUEST_COUNT = Counter(
    "cinebook_ai_http_requests_total",
    "Total HTTP requests handled by the CineBook AI service",
    ["method", "endpoint", "status_code"],
)

REQUEST_LATENCY = Histogram(
    "cinebook_ai_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# AI Core Metrics
TOOL_EXECUTION_COUNT = Counter(
    "cinebook_ai_tool_executions_total",
    "Total AI agent tool invocations",
    ["tool_name", "status"],
)

RETRIEVAL_LATENCY = Histogram(
    "cinebook_ai_retrieval_duration_seconds",
    "Latency of hybrid and semantic movie retrieval in seconds",
    ["mode"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

EMBEDDING_LATENCY = Histogram(
    "cinebook_ai_embedding_duration_seconds",
    "Latency of text embedding vector calculation in seconds",
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
)

LLM_TOKEN_COUNT = Counter(
    "cinebook_ai_llm_tokens_total",
    "Estimated tokens consumed by LLM calls",
    ["model", "type"],
)


async def prometheus_metrics_middleware(request: Request, call_next: Callable) -> Response:
    """Middleware to measure HTTP request count and latency."""
    if request.url.path in ("/metrics", "/health", "/ready"):
        return await call_next(request)

    start_time = time.time()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration = time.time() - start_time
        endpoint = request.url.path
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=endpoint,
            status_code=str(status_code),
        ).inc()
        REQUEST_LATENCY.labels(
            method=request.method,
            endpoint=endpoint,
        ).observe(duration)


def record_tool_execution(tool_name: str, status: str = "success") -> None:
    """Record an agent tool execution event."""
    TOOL_EXECUTION_COUNT.labels(tool_name=tool_name, status=status).inc()


def record_retrieval_latency(duration_seconds: float, mode: str = "hybrid") -> None:
    """Record search retrieval duration."""
    RETRIEVAL_LATENCY.labels(mode=mode).observe(duration_seconds)


def record_embedding_latency(duration_seconds: float) -> None:
    """Record embedding computation duration."""
    EMBEDDING_LATENCY.observe(duration_seconds)


def record_tokens(count: int, model: str = "llama3-70b-8192", token_type: str = "total") -> None:
    """Record LLM token usage."""
    if count > 0:
        LLM_TOKEN_COUNT.labels(model=model, type=token_type).inc(count)


def create_metrics_app():
    """Mountable ASGI app exposing /metrics endpoint."""
    return make_asgi_app(registry=REGISTRY)
