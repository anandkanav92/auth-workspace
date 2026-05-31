import React from 'react';
import { THEME } from '../../data/constants';

export default function CategoryBars({ categoryStats }) {
  if (!categoryStats || categoryStats.length === 0) {
    return null;
  }

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
        CATEGORIES
      </div>

      <div
        style={{
          background: THEME.surface,
          borderRadius: 14,
          border: `1px solid ${THEME.border}`,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {categoryStats.map((category) => (
          <div
            key={category.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {/* Left: dot + name */}
            <div
              style={{
                minWidth: 90,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: category.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: THEME.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: THEME.text,
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {category.name}
              </span>
            </div>

            {/* Middle: bar */}
            <div
              style={{
                flex: 1,
                height: 8,
                background: THEME.surfaceAlt,
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${category.pct}%`,
                  height: '100%',
                  background: category.color,
                  borderRadius: 4,
                  transition: 'width 0.4s ease',
                  minWidth: category.pct > 0 ? 4 : 0,
                }}
              />
            </div>

            {/* Right: percentage */}
            <div
              style={{
                minWidth: 32,
                fontFamily: THEME.mono,
                fontSize: 11,
                fontWeight: 700,
                color: THEME.textMuted,
                textAlign: 'right',
              }}
            >
              {category.pct}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
