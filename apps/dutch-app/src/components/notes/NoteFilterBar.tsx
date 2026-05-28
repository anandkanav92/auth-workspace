"use client";

import type { NoteCategory } from "@/types/chapter";

type FilterOption = NoteCategory | "all";

interface NoteFilterBarProps {
  activeFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  counts: { all: number; vocab: number; grammar: number; general: number };
}

const FILTERS: { id: FilterOption; label: string }[] = [
  { id: "all", label: "All" },
  { id: "vocab", label: "Vocab" },
  { id: "grammar", label: "Grammar" },
  { id: "general", label: "General" },
];

export function NoteFilterBar({
  activeFilter,
  onFilterChange,
  counts,
}: NoteFilterBarProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {FILTERS.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onFilterChange(filter.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeFilter === filter.id
              ? "bg-orange-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-orange-50 border border-slate-200"
          }`}
        >
          {filter.label} ({counts[filter.id]})
        </button>
      ))}
    </div>
  );
}
