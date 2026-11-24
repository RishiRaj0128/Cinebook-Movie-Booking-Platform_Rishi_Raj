import os
import pytest
from fastapi.testclient import TestClient

# Set testing environment variables before loading app
os.environ["ENVIRONMENT"] = "testing"
os.environ["DATABASE_URL"] = "postgresql+psycopg2://postgres:postgres@localhost:5432/cinebook_test"
os.environ["GROQ_API_KEY"] = "mock_groq_api_key_for_testing"

from app.main import app

@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
