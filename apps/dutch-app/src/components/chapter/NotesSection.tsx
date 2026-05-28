"use client";

import { useState, useEffect, useCallback } from "react";
import { useStorage } from "@/hooks/useStorage";
import type { Note, NoteCategory } from "@/types/chapter";
import { NoteInput } from "@/components/notes/NoteInput";
import { NoteFeed } from "@/components/notes/NoteFeed";
import { NoteFilterBar } from "@/components/notes/NoteFilterBar";

type FilterOption = NoteCategory | "all";

export function NotesSection({ chapterId }: { chapterId: number }) {
  const storage = useStorage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const loaded = await storage.getNotes(chapterId);
      if (!cancelled) {
        setNotes(loaded);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [chapterId, storage.getNotes]);

  const handleNoteAdded = useCallback(
    async (note: Note) => {
      setNotes((prev) => [note, ...prev]); // optimistic prepend
      await storage.saveNote(note);
    },
    [storage.saveNote]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id)); // optimistic
      await storage.deleteNote(id);
    },
    [storage.deleteNote]
  );

  const handleUpdate = useCallback(
    async (id: string, text: string, category: NoteCategory) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, text, category, updatedAt: new Date().toISOString() }
            : n
        )
      );
      await storage.updateNote(id, text, category);
    },
    [storage.updateNote]
  );

  // Compute counts from full (unfiltered) notes array
  const counts = {
    all: notes.length,
    vocab: notes.filter((n) => n.category === "vocab").length,
    grammar: notes.filter((n) => n.category === "grammar").length,
    general: notes.filter((n) => n.category === "general").length,
  };

  const filteredNotes =
    activeFilter === "all"
      ? notes
      : notes.filter((n) => n.category === activeFilter);

  if (loading) {
    return (
      <section>
        <h2 className="text-xl font-semibold mb-3 text-slate-900">
          Notities
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6 animate-pulse">
          <div className="h-40 bg-slate-100 rounded-lg" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-semibold mb-3 text-slate-900">Notities</h2>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col" style={{ maxHeight: "70vh" }}>
        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-slate-100">
          <NoteFilterBar
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={counts}
          />
        </div>

        {/* Scrollable feed */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <NoteFeed
            notes={filteredNotes}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        </div>

        {/* Pinned input at bottom */}
        <NoteInput chapterId={chapterId} onNoteAdded={handleNoteAdded} />
      </div>
    </section>
  );
}
