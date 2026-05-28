"use client";

import { useState } from "react";
import type { Note } from "@/types/chapter";
import { categorizeNote } from "@/lib/note-categories";
import { generateId } from "@/lib/storage";

interface NoteInputProps {
  chapterId: number;
  onNoteAdded: (note: Note) => void;
}

export function NoteInput({ chapterId, onNoteAdded }: NoteInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();
    const note: Note = {
      id: generateId(),
      chapterId,
      text: trimmed,
      category: categorizeNote(trimmed),
      createdAt: now,
      updatedAt: now,
    };

    onNoteAdded(note);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-white border-t border-slate-200 px-3 py-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Schrijf een notitie..."
          className="flex-1 text-sm py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="bg-orange-600 text-white w-9 h-9 rounded-lg flex items-center justify-center hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors shrink-0"
          aria-label="Send note"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
