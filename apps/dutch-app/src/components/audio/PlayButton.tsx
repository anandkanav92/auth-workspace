"use client";

import { useState } from "react";

interface PlayButtonProps {
  text: string;
  size?: "sm" | "md";
  className?: string;
}

export function PlayButton({
  text,
  size = "sm",
  className = "",
}: PlayButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (state === "playing") {
      const { stopSpeaking } = await import("@/lib/tts");
      stopSpeaking();
      setState("idle");
      return;
    }

    setState("loading");
    try {
      const { speak } = await import("@/lib/tts");
      setState("playing");
      await speak(text); // Resolves when speech finishes
      setState("idle");
    } catch (err) {
      console.error("[PlayButton] TTS error:", err);
      setState("idle");
    }
  };

  const sizeClasses =
    size === "sm" ? "w-7 h-7 text-sm" : "w-9 h-9 text-base";

  return (
    <button
      onClick={handleClick}
      className={`${sizeClasses} rounded-full flex items-center justify-center transition-colors shrink-0 ${
        state === "playing"
          ? "bg-orange-500 text-white"
          : state === "loading"
            ? "bg-gray-200 text-gray-400 animate-pulse"
            : "bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600"
      } ${className}`}
      title={`Play: ${text}`}
      disabled={state === "loading"}
    >
      {state === "playing" ? "■" : "▶"}
    </button>
  );
}
