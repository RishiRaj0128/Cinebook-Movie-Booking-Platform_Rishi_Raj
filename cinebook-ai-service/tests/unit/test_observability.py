"""Unit tests for Prometheus observability and metrics."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.observability.metrics import (
    record_tool_execution,
    record_retrieval_latency,
    record_embedding_latency,
    record_tokens,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_metrics_endpoint_accessible(client):
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "cinebook_ai_http_requests_total" in response.text


def test_recording_functions_observe_without_error(client):
    # Call recording helpers
    record_tool_execution(tool_name="search_movies", status="success")
    record_retrieval_latency(duration_seconds=0.042, mode="hybrid")
    record_embedding_latency(duration_seconds=0.015)
    record_tokens(count=150, model="llama3-70b-8192", token_type="total")

    # Verify they appear in the metrics output
    response = client.get("/metrics")
    assert response.status_code == 200
    assert 'tool_name="search_movies"' in response.text
    assert 'mode="hybrid"' in response.text
    assert 'model="llama3-70b-8192"' in response.text
