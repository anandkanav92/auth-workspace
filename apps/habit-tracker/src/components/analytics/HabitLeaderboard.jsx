import React from 'react';

const MEDALS = ['🥇', '🥈', '🥉'];

function HabitLeaderboard({ habitStats, onHabitTap }) {
  if (!habitStats || habitStats.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
          fontWeight: 700,
          color: '#888',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        HABIT RANKINGS
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #e8e8f0',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {habitStats.map((habit, index) => (
          <div
            key={habit.id}
            onClick={() => onHabitTap(habit.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 4px',
              cursor: 'pointer',
              borderRadius: 8,
            }}
          >
            {/* Rank */}
            <div
              style={{
                width: 24,
                textAlign: 'center',
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                color: '#bbb',
                flexShrink: 0,
              }}
            >
              {index < 3 ? MEDALS[index] : index + 1}
            </div>

            {/* Icon + Name */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flex: 1,
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{habit.icon}</span>
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#333',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {habit.name}
              </span>
            </div>

            {/* Mini bar */}
            <div
              style={{
                width: 60,
                height: 6,
                background: '#f0f0f8',
                borderRadius: 3,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: `${habit.pct}%`,
                  height: '100%',
                  background: habit.categoryColor,
                  borderRadius: 3,
                }}
              />
            </div>

            {/* Percentage */}
            <div
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                color: '#555',
                minWidth: 32,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {habit.pct}%
            </div>

            {/* Streak badge */}
            {habit.streak >= 2 && (
              <div
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#F59E0B',
                  flexShrink: 0,
                }}
              >
                🔥{habit.streak}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default HabitLeaderboard;
