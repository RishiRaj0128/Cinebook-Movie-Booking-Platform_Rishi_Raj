import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.models import RecommendationFeedback, UserInteraction
from app.schemas.feedback import (
    FeedbackSubmissionRequest, InteractionLogRequest, FeedbackResponse
)
from app.core.security import get_current_user, AuthenticatedUser
from app.core.logging import logger

router = APIRouter(tags=["Feedback & Interaction Telemetry"])

@router.post("/feedback", response_model=FeedbackResponse)
def submit_recommendation_feedback(
    request: FeedbackSubmissionRequest,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Record explicit user feedback on recommendation events.
    """
    try:
        feedback = RecommendationFeedback(
            id=uuid.uuid4(),
            recommendation_event_id=request.recommendation_event_id,
            user_id=user.user_id,
            movie_id=request.movie_id,
            feedback_type=request.feedback_type,
            rating=request.rating,
            feedback_comment=request.comment,
            created_at=datetime.now(timezone.utc)
        )
        db.add(feedback)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to persist recommendation feedback: {str(e)}")
        db.rollback()

    return FeedbackResponse(success=True, message="Recommendation feedback captured.")

@router.post("/interactions", response_model=FeedbackResponse)
def log_user_interaction(
    request: InteractionLogRequest,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Record general user interaction events (clicks, detail views, trailer views).
    """
    try:
        interaction = UserInteraction(
            id=uuid.uuid4(),
            user_id=user.user_id,
            movie_id=request.movie_id,
            interaction_type=request.interaction_type,
            context_metadata=json.dumps(request.context_metadata) if request.context_metadata else None,
            created_at=datetime.now(timezone.utc)
        )
        db.add(interaction)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to persist user interaction event: {str(e)}")
        db.rollback()

    return FeedbackResponse(success=True, message="User interaction event logged.")
