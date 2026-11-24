import uuid
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Path, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.core.security import get_current_user, AuthenticatedUser
from app.memory.long_term import UserMemoryService

router = APIRouter(prefix="/memory", tags=["User Memory & Privacy"])

class MemoryItemResponse(BaseModel):
    id: uuid.UUID
    content: str
    category: str
    importance: int
    source: str
    created_at: str

class CreateMemoryRequest(BaseModel):
    content: str = Field(..., min_length=2, max_length=500)
    category: str = Field(default="GENERAL", description="GENRE_PREFERENCE, ACTOR_PREFERENCE, DISLIKE, GENERAL")
    importance: int = Field(default=5, ge=1, le=10)

class DeleteMemoryResponse(BaseModel):
    success: bool
    message: str

@router.get("", response_model=List[MemoryItemResponse])
def list_user_memories(
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    List all active durable memories stored for the authenticated user.
    """
    memories = UserMemoryService.get_user_memories(db=db, user_id=user.user_id)
    return [
        MemoryItemResponse(
            id=m.id,
            content=m.memory_content,
            category=m.memory_category,
            importance=m.importance_score,
            source=m.source,
            created_at=m.created_at.isoformat() if m.created_at else ""
        )
        for m in memories
    ]

@router.delete("/{memory_id}", response_model=DeleteMemoryResponse)
def delete_user_memory(
    memory_id: uuid.UUID = Path(..., description="ID of memory to delete"),
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Deletes user memory with strict user ownership validation.
    """
    deleted = UserMemoryService.delete_user_memory(db=db, user_id=user.user_id, memory_id=memory_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found or not owned by user.")
    return DeleteMemoryResponse(success=True, message="Memory successfully deleted.")
