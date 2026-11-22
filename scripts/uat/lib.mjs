// Shared helpers for UAT scripts. Never prints secrets.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROD_REF = 'ubxllsvanurkwkohzxau';
export const BRANCH_REF = 'oloobswzsziidjwycthm';

// Candidate env files, first existing wins (all gitignored).
const ENV_FILES = [
  resolve(ROOT, '.uat/env'),
  resolve(ROOT, 'scripts/uat/.env.uat'),
  'C:/ziko-platform/.uat/env',
];

export function loadEnv() {
  const out = {};
  for (const f of ENV_FILES) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    break;
  }
  return { ...out, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('UAT_'))) };
}

/** Returns {url, key, anon}. Exits 2 if target is not the throwaway branch. */
export function resolveTarget(env, { requireKey = true } = {}) {
  const url = env.UAT_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.UAT_SERVICE_ROLE_KEY;
  const expectedRef = env.UAT_EXPECTED_REF || BRANCH_REF;
  const fail = (m) => { console.error('[uat] REFUSED: ' + m); process.exit(2); };
  if (!url) fail('UAT_SUPABASE_URL missing (put it in .uat/env or scripts/uat/.env.uat)');
  if (url.includes(PROD_REF)) fail('URL points at PRODUCTION project');
  if (!url.includes(expectedRef)) fail(`URL does not contain expected branch ref (${expectedRef})`);
  if (requireKey && !key) fail('UAT_SERVICE_ROLE_KEY missing');
  if (key && key.length < 20) fail('UAT_SERVICE_ROLE_KEY looks invalid');
  return { url, key, anon: env.UAT_ANON_KEY };
}

export async function adminClient(t) {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(t.url, t.key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Test identities. Passwords come from the env file only (never in repo).
export function identities(env) {
  return {
    athlete: { email: env.UAT_ATHLETE_EMAIL || 'uat-athlete@uat.ziko.invalid', password: env.UAT_ATHLETE_PASSWORD },
    coach: { email: env.UAT_COACH_EMAIL || 'uat-coach@uat.ziko.invalid', password: env.UAT_COACH_PASSWORD },
  };
}
