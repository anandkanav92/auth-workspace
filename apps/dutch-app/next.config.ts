import type { NextConfig } from "next";

// Document/Flight responses are emitted with `Cache-Control: s-maxage=31536000`
// and differ only by `Vary: rsc`. Any cache/prefetch path that ignores the RSC
// vary can serve the `text/x-component` Flight payload for a real page load,
// which Chrome can't render — it shows a blank page and downloads the payload
// as a file. Forcing no-store on the page routes (NOT static assets) makes the
// browser always fetch the correct variant per request.
const NO_STORE = {
  key: "Cache-Control",
  value: "no-store, must-revalidate",
};

const nextConfig: NextConfig = {
  transpilePackages: ["@myorg/auth-google"],
  output: "standalone",
  async headers() {
    return [
      { source: "/", headers: [NO_STORE] },
      { source: "/chapter/:id", headers: [NO_STORE] },
      { source: "/chapter/:id/quiz", headers: [NO_STORE] },
      { source: "/flashcards", headers: [NO_STORE] },
    ];
  },
};

export default nextConfig;
