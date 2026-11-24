-- ============================================================
-- V3__ai_vector_and_user_memory.sql
-- CineBook AI Vector Foundation, Memory, Interactions & Agent State
-- Target: PostgreSQL 16 with pgvector extension
-- ============================================================

-- 0. Enable pgvector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Full-Text Search Index on Movies Catalog (for Hybrid Retrieval)
CREATE INDEX IF NOT EXISTS idx_movies_fts
  ON movies
  USING gin (to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(genre, '')));

-- ============================================================
-- 1. TABLE: movie_embeddings
-- 384-dimensional vector embeddings for BAAI/bge-small-en-v1.5
-- ============================================================
CREATE TABLE IF NOT EXISTS movie_embeddings (
  id                UUID PRIMARY KEY,
  movie_id          UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  embedding         vector(384) NOT NULL,
  embedding_model   VARCHAR(100) NOT NULL DEFAULT 'BAAI/bge-small-en-v1.5',
  model_version     VARCHAR(50) NOT NULL DEFAULT 'v1.5',
  source_text_hash  VARCHAR(64) NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (movie_id, embedding_model, model_version)
);

CREATE INDEX idx_movie_embeddings_movie_id
  ON movie_embeddings(movie_id);

CREATE INDEX idx_movie_embeddings_source_hash
  ON movie_embeddings(source_text_hash);

-- Fast Approximate Nearest Neighbor (ANN) index using Cosine Distance
CREATE INDEX idx_movie_embeddings_vector_hnsw
  ON movie_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 2. TABLE: user_preferences
-- Explicit & inferred preference profiles for personalised ranking
-- ============================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id                        UUID PRIMARY KEY,
  user_id                   UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  preferred_genres          TEXT,
  preferred_languages       VARCHAR(500),
  preferred_actors          VARCHAR(1000),
  preferred_directors       VARCHAR(1000),
  preferred_characteristics TEXT,
  explicit_notes            TEXT,
  created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_preferences_user_id
  ON user_preferences(user_id);

-- ============================================================
-- 3. TABLE: user_interactions
-- General catalog browsing & application telemetry
-- (Distinct from explicit recommendation feedback)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_interactions (
  id                UUID PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id          UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  interaction_type  VARCHAR(50) NOT NULL
                      CHECK (interaction_type IN ('VIEW_DETAILS', 'WATCH_TRAILER', 'SEARCH_CLICK', 'SHARE')),
  context_metadata  TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_interactions_user_type
  ON user_interactions(user_id, interaction_type);

CREATE INDEX idx_user_interactions_movie_type
  ON user_interactions(movie_id, interaction_type);

CREATE INDEX idx_user_interactions_created_at
  ON user_interactions(created_at);

-- ============================================================
-- 4. TABLE: chat_sessions
-- Multi-turn conversation sessions with compound uniqueness for ownership enforcement
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, user_id)
);

CREATE INDEX idx_chat_sessions_user_updated
  ON chat_sessions(user_id, updated_at DESC);

-- ============================================================
-- 5. TABLE: chat_messages
-- Message history per session with strict database-level ownership enforcement
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id            UUID PRIMARY KEY,
  session_id    UUID NOT NULL,
  user_id       UUID NOT NULL,
  role          VARCHAR(20) NOT NULL
                  CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content       TEXT NOT NULL,
  metadata      TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_messages_session_user FOREIGN KEY (session_id, user_id)
    REFERENCES chat_sessions(id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_session_time
  ON chat_messages(session_id, created_at ASC);

CREATE INDEX idx_chat_messages_user_id
  ON chat_messages(user_id);

-- ============================================================
-- 6. TABLE: user_memory
-- Long-term persistent memory across sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS user_memory (
  id                UUID PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_content    TEXT NOT NULL,
  memory_category   VARCHAR(50) NOT NULL
                      CHECK (memory_category IN ('GENRE_PREFERENCE', 'ACTOR_PREFERENCE', 'DIRECTOR_PREFERENCE', 'DISLIKE', 'CONSTRAINTS', 'OUTING_HABIT', 'GENERAL')),
  importance_score  INT NOT NULL DEFAULT 5 CHECK (importance_score BETWEEN 1 AND 10),
  source            VARCHAR(50) NOT NULL DEFAULT 'EXPLICIT_CHAT'
                      CHECK (source IN ('EXPLICIT_CHAT', 'INFERRED_INTERACTION', 'USER_PROFILE')),
  expires_at        TIMESTAMP,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_memory_user_active
  ON user_memory(user_id, is_active);

CREATE INDEX idx_user_memory_category
  ON user_memory(user_id, memory_category);

-- ============================================================
-- 7. TABLE: agent_tool_calls
-- Complete audit trail of LLM agent tool calling execution
-- (Preserves audit records on session/user deletion)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_tool_calls (
  id                      UUID PRIMARY KEY,
  user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id              UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  tool_name               VARCHAR(100) NOT NULL,
  sanitized_arguments     TEXT,
  execution_status        VARCHAR(50) NOT NULL
                            CHECK (execution_status IN ('SUCCESS', 'FAILED', 'TIMED_OUT', 'REJECTED')),
  execution_duration_ms   INT NOT NULL CHECK (execution_duration_ms >= 0),
  error_message           TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_tool_calls_session
  ON agent_tool_calls(session_id, created_at ASC);

CREATE INDEX idx_agent_tool_calls_status
  ON agent_tool_calls(tool_name, execution_status);

CREATE INDEX idx_agent_tool_calls_user
  ON agent_tool_calls(user_id);

-- ============================================================
-- 8. TABLE: recommendation_events
-- Candidate generation & ranking telemetry
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendation_events (
  id                      UUID PRIMARY KEY,
  user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  movie_id                UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  ranking_score           DECIMAL(5,4) NOT NULL CHECK (ranking_score >= 0.0 AND ranking_score <= 1.0),
  recommendation_source   VARCHAR(100) NOT NULL,
  model_version           VARCHAR(50) NOT NULL,
  score_breakdown         TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rec_events_user_time
  ON recommendation_events(user_id, created_at DESC);

CREATE INDEX idx_rec_events_movie
  ON recommendation_events(movie_id);

-- ============================================================
-- 9. TABLE: recommendation_feedback
-- Explicit user feedback linked directly to recommendation events
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id                      UUID PRIMARY KEY,
  recommendation_event_id UUID REFERENCES recommendation_events(id) ON DELETE SET NULL,
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id                UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  feedback_type           VARCHAR(50) NOT NULL
                            CHECK (feedback_type IN ('THUMBS_UP', 'THUMBS_DOWN', 'STAR_RATING', 'ACCEPTED', 'DISMISSED')),
  rating                  INT CHECK (rating BETWEEN 1 AND 5),
  feedback_comment        TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rec_feedback_user_movie
  ON recommendation_feedback(user_id, movie_id);

CREATE INDEX idx_rec_feedback_type
  ON recommendation_feedback(feedback_type);

CREATE INDEX idx_rec_feedback_event
  ON recommendation_feedback(recommendation_event_id);
