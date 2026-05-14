import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{spec,test}.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // RLS suite mutates auth.users — running concurrently would race
    // on email collisions and `cleanupTestUsers`. Serialize.
    fileParallelism: false,
    sequence: { concurrent: false },
    reporters: 'default',
  },
});
