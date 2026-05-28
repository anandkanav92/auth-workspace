"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, signInWithGoogle } from "@myorg/auth-google";

const tabs = [
  { href: "/", label: "Home", icon: "📊" },
  { href: "/chapter/1", label: "Learn", icon: "📖", matchPrefix: "/chapter" },
  { href: "/flashcards", label: "Cards", icon: "🃏" },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

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

      {/* User/Login tab */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center py-2 pt-2.5 text-xs text-slate-400">
          <span className="text-lg leading-none mb-0.5">...</span>
        </div>
      ) : user ? (
        <Link
          href="/flashcards"
          className="flex-1 flex flex-col items-center py-2 pt-2.5 text-xs text-slate-400"
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName ?? "User"}
              className="w-6 h-6 rounded-full mb-0.5"
            />
          ) : (
            <span className="text-lg leading-none mb-0.5">👤</span>
          )}
          <span className="truncate max-w-[60px]">
            {user.displayName?.split(" ")[0] ?? "Me"}
          </span>
        </Link>
      ) : (
        <button
          onClick={() => signInWithGoogle()}
          className="flex-1 flex flex-col items-center py-2 pt-2.5 text-xs text-slate-400 transition-colors"
        >
          <span className="text-lg leading-none mb-0.5">👤</span>
          Login
        </button>
      )}
    </nav>
  );
}
