"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { chapters } from "@/data/chapters";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/flashcards", label: "Flashcards", icon: "🃏" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-800 text-white h-screen sticky top-0 p-4 flex flex-col shrink-0 overflow-y-auto">
      <h1 className="text-xl font-bold mb-6 px-2 text-orange-400">
        🇳🇱 Nederlands
      </h1>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
              pathname === item.href
                ? "bg-orange-600 text-white"
                : "text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <div className="mt-4 mb-2 px-3 text-xs text-slate-500 uppercase tracking-wider">
          Chapters
        </div>

        {chapters.map((ch) => (
          <Link
            key={ch.id}
            href={`/chapter/${ch.id}`}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
              pathname === `/chapter/${ch.id}`
                ? "bg-orange-600 text-white"
                : "text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span className="text-xs bg-slate-700 rounded px-1.5 py-0.5">
              {ch.id}
            </span>
            {ch.title}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
