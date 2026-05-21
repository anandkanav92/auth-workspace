import React from 'react';

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
        stroke="#f0f0f8"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#10B981"
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
          fontFamily: "'Space Mono', monospace",
          fontWeight: 'bold',
          fill: '#1a1a2e',
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
        backgroundColor: '#ffffff',
        borderRadius: 14,
        border: '1px solid #e8e8f0',
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
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    color: '#6b7280',
    margin: 0,
  };

  const valueStyle = {
    fontFamily: "'Space Mono', monospace",
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    margin: 0,
  };

  const subtitleStyle = {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    color: '#9ca3af',
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
            backgroundColor: '#f0fdf8',
            border: '1px solid rgba(167, 243, 208, 0.125)',
            borderRadius: 10,
            padding: '12px 16px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              color: '#065f46',
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
