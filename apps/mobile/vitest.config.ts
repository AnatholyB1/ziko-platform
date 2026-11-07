import { defineConfig } from 'vitest/config';

// Pure-logic tests only (native modules are mocked with vi.mock).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{spec,test}.ts'],
    passWithNoTests: true,
  },
});
