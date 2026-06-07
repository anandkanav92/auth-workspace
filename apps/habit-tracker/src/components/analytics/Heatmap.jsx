import React from 'react';
import { THEME } from '../../data/constants';

// Coral intensity ramp — light → deep coral as completion rises, matching the
// app-wide "completion = coral" language.
function getCellColor(pct) {
  if (pct < 0) return THEME.surfaceAlt; // no habits scheduled that day
  if (pct === 0) return '#FBE4DE';      // had habits, none done (faint warm)
  if (pct <= 32) return '#FECDD3';      // coral-200
  if (pct <= 65) return '#FDA4AF';      // coral-300
  if (pct <= 99) return '#FB7185';      // coral-400 (accent)
  return '#F43F5E';                     // coral-500 (deep)
}

function getTooltipText(entry) {
  if (!entry) return '';
  if (entry.pct < 0) return `${entry.date}: no habits`;
  return `${entry.date}: ${entry.pct}%`;
}

export default function Heatmap({ heatmapData }) {
  if (!heatmapData || heatmapData.length === 0) {
    return null;
  }

  // Organize flat chronological data into week columns (each week = 7 slots by dayOfWeek)
  const weeks = [];
  let currentWeek = new Array(7).fill(null);

  for (const entry of heatmapData) {
    if (entry.dayOfWeek === 0 && currentWeek.some((slot) => slot !== null)) {
      weeks.push(currentWeek);
      currentWeek = new Array(7).fill(null);
    }
    currentWeek[entry.dayOfWeek] = entry;
  }
  if (currentWeek.some((slot) => slot !== null)) {
    weeks.push(currentWeek);
  }

  const cellSize = 14;
  const gap = 3;
  const labelWidth = 16;
  const headerHeight = 16;

  const svgWidth = labelWidth + weeks.length * (cellSize + gap);
  const svgHeight = headerHeight + 7 * (cellSize + gap);

  // Determine month labels — show at first week where a new month appears
  const monthLabels = [];
  let lastMonth = null;
  for (let col = 0; col < weeks.length; col++) {
    const week = weeks[col];
    const firstEntry = week.find((slot) => slot !== null);
    if (firstEntry && firstEntry.month !== lastMonth) {
      monthLabels.push({ col, month: firstEntry.month });
      lastMonth = firstEntry.month;
    }
  }

  // Day labels — show M, W, F (indices 0, 2, 4)
  const dayLabels = [
    { row: 0, label: 'M' },
    { row: 2, label: 'W' },
    { row: 4, label: 'F' },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontFamily: THEME.mono,
          fontSize: 11,
          fontWeight: 700,
          color: THEME.textMuted,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        12-WEEK ACTIVITY
      </div>

      <div
        style={{
          background: THEME.surface,
          borderRadius: 14,
          border: `1px solid ${THEME.border}`,
          padding: 16,
          overflowX: 'auto',
        }}
      >
        <svg width={svgWidth} height={svgHeight}>
          {/* Month labels */}
          {monthLabels.map(({ col, month }) => (
            <text
              key={`month-${col}`}
              x={labelWidth + col * (cellSize + gap) + cellSize / 2}
              y={headerHeight - 4}
              textAnchor="middle"
              style={{
                fontSize: 9,
                fill: THEME.textFaint,
                fontFamily: THEME.mono,
              }}
            >
              {month}
            </text>
          ))}

          {/* Day labels */}
          {dayLabels.map(({ row, label }) => (
            <text
              key={`day-${row}`}
              x={labelWidth - 4}
              y={headerHeight + row * (cellSize + gap) + cellSize / 2 + 3}
              textAnchor="end"
              style={{
                fontSize: 8,
                fill: THEME.textFaint,
                fontFamily: THEME.mono,
              }}
            >
              {label}
            </text>
          ))}

          {/* Grid cells */}
          {weeks.map((week, col) =>
            week.map((entry, row) => {
              if (!entry) return null;
              const x = labelWidth + col * (cellSize + gap);
              const y = headerHeight + row * (cellSize + gap);
              return (
                <rect
                  key={`${col}-${row}`}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={3}
                  ry={3}
                  fill={getCellColor(entry.pct)}
                >
                  <title>{getTooltipText(entry)}</title>
                </rect>
              );
            })
          )}
        </svg>
      </div>
    </div>
  );
}
