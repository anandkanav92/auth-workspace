import { notFound } from "next/navigation";
import { getChapter, getAllChapterIds } from "@/data/chapters";
import { ChapterContent } from "@/components/chapter/ChapterContent";
import { QuizButton } from "@/components/chapter/QuizButton";

export function generateStaticParams() {
  return getAllChapterIds().map((id) => ({ id: String(id) }));
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chapter = getChapter(Number(id));
  if (!chapter) notFound();

  return (
    <div>
      {/* Chapter header — compact on mobile */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide">
            Hoofdstuk {chapter.id}
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
            {chapter.title}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{chapter.theme}</p>
        </div>
        <QuizButton chapterId={chapter.id} />
      </div>

      {/* Tabbed content */}
      <ChapterContent chapter={chapter} />
    </div>
  );
}
