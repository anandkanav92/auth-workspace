import { useState } from "react";

export default function StreakDots({ occurrences, size = "small", onToggle }) {
  const isLarge = size === "large";
  const dotSize = isLarge ? 16 : 8;
  const gap = isLarge ? 12 : 4;
  const [expandedIdx, setExpandedIdx] = useState(null);

  // Show most recent on right — occurrences come newest-first, reverse for display
  const display = [...occurrences].reverse();

  const formatShortDate = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap }}>
        {display.map((occ, i) => {
          const hasNotes = occ.notes || occ.effort !== null;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                onClick={isLarge ? () => {
                  if (hasNotes) setExpandedIdx(expandedIdx === i ? null : i);
                  if (onToggle) onToggle(occ.date);
                } : undefined}
                style={{
                  width: dotSize, height: dotSize, borderRadius: "50%",
                  background: occ.done ? "#10B981" : "#E8453C",
                  cursor: isLarge ? "pointer" : "default",
                  transition: "background 0.2s ease",
                }}
              />
              {/* Note indicator line */}
              {isLarge && hasNotes && (
                <div style={{
                  width: 8, height: 2, borderRadius: 1,
                  background: "#3B82F6", marginTop: -2,
                }} />
              )}
              {isLarge && !hasNotes && <div style={{ height: 2 }} />}
              {isLarge && (
                <span style={{ fontSize: 9, color: "#aaa", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>
                  {formatShortDate(occ.date)}
                </span>
              )}
            </div>
          );
        })}
        {display.length === 0 && (
          <span style={{ fontSize: isLarge ? 12 : 10, color: "#ccc" }}>
            {isLarge ? "No history yet" : ""}
          </span>
        )}
      </div>

      {/* Expanded note card */}
      {isLarge && expandedIdx !== null && display[expandedIdx] && (display[expandedIdx].notes || display[expandedIdx].effort !== null) && (
        <div style={{
          padding: "8px 12px", background: "#f9f9fc", borderRadius: 8,
          border: "1px solid #e8e8f0", fontSize: 12, color: "#555",
        }}>
          {display[expandedIdx].effort !== null && (
            <div style={{
              fontSize: 11, fontWeight: 600, color: "#888",
              fontFamily: "'Space Mono', monospace", marginBottom: display[expandedIdx].notes ? 4 : 0,
            }}>
              Effort: {display[expandedIdx].effort}/10
            </div>
          )}
          {display[expandedIdx].notes && (
            <div style={{ lineHeight: 1.5, whiteSpace: "pre-line" }}>
              {display[expandedIdx].notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
