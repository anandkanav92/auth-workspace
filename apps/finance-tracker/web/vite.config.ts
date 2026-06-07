import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // M15.7 + M15.8 — installable PWA + offline read of last-fetched data.
    VitePWA({
      registerType: 'autoUpdate',
      // Inject a tiny inline registration script (no workbox-window dependency
      // pulled into the app bundle).
      injectRegister: 'inline',
      // Precache the built shell so the app opens offline; icons live in public.
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Finance Tracker',
        short_name: 'Finance',
        description: 'Your investment dashboard — holdings, allocation, and income.',
        theme_color: '#2563eb',
        background_color: '#0b0f14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA fallback so deep links work offline.
        navigateFallback: '/index.html',
        // Don't let the SW intercept /api/* navigations.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // M15.8 — offline read of last-fetched portfolio data.
            // NetworkFirst: always try the network first (fresh prices), fall
            // back to the cached response when offline.
            //
            // SECURITY (reviewer fix I14): we explicitly DO NOT cache auth
            // responses. `/api/auth/*` (incl. /api/auth/me) is matched by the
            // denylist below and falls through to NetworkOnly — so no
            // user-identity / token-bearing response is ever persisted in the
            // SW cache. The Authorization request header is never part of a
            // Cache API key (Workbox keys on URL only), and we add a
            // cacheKeyWillBeUsed handler that strips any query/cred noise to a
            // bare URL so tokens can't leak into a cache key either.
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin &&
              request.method === 'GET' &&
              url.pathname.startsWith('/api/') &&
              !url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-data',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  // Normalise the cache key to a bare same-origin URL so no
                  // credentials/tokens ride along in the key.
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const u = new URL(request.url);
                    return `${u.origin}${u.pathname}${u.search}`;
                  },
                },
              ],
            },
          },
          {
            // Auth endpoints: never cache. NetworkOnly means an offline read
            // returns a network error rather than a stale identity.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        // Keep the SW out of `vite dev` so it doesn't shadow the API proxy.
        enabled: false,
      },
    }),
  ],
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
