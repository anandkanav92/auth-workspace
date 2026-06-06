import { defineConfig } from 'vitest/config';

// Default (unit) suite. Integration tests live in *.integration.test.ts and
// are excluded here so `pnpm test` never needs the PocketBase binary or a
// network — run those via `pnpm test:integration`.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
  },
});
