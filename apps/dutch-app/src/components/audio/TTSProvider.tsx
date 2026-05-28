"use client";

import { useEffect, useState } from "react";

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    // Pre-load voices so the first play click is fast
    import("@/lib/tts")
      .then(({ initTTS }) => initTTS())
      .catch(() => setError(true));
  }, []);

  return (
    <>
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 shadow-lg rounded-xl px-4 py-3 z-50">
          <span className="text-sm text-red-600">
            Speech not available in this browser. Try Chrome or Edge.
          </span>
        </div>
      )}
      {children}
    </>
  );
}
