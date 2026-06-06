import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Dedupe React across the pnpm workspace so firebase / @myorg/auth-google
    // peer deps don't pull in a second React copy (breaks hooks/context).
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5173, host: true }, // matches design §9 CORS allowlist (reviewer fix I10)
});
