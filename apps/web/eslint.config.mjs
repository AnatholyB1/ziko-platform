import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // Inherit existing Next.js rules from the migrated config
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // ─── D-11: Ban @supabase/supabase-js in Server Components / app code ────
  {
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@supabase/supabase-js',
            message: 'Use @supabase/ssr factories from src/lib/supabase/. See ARCH-05.',
          },
          {
            name: '@supabase/auth-helpers-nextjs',
            message: 'Deprecated. Use @supabase/ssr instead. See ARCH-05.',
          },
        ],
        // D-12: Cross-module imports — patterns activate when Phase 24 creates the folders.
        // ESLint ignores patterns that match no files; safe to ship now.
        patterns: [
          {
            group: ['**/coach/*/db/**'],
            message: 'Cross-module DB imports forbidden. Use the module\'s service.ts. See ARCH-02.',
          },
          {
            group: ['**/coach/*/internal/**'],
            message: 'Cross-module internal imports forbidden. Use the module\'s service.ts. See ARCH-02.',
          },
        ],
      }],
    },
  },

  // ─── D-11 Allowlist: Legacy admin client + tests ──────────────────────
  {
    files: [
      'src/lib/supabase/admin.ts',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
    ],
    rules: {
      // Disable the supabase-js ban in these files
      'no-restricted-imports': 'off',
    },
  },

  // ─── D-12 service.ts allowlist (Phase 24+ — pattern matches no files in Phase 23) ──
  {
    files: ['**/coach/*/service.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // ─── CJS scripts: allow require() in Node.js utility scripts ──────────
  {
    files: ['scripts/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
