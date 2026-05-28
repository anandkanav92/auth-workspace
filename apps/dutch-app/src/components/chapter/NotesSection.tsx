"use client";

import { useState, useEffect } from "react";
import { useStorage } from "@/hooks/useStorage";

export function NotesSection({ chapterId }: { chapterId: number }) {
  const storage = useStorage();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotes() {
      const saved = await storage.getChapterNotes(chapterId);
      setNotes(saved);
      setLoading(false);
    }
    loadNotes();
  }, [chapterId, storage.getChapterNotes]);

  const handleSave = async () => {
    await storage.saveChapterNotes(chapterId, notes);
  };

  if (loading) {
    return (
      <section>
        <h2 className="text-xl font-semibold mb-3 text-slate-900">Your Notes</h2>
        <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6 animate-pulse">
          <div className="h-40 bg-slate-100 rounded-lg" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-semibold mb-3 text-slate-900">Your Notes</h2>
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSave}
          className="w-full h-40 border border-slate-200 rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder="Write your personal notes about this chapter..."
        />
        <p className="text-xs text-slate-400 mt-2">
          Auto-saves when you click away
        </p>
      </div>
    </section>
  );
}
