import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.core.logging import logger
from app.database.models import Movie, MovieEmbedding
from app.services.embedding_service import EmbeddingService

class IngestionService:
    @staticmethod
    def index_movie(db: Session, movie: Movie, force: bool = False) -> bool:
        """
        Generates and stores vector embedding for a single movie.
        Skips computation if source_text_hash matches existing stored version.
        """
        source_text = EmbeddingService.prepare_movie_text(
            title=movie.title,
            genre=movie.genre,
            description=movie.description,
            language=movie.language,
            rating=float(movie.rating) if movie.rating else None
        )
        source_hash = EmbeddingService.compute_source_hash(source_text)

        # Check existing embedding
        existing = db.query(MovieEmbedding).filter(
            MovieEmbedding.movie_id == movie.id,
            MovieEmbedding.embedding_model == settings.EMBEDDING_MODEL_NAME
        ).first()

        if existing and existing.source_text_hash == source_hash and not force:
            logger.debug(f"Skipping movie {movie.id} ('{movie.title}'): embedding is up-to-date.")
            return False

        # Generate new 384-dimensional vector
        vector = EmbeddingService.embed_text(source_text)

        if existing:
            existing.embedding = vector
            existing.source_text_hash = source_hash
            existing.model_version = "v1.5"
            existing.updated_at = datetime.now(timezone.utc)
            logger.info(f"Updated embedding for movie {movie.id} ('{movie.title}')")
        else:
            new_embedding = MovieEmbedding(
                id=uuid.uuid4(),
                movie_id=movie.id,
                embedding=vector,
                embedding_model=settings.EMBEDDING_MODEL_NAME,
                model_version="v1.5",
                source_text_hash=source_hash,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(new_embedding)
            logger.info(f"Indexed new movie {movie.id} ('{movie.title}')")

        db.commit()
        return True

    @classmethod
    def index_all_movies(cls, db: Session, force: bool = False) -> Dict[str, int]:
        """
        Iterates over all active catalog movies and indexes any missing or changed entries.
        """
        movies = db.query(Movie).filter(Movie.is_active == True).all()
        stats = {"total": len(movies), "indexed": 0, "skipped": 0, "failed": 0}

        for movie in movies:
            try:
                changed = cls.index_movie(db, movie, force=force)
                if changed:
                    stats["indexed"] += 1
                else:
                    stats["skipped"] += 1
            except Exception as e:
                logger.error(f"Failed to index movie {movie.id}: {str(e)}", exc_info=True)
                stats["failed"] += 1
                db.rollback()

        return stats
