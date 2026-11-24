import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.database.models import ChatSession, ChatMessage
from app.core.logging import logger

class ConversationManager:
    @staticmethod
    def get_or_create_session(
        db: Session,
        user_id: uuid.UUID,
        session_id: Optional[uuid.UUID] = None,
        initial_title: str = "New Conversation"
    ) -> ChatSession:
        """
        Retrieves an existing session owned by user_id or provisions a new one.
        Guarantees strict ownership isolation at query time.
        """
        if session_id:
            session = db.query(ChatSession).filter(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id,
                ChatSession.is_active == True
            ).first()
            if session:
                return session

        new_session = ChatSession(
            id=uuid.uuid4(),
            user_id=user_id,
            session_title=initial_title[:250],
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session

    @staticmethod
    def append_message(
        db: Session,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ChatMessage:
        """
        Appends message with compound (session_id, user_id) foreign key constraint.
        """
        import json
        msg = ChatMessage(
            id=uuid.uuid4(),
            session_id=session_id,
            user_id=user_id,
            role=role,
            content=content,
            message_metadata=json.dumps(metadata) if metadata else None,
            created_at=datetime.now(timezone.utc)
        )
        db.add(msg)
        # Update session timestamp
        db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == user_id
        ).update({"updated_at": datetime.now(timezone.utc)})
        db.commit()
        return msg

    @staticmethod
    def get_recent_history(
        db: Session,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        limit: int = 10
    ) -> List[Dict[str, str]]:
        """
        Retrieves ordered chronological sliding window of recent messages for context injection.
        """
        rows = db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id,
            ChatMessage.user_id == user_id
        ).order_by(ChatMessage.created_at.asc()).limit(limit).all()

        return [
            {"role": r.role, "content": r.content}
            for r in rows if r.role in ["user", "assistant"]
        ]
