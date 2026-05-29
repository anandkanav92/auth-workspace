# Notes Redesign — Chat-Style Quick Capture

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-textarea notes with a chat-style feed that auto-categorizes notes into vocab/grammar/general, optimized for mobile quick capture during class.

**Architecture:** Per-chapter note feed with pinned bottom input, auto-categorization via heuristics (v1), filterable by category. Same `useStorage` abstraction — PocketBase when authenticated, localStorage fallback.

**Tech Stack:** Next.js 16 / React 19 / Tailwind v4 / PocketBase

---

## Core Concept

Notes becomes a "message to yourself" per chapter. You type a note at the bottom (like Slack/iMessage), hit send, and it appears above as a timestamped card. The input is always pinned at the bottom — thumb-friendly, zero friction.

Auto-categorization happens silently after submission. A small colored tag appears on the card (vocab/grammar/general). v1 uses simple heuristics — pattern matching. You never choose categories manually.

---

## Data Model

```typescript
interface Note {
  id: string;              // unique ID
  chapterId: number;       // which chapter (1-9)
  text: string;            // raw user input
  category: "vocab" | "grammar" | "general";  // auto-detected
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp (for editing)
}
```

### PocketBase Collection: `notes`

Replaces the current single-text notes collection.

| Field        | Type     | Notes                          |
|-------------|----------|--------------------------------|
| `id`        | string   | PB auto-generated              |
| `user_id`   | string   | Firebase UID                   |
| `chapter_id`| number   | 1-9                            |
| `text`      | string   | Raw note text                  |
| `category`  | string   | "vocab" / "grammar" / "general"|
| `created`   | datetime | PB auto                        |
| `updated`   | datetime | PB auto                        |

**Unique index:** None (multiple notes per user per chapter).
**Filter:** `user_id = :uid AND chapter_id = :chapterId`, sorted by `created DESC`.

### localStorage Fallback

Key: `dutch-notes`, value: `Note[]` array. Filtered client-side by chapterId.

### Migration from Old Format

Current notes are a single string per chapter stored as `dutch-notes-{chapterId}`. On first load:
1. Check if old-format key exists
2. Split by newlines
3. Create one Note per non-empty line (category: "general", timestamp: now)
4. Save in new format
5. Delete old key

---

## Component Architecture

### 1. `NoteInput` — Pinned Bottom Input

- Single `<input>` element (not textarea — encourages quick notes)
- Send button + Enter to submit
- Sticks to bottom of notes tab content area
- Clears after submit, new note appears at top with fade-in
- Disabled with lock icon when not authenticated

### 2. `NoteFeed` — Scrollable Note Cards

Each card displays:
- Note text
- Colored category pill: vocab (orange), grammar (blue), general (gray)
- Relative timestamp ("2m ago", "yesterday")
- Delete: trash icon on hover (desktop), always visible small icon (mobile)
- Edit: tap/click text to edit inline, save on blur or Enter

### 3. `NoteFilterBar` — Category Filter Pills

- Four pills: `All (n) | Vocab (n) | Grammar (n) | General (n)`
- Active filter highlighted orange
- Instant client-side filtering (no reload)

### Layout (Notes Tab)

```
+---------------------------+
| [All] [Vocab] [Grammar]  |  <- NoteFilterBar
| [General]                 |
+---------------------------+
| huis = house, sounds     |  <- NoteFeed (scrollable)
| like "whose"     [V] 2m  |
|---------------------------|
| altijd 'er' bij onpers.  |
| zinnen            [G] 1h |
|---------------------------|
| ...more notes...          |
+---------------------------+
| [Type a note...]   [>]   |  <- NoteInput (pinned bottom)
+---------------------------+
```

---

## Categorization Engine (v1 — Heuristics)

File: `src/lib/note-categories.ts`

Pure function: `categorizeNote(text: string): "vocab" | "grammar" | "general"`

**Priority: vocab -> grammar -> general** (first match wins).

### Vocab Detection
- Contains `=` or `->`  with word tokens on both sides
- Contains "betekent" (means), "vertaling" (translation)
- Pattern: `word - word` (dash-separated pair)

### Grammar Detection — Keyword List
- Articles/gender: `de/het`, `de-woord`, `het-woord`
- Verb terms: `werkwoord`, `vervoeging`, `verleden tijd`, `voltooid deelwoord`, `infinitief`
- Noun/adj: `meervoud`, `enkelvoud`, `bijvoeglijk`, `verkleinwoord`
- Structure: `woordvolgorde`, `inversie`, `bijzin`, `hoofdzin`
- Abbreviations: `OVT`, `VTT`

### General
Everything that doesn't match vocab or grammar patterns.

### Future v2
Swap heuristic implementation for open-source model inference. Same function signature — components never change.

---

## Storage Interface Changes

Add to `useStorage` hook:

```typescript
// New methods
getNotes(chapterId: number): Promise<Note[]>
saveNote(note: Note): Promise<void>
updateNote(id: string, text: string, category: Category): Promise<void>
deleteNote(id: string): Promise<void>
```

PocketBase functions in `pb-storage.ts`:
- `pbGetNotes(userId, chapterId)` — list with filter + sort
- `pbSaveNote(userId, note)` — create record
- `pbUpdateNote(id, text, category)` — update record
- `pbDeleteNote(id)` — delete record

---

## Auth Gating

- Notes tab already requires auth (existing `ChapterContent` tab config)
- `NoteInput` shows disabled state with lock icon when not authenticated
- `LockedFeature` component shown when unauthenticated user tries Notes tab

---

## Implementation Tasks (High Level)

### Task 1: Categorization Engine + Tests
- Create `src/lib/note-categories.ts` with `categorizeNote()`
- Write comprehensive tests for all patterns
- Pure logic, no UI

### Task 2: Data Model + Storage Layer
- Update PocketBase `notes` collection schema (new fields: chapter_id, category)
- Add `pbGetNotes`, `pbSaveNote`, `pbUpdateNote`, `pbDeleteNote` to pb-storage.ts
- Add localStorage equivalents to storage.ts
- Add `getNotes`, `saveNote`, `updateNote`, `deleteNote` to useStorage hook
- Write migration from old single-string format

### Task 3: PocketBase Collection Bootstrap
- Update `pb/start.sh` to create new notes collection schema
- Add proper indexes

### Task 4: NoteInput Component
- Chat-style input bar with send button
- Enter to submit, clear on send
- Auto-categorize on submit

### Task 5: NoteFeed Component
- Scrollable card list with category pills + timestamps
- Delete functionality
- Inline editing

### Task 6: NoteFilterBar Component
- Filter pills with counts
- Client-side filtering

### Task 7: Integration — Replace NotesSection
- Remove old `NotesSection` component
- Wire up new components in `ChapterContent` Notes tab
- Mobile-friendly layout with pinned input

### Task 8: Migration + Cleanup
- Old format migration (split newlines into individual notes)
- Update PocketBase migration script
- Remove dead code
