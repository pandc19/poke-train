#!/usr/bin/env bash
# Creates the poke-train role and database inside an existing Postgres
# container. Safe to re-run: existing role/database are left untouched.
#
# Usage: ./scripts/setup-db.sh [container] [role] [password] [database]
set -euo pipefail

CONTAINER="${1:-postgres18}"
ROLE="${2:-poketrain}"
PASSWORD="${3:-poketrain_dev_password}"
DATABASE="${4:-poketrain_dev}"

psql() { docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }

if [ "$(psql -Atc "SELECT 1 FROM pg_roles WHERE rolname = '$ROLE'")" != "1" ]; then
  # CREATEDB: `prisma migrate dev` creates a temporary shadow database.
  psql -c "CREATE ROLE $ROLE LOGIN PASSWORD '$PASSWORD' CREATEDB;"
else
  echo "role $ROLE already exists"
fi

if [ "$(psql -Atc "SELECT 1 FROM pg_database WHERE datname = '$DATABASE'")" != "1" ]; then
  psql -c "CREATE DATABASE $DATABASE OWNER $ROLE;"
else
  echo "database $DATABASE already exists"
fi

echo "ready: postgresql://$ROLE:$PASSWORD@localhost:5432/$DATABASE?schema=public"
