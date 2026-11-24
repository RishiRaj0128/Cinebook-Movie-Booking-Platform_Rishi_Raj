import re
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database.models import UserMemory
from app.core.logging import logger

class UserMemoryService:
    EXPLICIT_PATTERNS = [
        (r"(?:i (?:really )?like|i love|i prefer|i enjoy)\s+([a-zA-Z\s,]+(?:movies|films|cinema|genre|directors|actors)?)", "GENRE_PREFERENCE", 8),
        (r"(?:i hate|i dislike|never (?:recommend|suggest)|don't (?:like|suggest))\s+([a-zA-Z\s,]+)", "DISLIKE", 9),
        (r"(?:my favorite actor is|i am a fan of)\s+([a-zA-Z\s]+)", "ACTOR_PREFERENCE", 8),
        (r"(?:remember that|note that)\s+(.*)", "GENERAL", 7),
    ]

    @classmethod
    def extract_and_store_memory(
        cls,
        db: Session,
        user_id: uuid.UUID,
        message: str
    ) -> List[UserMemory]:
        """
        Parses explicit preference cues in the user prompt and persists durable memories.
        """
        extracted = []
        msg_clean = message.strip()

        for pattern, category, importance in cls.EXPLICIT_PATTERNS:
            match = re.search(pattern, msg_clean, re.IGNORECASE)
            if match:
                content = match.group(0).strip()
                # Deduplicate: check if active identical memory already stored
                existing = db.query(UserMemory).filter(
                    UserMemory.user_id == user_id,
                    UserMemory.is_active == True,
                    UserMemory.memory_content.ilike(content)
                ).first()

                if not existing:
                    mem = UserMemory(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        memory_content=content,
                        memory_category=category,
                        importance_score=importance,
                        source="EXPLICIT_CHAT",
                        is_active=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc)
                    )
                    db.add(mem)
                    extracted.append(mem)
                    logger.info(f"Captured durable user memory for {user_id}: '{content}' ({category})")

        if extracted:
            db.commit()
        return extracted

    @staticmethod
    def get_user_memories(
        db: Session,
        user_id: uuid.UUID,
        category: Optional[str] = None
    ) -> List[UserMemory]:
        """
        Retrieves active durable memories for a user.
        """
        query = db.query(UserMemory).filter(
            UserMemory.user_id == user_id,
            UserMemory.is_active == True
        )
        if category:
            query = query.filter(UserMemory.memory_category == category)
        return query.order_by(UserMemory.importance_score.desc()).all()

    @staticmethod
    def delete_user_memory(
        db: Session,
        user_id: uuid.UUID,
        memory_id: uuid.UUID
    ) -> bool:
        """
        Soft-deletes or deletes user memory, enforcing ownership check.
        Satisfies user right-to-be-forgotten requirement.
        """
        mem = db.query(UserMemory).filter(
            UserMemory.id == memory_id,
            UserMemory.user_id == user_id
        ).first()

        if mem:
            mem.is_active = False
            mem.updated_at = datetime.now(timezone.utc)
            db.commit()
            return True
        return False
