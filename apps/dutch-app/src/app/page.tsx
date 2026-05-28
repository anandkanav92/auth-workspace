import { StatsBar } from "@/components/dashboard/StatsBar";
import { ChapterGrid } from "@/components/dashboard/ChapterGrid";
import { StudySchedule } from "@/components/dashboard/StudySchedule";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welkom terug! 🇳🇱</h1>
        <p className="text-gray-500 mt-1">Your Dutch A2 learning dashboard</p>
      </div>

      <StatsBar />

      <div>
        <h2 className="text-xl font-semibold mb-4">Chapters</h2>
        <ChapterGrid />
      </div>

      <StudySchedule />
    </div>
  );
}
