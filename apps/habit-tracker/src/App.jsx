import { useState, useEffect, useRef } from "react";
import { useAuth, signOut } from "@myorg/auth-google";
import { useHabits } from "./hooks/useHabits";
import { useAnalytics } from "./hooks/useAnalytics";
import { unlockAudio, playAlarm } from "./components/Timer";
import FloatingTimerPill from "./components/FloatingTimerPill";
import HabitForm from "./components/HabitForm";
import HabitDetail from "./components/HabitDetail";
import StreakDots from "./components/StreakDots";
import LoginPage from "./components/LoginPage";
import CompletionNotes from "./components/CompletionNotes";
import ProgressPage from "./components/ProgressPage";
import WeeklyView from "./components/WeeklyView";
import StreaksGuide from "./components/StreaksGuide";
import {
  getDateForOffset,
  getJsDayToOurDay,
  toDateStr,
  formatDateHeader,
  formatTime,
  getLast5Occurrences,
  THEME,
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
        fontFamily: THEME.sans,
        color: THEME.textMuted,
        background: THEME.bg,
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
    loading: dataLoading,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    updateCompletion,
    addCategory,
    getCategory,
    vacationMode,
    vacationStart,
    toggleVacation,
  } = useHabits(user.uid);

  const analytics = useAnalytics(habits, completions, categories, vacationMode, vacationStart);

  const [dayOffset, setDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [completionNotesHabit, setCompletionNotesHabit] = useState(null);
  const [completionNotesDateStr, setCompletionNotesDateStr] = useState(null);
  const [showVacationConfirm, setShowVacationConfirm] = useState(false);

  // Bottom-nav pages: 0 = Activities, 1 = Progress
  const [pageIndex, setPageIndex] = useState(0);
  // Sub-view inside Activities, toggled by the top segmented control
  const [activityView, setActivityView] = useState("week"); // "week" | "today"
  const touchRef = useRef({ startX: 0, startY: 0, swiping: false });

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

  // Swipe handlers for page navigation
  function handleTouchStart(e) {
    const t = e.touches[0];
    touchRef.current = { startX: t.clientX, startY: t.clientY, swiping: false };
  }

  function handleTouchMove(e) {
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.startX;
    const dy = t.clientY - touchRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      touchRef.current.swiping = true;
    }
  }

  function handleTouchEnd(e) {
    if (!touchRef.current.swiping) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    if (dx < -60 && pageIndex < 2) setPageIndex(p => p + 1);
    if (dx > 60 && pageIndex > 0) setPageIndex(p => p - 1);
    touchRef.current.swiping = false;
  }

  function handleLeaderboardTap(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (habit) {
      setSelectedHabit(habit);
      setActivityView("today"); // Habit detail is most contextual in the daily list
      setPageIndex(0); // Activities page
    }
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

  // Seed default activities for brand-new users (runs after PocketBase data loads)
  const seededRef = useRef(false);
  useEffect(() => {
    if (dataLoading || seededRef.current) return;
    seededRef.current = true;
    if (habits.length === 0) {
      import("./data/migration").then(({ migrateIfNeeded }) => {
        migrateIfNeeded(habits, addHabit, user.uid);
      });
    }
  }, [dataLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (dataLoading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", fontFamily: THEME.sans, color: THEME.textMuted,
        background: THEME.bg,
      }}>
        Loading...
      </div>
    );
  }

  // Computed values
  const viewDate = getDateForOffset(dayOffset);
  const dateStr = toDateStr(viewDate);
  const ourDay = getJsDayToOurDay(viewDate.getDay());
  const todaysHabits = habits
    .filter((h) => h.days.includes(ourDay))
    .sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return -1;
      if (!b.time) return 1;
      return a.time.localeCompare(b.time);
    });

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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        fontFamily: THEME.sans,
        background: THEME.bgGradient,
        color: THEME.text,
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />

      {/* Floating timer pill — visible on both pages when timer runs and no detail sheet is open */}
      {timerState.running && !selectedHabit && (
        <FloatingTimerPill
          remaining={timerState.remaining}
          habitName={timerState.habitName}
          running={timerState.running}
          onPause={pauseTimer}
          onTap={() => {
            const habit = habits.find(h => h.id === timerState.habitId);
            if (habit) { setSelectedHabit(habit); setPageIndex(0); }
          }}
        />
      )}

      {/* Horizontal swipe container */}
      <div style={{
        display: "flex",
        width: "300%",
        transform: `translateX(-${pageIndex * (100 / 3)}%)`,
        transition: "transform 0.3s ease",
        minHeight: "100vh",
      }}>
        {/* Page 0: Activities (Week / Today toggle) */}
        <div style={{ width: `${100 / 3}%`, minHeight: "100vh", padding: "20px 16px 90px", overflowY: "auto" }}>
          <div style={{ maxWidth: 1040, margin: "0 auto" }}>
            {/* User bar (shared) */}
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
                  fontSize: 13, fontWeight: 500, color: THEME.textMuted,
                  fontFamily: THEME.sans,
                }}>
                  {user.displayName || user.email}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => {
                    if (vacationMode) {
                      toggleVacation(); // Resume immediately, no confirmation needed
                    } else {
                      setShowVacationConfirm(true);
                    }
                  }}
                  style={{
                    background: vacationMode ? "#fef3c7" : "none",
                    border: `1px solid ${vacationMode ? "#f59e0b" : THEME.border}`,
                    borderRadius: 8, padding: "4px 10px",
                    fontSize: 12, color: vacationMode ? "#d97706" : THEME.textMuted,
                    cursor: "pointer", fontFamily: THEME.mono,
                  }}
                >
                  {vacationMode ? "🏖️ On" : "🏖️"}
                </button>
                <button
                  onClick={() => signOut()}
                  style={{
                    background: "none", border: `1px solid ${THEME.border}`,
                    borderRadius: 8, padding: "4px 12px",
                    fontSize: 12, color: THEME.textMuted, cursor: "pointer",
                    fontFamily: THEME.mono,
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>

            {/* Vacation banner */}
            {vacationMode && (
              <div style={{
                background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                border: "1px solid #f59e0b40",
                borderRadius: 12, padding: "12px 16px",
                marginBottom: 12, textAlign: "center",
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>🏖️</div>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: "#92400e",
                }}>
                  Vacation mode — habits paused
                </div>
                <div style={{
                  fontSize: 11, color: "#a16207",
                  fontFamily: "'Space Mono', monospace", marginTop: 2,
                }}>
                  Streaks are preserved · since {vacationStart || "today"}
                </div>
                <button
                  onClick={() => toggleVacation()}
                  style={{
                    marginTop: 8, padding: "6px 20px", borderRadius: 8,
                    border: "none", background: "#92400e", color: "#fff",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Resume habits
                </button>
              </div>
            )}

            {/* Week / Today segmented toggle */}
            <div style={{
              display: "flex",
              gap: 4,
              padding: 4,
              background: THEME.surfaceAlt,
              border: `1px solid ${THEME.border}`,
              borderRadius: 12,
              marginBottom: 14,
            }}>
              {[
                { id: "week", label: "Week" },
                { id: "today", label: "Today" },
              ].map((v) => {
                const active = activityView === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setActivityView(v.id)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 9,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: THEME.sans,
                      color: active ? "#fff" : THEME.textMuted,
                      background: active ? THEME.accent : "transparent",
                      boxShadow: active ? "0 1px 4px rgba(251,113,133,0.35)" : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>

            {/* Weekly calendar */}
            {activityView === "week" && (
              <WeeklyView
                weekOffset={weekOffset}
                setWeekOffset={setWeekOffset}
                habits={habits}
                completions={completions}
                toggleCompletion={toggleCompletion}
                getCategory={getCategory}
                onHabitClick={(habit) => setSelectedHabit(habit)}
                vacationMode={vacationMode}
              />
            )}

            {/* Daily view */}
            {activityView === "today" && (
            <>
            {/* Date Header */}
            <div
              style={{
                background: THEME.surface,
                borderRadius: 12,
                padding: "10px 16px",
                border: `1px solid ${THEME.border}`,
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
                    color: THEME.textMuted,
                    fontSize: 18,
                    cursor: "pointer",
                    padding: "4px 8px",
                  }}
                >
                  ←
                </button>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{ fontSize: 14, fontWeight: 600, color: THEME.text }}
                  >
                    {formatDateHeader(viewDate)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: THEME.textMuted,
                      fontFamily: THEME.mono,
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
                    color: THEME.textMuted,
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
                    Today
                  </button>
                </div>
              )}

              {/* Progress bar */}
              <div
                style={{
                  height: 4,
                  background: THEME.surfaceAlt,
                  borderRadius: 2,
                  marginTop: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${THEME.accent}, ${THEME.accentHover})`,
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
                              background: isChecked ? THEME.doneSoft : THEME.surface,
                              border: `1px solid ${isChecked ? THEME.accentSoft : THEME.border}`,
                              marginBottom: 6,
                              cursor: "pointer",
                              opacity: vacationMode ? 0.4 : 1,
                              pointerEvents: vacationMode ? "none" : "auto",
                            }}
                          >
                            {/* Checkbox */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const key = `${habit.id}-${dateStr}`;
                                const isDone = !!completions[key];
                                toggleCompletion(habit.id, dateStr);
                                // Show notes sheet only when completing (not uncompleting)
                                if (!isDone) {
                                  setCompletionNotesHabit(habit);
                                  setCompletionNotesDateStr(dateStr);
                                }
                              }}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 7,
                                flexShrink: 0,
                                border: isChecked
                                  ? `2px solid ${THEME.done}`
                                  : `2px solid ${THEME.borderStrong}`,
                                background: isChecked
                                  ? THEME.done
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
                                  color: isChecked ? THEME.accentText : THEME.text,
                                  textDecoration: isChecked
                                    ? "line-through"
                                    : "none",
                                  opacity: isChecked ? 0.7 : 1,
                                }}
                              >
                                {habit.icon} {habit.name}
                              </div>
                              {habit.time && (
                                <div style={{
                                  fontSize: 11,
                                  color: THEME.textMuted,
                                  fontFamily: THEME.mono,
                                  marginTop: 1,
                                }}>
                                  {formatTime(habit.time)}
                                </div>
                              )}
                            </div>

                            {/* Streak dots */}
                            <StreakDots
                              occurrences={occurrences}
                              size="small"
                            />

                            {/* Chevron */}
                            <span
                              style={{
                                color: THEME.textFaint,
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
                  color: THEME.textFaint,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: THEME.textMuted,
                    marginBottom: 4,
                  }}
                >
                  No habits for today
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: THEME.textFaint,
                  }}
                >
                  Tap + to create one
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </div>

        {/* Page 1: Progress */}
        <div style={{ width: `${100 / 3}%`, minHeight: "100vh", padding: "20px 0 90px", overflowY: "auto" }}>
          <ProgressPage analytics={analytics} onHabitTap={handleLeaderboardTap} onBack={() => setPageIndex(0)} />
        </div>

        {/* Page 2: Streaks guide */}
        <div style={{ width: `${100 / 3}%`, minHeight: "100vh", padding: "20px 0 90px", overflowY: "auto" }}>
          <StreaksGuide />
        </div>
      </div>

      {/* FAB — visible on the Activities page only */}
      {pageIndex === 0 && (
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
            background: THEME.accentGradient,
            color: "#fff",
            fontSize: 28,
            fontWeight: 300,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(251,113,133,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 900,
          }}
        >
          +
        </button>
      )}

      {/* Bottom tab bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "flex", justifyContent: "center",
        background: "#fffbf6ee", backdropFilter: "blur(8px)",
        borderTop: `1px solid ${THEME.border}`,
        zIndex: 800,
        padding: "8px 0 env(safe-area-inset-bottom, 8px)",
      }}>
        {[
          { idx: 0, label: "Activities", icon: "🗓️" },
          { idx: 1, label: "Progress", icon: "📊" },
          { idx: 2, label: "Streaks", icon: "ℹ️" },
        ].map(tab => (
          <button
            key={tab.idx}
            onClick={() => setPageIndex(tab.idx)}
            style={{
              flex: 1, maxWidth: 160,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: "none", border: "none", cursor: "pointer",
              padding: "6px 0",
              opacity: pageIndex === tab.idx ? 1 : 0.5,
            }}
          >
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: pageIndex === tab.idx ? THEME.accentText : THEME.textMuted,
              fontFamily: THEME.mono,
              letterSpacing: "0.3px",
            }}>
              {tab.label}
            </span>
            {pageIndex === tab.idx && (
              <div style={{
                width: 4, height: 4, borderRadius: "50%",
                background: THEME.accent, marginTop: 1,
              }} />
            )}
          </button>
        ))}
      </div>

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

      {/* Completion notes sheet */}
      {completionNotesHabit && (
        <CompletionNotes
          habit={completionNotesHabit}
          onSave={({ effort, notes }) => {
            updateCompletion(completionNotesHabit.id, completionNotesDateStr, { effort, notes });
            setCompletionNotesHabit(null);
            setCompletionNotesDateStr(null);
          }}
          onSkip={() => {
            setCompletionNotesHabit(null);
            setCompletionNotesDateStr(null);
          }}
        />
      )}

      {/* Vacation confirmation */}
      {showVacationConfirm && (
        <div
          onClick={() => setShowVacationConfirm(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: THEME.surface, borderRadius: 16, padding: "24px 20px",
              maxWidth: 320, width: "90%", textAlign: "center",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏖️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: THEME.text }}>
              Enable vacation mode?
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: THEME.textMuted, lineHeight: 1.5 }}>
              All habits will be paused. Your streaks will be preserved until you resume.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowVacationConfirm(false)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  border: `1px solid ${THEME.border}`, background: THEME.surfaceAlt,
                  fontSize: 13, fontWeight: 600, color: THEME.textMuted, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toggleVacation();
                  setShowVacationConfirm(false);
                }}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  border: "none", background: "#f59e0b",
                  fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
                }}
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
