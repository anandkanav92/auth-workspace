"use client";

import type { Dialogue } from "@/types/chapter";
import { useState } from "react";
import { PlayButton } from "@/components/audio/PlayButton";

export function DialogueSection({ dialogue }: { dialogue: Dialogue }) {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-slate-900">Dialoog</h2>
        <button
          onClick={() => setShowTranslation(!showTranslation)}
          className="text-sm text-orange-600 hover:text-orange-700 font-medium"
        >
          {showTranslation ? "Hide" : "Show"} English
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {dialogue.lines.map((line, i) => (
          <div key={i} className="flex gap-2 px-3 py-2.5 lg:px-6 lg:py-3 select-text">
            <span className="font-mono text-xs text-slate-400 w-16 lg:w-20 shrink-0 pt-1">
              {line.speaker}
            </span>
            <PlayButton text={line.dutch} />
            <div className="min-w-0">
              <p className="text-slate-900 text-sm lg:text-base">{line.dutch}</p>
              {showTranslation && (
                <p className="text-xs text-slate-400 italic mt-0.5">
                  {line.english}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
