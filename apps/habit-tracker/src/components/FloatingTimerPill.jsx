import { formatTime } from "./Timer";

export default function FloatingTimerPill({ remaining, habitName, running, onPause, onTap }) {
  return (
    <div
      onClick={onTap}
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 950,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        background: "#ffffff",
        borderRadius: 24,
        boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
        border: "1px solid #e0e0eb",
        cursor: "pointer",
      }}
    >
      <span style={{
        fontSize: 14,
        fontFamily: "'Space Mono', monospace",
        fontWeight: 700,
        color: "#10B981",
        whiteSpace: "nowrap",
      }}>
        ⏱ {formatTime(remaining)}
      </span>
      {habitName && (
        <span style={{
          fontSize: 13,
          color: "#666",
          fontFamily: "'DM Sans', sans-serif",
          maxWidth: 120,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          · {habitName}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onPause(); }}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #F59E0B, #D97706)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        ⏸
      </button>
    </div>
  );
}
