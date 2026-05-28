import type { Pronunciation } from "@/types/chapter";
import { PlayButton } from "@/components/audio/PlayButton";

export function PronunciationSection({
  pronunciation,
}: {
  pronunciation: Pronunciation;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3 text-slate-900">Uitspraak</h2>
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
        <p className="font-medium text-orange-600 mb-3 text-sm">
          Focus: {pronunciation.focus}
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 text-sm mb-4">
          {pronunciation.tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
        {pronunciation.practiceWords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pronunciation.practiceWords.map((pw, i) => (
              <span
                key={i}
                className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 border border-orange-100"
              >
                <PlayButton text={pw.word} size="sm" />
                {pw.word}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
