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
  server: { port: 5173, host: true }, // matches design §9 CORS allowlist (reviewer fix I10)
});
