#!/bin/sh
set -e

# Start PocketBase in the background. Unlike habit-tracker (which seeds
# collections via curl here), finance-tracker's schema is a set of JS migration
# files mounted read-only at /pb/pb_migrations. PocketBase auto-applies any
# pending migrations from --migrationsDir on `serve` boot (lexicographic order,
# tracked in the _migrations table), so all 8 collections + the batch-enable
# settings change are created without any curl seeding.
/pb/pocketbase serve --http=0.0.0.0:8090 --migrationsDir=/pb/pb_migrations &
PB_PID=$!

# Wait until the API is ready.
until curl -sf http://localhost:8090/api/health > /dev/null 2>&1; do
  sleep 1
done

# Create/refresh the superuser (idempotent — safe to run every boot). This is
# the account the BFF authenticates as via PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD.
/pb/pocketbase superuser upsert "${PB_EMAIL}" "${PB_PASSWORD}"

# Hand off to the PocketBase process.
wait $PB_PID
