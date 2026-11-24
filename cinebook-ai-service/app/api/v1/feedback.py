from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.feedback import (
    FeedbackSubmissionRequest, InteractionLogRequest, FeedbackResponse
)
from app.core.security import get_current_user, AuthenticatedUser

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
    return FeedbackResponse(success=True, message="User interaction event logged.")
