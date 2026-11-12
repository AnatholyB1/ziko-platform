import { defineConfig } from 'vitest/config';

// Logique pure uniquement (pricing, moments, reminders, catalog, data) : aucun import react-native.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
