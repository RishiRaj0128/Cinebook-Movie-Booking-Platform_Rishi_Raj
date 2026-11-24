import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import ChatSession, ChatMessage
from app.schemas.chat import (
    ChatMessageRequest, ChatMessageResponse, ChatSessionSummary, ToolExecutionInfo
)
from app.core.security import get_current_user, AuthenticatedUser
from app.agents.graph import CineBookAgent
from app.core.logging import logger

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
    # 1. Resolve or create chat session
    session_id = request.session_id
    if session_id:
        # Verify session ownership
        session = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == user.user_id
        ).first()
        if not session:
            session_id = uuid.uuid4()
            session = ChatSession(
                id=session_id,
                user_id=user.user_id,
                session_title=request.message[:40] + "...",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(session)
            db.commit()
    else:
        session_id = uuid.uuid4()
        session = ChatSession(
            id=session_id,
            user_id=user.user_id,
            session_title=request.message[:40] + "...",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(session)
        db.commit()

    # 2. Persist user message
    user_msg_id = uuid.uuid4()
    user_msg = ChatMessage(
        id=user_msg_id,
        session_id=session_id,
        user_id=user.user_id,
        role="user",
        content=request.message,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user_msg)
    db.commit()

    # 3. Retrieve short-term history for context
    history_rows = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).limit(10).all()

    chat_history = [
        {"role": row.role, "content": row.content}
        for row in history_rows if row.role in ["user", "assistant"]
    ]

    # 4. Execute Agentic Reasoning Loop
    agent_result = CineBookAgent.run(
        user_message=request.message,
        db=db,
        user_id=user.user_id,
        session_id=session_id,
        chat_history=chat_history
    )

    # 5. Persist assistant reply
    assistant_msg_id = uuid.uuid4()
    assistant_msg = ChatMessage(
        id=assistant_msg_id,
        session_id=session_id,
        user_id=user.user_id,
        role="assistant",
        content=agent_result["response"],
        created_at=datetime.now(timezone.utc)
    )
    db.add(assistant_msg)

    # Update session timestamp
    session.updated_at = datetime.now(timezone.utc)
    db.commit()

    tool_info = [
        ToolExecutionInfo(
            tool_name=tc.get("tool_name", "tool"),
            arguments={},
            status=tc.get("status", "SUCCESS"),
            duration_ms=tc.get("duration_ms", 10)
        )
        for tc in agent_result.get("tool_calls", [])
    ]

    return ChatMessageResponse(
        session_id=session_id,
        message_id=assistant_msg_id,
        role="assistant",
        content=agent_result["response"],
        tool_calls=tool_info,
        recommended_movies=agent_result.get("recommended_movies", []),
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
    sessions = db.query(ChatSession).filter(
        ChatSession.user_id == user.user_id,
        ChatSession.is_active == True
    ).order_by(ChatSession.updated_at.desc()).limit(20).all()

    return [
        ChatSessionSummary(
            id=s.id,
            title=s.session_title,
            is_active=s.is_active,
            created_at=s.created_at.isoformat() if s.created_at else "",
            updated_at=s.updated_at.isoformat() if s.updated_at else "",
            message_count=db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
        )
        for s in sessions
    ]
