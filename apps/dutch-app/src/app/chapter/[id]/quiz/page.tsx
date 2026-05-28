import { notFound } from "next/navigation";
import { getChapter, getAllChapterIds } from "@/data/chapters";
import { QuizGate } from "@/components/quiz/QuizGate";
import Link from "next/link";

export function generateStaticParams() {
  return getAllChapterIds().map((id) => ({ id: String(id) }));
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chapter = getChapter(Number(id));
  if (!chapter) notFound();

  if (chapter.exercises.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">
          No exercises available
        </h1>
        <p className="text-gray-500">
          This chapter does not have any quiz exercises yet.
        </p>
        <Link
          href={`/chapter/${chapter.id}`}
          className="inline-block bg-orange-500 text-white px-5 py-2 rounded-lg hover:bg-orange-600 text-sm font-medium"
        >
          Back to Chapter
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-orange-600 font-medium">
          Hoofdstuk {chapter.id} — Quiz
        </p>
        <h1 className="text-2xl font-bold text-gray-900">{chapter.title}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {chapter.exercises.length} questions
        </p>
      </div>

      <QuizGate
        exercises={chapter.exercises}
        chapterId={chapter.id}
        chapterTitle={chapter.title}
      />
    </div>
  );
}
