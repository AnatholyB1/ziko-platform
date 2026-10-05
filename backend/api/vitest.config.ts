import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// Remote-DB specs need a real Supabase project. They run only when the
// credentials are configured (local .env.test, or the test-rls workflow with
// the SUPABASE_TEST_* secrets). The root CI test step no longer receives any
// Supabase secrets (Phase 7 D-12b: scratch deleted), so these specs are
// excluded there instead of failing.
loadEnv({ path: resolve(__dirname, '.env.test') });
const RUN_REMOTE_DB = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const REMOTE_DB_SPECS = [
  'test/rls/**',
  'test/coach/clients-compare.spec.ts',
  'test/coach/clients-notes.spec.ts',
  'test/coach/clients-preview.spec.ts',
  'test/coach/clients-redeem.spec.ts',
  'test/coach/clients-revoke-coach.spec.ts',
  'test/coach/clients-revoke.spec.ts',
  'test/coach/clients-roster.spec.ts',
  'test/coach/clients-summary.spec.ts',
  'test/coach/clients-tabs.spec.ts',
  'test/coach/clients-tags.spec.ts',
  'test/coach/identity.spec.ts',
  'test/coach/invitations.spec.ts',
  'test/coach/timing.spec.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{spec,test}.ts', 'src/**/*.test.ts'],
    exclude: ['**/node_modules/**', ...(RUN_REMOTE_DB ? [] : REMOTE_DB_SPECS)],
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
