import time
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.search import SemanticSearchRequest, SemanticSearchResponse, MovieSearchResult
from app.core.security import get_optional_user, AuthenticatedUser
from app.services.retrieval_service import RetrievalService

router = APIRouter(prefix="/search", tags=["Semantic Search"])

@router.post("/semantic", response_model=SemanticSearchResponse)
def semantic_search(
    request: SemanticSearchRequest,
    db: Session = Depends(get_db),
    user: Optional[AuthenticatedUser] = Depends(get_optional_user)
):
    """
    Semantic & Hybrid Movie Search endpoint.
    Combines vector cosine similarity with full-text search using Reciprocal Rank Fusion.
    """
    start_time = time.time()

    results = RetrievalService.search_hybrid(
        db=db,
        query=request.query,
        genre=request.genre,
        language=request.language,
        min_rating=request.min_rating,
        limit=request.limit,
        hybrid=request.hybrid
    )

    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    return SemanticSearchResponse(
        query=request.query,
        total_found=len(results),
        results=results,
        execution_time_ms=execution_time_ms
    )
