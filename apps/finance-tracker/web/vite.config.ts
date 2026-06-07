import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Dedupe React across the pnpm workspace so firebase / @myorg/auth-google
    // peer deps don't pull in a second React copy (breaks hooks/context).
    dedupe: ['react', 'react-dom'],
    alias: {
      // shadcn/ui generated components import from "@/..." — map it to src.
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true, // matches design §9 CORS allowlist (reviewer fix I10)
    // M10.5: forward API calls to the local BFF so the SPA can use same-origin
    // relative `/api/*` paths in dev exactly as it does in prod (where the BFF
    // serves the SPA). Avoids CORS and keeps api.ts environment-agnostic.
    proxy: {
      "/api": {
        target: "http://localhost:3110",
        changeOrigin: true,
      },
    },
  },
});
