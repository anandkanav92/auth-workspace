import { THEME } from "../data/constants";

const RULES = [
  {
    emoji: "✅",
    title: "Earn a day",
    body: "Complete at least one scheduled habit and the day counts — your streak grows by 1.",
  },
  {
    emoji: "❄️",
    title: "One free miss a week",
    body: "Miss a day? The first slip each week (Mon–Sun) is forgiven — your streak freezes instead of breaking.",
  },
  {
    emoji: "🔁",
    title: "Slip twice and it resets",
    body: "A second miss in the same week ends the streak. Your free miss refreshes every Monday.",
  },
  {
    emoji: "🛌",
    title: "Rest days are free",
    body: "Days with no habits scheduled are skipped — they never count against you.",
  },
  {
    emoji: "🏖️",
    title: "Vacation mode pauses everything",
    body: "Turn on vacation mode and all habits pause. Your streak is preserved until you return.",
  },
];

const LEGEND = [
  { kind: "dot", color: "#10B981", label: "Done" },
  { kind: "dot", color: "#E8453C", label: "Missed" },
  { kind: "icon", glyph: "❄️", label: "Freeze" },
  { kind: "line", label: "Has notes" },
];

export default function StreaksGuide() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>
      {/* Header */}
      <h1
        style={{
          margin: "4px 0 2px",
          fontSize: 24,
          fontWeight: 700,
          color: THEME.text,
          fontFamily: THEME.sans,
        }}
      >
        🔥 How Streaks Work
      </h1>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: 13,
          color: THEME.textMuted,
          fontFamily: THEME.mono,
        }}
      >
        Build momentum without the all-or-nothing pressure.
      </p>

      {/* Hero TL;DR */}
      <div
        style={{
          background: THEME.accentGradient,
          borderRadius: 16,
          padding: "18px 20px",
          marginBottom: 20,
          boxShadow: "0 4px 16px rgba(251,113,133,0.3)",
        }}
      >
        <div style={{ fontSize: 26, marginBottom: 6 }}>🔥</div>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.5,
            fontFamily: THEME.sans,
          }}
        >
          Do one habit a day. Slip once a week, no stress. Slip twice and it
          resets.
        </p>
      </div>

      {/* Rule cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {RULES.map((rule) => (
          <div
            key={rule.title}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              background: THEME.surface,
              border: `1px solid ${THEME.border}`,
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: THEME.accentTint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {rule.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: THEME.text,
                  marginBottom: 2,
                  fontFamily: THEME.sans,
                }}
              >
                {rule.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: THEME.textMuted,
                  fontFamily: THEME.sans,
                }}
              >
                {rule.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two kinds of streak */}
      <SectionLabel>Two kinds of streak</SectionLabel>
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <MiniCard
          title="Overall streak"
          body="The big number — consecutive days where you did at least one habit."
        />
        <MiniCard
          title="Per-habit streak"
          body="The 🔥 badge on each habit, shown once you reach 2 in a row."
        />
      </div>

      {/* Reading Recent History */}
      <SectionLabel>Reading “Recent History”</SectionLabel>
      <div
        style={{
          background: THEME.surface,
          border: `1px solid ${THEME.border}`,
          borderRadius: 14,
          padding: "16px",
          marginBottom: 8,
        }}
      >
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 13,
            color: THEME.textMuted,
            lineHeight: 1.5,
            fontFamily: THEME.sans,
          }}
        >
          Each habit shows its last few scheduled days, newest on the right. Tap
          a dot to mark it done, or tap a noted day to read what you logged.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px" }}>
          {LEGEND.map((item) => (
            <span
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                color: THEME.text,
                fontFamily: THEME.sans,
              }}
            >
              {item.kind === "dot" && (
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: item.color,
                  }}
                />
              )}
              {item.kind === "icon" && <span style={{ fontSize: 13 }}>{item.glyph}</span>}
              {item.kind === "line" && (
                <span
                  style={{
                    width: 14,
                    height: 2,
                    borderRadius: 1,
                    background: THEME.textMuted,
                  }}
                />
              )}
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: THEME.textMuted,
        fontFamily: THEME.mono,
        letterSpacing: "1px",
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function MiniCard({ title, body }) {
  return (
    <div
      style={{
        flex: "1 1 160px",
        minWidth: 0,
        background: THEME.surface,
        border: `1px solid ${THEME.border}`,
        borderRadius: 14,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: THEME.accentText,
          marginBottom: 4,
          fontFamily: THEME.sans,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.5,
          color: THEME.textMuted,
          fontFamily: THEME.sans,
        }}
      >
        {body}
      </div>
    </div>
  );
}
