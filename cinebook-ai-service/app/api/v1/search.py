import time
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.search import SemanticSearchRequest, SemanticSearchResponse, MovieSearchResult
from app.core.security import get_optional_user, AuthenticatedUser

router = APIRouter(prefix="/search", tags=["Semantic Search"])

@router.post("/semantic", response_model=SemanticSearchResponse)
def semantic_search(
    request: SemanticSearchRequest,
    db: Session = Depends(get_db),
    user: Optional[AuthenticatedUser] = Depends(get_optional_user)
):
    """
    Semantic & Hybrid Movie Search endpoint.
    Combines vector cosine similarity with full-text search.
    """
    start_time = time.time()

    # Search execution will be wired into retrieval_service in Phase 3 & 4
    # For Phase 2 baseline validation, return typed empty result structure
    results = []
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    return SemanticSearchResponse(
        query=request.query,
        total_found=len(results),
        results=results,
        execution_time_ms=execution_time_ms
    )
