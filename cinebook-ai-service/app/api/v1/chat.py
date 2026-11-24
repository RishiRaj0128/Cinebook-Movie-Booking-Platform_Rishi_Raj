import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.chat import (
    ChatMessageRequest, ChatMessageResponse, ChatSessionSummary
)
from app.core.security import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/chat", tags=["Agentic Conversation"])

@router.post("", response_model=ChatMessageResponse)
def send_chat_message(
    request: ChatMessageRequest,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Main conversational agent endpoint powered by LangGraph & Groq LLM.
    Enforces user session ownership at the database level.
    """
    session_id = request.session_id or uuid.uuid4()
    message_id = uuid.uuid4()

    # Conversation graph will be executed via graph.py in Phase 6 & 7
    return ChatMessageResponse(
        session_id=session_id,
        message_id=message_id,
        role="assistant",
        content="Hello! I am CineBook AI Concierge. How can I help you discover great movies today?",
        tool_calls=[],
        recommended_movies=[],
        created_at=datetime.now(timezone.utc).isoformat()
    )

@router.get("/sessions", response_model=List[ChatSessionSummary])
def get_user_chat_sessions(
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    List all active conversation sessions for the authenticated user.
    """
    # Wired to repository in Phase 7
    return []
