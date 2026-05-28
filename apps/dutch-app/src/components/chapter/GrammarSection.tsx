"use client";

import { useState } from "react";
import type { GrammarRule } from "@/types/chapter";
import { PlayButton } from "@/components/audio/PlayButton";

function GrammarCard({
  rule,
  isOpen,
  onToggle,
}: {
  rule: GrammarRule;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Tappable header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <h3 className="font-semibold text-slate-900 text-sm lg:text-base pr-2">
          {rule.topic}
        </h3>
        <span
          className={`text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {/* Expandable content */}
      {isOpen && (
        <div className="px-4 pb-4 lg:px-6 lg:pb-6 space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line select-text">
            {rule.explanation}
          </p>

          {rule.tips && rule.tips.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 lg:p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                Tips for English speakers
              </p>
              <ul className="space-y-1.5">
                {rule.tips.map((tip, j) => (
                  <li
                    key={j}
                    className="text-sm text-amber-900 flex gap-2 select-text"
                  >
                    <span className="shrink-0">💡</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rule.table && (
            <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
              <table className="w-full text-sm border-collapse min-w-[400px]">
                <thead>
                  <tr>
                    {rule.table.headers.map((h, j) => (
                      <th
                        key={j}
                        className="text-left px-3 py-2 bg-slate-100 font-semibold text-slate-700 border-b text-xs lg:text-sm"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rule.table.rows.map((row, j) => (
                    <tr
                      key={j}
                      className={j % 2 === 0 ? "bg-white" : "bg-slate-50"}
                    >
                      {row.map((cell, k) => (
                        <td
                          key={k}
                          className="px-3 py-2 border-b border-slate-100 text-slate-800 text-xs lg:text-sm select-text"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rule.examples.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 lg:p-4 space-y-2">
              {rule.examples.map((ex, j) => (
                <div key={j}>
                  <div className="flex items-center gap-2 text-sm">
                    <PlayButton text={ex.dutch} size="sm" />
                    <span className="text-slate-900 font-medium select-text">
                      {ex.dutch}
                    </span>
                    <span className="text-slate-300">&mdash;</span>
                    <span className="text-slate-500 italic select-text">
                      {ex.english}
                    </span>
                  </div>
                  {ex.note && (
                    <p className="text-xs text-slate-400 ml-9 mt-0.5 select-text">
                      {ex.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GrammarSection({ grammar }: { grammar: GrammarRule[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section>
      <h2 className="text-xl font-semibold mb-3 text-slate-900">Grammatica</h2>
      <p className="text-sm text-slate-500 mb-4">
        {grammar.length} lessons — tap to expand
      </p>
      <div className="space-y-2">
        {grammar.map((rule, i) => (
          <GrammarCard
            key={i}
            rule={rule}
            isOpen={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </div>
    </section>
  );
}
