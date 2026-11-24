import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User conversational prompt")
    session_id: Optional[uuid.UUID] = Field(None, description="Active session ID, or None to initialize a new session")

class ToolExecutionInfo(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]
    status: str
    duration_ms: int

class ChatMessageResponse(BaseModel):
    session_id: uuid.UUID
    message_id: uuid.UUID
    role: str = "assistant"
    content: str
    tool_calls: List[ToolExecutionInfo] = []
    recommended_movies: List[Dict[str, Any]] = []
    created_at: str

class ChatSessionSummary(BaseModel):
    id: uuid.UUID
    title: str
    is_active: bool
    created_at: str
    updated_at: str
    message_count: int
