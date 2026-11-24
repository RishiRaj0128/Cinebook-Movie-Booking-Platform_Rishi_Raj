-- ==============================================================================
-- scripts/verify-postgres-permissions.sql
-- CineBook PostgreSQL & pgvector Security & Permission Verification Suite
-- ==============================================================================
-- Usage:
--   psql -U postgres -d cinebook -f scripts/verify-postgres-permissions.sql
-- ==============================================================================

\echo '============================================================================'
\echo '  CineBook PostgreSQL Verification: Extensions, Schema, Indexes & Permissions'
\echo '============================================================================'

-- ------------------------------------------------------------------------------
-- 1. VERIFY PGVECTOR EXTENSION
-- ------------------------------------------------------------------------------
\echo '--- 1. PGVECTOR EXTENSION ---'
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'vector';

-- ------------------------------------------------------------------------------
-- 2. VERIFY ALL 9 AI TABLES EXIST
-- ------------------------------------------------------------------------------
\echo '--- 2. AI TABLES IN PUBLIC SCHEMA ---'
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'movie_embeddings',
    'user_preferences',
    'user_interactions',
    'chat_sessions',
    'chat_messages',
    'user_memory',
    'agent_tool_calls',
    'recommendation_events',
    'recommendation_feedback'
  )
ORDER BY table_name;

-- ------------------------------------------------------------------------------
-- 3. VERIFY 384-DIMENSIONAL VECTOR COLUMN ON MOVIE_EMBEDDINGS
-- ------------------------------------------------------------------------------
\echo '--- 3. EMBEDDING COLUMN TYPE & DIMENSIONS ---'
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'movie_embeddings' AND column_name = 'embedding';

-- ------------------------------------------------------------------------------
-- 4. VERIFY HNSW INDEX ON MOVIE_EMBEDDINGS
-- ------------------------------------------------------------------------------
\echo '--- 4. HNSW INDEX DEFINITION ---'
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'movie_embeddings' AND indexname = 'idx_movie_embeddings_vector_hnsw';

-- ------------------------------------------------------------------------------
-- 5. TEST VECTOR SIMILARITY QUERY EXECUTION
-- ------------------------------------------------------------------------------
\echo '--- 5. VECTOR COSINE SIMILARITY TEST ---'
SELECT id, movie_id, 1 - (embedding <=> '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]'::vector(384)) AS test_cosine_similarity
FROM movie_embeddings
LIMIT 1;

-- ------------------------------------------------------------------------------
-- 6. POSITIVE PERMISSION TESTS FOR CINEBOOK_AI ROLE
-- ------------------------------------------------------------------------------
\echo '--- 6. POSITIVE PERMISSIONS (ROLE cinebook_ai) ---'
SET ROLE cinebook_ai;

SELECT current_user;

-- Permitted Catalog SELECTs
SELECT id, title, genre, language FROM movies LIMIT 1;
SELECT id, name, city FROM theaters LIMIT 1;
SELECT id, name FROM screens LIMIT 1;
SELECT id, start_time, base_price FROM shows LIMIT 1;

-- Permitted AI-Owned Table SELECTs
SELECT count(*) AS memory_count FROM user_memory;
SELECT count(*) AS pref_count FROM user_preferences;
SELECT count(*) AS chat_count FROM chat_sessions;
SELECT count(*) AS tool_call_count FROM agent_tool_calls;

-- ------------------------------------------------------------------------------
-- 7. NEGATIVE PERMISSION TESTS FOR CINEBOOK_AI ROLE (SECURITY GATES)
-- Each query below MUST FAIL with "permission denied for table ..."
-- ------------------------------------------------------------------------------
\echo '--- 7. NEGATIVE PERMISSIONS / ISOLATION BOUNDARY CHECKS ---'

-- Gate 7.1: User PII Isolation
\echo 'Attempting unauthorized read on sensitive user table:'
SELECT id, email, password_hash, phone FROM users LIMIT 1;

-- Gate 7.2: Booking Write Blockade
\echo 'Attempting unauthorized INSERT into bookings:'
INSERT INTO bookings (id, user_id, show_id, total_amount, status, booking_time) 
VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 50000, 'CONFIRMED', now());

-- Gate 7.3: Seat Lock Manipulation Blockade
\echo 'Attempting unauthorized UPDATE on show_seats (seat locking bypass):'
UPDATE show_seats SET status = 'LOCKED' WHERE id = gen_random_uuid();

-- Gate 7.4: Payment Table Blockade
\echo 'Attempting unauthorized INSERT into payments:'
INSERT INTO payments (id, booking_id, amount, status, payment_method) 
VALUES (gen_random_uuid(), gen_random_uuid(), 50000, 'SUCCESS', 'RAZORPAY');

-- Gate 7.5: Ledger Entry Mutation Blockade
\echo 'Attempting unauthorized INSERT into double-entry ledger_entries:'
INSERT INTO ledger_entries (id, transaction_id, entry_type, account_type, amount, balance_after) 
VALUES (gen_random_uuid(), gen_random_uuid(), 'CREDIT', 'ESCROW', 50000, 50000);

-- Gate 7.6: User Wallet Mutation Blockade
\echo 'Attempting unauthorized UPDATE on wallets:'
UPDATE wallets SET balance = balance + 100000;

RESET ROLE;
\echo '============================================================================'
\echo '  Verification Script Completed'
\echo '============================================================================'
