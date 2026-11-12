#!/usr/bin/env node
// Reset the athlete test dataset to a reproducible baseline (idempotent). Service role, branch only.
// Usage: node scripts/uat/reset-data.mjs [--dry-run]
import { loadEnv, resolveTarget, adminClient, identities } from './lib.mjs';

const dry = process.argv.includes('--dry-run');
const env = loadEnv();
const t = resolveTarget(env, { requireKey: !dry });

// user_id-scoped tables wiped at each reset (missing tables are tolerated and reported).
const WIPE = [
  'ziko_workout_sessions', 'ziko_habit_logs', 'ziko_habits', 'ziko_nutrition_logs', 'ziko_sleep_logs',
  'ziko_body_measurements', 'ziko_hydration_logs', 'ziko_journal_entries', 'ziko_cardio_sessions',
  'ziko_ai_conversations', 'ziko_user_inventory',
];
const BASELINE = [
  { table: 'ziko_user_profiles', key: 'id', row: { onboarding_done: true, role: 'client' } },
  { table: 'ziko_athlete_state', key: 'user_id', row: { status: 'active', tier: 5, level: 1, points: 0 } },
];
if (dry) {
  console.log(`[uat] DRY-RUN target=${new URL(t.url).host}`);
  WIPE.forEach((x) => console.log(` - delete from ${x} where user_id=<athlete>`));
  BASELINE.forEach((b) => console.log(` - upsert ${b.table} (${b.key}=<athlete>) ${JSON.stringify(b.row)}`));
  process.exit(0);
}
const db = await adminClient(t);
const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const u = data?.users.find((x) => x.email === identities(env).athlete.email);
if (!u) { console.error('[uat] athlete not found: run create-accounts.mjs first'); process.exit(1); }
for (const tbl of WIPE) {
  const { error } = await db.from(tbl).delete().eq('user_id', u.id);
  console.log(error ? `[uat] skip ${tbl}: ${error.message}` : `[uat] wiped ${tbl}`);
}
for (const b of BASELINE) {
  const { error } = await db.from(b.table).upsert({ [b.key]: u.id, ...b.row });
  console.log(error ? `[uat] WARN ${b.table}: ${error.message}` : `[uat] baseline ${b.table}`);
}
console.log('[uat] reset done (only the athlete test user is touched).');
