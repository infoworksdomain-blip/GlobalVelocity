#!/usr/bin/env bash
# Nightly backup: Postgres dump + media (local driver). For S3 storage rely on bucket versioning/replication instead.
set -euo pipefail
: "${DATABASE_URL:?}"; DEST=${BACKUP_DIR:-./backups}; TS=$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$DEST"
pg_dump --no-owner --format=custom "$DATABASE_URL" > "$DEST/db-$TS.dump"
[ -d "${LOCAL_STORAGE_DIR:-.media}" ] && tar -czf "$DEST/media-$TS.tar.gz" -C "$(dirname "${LOCAL_STORAGE_DIR:-.media}")" "$(basename "${LOCAL_STORAGE_DIR:-.media}")"
find "$DEST" -type f -mtime +${BACKUP_RETENTION_DAYS:-14} -delete
echo "backup written to $DEST ($TS)"
