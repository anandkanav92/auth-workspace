import { useState, useEffect, useRef } from "react";
import { useAuth, signOut } from "@myorg/auth-google";
import { useHabits } from "./hooks/useHabits";
import { unlockAudio, playAlarm } from "./components/Timer";
import FloatingTimerPill from "./components/FloatingTimerPill";
import HabitForm from "./components/HabitForm";
import HabitDetail from "./components/HabitDetail";
import StreakDots from "./components/StreakDots";
import LoginPage from "./components/LoginPage";
import { migrateIfNeeded } from "./data/migration";
import {
  getDateForOffset,
  getJsDayToOurDay,
  toDateStr,
  formatDateHeader,
  getLast5Occurrences,
} from "./data/constants";

export default function HabitTracker() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
        color: "#888",
      }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedApp user={user} />;
}

function AuthenticatedApp({ user }) {
  const {
    habits,
    categories,
    completions,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    addCategory,
    getCategory,
  } = useHabits(user.uid);

  const [dayOffset, setDayOffset] = useState(0);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);

  // Timer state — lifted here so both HabitDetail and FloatingTimerPill can access it
  const [timerState, setTimerState] = useState({
    totalSeconds: 60,
    remaining: 60,
    running: false,
    habitId: null,
    habitName: null,
  });

  function setTimerTime(seconds) {
    setTimerState(prev => ({ ...prev, totalSeconds: seconds, remaining: seconds, running: false }));
  }

  function startTimer(habitId, habitName) {
    unlockAudio(); // Must happen inside a user tap/click to work on mobile
    setTimerState(prev => ({
      ...prev,
      running: true,
      habitId: habitId || prev.habitId,
      habitName: habitName || prev.habitName,
      remaining: prev.remaining === 0 ? prev.totalSeconds : prev.remaining,
    }));
  }

  function pauseTimer() {
    setTimerState(prev => ({ ...prev, running: false }));
  }

  function resetTimer() {
    setTimerState(prev => ({ ...prev, running: false, remaining: prev.totalSeconds }));
  }

  // Countdown interval
  useEffect(() => {
    if (timerState.running && timerState.remaining > 0) {
      const id = setInterval(() => {
        setTimerState(prev => {
          if (prev.remaining <= 1) {
            playAlarm();
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
            return { ...prev, remaining: 0, running: false };
          }
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
      return () => clearInterval(id);
    }
  }, [timerState.running, timerState.remaining]);

  const migratedRef = useRef(false);

  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;
    migrateIfNeeded(habits, addHabit, user.uid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Computed values
  const viewDate = getDateForOffset(dayOffset);
  const dateStr = toDateStr(viewDate);
  const ourDay = getJsDayToOurDay(viewDate.getDay());
  const todaysHabits = habits.filter((h) => h.days.includes(ourDay));

  // Group habits by categoryId
  const groupedByCategory = {};
  todaysHabits.forEach((habit) => {
    if (!groupedByCategory[habit.categoryId]) {
      groupedByCategory[habit.categoryId] = [];
    }
    groupedByCategory[habit.categoryId].push(habit);
  });

  const totalHabits = todaysHabits.length;
  const doneCount = todaysHabits.filter(
    (h) => completions[`${h.id}-${dateStr}`]
  ).length;
  const pct = totalHabits > 0 ? Math.round((doneCount / totalHabits) * 100) : 0;

  return (
    <div
      style={{
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        background:
          "linear-gradient(145deg, #f5f5fa 0%, #ffffff 50%, #f0f0f8 100%)",
        color: "#1a1a2e",
        minHeight: "100vh",
        padding: "20px 16px 90px",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />

      {/* Floating timer pill — visible when timer runs and no detail sheet is open */}
      {timerState.running && !selectedHabit && (
        <FloatingTimerPill
          remaining={timerState.remaining}
          habitName={timerState.habitName}
          running={timerState.running}
          onPause={pauseTimer}
          onTap={() => {
            const habit = habits.find(h => h.id === timerState.habitId);
            if (habit) setSelectedHabit(habit);
          }}
        />
      )}

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* User bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 4px",
          marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt=""
                style={{ width: 28, height: 28, borderRadius: "50%" }}
                referrerPolicy="no-referrer"
              />
            )}
            <span style={{
              fontSize: 13, fontWeight: 500, color: "#666",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {user.displayName || user.email}
            </span>
          </div>
          <button
            onClick={() => signOut()}
            style={{
              background: "none", border: "1px solid #e0e0eb",
              borderRadius: 8, padding: "4px 12px",
              fontSize: 12, color: "#999", cursor: "pointer",
              fontFamily: "'Space Mono', monospace",
            }}
          >
            Sign out
          </button>
        </div>

        {/* Date Header */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            padding: "10px 16px",
            border: "1px solid #e0e0eb",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            marginBottom: 16,
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
              onClick={() => setDayOffset((o) => o - 1)}
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
              <div
                style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}
              >
                {formatDateHeader(viewDate)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#888",
                  fontFamily: "'Space Mono', monospace",
                  marginTop: 2,
                }}
              >
                {doneCount}/{totalHabits} done · {pct}%
              </div>
            </div>
            <button
              onClick={() => setDayOffset((o) => o + 1)}
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

          {dayOffset !== 0 && (
            <div style={{ textAlign: "center", marginTop: 6 }}>
              <button
                onClick={() => setDayOffset(0)}
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
                Today
              </button>
            </div>
          )}

          {/* Progress bar */}
          <div
            style={{
              height: 3,
              background: "#e5e5f0",
              borderRadius: 2,
              marginTop: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background:
                  "linear-gradient(90deg, #E8453C, #3B82F6, #10B981)",
                borderRadius: 2,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Habit List */}
        {totalHabits > 0 ? (
          Object.entries(groupedByCategory).map(
            ([categoryId, habitsInCategory]) => {
              const category = getCategory(categoryId);
              return (
                <div key={categoryId} style={{ marginBottom: 16 }}>
                  {/* Category header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 8,
                      paddingLeft: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: category.color,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: category.color,
                        fontFamily: "'Space Mono', monospace",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {category.name}
                    </span>
                  </div>

                  {/* Habits in this category */}
                  {habitsInCategory.map((habit) => {
                    const isChecked =
                      !!completions[`${habit.id}-${dateStr}`];
                    const occurrences = getLast5Occurrences(
                      habit,
                      completions,
                      viewDate
                    );

                    return (
                      <div
                        key={habit.id}
                        onClick={() => setSelectedHabit(habit)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: isChecked ? "#f0fdf8" : "#ffffff",
                          border: `1px solid ${isChecked ? "#a7f3d0" : "#e8e8f0"}`,
                          marginBottom: 6,
                          cursor: "pointer",
                        }}
                      >
                        {/* Checkbox */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompletion(habit.id, dateStr);
                          }}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 7,
                            flexShrink: 0,
                            border: isChecked
                              ? "2px solid #10B981"
                              : "2px solid #d0d0e0",
                            background: isChecked
                              ? "#10B981"
                              : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s ease",
                            cursor: "pointer",
                          }}
                        >
                          {isChecked && (
                            <span
                              style={{
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 700,
                              }}
                            >
                              ✓
                            </span>
                          )}
                        </div>

                        {/* Category color bar */}
                        <div
                          style={{
                            width: 4,
                            height: 28,
                            borderRadius: 2,
                            background: category.color,
                            flexShrink: 0,
                            opacity: 0.7,
                          }}
                        />

                        {/* Habit info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: isChecked ? "#10B981" : "#333",
                              textDecoration: isChecked
                                ? "line-through"
                                : "none",
                              opacity: isChecked ? 0.7 : 1,
                            }}
                          >
                            {habit.icon} {habit.name}
                          </div>
                        </div>

                        {/* Streak dots */}
                        <StreakDots
                          occurrences={occurrences}
                          size="small"
                        />

                        {/* Chevron */}
                        <span
                          style={{
                            color: "#ccc",
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          ›
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            }
          )
        ) : (
          /* Empty state */
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#aaa",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#888",
                marginBottom: 4,
              }}
            >
              No habits for today
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#bbb",
              }}
            >
              Tap + to create one
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowCreateForm(true)}
        style={{
          position: "fixed",
          bottom: 80,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #3B82F6, #2563EB)",
          color: "#fff",
          fontSize: 28,
          fontWeight: 300,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(59,130,246,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 900,
        }}
      >
        +
      </button>

      {/* HabitDetail sheet */}
      {selectedHabit && (
        <HabitDetail
          habit={selectedHabit}
          category={getCategory(selectedHabit.categoryId)}
          occurrences={getLast5Occurrences(
            selectedHabit,
            completions,
            viewDate
          )}
          onClose={() => setSelectedHabit(null)}
          onEdit={() => {
            setEditingHabit(selectedHabit);
            setSelectedHabit(null);
          }}
          onToggleOccurrence={(dateString) =>
            toggleCompletion(selectedHabit.id, dateString)
          }
          timerState={timerState}
          onSetTime={setTimerTime}
          onStartTimer={() => startTimer(selectedHabit.id, selectedHabit.name)}
          onPauseTimer={pauseTimer}
          onResetTimer={resetTimer}
        />
      )}

      {/* HabitForm sheet */}
      {(showCreateForm || editingHabit) && (
        <HabitForm
          habit={editingHabit || null}
          categories={categories}
          onSave={(data) => {
            if (editingHabit) {
              updateHabit(editingHabit.id, data);
              setEditingHabit(null);
            } else {
              addHabit(data);
              setShowCreateForm(false);
            }
          }}
          onDelete={() => {
            if (editingHabit) {
              deleteHabit(editingHabit.id);
              setEditingHabit(null);
            }
          }}
          onClose={() => {
            setShowCreateForm(false);
            setEditingHabit(null);
          }}
          onAddCategory={addCategory}
        />
      )}
    </div>
  );
}
