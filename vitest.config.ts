import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/exercise-import/**/*.test.ts', 'packages/plugin-sdk/src/**/*.test.ts', 'apps/mobile/src/lib/**/*.test.ts'],
    reporters: 'default',
  },
});
