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

# --- flashcards ---
create_if_missing "flashcards" '{
  "name": "flashcards",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": "",
  "indexes": [
    "CREATE UNIQUE INDEX idx_flashcards_user_card ON flashcards (userId, cardId)"
  ],
  "fields": [
    {"type":"text","name":"userId","required":true},
    {"type":"text","name":"cardId","required":true},
    {"type":"text","name":"dutch","required":true},
    {"type":"text","name":"english","required":true},
    {"type":"number","name":"chapterId","required":true},
    {"type":"number","name":"easeFactor","required":true},
    {"type":"number","name":"interval","required":true},
    {"type":"number","name":"repetitions","required":true},
    {"type":"text","name":"dueDate","required":true}
  ]
}'

# --- chapter_progress ---
create_if_missing "chapter_progress" '{
  "name": "chapter_progress",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": "",
  "indexes": [
    "CREATE UNIQUE INDEX idx_chapter_progress_user_chapter ON chapter_progress (userId, chapterId)"
  ],
  "fields": [
    {"type":"text","name":"userId","required":true},
    {"type":"number","name":"chapterId","required":true},
    {"type":"bool","name":"dialogueRead"},
    {"type":"bool","name":"vocabularyStudied"},
    {"type":"bool","name":"grammarStudied"},
    {"type":"bool","name":"exercisesDone"},
    {"type":"bool","name":"pronunciationPracticed"},
    {"type":"bool","name":"cultureRead"},
    {"type":"number","name":"quizBestScore"}
  ]
}'

# --- notes ---
create_if_missing "notes" '{
  "name": "notes",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": "",
  "indexes": [
    "CREATE UNIQUE INDEX idx_notes_user_chapter ON notes (userId, chapterId)"
  ],
  "fields": [
    {"type":"text","name":"userId","required":true},
    {"type":"number","name":"chapterId","required":true},
    {"type":"text","name":"content"}
  ]
}'

# --- streaks ---
create_if_missing "streaks" '{
  "name": "streaks",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": "",
  "indexes": [
    "CREATE UNIQUE INDEX idx_streaks_user ON streaks (userId)"
  ],
  "fields": [
    {"type":"text","name":"userId","required":true},
    {"type":"number","name":"currentStreak","required":true},
    {"type":"text","name":"lastStudyDate","required":true}
  ]
}'

# Hand off to the PocketBase process
wait $PB_PID
