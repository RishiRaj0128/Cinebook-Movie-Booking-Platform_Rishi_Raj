import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500, description="Natural language search prompt")
    genre: Optional[str] = Field(None, description="Optional genre filter")
    language: Optional[str] = Field(None, description="Optional language filter (e.g. Hindi, English)")
    min_rating: Optional[float] = Field(None, ge=0.0, le=10.0, description="Minimum movie rating")
    limit: int = Field(default=10, ge=1, le=50, description="Number of results to return")
    hybrid: bool = Field(default=True, description="Whether to combine vector similarity with BM25 full-text search")

class MovieSearchResult(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    genre: str
    language: str
    rating: Optional[float] = None
    poster_url: Optional[str] = None
    release_date: str
    similarity_score: float
    retrieval_method: str = "hybrid"  # vector, fts, or hybrid

class SemanticSearchResponse(BaseModel):
    query: str
    total_found: int
    results: List[MovieSearchResult]
    execution_time_ms: float
