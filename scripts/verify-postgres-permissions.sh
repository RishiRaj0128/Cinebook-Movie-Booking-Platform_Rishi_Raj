#!/usr/bin/env bash
# scripts/verify-postgres-permissions.sh
# Verifies PostgreSQL pgvector, V3 schema, and least-privilege security role

set -e

HOST="${PGHOST:-localhost}"
PORT="${PGPORT:-5432}"
DB="${PGDATABASE:-cinebook}"
USER="${PGUSER:-postgres}"

echo "=========================================================="
echo "  CineBook PostgreSQL & Database Security Verifier"
echo "=========================================================="

if ! nc -z "$HOST" "$PORT" 2>/dev/null && ! timeout 2 bash -c "</dev/tcp/$HOST/$PORT" 2>/dev/null; then
    echo ""
    echo "[ERROR] Cannot connect to PostgreSQL on $HOST:$PORT."
    echo "Docker Desktop daemon or local PostgreSQL service is currently offline."
    echo ""
    echo "To execute this verification once Docker is running:"
    echo "  1. docker compose up postgres -d"
    echo "  2. docker exec -i cinebook-postgres psql -U postgres -d cinebook < scripts/setup-ai-db-role.sql"
    echo "  3. docker exec -i cinebook-postgres psql -U postgres -d cinebook < scripts/verify-postgres-permissions.sql"
    echo ""
    exit 1
fi

echo "[INFO] PostgreSQL connection detected. Executing verification suite..."
docker exec -i cinebook-postgres psql -U "$USER" -d "$DB" < scripts/verify-postgres-permissions.sql
