import React from 'react';
import { THEME } from '../../data/constants';

function CircularProgressRing({ percentage }) {
  const radius = 18;
  const strokeWidth = 5;
  const size = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={THEME.border}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={THEME.accent}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        style={{
          fontSize: 11,
          fontFamily: THEME.mono,
          fontWeight: 'bold',
          fill: THEME.text,
        }}
      >
        {Math.round(percentage)}%
      </text>
    </svg>
  );
}

function StatCard({ children }) {
  return (
    <div
      style={{
        backgroundColor: THEME.surface,
        borderRadius: 14,
        border: `1px solid ${THEME.border}`,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {children}
    </div>
  );
}

export default function SummaryCards({
  completionRate,
  currentStreak,
  bestDay,
  activeHabits,
  motivationalMessage,
}) {
  const labelStyle = {
    fontFamily: THEME.sans,
    fontSize: 13,
    color: THEME.textMuted,
    margin: 0,
  };

  const valueStyle = {
    fontFamily: THEME.mono,
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.text,
    margin: 0,
  };

  const subtitleStyle = {
    fontFamily: THEME.sans,
    fontSize: 12,
    color: THEME.textFaint,
    margin: 0,
  };

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        {/* Completion Rate */}
        <StatCard>
          <p style={labelStyle}>Completion Rate</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <CircularProgressRing percentage={completionRate} />
            <div>
              <p style={valueStyle}>{Math.round(completionRate)}%</p>
              <p style={subtitleStyle}>overall</p>
            </div>
          </div>
        </StatCard>

        {/* Current Streak */}
        <StatCard>
          <p style={labelStyle}>Current Streak</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <p style={valueStyle}>{currentStreak}</p>
            <span style={{ fontSize: 20 }}>{currentStreak >= 7 ? '🔥' : '⚡'}</span>
          </div>
          <p style={subtitleStyle}>{currentStreak === 1 ? 'day' : 'days'}</p>
        </StatCard>

        {/* Best Day */}
        <StatCard>
          <p style={labelStyle}>Best Day</p>
          <p style={{ ...valueStyle, fontSize: bestDay && bestDay.length > 6 ? 20 : 24, marginTop: 4 }}>
            {bestDay || '--'}
          </p>
          <p style={subtitleStyle}>most completions</p>
        </StatCard>

        {/* Active Habits */}
        <StatCard>
          <p style={labelStyle}>Active Habits</p>
          <p style={{ ...valueStyle, marginTop: 4 }}>{activeHabits}</p>
          <p style={subtitleStyle}>tracked</p>
        </StatCard>
      </div>

      {/* Motivational Banner */}
      {motivationalMessage && (
        <div
          style={{
            marginTop: 12,
            backgroundColor: THEME.accentTint,
            border: `1px solid ${THEME.accentSoft}`,
            borderRadius: 10,
            padding: '12px 16px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: THEME.sans,
              fontSize: 14,
              color: THEME.accentText,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {motivationalMessage}
          </p>
        </div>
      )}
    </div>
  );
}
