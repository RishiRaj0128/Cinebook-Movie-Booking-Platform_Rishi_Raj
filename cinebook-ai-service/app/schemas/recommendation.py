import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class RecommendationItem(BaseModel):
    movie_id: uuid.UUID
    title: str
    genre: str
    language: str
    rating: Optional[float] = None
    poster_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    ranking_score: float
    recommendation_reason: str
    score_breakdown: Optional[Dict[str, float]] = None

class RecommendationResponse(BaseModel):
    user_id: Optional[uuid.UUID]
    recommendation_event_id: uuid.UUID
    recommendations: List[RecommendationItem]
    model_version: str
    generated_at: str
    execution_time_ms: float
