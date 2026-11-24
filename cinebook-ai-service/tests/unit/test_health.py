def test_health_check_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "timestamp" in data

def test_root_endpoint_returns_metadata(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"
    assert "service" in data

def test_correlation_id_header_in_response(client):
    response = client.get("/health", headers={"X-Correlation-ID": "test-corr-123"})
    assert response.status_code == 200
    assert response.headers.get("X-Correlation-ID") == "test-corr-123"
    assert "X-Response-Time-Ms" in response.headers
