import { defineConfig } from 'vitest/config';

// Vitest config for unit tests (mocked dependencies, no real Supabase required).
// Separate from vitest.config.ts which runs integration tests against a live DB.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // No setupFiles — unit tests do not need real Supabase credentials
    testTimeout: 10_000,
    reporters: 'default',
  },
});
