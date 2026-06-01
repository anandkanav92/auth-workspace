import { THEME, formatTime, getLast5Occurrences } from "../data/constants";
import StreakDots from "./StreakDots";

const GUTTER = 56;

/**
 * Daily agenda (Option A): a left time gutter like the weekly view.
 * All-day habits are grouped at the top; timed habits show their time in the
 * left column. Category appears as a small subtitle under the habit name plus
 * a category-color left stripe on the card (matching the weekly chips).
 *
 * `habits` is expected pre-sorted (all-day first, then by time).
 */
export default function DailyAgenda({
  habits,
  dateStr,
  viewDate,
  completions,
  getCategory,
  vacationMode,
  onToggle,
  onOpenHabit,
}) {
  const allDay = habits.filter((h) => !h.time);
  const timed = habits.filter((h) => h.time);

  return (
    <div>
      {allDay.length > 0 && (
        <>
          <SectionLabel>All day</SectionLabel>
          {allDay.map((habit) => (
            <Row
              key={habit.id}
              timeLabel=""
              habit={habit}
              dateStr={dateStr}
              viewDate={viewDate}
              completions={completions}
              getCategory={getCategory}
              vacationMode={vacationMode}
              onToggle={onToggle}
              onOpenHabit={onOpenHabit}
            />
          ))}
          {timed.length > 0 && (
            <div
              style={{
                height: 1,
                background: THEME.border,
                margin: "10px 0 14px",
                marginLeft: GUTTER,
              }}
            />
          )}
        </>
      )}

      {timed.map((habit) => (
        <Row
          key={habit.id}
          timeLabel={formatTime(habit.time)}
          habit={habit}
          dateStr={dateStr}
          viewDate={viewDate}
          completions={completions}
          getCategory={getCategory}
          vacationMode={vacationMode}
          onToggle={onToggle}
          onOpenHabit={onOpenHabit}
        />
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        marginLeft: GUTTER,
        marginBottom: 6,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "1px",
        textTransform: "uppercase",
        color: THEME.textFaint,
        fontFamily: THEME.mono,
      }}
    >
      {children}
    </div>
  );
}

function Row({
  timeLabel,
  habit,
  dateStr,
  viewDate,
  completions,
  getCategory,
  vacationMode,
  onToggle,
  onOpenHabit,
}) {
  const isChecked = !!completions[`${habit.id}-${dateStr}`];
  const occurrences = getLast5Occurrences(habit, completions, viewDate);
  const category = getCategory(habit.categoryId);

  return (
    <div style={{ display: "flex", marginBottom: 8 }}>
      {/* Time gutter */}
      <div
        style={{
          width: GUTTER,
          flexShrink: 0,
          paddingTop: 12,
          paddingRight: 10,
          textAlign: "right",
          fontSize: 12,
          fontFamily: THEME.mono,
          color: THEME.textFaint,
          whiteSpace: "nowrap",
        }}
      >
        {timeLabel}
      </div>

      {/* Card */}
      <div
        onClick={() => onOpenHabit(habit)}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          background: isChecked ? THEME.doneSoft : THEME.surface,
          borderTop: `1px solid ${isChecked ? THEME.accentSoft : THEME.border}`,
          borderRight: `1px solid ${isChecked ? THEME.accentSoft : THEME.border}`,
          borderBottom: `1px solid ${isChecked ? THEME.accentSoft : THEME.border}`,
          borderLeft: `4px solid ${category.color}`,
          cursor: "pointer",
          opacity: vacationMode ? 0.4 : 1,
          pointerEvents: vacationMode ? "none" : "auto",
        }}
      >
        {/* Checkbox */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggle(habit);
          }}
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            flexShrink: 0,
            border: isChecked
              ? `2px solid ${THEME.done}`
              : `2px solid ${THEME.borderStrong}`,
            background: isChecked ? THEME.done : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            cursor: "pointer",
          }}
        >
          {isChecked && (
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✓</span>
          )}
        </div>

        {/* Habit info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: isChecked ? THEME.accentText : THEME.text,
              textDecoration: isChecked ? "line-through" : "none",
              opacity: isChecked ? 0.7 : 1,
            }}
          >
            {habit.icon} {habit.name}
          </div>
          {/* Category — small subtitle under the name */}
          <div
            style={{
              fontSize: 11,
              color: THEME.textMuted,
              fontFamily: THEME.mono,
              marginTop: 2,
            }}
          >
            {category.name}
          </div>
        </div>

        {/* Streak dots */}
        <StreakDots occurrences={occurrences} size="small" />

        {/* Chevron */}
        <span style={{ color: THEME.textFaint, fontSize: 14, flexShrink: 0 }}>›</span>
      </div>
    </div>
  );
}
