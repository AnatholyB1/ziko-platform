import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

// Vitest config for apps/web — resolves the `@/*` path alias used in src/.
// Mirrors tsconfig.json `compilerOptions.paths`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['{src,test}/**/*.{spec,test}.{ts,tsx}'],
    environmentMatchGlobs: [['**/*.test.tsx', 'happy-dom']],
    passWithNoTests: true,
  },
});
