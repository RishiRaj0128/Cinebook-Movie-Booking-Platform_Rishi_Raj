#!/usr/bin/env bash
# ==============================================================================
# scripts/backup-db.sh
# Backup and Rollback Procedure for CineBook PostgreSQL
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/cinebook_backup_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Starting database backup to ${BACKUP_FILE}..."
if docker ps --format '{{.Names}}' | grep -q 'postgres'; then
  docker exec -t "$(docker ps -qf 'name=postgres' | head -n 1)" pg_dump -U postgres -d cinebook > "${BACKUP_FILE}"
  echo "[SUCCESS] Backup completed: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
else
  echo "[WARN] No running PostgreSQL container detected. If using native PostgreSQL, run:"
  echo "       pg_dump -U postgres -d cinebook > ${BACKUP_FILE}"
fi

echo ""
echo "=== ROLLBACK PROCEDURE ==="
echo "If upgrading PostgreSQL image or schema rollback is needed:"
echo "1. Stop the application services: docker compose down"
echo "2. Revert docker-compose.yml image tag to postgres:16 if pgvector fails."
echo "3. Start postgres service: docker compose up -d postgres"
echo "4. Restore database dump:"
echo "   cat ${BACKUP_FILE} | docker exec -i \$(docker ps -qf 'name=postgres') psql -U postgres -d cinebook"
echo "=========================="
