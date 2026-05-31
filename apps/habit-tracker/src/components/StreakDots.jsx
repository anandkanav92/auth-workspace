import { useState } from "react";
import { THEME } from "../data/constants";

const STATUS_COLOR = {
  done: "#10B981",    // green — success
  missed: "#E8453C",  // red — missed
  frozen: "#93c5fd",  // frost blue — streak freeze (paired with a ❄️ below)
};

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
                  background: STATUS_COLOR[occ.status] ?? STATUS_COLOR.missed,
                  cursor: isLarge ? "pointer" : "default",
                  transition: "background 0.2s ease",
                }}
              />
              {/* Freeze marker */}
              {isLarge && occ.status === "frozen" && (
                <div style={{ fontSize: 10, marginTop: -1 }}>❄️</div>
              )}
              {/* Note indicator — neutral underline (blue is reserved for freeze) */}
              {isLarge && hasNotes && occ.status !== "frozen" && (
                <div style={{
                  width: 10, height: 2, borderRadius: 1,
                  background: THEME.textMuted, marginTop: 0,
                }} />
              )}
              {isLarge && !hasNotes && occ.status !== "frozen" && <div style={{ height: 2 }} />}
              {isLarge && (
                <span style={{ fontSize: 9, color: THEME.textFaint, fontFamily: THEME.mono, whiteSpace: "nowrap" }}>
                  {formatShortDate(occ.date)}
                </span>
              )}
            </div>
          );
        })}
        {display.length === 0 && (
          <span style={{ fontSize: isLarge ? 12 : 10, color: THEME.textFaint }}>
            {isLarge ? "No history yet" : ""}
          </span>
        )}
      </div>

      {/* Legend — only in the detailed view */}
      {isLarge && display.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "6px 14px",
          fontSize: 10, color: THEME.textMuted, fontFamily: THEME.mono,
        }}>
          <LegendItem dot={STATUS_COLOR.done} label="Done" />
          <LegendItem dot={STATUS_COLOR.missed} label="Missed" />
          <LegendItem icon="❄️" label="Freeze" />
          <LegendItem line label="Notes" />
        </div>
      )}

      {/* Expanded note card */}
      {isLarge && expandedIdx !== null && display[expandedIdx] && (display[expandedIdx].notes || display[expandedIdx].effort !== null) && (
        <div style={{
          padding: "8px 12px", background: THEME.surfaceAlt, borderRadius: 8,
          border: `1px solid ${THEME.border}`, fontSize: 12, color: THEME.text,
        }}>
          {display[expandedIdx].effort !== null && (
            <div style={{
              fontSize: 11, fontWeight: 600, color: THEME.textMuted,
              fontFamily: THEME.mono, marginBottom: display[expandedIdx].notes ? 4 : 0,
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

/** Single key entry: a colored dot, an icon, or a neutral underline + label. */
function LegendItem({ dot, icon, line, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {dot && (
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
      )}
      {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
      {line && (
        <span style={{ width: 10, height: 2, borderRadius: 1, background: THEME.textMuted }} />
      )}
      {label}
    </span>
  );
}
