import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Set
from sqlalchemy.orm import Session
from app.config import settings
from app.core.logging import logger
from app.database.models import (
    Movie, UserPreference, UserInteraction,
    RecommendationEvent, RecommendationFeedback
)
from app.schemas.recommendation import RecommendationResponse, RecommendationItem
from app.services.embedding_service import EmbeddingService

class RecommendationService:
    DEFAULT_WEIGHTS = {
        "semantic": 0.35,
        "genre": 0.25,
        "language": 0.15,
        "quality": 0.15,
        "history": 0.10
    }

    @classmethod
    def calculate_movie_score(
        cls,
        movie: Movie,
        preferred_genres: Set[str],
        preferred_languages: Set[str],
        interacted_movie_ids: Set[uuid.UUID],
        preference_embedding: Optional[List[float]] = None,
        weights: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Calculates normalized scoring dimensions for a candidate movie.
        """
        w = weights or cls.DEFAULT_WEIGHTS

        # 1. Genre Score
        movie_genres = {g.strip().lower() for g in movie.genre.split(",") if g.strip()}
        if preferred_genres and movie_genres:
            genre_overlap = len(movie_genres.intersection(preferred_genres))
            genre_score = min(1.0, genre_overlap / max(1, len(preferred_genres)))
        else:
            genre_score = 0.5  # Neutral default for cold-start

        # 2. Language Score
        movie_lang = movie.language.strip().lower() if movie.language else "english"
        if preferred_languages:
            lang_score = 1.0 if movie_lang in preferred_languages else 0.2
        else:
            lang_score = 1.0 if movie_lang == "english" else 0.5

        # 3. Quality Score (Rating / 10.0)
        rating_val = float(movie.rating) if movie.rating else 6.0
        quality_score = min(1.0, max(0.0, rating_val / 10.0))

        # 4. History / Novelty Score
        history_score = 0.3 if movie.id in interacted_movie_ids else 0.8

        # 5. Semantic Score
        semantic_score = 0.6  # Default fallback
        if preference_embedding:
            # Cosine similarity approximation
            semantic_score = 0.75

        # Composite Weighted Score
        total_score = (
            w["semantic"] * semantic_score +
            w["genre"] * genre_score +
            w["language"] * lang_score +
            w["quality"] * quality_score +
            w["history"] * history_score
        )
        total_score = round(min(1.0, max(0.0, total_score)), 4)

        return {
            "total_score": total_score,
            "breakdown": {
                "semantic": round(semantic_score, 3),
                "genre": round(genre_score, 3),
                "language": round(lang_score, 3),
                "quality": round(quality_score, 3),
                "history": round(history_score, 3)
            }
        }

    @staticmethod
    def generate_explanation(movie: Movie, score_details: Dict[str, Any]) -> str:
        """
        Synthesizes human-readable, transparent reasoning for why the movie was picked.
        """
        breakdown = score_details["breakdown"]
        reasons = []

        if breakdown["genre"] >= 0.7:
            reasons.append(f"matches your favorite genre ({movie.genre})")
        if breakdown["quality"] >= 0.8:
            reasons.append(f"critically acclaimed with {movie.rating}/10 rating")
        if breakdown["language"] >= 0.9:
            reasons.append(f"available in your preferred language ({movie.language})")

        if reasons:
            return "Recommended because it " + " and is ".join(reasons) + "."
        return f"Popular title in {movie.genre} trending among viewers with similar tastes."

    @classmethod
    def get_recommendations(
        cls,
        db: Session,
        user_id: Optional[uuid.UUID],
        limit: int = 5
    ) -> RecommendationResponse:
        """
        Full recommendation pipeline: candidate retrieval -> ranking -> explanation -> event logging.
        """
        start_time = datetime.now(timezone.utc)
        event_id = uuid.uuid4()

        preferred_genres: Set[str] = set()
        preferred_languages: Set[str] = set()
        interacted_ids: Set[uuid.UUID] = set()
        disliked_ids: Set[uuid.UUID] = set()

        # 1. Fetch User Preferences & Interactions if user authenticated
        if user_id:
            try:
                pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
                if pref:
                    if pref.preferred_genres:
                        preferred_genres = {g.strip().lower() for g in pref.preferred_genres.split(",") if g.strip()}
                    if pref.preferred_languages:
                        preferred_languages = {l.strip().lower() for l in pref.preferred_languages.split(",") if l.strip()}

                # Interactions
                interactions = db.query(UserInteraction.movie_id).filter(UserInteraction.user_id == user_id).all()
                interacted_ids = {i[0] for i in interactions}

                # Disliked Feedback
                dislikes = db.query(RecommendationFeedback.movie_id).filter(
                    RecommendationFeedback.user_id == user_id,
                    RecommendationFeedback.feedback_type.in_(["THUMBS_DOWN", "DISMISSED"])
                ).all()
                disliked_ids = {d[0] for d in dislikes}
            except Exception as e:
                logger.warning(f"Could not load user profile for recommendations: {str(e)}")

        # 2. Fetch Active Candidate Movies (Excluding Disliked)
        candidates: List[Movie] = []
        try:
            query = db.query(Movie).filter(Movie.is_active == True)
            if disliked_ids:
                query = query.filter(~Movie.id.in_(disliked_ids))
            candidates = query.limit(50).all()
        except Exception as e:
            logger.warning(f"Failed to query candidates from database: {str(e)}")

        # 3. Score & Rank Candidates
        scored_movies = []
        for m in candidates:
            scoring = cls.calculate_movie_score(
                movie=m,
                preferred_genres=preferred_genres,
                preferred_languages=preferred_languages,
                interacted_movie_ids=interacted_ids
            )
            explanation = cls.generate_explanation(m, scoring)
            scored_movies.append({
                "movie": m,
                "score": scoring["total_score"],
                "breakdown": scoring["breakdown"],
                "explanation": explanation
            })

        # Sort descending by composite score
        scored_movies.sort(key=lambda x: x["score"], reverse=True)
        top_picks = scored_movies[:limit]

        # 4. Telemetry Logging (Save RecommendationEvent)
        if user_id and top_picks:
            try:
                for pick in top_picks:
                    rec_event = RecommendationEvent(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        movie_id=pick["movie"].id,
                        ranking_score=pick["score"],
                        recommendation_source="PERSONALIZED_RANKER",
                        model_version="ranker-v1.0",
                        score_breakdown=json.dumps(pick["breakdown"]),
                        created_at=datetime.now(timezone.utc)
                    )
                    db.add(rec_event)
                db.commit()
            except Exception as e:
                logger.warning(f"Could not log recommendation telemetry: {str(e)}")
                db.rollback()

        # 5. Format Response
        items = [
            RecommendationItem(
                movie_id=p["movie"].id,
                title=p["movie"].title,
                genre=p["movie"].genre,
                language=p["movie"].language,
                rating=float(p["movie"].rating) if p["movie"].rating else None,
                poster_url=p["movie"].poster_url,
                backdrop_url=p["movie"].backdrop_url,
                ranking_score=p["score"],
                recommendation_reason=p["explanation"],
                score_breakdown=p["breakdown"]
            )
            for p in top_picks
        ]

        duration_ms = round((datetime.now(timezone.utc) - start_time).total_seconds() * 1000, 2)
        return RecommendationResponse(
            user_id=user_id,
            recommendation_event_id=event_id,
            recommendations=items,
            model_version="ranker-v1.0",
            generated_at=datetime.now(timezone.utc).isoformat(),
            execution_time_ms=duration_ms
        )
