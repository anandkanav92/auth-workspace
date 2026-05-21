import StreakDots from "./StreakDots";
import { DAYS } from "../data/constants";

export default function HabitDetail({ habit, category, occurrences, onClose, onEdit, onToggleOccurrence }) {
  const scheduledLabel =
    habit.days.length === 7
      ? "Daily"
      : habit.days.map((d) => DAYS[d].slice(0, 3)).join(", ");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff", borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 600, maxHeight: "88vh", overflowY: "auto",
          padding: "24px 20px 40px", position: "relative",
          border: "1px solid #e0e0eb", borderBottom: "none",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .modal-inner { animation: slideUp 0.25s ease; }
        `}</style>
        <div className="modal-inner">
          {/* Drag handle */}
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#d0d0e0", margin: "0 auto 20px" }} />

          {/* Edit button */}
          <button onClick={onEdit} style={{
            position: "absolute", top: 16, right: 56,
            background: "#f5f5fa", border: "1px solid #e0e0eb",
            borderRadius: 8, width: 32, height: 32,
            color: "#999", fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✏️</button>

          {/* Close button */}
          <button onClick={onClose} style={{
            position: "absolute", top: 16, right: 16,
            background: "#f5f5fa", border: "1px solid #e0e0eb",
            borderRadius: 8, width: 32, height: 32,
            color: "#999", fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: "inline-block", padding: "3px 10px", borderRadius: 6,
              background: `${category.color}18`,
              border: `1px solid ${category.color}30`,
              fontSize: 10, fontWeight: 600, color: category.color,
              fontFamily: "'Space Mono', monospace", marginBottom: 8, letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}>
              {category.name}
            </div>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>
              {habit.icon} {habit.name}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#aaa", fontFamily: "'Space Mono', monospace" }}>
              {scheduledLabel}
            </p>
          </div>

          {/* Recent History */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 10,
              fontFamily: "'Space Mono', monospace", letterSpacing: "1px",
            }}>
              RECENT HISTORY
            </h3>
            <StreakDots occurrences={occurrences} size="large" onToggle={onToggleOccurrence} />
            <p style={{ margin: "8px 0 0", fontSize: 10, color: "#ccc", fontFamily: "'Space Mono', monospace" }}>
              Tap a dot to toggle
            </p>
          </div>

          {/* Notes (conditional) */}
          {habit.notes && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{
                fontSize: 11, fontWeight: 700, color: "#F59E0B", marginBottom: 10,
                fontFamily: "'Space Mono', monospace", letterSpacing: "1px",
              }}>
                NOTES
              </h3>
              <div style={{
                padding: "12px 14px", background: "#fffbf0", borderRadius: 10,
                fontSize: 13, lineHeight: 1.6, color: "#555", border: "1px solid #f0e8d0",
                whiteSpace: "pre-line",
              }}>
                {habit.notes}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 10,
              fontFamily: "'Space Mono', monospace", letterSpacing: "1px",
            }}>
              SCHEDULE
            </h3>
            <div style={{ display: "flex", gap: 6 }}>
              {DAYS.map((day, idx) => {
                const active = habit.days.includes(idx);
                return (
                  <div key={idx} style={{
                    width: 32, height: 32, borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 600,
                    fontFamily: "'Space Mono', monospace",
                    background: active ? "#3B82F6" : "#f0f0f5",
                    color: active ? "#fff" : "#bbb",
                    border: active ? "1px solid #3B82F6" : "1px solid #e0e0eb",
                  }}>
                    {day.slice(0, 2)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
