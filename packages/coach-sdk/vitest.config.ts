// Mirrors backend/api/vitest.config.ts shape (verified on disk).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{spec,test}.ts'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    reporters: 'default',
  },
});
