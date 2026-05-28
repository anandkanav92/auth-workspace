"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "📊" },
  { href: "/chapter/1", label: "Learn", icon: "📖", matchPrefix: "/chapter" },
  { href: "/flashcards", label: "Cards", icon: "🃏" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex safe-bottom z-50">
      {tabs.map((tab) => {
        const isActive = tab.matchPrefix
          ? pathname.startsWith(tab.matchPrefix)
          : pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center py-2 pt-2.5 text-xs transition-colors ${
              isActive
                ? "text-orange-600 font-semibold"
                : "text-slate-400"
            }`}
          >
            <span className="text-lg leading-none mb-0.5">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
