"use client";

import dynamic from "next/dynamic";

const TTSProvider = dynamic(
  () => import("./TTSProvider").then((m) => m.TTSProvider),
  { ssr: false }
);

export function TTSWrapper({ children }: { children: React.ReactNode }) {
  return <TTSProvider>{children}</TTSProvider>;
}
