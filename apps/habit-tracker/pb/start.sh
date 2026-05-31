#!/bin/sh
set -e

# Start PocketBase in the background
/pb/pocketbase serve --http=0.0.0.0:8090 &
PB_PID=$!

# Wait until the API is ready
until curl -sf http://localhost:8090/api/health > /dev/null 2>&1; do
  sleep 1
done

# Create superuser (idempotent — safe to run every boot)
/pb/pocketbase superuser upsert "${PB_EMAIL}" "${PB_PASSWORD}" 2>/dev/null || true

# Authenticate as superuser to get a token
TOKEN=$(curl -sf -X POST http://localhost:8090/api/collections/_superusers/auth-with-password \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"${PB_EMAIL}\",\"password\":\"${PB_PASSWORD}\"}" \
  | sed 's/.*"token":"\([^"]*\)".*/\1/')

auth_header="Authorization: Bearer ${TOKEN}"

# Helper: create a collection only if it doesn't already exist
create_if_missing() {
  NAME=$1
  BODY=$2
  EXISTS=$(curl -sf -H "${auth_header}" \
    "http://localhost:8090/api/collections/${NAME}" 2>/dev/null && echo "yes" || echo "no")
  if [ "$EXISTS" = "no" ]; then
    curl -sf -X POST http://localhost:8090/api/collections \
      -H "${auth_header}" \
      -H "Content-Type: application/json" \
      -d "${BODY}" > /dev/null
    echo "Created collection: ${NAME}"
  else
    echo "Collection already exists: ${NAME}"
  fi
}

create_if_missing "habits" '{
  "name": "habits",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": "",
  "indexes": ["CREATE INDEX idx_habits_user ON habits (userId)"],
  "fields": [
    {"type":"text","name":"userId","required":true},
    {"type":"text","name":"name","required":true},
    {"type":"text","name":"icon"},
    {"type":"text","name":"categoryId"},
    {"type":"json","name":"days"},
    {"type":"text","name":"notes","max":10000},
    {"type":"text","name":"time"}
  ]
}'

create_if_missing "categories" '{
  "name": "categories",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": "",
  "fields": [
    {"type":"text","name":"userId","required":true},
    {"type":"text","name":"name","required":true},
    {"type":"text","name":"color"}
  ]
}'

create_if_missing "completions" '{
  "name": "completions",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": "",
  "indexes": [
    "CREATE INDEX idx_completions_user_date ON completions (userId, dateStr)",
    "CREATE INDEX idx_completions_habit ON completions (habitId)"
  ],
  "fields": [
    {"type":"text","name":"userId","required":true},
    {"type":"text","name":"habitId","required":true},
    {"type":"text","name":"dateStr","required":true}
  ]
}'

# Hand off to the PocketBase process
wait $PB_PID
