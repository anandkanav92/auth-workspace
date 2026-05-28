import type { CultureNote } from "@/types/chapter";

export function CultureSection({ culture }: { culture: CultureNote }) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3 text-slate-900">Cultuur</h2>
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 lg:p-6">
        <h3 className="font-semibold text-orange-800 mb-2">{culture.topic}</h3>
        <p className="text-orange-700 text-sm leading-relaxed select-text">
          {culture.content}
        </p>
      </div>
    </section>
  );
}
