"use client";

import { useState, useEffect, useRef } from "react";
import type { Chapter } from "@/types/chapter";
import type { ChapterProgress } from "@/lib/storage";
import { useStorage } from "@/hooks/useStorage";
import { DialogueSection } from "./DialogueSection";
import { VocabularySection } from "./VocabularySection";
import { GrammarSection } from "./GrammarSection";
import { PronunciationSection } from "./PronunciationSection";
import { CultureSection } from "./CultureSection";
import { NotesSection } from "./NotesSection";
import { LockedFeature } from "@/components/auth/LockedFeature";

const TABS = [
  { id: "dialogue", label: "Dialoog", icon: "💬", requiresAuth: false },
  { id: "vocab", label: "Woorden", icon: "📝", requiresAuth: false },
  { id: "grammar", label: "Grammatica", icon: "📐", requiresAuth: false },
  { id: "pronunciation", label: "Uitspraak", icon: "🗣️", requiresAuth: false },
  { id: "culture", label: "Cultuur", icon: "🇳🇱", requiresAuth: false },
  { id: "notes", label: "Notities", icon: "✏️", requiresAuth: true },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Viewing a content tab marks that section as "studied" so the dashboard's
// completion bar reflects real activity (not just the quiz).
const TAB_TO_FIELD: Partial<Record<TabId, keyof ChapterProgress>> = {
  dialogue: "dialogueRead",
  vocab: "vocabularyStudied",
  grammar: "grammarStudied",
  pronunciation: "pronunciationPracticed",
  culture: "cultureRead",
};

export function ChapterContent({ chapter }: { chapter: Chapter }) {
  const [activeTab, setActiveTab] = useState<TabId>("dialogue");
  const storage = useStorage();
  const { isAuthenticated, updateChapterProgress } = storage;
  // Mark each section studied once per mount (avoids repeated writes on re-clicks)
  const markedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const field = TAB_TO_FIELD[activeTab];
    if (!field || markedRef.current.has(field)) return;
    markedRef.current.add(field);
    updateChapterProgress(chapter.id, { [field]: true }).catch(() => {
      markedRef.current.delete(field); // allow retry if the write failed
    });
  }, [activeTab, chapter.id, updateChapterProgress]);

  return (
    <div>
      {/* Sticky tab bar */}
      <div className="sticky top-0 z-30 bg-slate-50 -mx-4 px-4 lg:-mx-8 lg:px-8 pb-2 pt-1">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide py-1">
          {TABS.map((tab) => {
            const locked = tab.requiresAuth && !isAuthenticated;
            return (
              <button
                key={tab.id}
                onClick={() => !locked && setActiveTab(tab.id)}
                disabled={locked}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                  locked
                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    : activeTab === tab.id
                      ? "bg-orange-600 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-orange-50 border border-slate-200"
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {locked && (
                  <span className="text-xs leading-none opacity-60">🔒</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "dialogue" && (
          <DialogueSection dialogue={chapter.dialogue} />
        )}
        {activeTab === "vocab" && (
          <VocabularySection
            vocabulary={chapter.vocabulary}
            chapterId={chapter.id}
          />
        )}
        {activeTab === "grammar" && (
          <GrammarSection grammar={chapter.grammar} />
        )}
        {activeTab === "pronunciation" && (
          <PronunciationSection pronunciation={chapter.pronunciation} />
        )}
        {activeTab === "culture" && (
          <CultureSection culture={chapter.culture} />
        )}
        {activeTab === "notes" &&
          (isAuthenticated ? (
            <NotesSection chapterId={chapter.id} />
          ) : (
            <LockedFeature feature="Notes" />
          ))}
      </div>
    </div>
  );
}
