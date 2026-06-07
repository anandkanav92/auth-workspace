import { defineConfig } from 'vitest/config';

// Integration tests only. These spawn a real PocketBase binary (see
// tests/pb-test-server.ts) and are kept separate from the fast unit suite
// (`pnpm test`) so unit runs never need a binary or network.
//
// Single-fork + no isolation: the spawned PocketBase is a shared resource for
// the whole run, so all integration test files share one globalSetup instance.
export default defineConfig({
  test: {
    include: ['tests/**/*.integration.test.ts'],
    globalSetup: ['tests/pb-test-server.ts'],
    pool: 'forks',
    // Vitest 4: pool options are top-level. Single fork so the spawned
    // PocketBase is shared across the whole integration run.
    isolate: false,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
