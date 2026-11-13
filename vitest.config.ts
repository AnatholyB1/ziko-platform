import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/exercise-import/**/*.test.ts', 'scripts/uat/**/*.test.ts','packages/plugin-sdk/src/**/*.test.ts', 'apps/mobile/src/lib/**/*.test.ts', 'plugins/hydration/src/**/*.test.ts', 'plugins/measurements/src/**/*.test.ts', 'plugins/timer/src/**/*.test.ts', 'plugins/sleep/src/**/*.test.ts', 'plugins/journal/src/**/*.test.ts', 'plugins/coach/src/**/*.test.ts', 'plugins/community/src/**/*.test.ts', 'plugins/stretching/src/**/*.test.ts', 'plugins/ai-programs/src/**/*.test.ts', 'plugins/gamification/src/**/*.test.ts'],
    reporters: 'default',
  },
});
