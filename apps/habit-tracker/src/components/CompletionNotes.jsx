import { useState } from "react";
import { THEME } from "../data/constants";

const EFFORT_LABELS = ["None", "", "", "", "", "Medium", "", "", "", "", "Max"];
const EFFORT_COLORS = [
  "#10B981", "#22c55e", "#84cc16", "#a3e635", "#eab308",
  "#f59e0b", "#f97316", "#ef4444", "#dc2626", "#b91c1c", "#991b1b",
];

export default function CompletionNotes({ habit, onSave, onSkip }) {
  const [effort, setEffort] = useState(5);
  const [notes, setNotes] = useState("");

  return (
    <div
      onClick={onSkip}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        zIndex: 1100, display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: THEME.surface, borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 600,
          padding: "24px 20px 40px", position: "relative",
          border: `1px solid ${THEME.border}`, borderBottom: "none",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <style>{`
          @keyframes slideUpNotes {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .notes-inner { animation: slideUpNotes 0.25s ease; }
        `}</style>
        <div className="notes-inner">
          {/* Drag handle */}
          <div style={{ width: 36, height: 4, borderRadius: 2, background: THEME.borderStrong, margin: "0 auto 16px" }} />

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{habit.icon || "✅"}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: THEME.text }}>
              {habit.name}
            </div>
            <div style={{
              fontSize: 11, color: THEME.accent, fontWeight: 600,
              fontFamily: THEME.mono, marginTop: 2,
            }}>
              COMPLETED
            </div>
          </div>

          {/* Effort slider */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: THEME.textMuted,
                fontFamily: THEME.mono, letterSpacing: "1px",
              }}>
                EFFORT
              </span>
              <span style={{
                fontSize: 20, fontWeight: 700,
                color: EFFORT_COLORS[effort],
              }}>
                {effort}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={10}
              value={effort}
              onChange={(e) => setEffort(Number(e.target.value))}
              style={{
                width: "100%", height: 6, appearance: "none",
                background: `linear-gradient(to right, #10B981, #eab308, #dc2626)`,
                borderRadius: 3, outline: "none",
                cursor: "pointer",
              }}
            />
            <div style={{
              display: "flex", justifyContent: "space-between", marginTop: 4,
            }}>
              <span style={{ fontSize: 9, color: THEME.textFaint, fontFamily: THEME.mono }}>
                No effort
              </span>
              <span style={{ fontSize: 9, color: THEME.textFaint, fontFamily: THEME.mono }}>
                Max effort
              </span>
            </div>
          </div>

          {/* Notes textarea */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: THEME.textMuted,
              fontFamily: THEME.mono, letterSpacing: "1px",
              marginBottom: 8,
            }}>
              NOTES
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go?"
              rows={3}
              style={{
                width: "100%", padding: "10px 12px",
                borderRadius: 10, border: `1px solid ${THEME.border}`,
                background: THEME.surfaceAlt, fontSize: 13,
                fontFamily: THEME.sans,
                color: THEME.text, resize: "none", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onSkip}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 10,
                border: `1px solid ${THEME.border}`, background: THEME.surfaceAlt,
                fontSize: 13, fontWeight: 600, color: THEME.textMuted,
                cursor: "pointer", fontFamily: THEME.sans,
              }}
            >
              Skip
            </button>
            <button
              onClick={() => onSave({ effort, notes })}
              style={{
                flex: 2, padding: "12px 0", borderRadius: 10,
                border: "none",
                background: THEME.accentGradient,
                fontSize: 13, fontWeight: 600, color: "#fff",
                cursor: "pointer", fontFamily: THEME.sans,
                boxShadow: "0 2px 8px rgba(251,113,133,0.3)",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
