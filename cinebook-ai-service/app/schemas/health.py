from datetime import datetime, timezone
from typing import Dict, Any
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    environment: str

class ReadinessResponse(BaseModel):
    ready: bool
    database_connected: bool
    embedding_model_loaded: bool
    details: Dict[str, Any] = {}
