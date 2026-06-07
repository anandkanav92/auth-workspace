import { THEME } from "../../data/constants";

export default function WeeklyChart({ weeklyData }) {
  const BAR_WIDTH = 32;
  const BAR_GAP = 8;
  const MAX_BAR_HEIGHT = 120;
  const LABEL_AREA_TOP = 18;
  const LABEL_AREA_BOTTOM = 30;
  const DOT_AREA = 12;
  const CHART_TOP_PADDING = 4;

  const totalWidth = weeklyData.length * BAR_WIDTH + (weeklyData.length - 1) * BAR_GAP;
  const svgHeight = CHART_TOP_PADDING + LABEL_AREA_TOP + MAX_BAR_HEIGHT + LABEL_AREA_BOTTOM + DOT_AREA;

  const barBaseY = CHART_TOP_PADDING + LABEL_AREA_TOP + MAX_BAR_HEIGHT;

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: THEME.mono,
          color: THEME.textMuted,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        THIS WEEK
      </div>

      <div
        style={{
          background: THEME.surface,
          borderRadius: 14,
          border: `1px solid ${THEME.border}`,
          padding: "20px 16px",
        }}
      >
        <svg
          width={totalWidth}
          height={svgHeight}
          style={{ display: "block", margin: "0 auto" }}
        >
          <defs>
            <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#F43F5E" />
              <stop offset="50%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#FDA4AF" />
            </linearGradient>
          </defs>

          {weeklyData.map((day, i) => {
            const x = i * (BAR_WIDTH + BAR_GAP);
            const centerX = x + BAR_WIDTH / 2;
            const barHeight =
              day.pct === -1 ? 0 : (day.pct / 100) * MAX_BAR_HEIGHT;

            return (
              <g key={day.date}>
                {/* Percentage label above bar */}
                <text
                  x={centerX}
                  y={barBaseY - barHeight - 6}
                  textAnchor="middle"
                  style={{
                    fontSize: 10,
                    fontFamily: THEME.mono,
                    fill: THEME.textMuted,
                  }}
                >
                  {day.pct === -1 ? "" : `${day.pct}%`}
                </text>

                {/* Bar or dash */}
                {day.pct === -1 ? (
                  <rect
                    x={x + 6}
                    y={barBaseY - 2}
                    width={BAR_WIDTH - 12}
                    height={3}
                    rx={1.5}
                    ry={1.5}
                    fill={THEME.borderStrong}
                  />
                ) : barHeight > 0 ? (
                  <rect
                    x={x}
                    y={barBaseY - barHeight}
                    width={BAR_WIDTH}
                    height={barHeight}
                    rx={6}
                    ry={6}
                    fill={day.isToday ? "url(#barGrad)" : THEME.accent}
                    opacity={day.isToday ? 1 : 0.6}
                  />
                ) : (
                  /* 0% — show a tiny sliver so the column isn't empty */
                  <rect
                    x={x + 6}
                    y={barBaseY - 2}
                    width={BAR_WIDTH - 12}
                    height={3}
                    rx={1.5}
                    ry={1.5}
                    fill={day.isToday ? "url(#barGrad)" : THEME.accent}
                    opacity={day.isToday ? 1 : 0.6}
                  />
                )}

                {/* Day label below bar */}
                <text
                  x={centerX}
                  y={barBaseY + 18}
                  textAnchor="middle"
                  style={{
                    fontSize: 11,
                    fontFamily: THEME.mono,
                    fill: day.isToday ? THEME.accent : THEME.textMuted,
                    fontWeight: day.isToday ? 700 : 400,
                  }}
                >
                  {day.dayLabel}
                </text>

                {/* Accent dot below today's label */}
                {day.isToday && (
                  <circle cx={centerX} cy={barBaseY + 28} r={3} fill={THEME.accent} />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
