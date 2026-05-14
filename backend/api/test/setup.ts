import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// SERVICE-ROLE ONLY IN TESTS — never imported from backend/api/src/**
// Loads .env.test (gitignored) which contains SUPABASE_SERVICE_ROLE_KEY
loadEnv({ path: resolve(__dirname, '../.env.test') });

const required = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];
for (const k of required) {
  if (!process.env[k]) {
    throw new Error(`[test/setup.ts] Missing required env var: ${k}. Copy .env.test.example to .env.test and fill values.`);
  }
}
