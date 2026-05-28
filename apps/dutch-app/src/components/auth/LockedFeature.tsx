"use client";

import { signInWithGoogle } from "@myorg/auth-google";

interface LockedFeatureProps {
  feature: string;
}

export function LockedFeature({ feature }: LockedFeatureProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">
        {feature} requires sign-in
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Sign in with Google to unlock {feature.toLowerCase()} and sync your
        progress across devices.
      </p>
      <button
        onClick={() => signInWithGoogle()}
        className="inline-flex items-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
      >
        Sign in to unlock
      </button>
    </div>
  );
}
