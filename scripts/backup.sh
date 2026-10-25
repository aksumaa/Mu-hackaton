#!/bin/sh
set -eu
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-muhack}" -d "${POSTGRES_DB:-muhack}" --format=custom > "backups/muhack-${stamp}.dump"
echo "Wrote backups/muhack-${stamp}.dump"
