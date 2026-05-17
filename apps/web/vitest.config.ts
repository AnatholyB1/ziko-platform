import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Vitest config for apps/web — resolves the `@/*` path alias used in src/.
// Mirrors tsconfig.json `compilerOptions.paths`.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['{src,test}/**/*.{spec,test}.ts'],
    passWithNoTests: true,
  },
});
