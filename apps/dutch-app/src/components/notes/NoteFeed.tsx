"use client";

import { useState } from "react";
import type { Note, NoteCategory } from "@/types/chapter";
import { categorizeNote } from "@/lib/note-categories";

interface NoteFeedProps {
  notes: Note[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string, category: NoteCategory) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

const CATEGORY_STYLES: Record<NoteCategory, { bg: string; label: string }> = {
  vocab: { bg: "bg-orange-100 text-orange-700", label: "Vocab" },
  grammar: { bg: "bg-blue-100 text-blue-700", label: "Grammar" },
  general: { bg: "bg-slate-100 text-slate-500", label: "General" },
};

// ---------------------------------------------------------------------------
// NoteCard
// ---------------------------------------------------------------------------

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string, category: NoteCategory) => void;
}

function NoteCard({ note, onDelete, onUpdate }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);

  const style = CATEGORY_STYLES[note.category];

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.text) {
      onUpdate(note.id, trimmed, categorizeNote(trimmed));
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(note.text);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  return (
    <div className="px-4 py-3 hover:bg-slate-50 group">
      {editing ? (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
        />
      ) : (
        <p
          className="text-sm text-slate-700 cursor-text"
          onClick={() => {
            setDraft(note.text);
            setEditing(true);
          }}
        >
          {note.text}
        </p>
      )}

      <div className="flex items-center gap-2 mt-1.5">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${style.bg}`}
        >
          {style.label}
        </span>
        <span className="text-[11px] text-slate-400">
          {relativeTime(note.updatedAt)}
        </span>
        <span className="flex-1" />
        <button
          onClick={() => onDelete(note.id)}
          className="text-slate-300 hover:text-red-500 text-sm transition-colors"
          aria-label="Delete note"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoteFeed
// ---------------------------------------------------------------------------

export function NoteFeed({ notes, onDelete, onUpdate }: NoteFeedProps) {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-slate-500">Nog geen notities</p>
        <p className="text-xs text-slate-400 mt-1">
          Schrijf je eerste notitie hieronder
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onDelete={onDelete}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}
