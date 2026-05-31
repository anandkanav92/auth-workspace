import {
  getWeekDates,
  getHourFromTime,
  getHourLabels,
  getJsDayToOurDay,
  toDateStr,
  THEME,
} from "../data/constants";

const HOURS = getHourLabels(6, 22);

// Layout constants — the gutter is sticky-left, each day column has a fixed
// min width so 7 columns overflow on narrow screens instead of cutting off.
const GUTTER_WIDTH = 48;
const DAY_MIN_WIDTH = 132;

export default function WeeklyView({
  weekOffset,
  setWeekOffset,
  habits,
  completions,
  toggleCompletion,
  getCategory,
  onHabitClick,
  vacationMode,
}) {
  const today = new Date();
  const baseDate = new Date(today);
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(baseDate);
  const todayStr = toDateStr(today);

  // Split habits into all-day and timed
  // Timed habits outside the 06-22 range fall back to the all-day row
  const allDayHabits = habits.filter((h) => {
    if (!h.time) return true;
    const hour = getHourFromTime(h.time);
    return hour < 6 || hour > 22;
  });
  const timedHabits = habits.filter((h) => {
    if (!h.time) return false;
    const hour = getHourFromTime(h.time);
    return hour >= 6 && hour <= 22;
  });

  // Group timed habits by hour
  const habitsByHour = {};
  HOURS.forEach((hour) => {
    habitsByHour[hour] = timedHabits.filter(
      (h) => getHourFromTime(h.time) === hour
    );
  });

  // Check if any habits exist for an hour (across the week)
  const activeHours = HOURS.filter((hour) => {
    return habitsByHour[hour].some((h) =>
      weekDates.some((d) => h.days.includes(getJsDayToOurDay(d.getDay())))
    );
  });

  const isEmpty = allDayHabits.length === 0 && activeHours.length === 0;

  return (
    <div>
      {/* Week navigation */}
      <div
        style={{
          background: THEME.surface,
          borderRadius: 12,
          padding: "10px 16px",
          border: `1px solid ${THEME.border}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            style={{
              background: "none",
              border: "none",
              color: THEME.textMuted,
              fontSize: 18,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ←
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text }}>
              {weekDates[0].toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}{" "}
              –{" "}
              {weekDates[6].toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            style={{
              background: "none",
              border: "none",
              color: THEME.textMuted,
              fontSize: 18,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            →
          </button>
        </div>

        {weekOffset !== 0 && (
          <div style={{ textAlign: "center", marginTop: 6 }}>
            <button
              onClick={() => setWeekOffset(0)}
              style={{
                background: THEME.accentSoft,
                border: `1px solid ${THEME.accent}`,
                borderRadius: 20,
                padding: "3px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: THEME.accentText,
                cursor: "pointer",
                fontFamily: THEME.mono,
              }}
            >
              This week
            </button>
          </div>
        )}
      </div>

      {/* Calendar grid — scroll container is the positioning context for the
          sticky day-header row (top) and sticky time gutter (left). */}
      <div
        style={{
          background: THEME.surface,
          borderRadius: 12,
          border: `1px solid ${THEME.border}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "calc(100vh - 220px)",
        }}
      >
        {/* Inner track sized to the full 7-column width so columns keep their
            min width and overflow horizontally instead of shrinking. */}
        <div style={{ minWidth: GUTTER_WIDTH + DAY_MIN_WIDTH * 7 }}>
          {/* Day header row — sticky on top */}
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${THEME.border}`,
              position: "sticky",
              top: 0,
              zIndex: 20,
            }}
          >
            {/* Corner cell: sticky top + left, must sit above other sticky cells */}
            <div
              style={{
                width: GUTTER_WIDTH,
                flexShrink: 0,
                borderRight: `1px solid ${THEME.border}`,
                background: THEME.surfaceAlt,
                position: "sticky",
                left: 0,
                zIndex: 30,
              }}
            />
            {weekDates.map((date, i) => {
              const isToday = toDateStr(date) === todayStr;
              return (
                <div
                  key={i}
                  style={{
                    minWidth: DAY_MIN_WIDTH,
                    flex: "1 0 auto",
                    flexShrink: 0,
                    textAlign: "center",
                    padding: "8px 2px",
                    borderRight: i < 6 ? `1px solid ${THEME.border}` : "none",
                    background: isToday ? THEME.accentTint : THEME.surfaceAlt,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: isToday ? THEME.accentText : THEME.textMuted,
                      fontFamily: THEME.mono,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i]}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: isToday ? "#fff" : THEME.text,
                      marginTop: 2,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isToday ? THEME.accent : "transparent",
                    }}
                  >
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All-day row */}
          {allDayHabits.length > 0 && (
            <div
              style={{
                display: "flex",
                borderBottom: `2px solid ${THEME.borderStrong}`,
                minHeight: 36,
              }}
            >
              <div
                style={{
                  width: GUTTER_WIDTH,
                  flexShrink: 0,
                  borderRight: `1px solid ${THEME.border}`,
                  background: THEME.surfaceAlt,
                  position: "sticky",
                  left: 0,
                  zIndex: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  color: THEME.textFaint,
                  fontFamily: THEME.mono,
                }}
              >
                ALL
              </div>
              {weekDates.map((date, dayIdx) => {
                const ourDay = getJsDayToOurDay(date.getDay());
                const dateStr = toDateStr(date);
                const dayHabits = allDayHabits.filter((h) =>
                  h.days.includes(ourDay)
                );
                const isToday = dateStr === todayStr;

                return (
                  <div
                    key={dayIdx}
                    style={{
                      minWidth: DAY_MIN_WIDTH,
                      flex: "1 0 auto",
                      flexShrink: 0,
                      borderRight:
                        dayIdx < 6 ? `1px solid ${THEME.border}` : "none",
                      padding: "3px 2px",
                      background: isToday ? THEME.accentTint : "transparent",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {dayHabits.map((habit) => {
                      const key = `${habit.id}-${dateStr}`;
                      const isDone = !!completions[key];
                      const cat = getCategory(habit.categoryId);
                      return (
                        <HabitChip
                          key={habit.id}
                          habit={habit}
                          isDone={isDone}
                          color={cat.color}
                          onClick={() => onHabitClick(habit)}
                          onToggle={(e) => {
                            e.stopPropagation();
                            toggleCompletion(habit.id, dateStr);
                          }}
                          vacationMode={vacationMode}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hour rows — only show hours that have at least one habit */}
          {activeHours.map((hour) => (
            <div
              key={hour}
              style={{
                display: "flex",
                borderBottom: `1px solid ${THEME.border}`,
                minHeight: 40,
              }}
            >
              <div
                style={{
                  width: GUTTER_WIDTH,
                  flexShrink: 0,
                  borderRight: `1px solid ${THEME.border}`,
                  background: THEME.surfaceAlt,
                  position: "sticky",
                  left: 0,
                  zIndex: 10,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  paddingTop: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  color: THEME.textFaint,
                  fontFamily: THEME.mono,
                }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
              {weekDates.map((date, dayIdx) => {
                const ourDay = getJsDayToOurDay(date.getDay());
                const dateStr = toDateStr(date);
                const cellHabits = habitsByHour[hour].filter((h) =>
                  h.days.includes(ourDay)
                );
                const isToday = dateStr === todayStr;

                return (
                  <div
                    key={dayIdx}
                    style={{
                      minWidth: DAY_MIN_WIDTH,
                      flex: "1 0 auto",
                      flexShrink: 0,
                      borderRight:
                        dayIdx < 6 ? `1px solid ${THEME.border}` : "none",
                      padding: "3px 2px",
                      background: isToday ? THEME.accentTint : "transparent",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {cellHabits.map((habit) => {
                      const key = `${habit.id}-${dateStr}`;
                      const isDone = !!completions[key];
                      const cat = getCategory(habit.categoryId);
                      return (
                        <HabitChip
                          key={habit.id}
                          habit={habit}
                          isDone={isDone}
                          color={cat.color}
                          showTime
                          onClick={() => onHabitClick(habit)}
                          onToggle={(e) => {
                            e.stopPropagation();
                            toggleCompletion(habit.id, dateStr);
                          }}
                          vacationMode={vacationMode}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Empty state */}
          {isEmpty && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: THEME.textFaint,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div
                style={{ fontSize: 14, fontWeight: 600, color: THEME.textMuted }}
              >
                No habits this week
              </div>
              <div style={{ fontSize: 12, color: THEME.textFaint, marginTop: 4 }}>
                Tap + to create one
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact habit chip for calendar cells */
function HabitChip({
  habit,
  isDone,
  color,
  showTime,
  onClick,
  onToggle,
  vacationMode,
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 4px",
        borderRadius: 8,
        background: isDone ? THEME.doneSoft : THEME.surfaceAlt,
        // 1px frame on top/right/bottom; coral when done, warm hairline otherwise.
        borderTop: `1px solid ${isDone ? THEME.accentSoft : THEME.border}`,
        borderRight: `1px solid ${isDone ? THEME.accentSoft : THEME.border}`,
        borderBottom: `1px solid ${isDone ? THEME.accentSoft : THEME.border}`,
        // Category color stays as the thin 3px left identity bar.
        borderLeft: `3px solid ${color}`,
        cursor: "pointer",
        opacity: vacationMode ? 0.4 : 1,
        pointerEvents: vacationMode ? "none" : "auto",
        fontSize: 10,
        lineHeight: 1.2,
        minHeight: 22,
      }}
    >
      {/* Mini checkbox — completion fills with coral */}
      <div
        onClick={onToggle}
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          flexShrink: 0,
          border: isDone
            ? `1.5px solid ${THEME.done}`
            : `1.5px solid ${THEME.borderStrong}`,
          background: isDone ? THEME.done : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        {isDone && (
          <span style={{ color: "#fff", fontSize: 8, fontWeight: 700 }}>
            ✓
          </span>
        )}
      </div>
      <span
        style={{
          fontWeight: 500,
          color: isDone ? THEME.textMuted : THEME.text,
          textDecoration: isDone ? "line-through" : "none",
          opacity: isDone ? 0.7 : 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: THEME.sans,
        }}
      >
        {habit.icon}{" "}
        <span style={{ fontSize: 9 }}>{habit.name}</span>
      </span>
    </div>
  );
}
