import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.config import settings
from app.core.logging import logger
from app.database.models import Movie, MovieEmbedding
from app.schemas.search import MovieSearchResult
from app.services.embedding_service import EmbeddingService

class RetrievalService:
    @staticmethod
    def reciprocal_rank_fusion(
        vector_rankings: List[Dict[str, Any]],
        fts_rankings: List[Dict[str, Any]],
        k: int = 60,
        vector_weight: float = 0.7,
        fts_weight: float = 0.3
    ) -> List[Dict[str, Any]]:
        """
        Combines disparate ranking lists via Reciprocal Rank Fusion (RRF).
        RRF Score(d) = sum( weight / (k + rank) )
        """
        rrf_scores: Dict[uuid.UUID, Dict[str, Any]] = {}

        # 1. Process Vector Candidates
        for rank, item in enumerate(vector_rankings, start=1):
            mid = item["id"]
            if mid not in rrf_scores:
                rrf_scores[mid] = {**item, "rrf_score": 0.0, "vector_rank": rank, "fts_rank": None}
            score_contrib = vector_weight / (k + rank)
            rrf_scores[mid]["rrf_score"] += score_contrib
            rrf_scores[mid]["vector_score"] = item.get("score", 0.0)

        # 2. Process Full-Text Search Candidates
        for rank, item in enumerate(fts_rankings, start=1):
            mid = item["id"]
            if mid not in rrf_scores:
                rrf_scores[mid] = {**item, "rrf_score": 0.0, "vector_rank": None, "fts_rank": rank}
            else:
                rrf_scores[mid]["fts_rank"] = rank
            score_contrib = fts_weight / (k + rank)
            rrf_scores[mid]["rrf_score"] += score_contrib
            rrf_scores[mid]["fts_score"] = item.get("score", 0.0)

        # Sort descending by RRF score
        sorted_results = sorted(rrf_scores.values(), key=lambda x: x["rrf_score"], reverse=True)
        return sorted_results

    @classmethod
    def search_hybrid(
        cls,
        db: Session,
        query: str,
        genre: Optional[str] = None,
        language: Optional[str] = None,
        min_rating: Optional[float] = None,
        limit: int = 10,
        hybrid: bool = True
    ) -> List[MovieSearchResult]:
        """
        Executes hybrid semantic search combining pgvector ANN with PostgreSQL full-text search.
        """
        query_text = query.strip()
        if not query_text:
            return []

        # 1. Vector Search Candidates
        vector_candidates = []
        try:
            query_vector = EmbeddingService.embed_text(query_text)
            vector_str = "[" + ",".join(str(x) for x in query_vector) + "]"

            # Cosine distance query with pgvector (<=>)
            vector_sql = """
                SELECT m.id, m.title, m.description, m.genre, m.language,
                       m.rating, m.poster_url, m.release_date,
                       1 - (me.embedding <=> :vector_str::vector) AS similarity
                FROM movies m
                JOIN movie_embeddings me ON m.id = me.movie_id
                WHERE m.is_active = true
            """
            params: Dict[str, Any] = {"vector_str": vector_str, "fetch_limit": limit * 2}

            if genre:
                vector_sql += " AND m.genre ILIKE :genre"
                params["genre"] = f"%{genre}%"
            if language:
                vector_sql += " AND LOWER(m.language) = LOWER(:language)"
                params["language"] = language
            if min_rating is not None:
                vector_sql += " AND m.rating >= :min_rating"
                params["min_rating"] = min_rating

            vector_sql += " ORDER BY me.embedding <=> :vector_str::vector LIMIT :fetch_limit"

            rows = db.execute(text(vector_sql), params).fetchall()
            for r in rows:
                vector_candidates.append({
                    "id": r.id,
                    "title": r.title,
                    "description": r.description,
                    "genre": r.genre,
                    "language": r.language,
                    "rating": float(r.rating) if r.rating else None,
                    "poster_url": r.poster_url,
                    "release_date": str(r.release_date),
                    "score": float(r.similarity),
                    "retrieval_method": "vector"
                })
        except Exception as e:
            logger.warning(f"Vector search execution failed (falling back to lexical): {str(e)}")

        # If not hybrid, return vector results directly
        if not hybrid:
            return [
                MovieSearchResult(
                    id=c["id"],
                    title=c["title"],
                    description=c["description"],
                    genre=c["genre"],
                    language=c["language"],
                    rating=c["rating"],
                    poster_url=c["poster_url"],
                    release_date=c["release_date"],
                    similarity_score=round(c["score"], 4),
                    retrieval_method="vector"
                )
                for c in vector_candidates[:limit]
            ]

        # 2. Full-Text Search Candidates
        fts_candidates = []
        try:
            fts_sql = """
                SELECT m.id, m.title, m.description, m.genre, m.language,
                       m.rating, m.poster_url, m.release_date,
                       ts_rank_cd(to_tsvector('english', m.title || ' ' || COALESCE(m.description, '') || ' ' || COALESCE(m.genre, '')), plainto_tsquery('english', :fts_query)) AS rank
                FROM movies m
                WHERE m.is_active = true
                  AND to_tsvector('english', m.title || ' ' || COALESCE(m.description, '') || ' ' || COALESCE(m.genre, '')) @@ plainto_tsquery('english', :fts_query)
            """
            fts_params: Dict[str, Any] = {"fts_query": query_text, "fetch_limit": limit * 2}

            if genre:
                fts_sql += " AND m.genre ILIKE :genre"
                fts_params["genre"] = f"%{genre}%"
            if language:
                fts_sql += " AND LOWER(m.language) = LOWER(:language)"
                fts_params["language"] = language
            if min_rating is not None:
                fts_sql += " AND m.rating >= :min_rating"
                fts_params["min_rating"] = min_rating

            fts_sql += " ORDER BY rank DESC LIMIT :fetch_limit"

            fts_rows = db.execute(text(fts_sql), fts_params).fetchall()
            for r in fts_rows:
                fts_candidates.append({
                    "id": r.id,
                    "title": r.title,
                    "description": r.description,
                    "genre": r.genre,
                    "language": r.language,
                    "rating": float(r.rating) if r.rating else None,
                    "poster_url": r.poster_url,
                    "release_date": str(r.release_date),
                    "score": float(r.rank),
                    "retrieval_method": "fts"
                })
        except Exception as e:
            logger.warning(f"Full-text search execution failed: {str(e)}")

        # 3. Reciprocal Rank Fusion
        fused = cls.reciprocal_rank_fusion(vector_candidates, fts_candidates)

        results = []
        for item in fused[:limit]:
            # Normalize RRF score to 0..1 range
            norm_score = min(1.0, round(item.get("rrf_score", 0.0) * 10.0, 4))
            results.append(MovieSearchResult(
                id=item["id"],
                title=item["title"],
                description=item["description"],
                genre=item["genre"],
                language=item["language"],
                rating=item["rating"],
                poster_url=item["poster_url"],
                release_date=item["release_date"],
                similarity_score=norm_score,
                retrieval_method="hybrid" if item.get("vector_rank") and item.get("fts_rank") else ("vector" if item.get("vector_rank") else "fts")
            ))

        return results
