-- ==============================================================================
-- scripts/setup-ai-db-role.sql
-- Least-Privilege Role Provisioning for CineBook Python AI Service
-- Execute as PostgreSQL superuser (postgres)
-- ==============================================================================

-- 1. Create dedicated AI microservice user with parameterized or environment password
-- Replace '${AI_DB_PASSWORD}' with the actual secure password during provisioning
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cinebook_ai') THEN
    CREATE ROLE cinebook_ai WITH LOGIN PASSWORD 'cinebook_ai_secret_change_in_prod';
  END IF;
END
$$;

-- 2. Connect & Schema Usage
GRANT CONNECT ON DATABASE cinebook TO cinebook_ai;
GRANT USAGE ON SCHEMA public TO cinebook_ai;

-- 3. Read-Only access to non-sensitive Catalog, Theaters, and Scheduled Shows
GRANT SELECT ON movies, theaters, screens, shows TO cinebook_ai;

-- 4. Explicitly DENY / DO NOT GRANT any permissions on Transactional & Sensitive Tables:
-- users (no access to passwords, emails, phones, salts)
-- show_seats (no direct access to seat locking)
-- seats (no direct seat layout manipulation)
-- bookings (no direct booking creation)
-- booking_seats
-- payments
-- payment_transactions
-- transaction_state_transitions
-- wallets
-- ledger_entries
-- idempotency_records
-- refresh_tokens

-- 5. Full CRUD permissions ONLY on AI-Owned Tables
GRANT SELECT, INSERT, UPDATE, DELETE ON
  movie_embeddings,
  user_preferences,
  user_interactions,
  chat_sessions,
  chat_messages,
  user_memory,
  agent_tool_calls,
  recommendation_events,
  recommendation_feedback
TO cinebook_ai;

-- 6. Sequence Usage for AI-owned tables (if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cinebook_ai;
