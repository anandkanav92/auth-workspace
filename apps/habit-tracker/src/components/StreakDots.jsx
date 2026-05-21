export default function StreakDots({ occurrences, size = "small", onToggle }) {
  const isLarge = size === "large";
  const dotSize = isLarge ? 16 : 8;
  const gap = isLarge ? 12 : 4;

  // Show most recent on right — occurrences come newest-first, reverse for display
  const display = [...occurrences].reverse();

  const formatShortDate = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap }}>
      {display.map((occ, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            onClick={isLarge && onToggle ? () => onToggle(occ.date) : undefined}
            style={{
              width: dotSize, height: dotSize, borderRadius: "50%",
              background: occ.done ? "#10B981" : "#E8453C",
              cursor: isLarge && onToggle ? "pointer" : "default",
              transition: "background 0.2s ease",
            }}
          />
          {isLarge && (
            <span style={{ fontSize: 9, color: "#aaa", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>
              {formatShortDate(occ.date)}
            </span>
          )}
        </div>
      ))}
      {display.length === 0 && (
        <span style={{ fontSize: isLarge ? 12 : 10, color: "#ccc" }}>
          {isLarge ? "No history yet" : ""}
        </span>
      )}
    </div>
  );
}
