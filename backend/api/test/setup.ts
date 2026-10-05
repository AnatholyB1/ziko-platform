import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// SERVICE-ROLE ONLY IN TESTS — never imported from backend/api/src/**
// Loads .env.test (gitignored) which contains SUPABASE_SERVICE_ROLE_KEY
loadEnv({ path: resolve(__dirname, '../.env.test') });

// Remote-DB specs are excluded by vitest.config.ts when these are absent
// (e.g. CI without Supabase secrets), so a missing var is not an error here.
const required = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length && missing.length < required.length) {
  throw new Error(`[test/setup.ts] Partial Supabase test env, missing: ${missing.join(', ')}. Copy .env.test.example to .env.test and fill values.`);
}
