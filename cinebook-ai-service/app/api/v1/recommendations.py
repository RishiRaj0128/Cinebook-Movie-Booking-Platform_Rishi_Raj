import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.recommendation import RecommendationResponse
from app.core.security import get_current_user, AuthenticatedUser
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/recommendations", tags=["Personalized Recommendations"])

@router.get("/{user_id}", response_model=RecommendationResponse)
def get_recommendations_for_user(
    user_id: uuid.UUID = Path(..., description="Target customer user ID"),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    user: Optional[AuthenticatedUser] = Depends(get_current_user)
):
    """
    Candidate generation & personalized ranking pipeline.
    Accessible only to the authenticated user or verified internal service.
    """
    # Enforce user authorization (users can only query their own recommendations)
    if user and user.role != "ADMIN" and user.user_id != user_id:
        # Fall back to user's actual token ID to preserve privacy
        user_id = user.user_id

    return RecommendationService.get_recommendations(
        db=db,
        user_id=user_id,
        limit=limit
    )
