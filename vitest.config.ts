import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/exercise-import/**/*.test.ts', 'packages/plugin-sdk/src/**/*.test.ts', 'apps/mobile/src/lib/**/*.test.ts', 'plugins/hydration/src/**/*.test.ts', 'plugins/measurements/src/**/*.test.ts', 'plugins/timer/src/**/*.test.ts'],
    reporters: 'default',
  },
});
