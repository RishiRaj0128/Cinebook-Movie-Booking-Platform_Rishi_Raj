import uuid
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class FeedbackSubmissionRequest(BaseModel):
    recommendation_event_id: Optional[uuid.UUID] = None
    movie_id: uuid.UUID
    feedback_type: str = Field(..., description="THUMBS_UP, THUMBS_DOWN, STAR_RATING, ACCEPTED, DISMISSED")
    rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)

class InteractionLogRequest(BaseModel):
    movie_id: uuid.UUID
    interaction_type: str = Field(..., description="VIEW_DETAILS, WATCH_TRAILER, SEARCH_CLICK, SHARE")
    context_metadata: Optional[Dict[str, Any]] = None

class FeedbackResponse(BaseModel):
    success: bool = True
    message: str = "Feedback recorded successfully"
