import { useState } from "react";
import {
  getWeekDates,
  getHourFromTime,
  getHourLabels,
  getJsDayToOurDay,
  toDateStr,
} from "../data/constants";

const HOURS = getHourLabels(6, 22);

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
  const allDayHabits = habits.filter((h) => !h.time);
  const timedHabits = habits.filter((h) => h.time);

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

  const colWidth = "calc((100% - 48px) / 7)";

  return (
    <div>
      {/* Week navigation */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 12,
          padding: "10px 16px",
          border: "1px solid #e0e0eb",
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
              color: "#999",
              fontSize: 18,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ←
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>
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
              color: "#999",
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
                background: "#3B82F610",
                border: "1px solid #3B82F640",
                borderRadius: 20,
                padding: "3px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: "#3B82F6",
                cursor: "pointer",
                fontFamily: "'Space Mono', monospace",
              }}
            >
              This week
            </button>
          </div>
        )}
      </div>

      {/* Calendar grid */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 12,
          border: "1px solid #e0e0eb",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Day header row */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e8e8f0",
            position: "sticky",
            top: 0,
            background: "#fafafe",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 48,
              flexShrink: 0,
              borderRight: "1px solid #e8e8f0",
            }}
          />
          {weekDates.map((date, i) => {
            const isToday = toDateStr(date) === todayStr;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "8px 2px",
                  borderRight: i < 6 ? "1px solid #f0f0f5" : "none",
                  background: isToday ? "#3B82F608" : "transparent",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: isToday ? "#3B82F6" : "#999",
                    fontFamily: "'Space Mono', monospace",
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
                    color: isToday ? "#fff" : "#1a1a2e",
                    marginTop: 2,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isToday ? "#3B82F6" : "transparent",
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
              borderBottom: "2px solid #e0e0eb",
              minHeight: 36,
            }}
          >
            <div
              style={{
                width: 48,
                flexShrink: 0,
                borderRight: "1px solid #e8e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                color: "#bbb",
                fontFamily: "'Space Mono', monospace",
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
                    flex: 1,
                    borderRight: dayIdx < 6 ? "1px solid #f0f0f5" : "none",
                    padding: "3px 2px",
                    background: isToday ? "#3B82F604" : "transparent",
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
              borderBottom: "1px solid #f0f0f5",
              minHeight: 40,
            }}
          >
            <div
              style={{
                width: 48,
                flexShrink: 0,
                borderRight: "1px solid #e8e8f0",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                paddingTop: 4,
                fontSize: 10,
                fontWeight: 600,
                color: "#bbb",
                fontFamily: "'Space Mono', monospace",
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
                    flex: 1,
                    borderRight: dayIdx < 6 ? "1px solid #f0f0f5" : "none",
                    padding: "3px 2px",
                    background: isToday ? "#3B82F604" : "transparent",
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
        {allDayHabits.length === 0 && activeHours.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "#bbb",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
            <div
              style={{ fontSize: 14, fontWeight: 600, color: "#999" }}
            >
              No habits this week
            </div>
            <div style={{ fontSize: 12, color: "#ccc", marginTop: 4 }}>
              Tap + to create one
            </div>
          </div>
        )}
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
        borderRadius: 6,
        background: isDone ? `${color}15` : "#f8f8fc",
        border: `1px solid ${isDone ? `${color}40` : "#e8e8f0"}`,
        cursor: "pointer",
        opacity: vacationMode ? 0.4 : 1,
        pointerEvents: vacationMode ? "none" : "auto",
        fontSize: 10,
        lineHeight: 1.2,
        minHeight: 22,
      }}
    >
      {/* Mini checkbox */}
      <div
        onClick={onToggle}
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          flexShrink: 0,
          border: isDone ? `1.5px solid ${color}` : "1.5px solid #d0d0e0",
          background: isDone ? color : "transparent",
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
          color: isDone ? color : "#555",
          textDecoration: isDone ? "line-through" : "none",
          opacity: isDone ? 0.7 : 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {habit.icon}{" "}
        <span style={{ fontSize: 9 }}>{habit.name}</span>
      </span>
    </div>
  );
}
