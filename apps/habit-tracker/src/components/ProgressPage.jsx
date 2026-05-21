import SummaryCards from "./analytics/SummaryCards";
import WeeklyChart from "./analytics/WeeklyChart";
import CategoryBars from "./analytics/CategoryBars";
import HabitLeaderboard from "./analytics/HabitLeaderboard";
import Heatmap from "./analytics/Heatmap";

export default function ProgressPage({ analytics, onHabitTap, onBack }) {
  const {
    completionRate,
    currentStreak,
    bestDay,
    activeHabits,
    motivationalMessage,
    weeklyData,
    categoryStats,
    habitStats,
    heatmapData,
  } = analytics;

  return (
    <div style={{ padding: "0 16px 40px", maxWidth: 900, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ position: "relative", textAlign: "center", marginBottom: 20, paddingTop: 4 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              position: "absolute", left: 0, top: 4,
              background: "none", border: "none",
              fontSize: 18, color: "#999", cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ←
          </button>
        )}
        <h2 style={{
          fontSize: 18, fontWeight: 700, color: "#1a1a2e", margin: "0 0 2px",
        }}>
          Progress
        </h2>
        <p style={{
          fontSize: 11, color: "#aaa", margin: 0,
          fontFamily: "'Space Mono', monospace",
        }}>
          Last 30 days
        </p>
      </div>

      <SummaryCards
        completionRate={completionRate}
        currentStreak={currentStreak}
        bestDay={bestDay}
        activeHabits={activeHabits}
        motivationalMessage={motivationalMessage}
      />

      <WeeklyChart weeklyData={weeklyData} />

      <CategoryBars categoryStats={categoryStats} />

      <HabitLeaderboard habitStats={habitStats} onHabitTap={onHabitTap} />

      <Heatmap heatmapData={heatmapData} />
    </div>
  );
}
