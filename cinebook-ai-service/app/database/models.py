import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime,
    ForeignKey, UniqueConstraint, CheckConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from app.database.connection import Base

try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    # Fallback type for testing environments without pgvector compiled
    from sqlalchemy.types import TypeDecorator, LargeBinary
    class Vector(TypeDecorator):
        impl = LargeBinary
        cache_ok = True
        def __init__(self, dim=384):
            super().__init__()
            self.dim = dim

class Movie(Base):
    """
    Read-only mapping to the core transactional 'movies' table created in V1.
    """
    __tablename__ = "movies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(String(4000), nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    genre = Column(String(100), nullable=False)
    language = Column(String(100), nullable=False, default="English")
    poster_url = Column(String(1000), nullable=True)
    backdrop_url = Column(String(1000), nullable=True)
    trailer_url = Column(String(1000), nullable=True)
    rating = Column(Float, nullable=True)
    vote_count = Column(Integer, nullable=True)
    release_date = Column(DateTime, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    tmdb_id = Column(Integer, nullable=True)
    imdb_id = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class MovieEmbedding(Base):
    """
    384-dimensional vector embeddings for semantic retrieval.
    """
    __tablename__ = "movie_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    movie_id = Column(UUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), nullable=False)
    embedding = Column(Vector(384), nullable=False)
    embedding_model = Column(String(100), nullable=False, default="BAAI/bge-small-en-v1.5")
    model_version = Column(String(50), nullable=False, default="v1.5")
    source_text_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("movie_id", "embedding_model", "model_version", name="uq_movie_model_version"),
    )

class UserPreference(Base):
    """
    Explicit and inferred user preference profiles.
    """
    __tablename__ = "user_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    preferred_genres = Column(Text, nullable=True)
    preferred_languages = Column(String(500), nullable=True)
    preferred_actors = Column(String(1000), nullable=True)
    preferred_directors = Column(String(1000), nullable=True)
    preferred_characteristics = Column(Text, nullable=True)
    explicit_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class UserInteraction(Base):
    """
    General catalog browsing & interaction telemetry.
    """
    __tablename__ = "user_interactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    movie_id = Column(UUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), nullable=False)
    interaction_type = Column(String(50), nullable=False)
    context_metadata = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ChatSession(Base):
    """
    Conversational thread with compound ownership key.
    """
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    session_title = Column(String(255), nullable=False, default="New Conversation")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_chat_sessions_id_user"),
    )

class ChatMessage(Base):
    """
    Message history enforced by compound foreign key (session_id, user_id).
    """
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    message_metadata = Column("metadata", Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class UserMemory(Base):
    """
    Long-term conversational memory with soft-delete and categorization.
    """
    __tablename__ = "user_memory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    memory_content = Column(Text, nullable=False)
    memory_category = Column(String(50), nullable=False)
    importance_score = Column(Integer, nullable=False, default=5)
    source = Column(String(50), nullable=False, default="EXPLICIT_CHAT")
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AgentToolCall(Base):
    """
    Audit log of agent tool calls (persisted even when session/user deleted).
    """
    __tablename__ = "agent_tool_calls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    session_id = Column(UUID(as_uuid=True), nullable=True)
    tool_name = Column(String(100), nullable=False)
    sanitized_arguments = Column(Text, nullable=True)
    execution_status = Column(String(50), nullable=False)
    execution_duration_ms = Column(Integer, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class RecommendationEvent(Base):
    """
    Telemetry recording candidate generation & ranking events.
    """
    __tablename__ = "recommendation_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    movie_id = Column(UUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), nullable=False)
    ranking_score = Column(Float, nullable=False)
    recommendation_source = Column(String(100), nullable=False)
    model_version = Column(String(50), nullable=False)
    score_breakdown = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class RecommendationFeedback(Base):
    """
    Explicit user feedback linked directly to recommendation events.
    """
    __tablename__ = "recommendation_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recommendation_event_id = Column(UUID(as_uuid=True), ForeignKey("recommendation_events.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    movie_id = Column(UUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), nullable=False)
    feedback_type = Column(String(50), nullable=False)
    rating = Column(Integer, nullable=True)
    feedback_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
