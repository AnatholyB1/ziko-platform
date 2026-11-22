#!/usr/bin/env node
// Creates uat-athlete + uat-coach on the throwaway branch and links them. Idempotent.
// Usage: node scripts/uat/create-accounts.mjs [--dry-run]
import { loadEnv, resolveTarget, adminClient, identities } from './lib.mjs';

const dry = process.argv.includes('--dry-run');
const env = loadEnv();
const t = resolveTarget(env, { requireKey: !dry });
const ids = identities(env);
if (!dry && (!ids.athlete.password || !ids.coach.password)) {
  console.error('[uat] REFUSED: UAT_ATHLETE_PASSWORD / UAT_COACH_PASSWORD missing in env file');
  process.exit(2);
}
const plan = [
  `ensure auth user ${ids.athlete.email} (email_confirm)`,
  `ensure auth user ${ids.coach.email} (email_confirm)`,
  'upsert ziko_user_profiles: coach role=coach, athlete role=client, onboarding_done=true',
  'upsert ziko_athlete_state(status=active, tier=5) for athlete',
  'ensure ziko_coach_invitations (used) + ziko_coach_client_links active (coach -> athlete)',
];
if (dry) {
  console.log(`[uat] DRY-RUN target=${new URL(t.url).host}\n - ` + plan.join('\n - '));
  process.exit(0);
}

const db = await adminClient(t);
async function ensureUser({ email, password }) {
  const { data: list, error: le } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (le) throw le;
  const found = list.users.find((u) => u.email === email);
  if (found) {
    await db.auth.admin.updateUserById(found.id, { password, email_confirm: true });
    return found.id;
  }
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}
const athleteId = await ensureUser(ids.athlete);
const coachId = await ensureUser(ids.coach);
const must = async (label, p) => {
  const { error } = await p;
  console.log(error ? `[uat] WARN ${label}: ${error.message}` : `[uat] ok ${label}`);
};

await must('profile coach', db.from('ziko_user_profiles').upsert({ id: coachId, role: 'coach', onboarding_done: true }));
await must('profile athlete', db.from('ziko_user_profiles').upsert({ id: athleteId, role: 'client', onboarding_done: true }));
await must('athlete_state', db.from('ziko_athlete_state').upsert({ user_id: athleteId, status: 'active', tier: 5 }));
await must(
  'invitation',
  db.from('ziko_coach_invitations').upsert(
    { coach_id: coachId, code: 'UATK42', used_by: athleteId, used_at: new Date().toISOString(), use_count: 1 },
    { onConflict: 'code' },
  ),
);
const { data: link } = await db
  .from('ziko_coach_client_links').select('id')
  .eq('coach_id', coachId).eq('client_id', athleteId).is('revoked_at', null).maybeSingle();
if (!link) await must('link', db.from('ziko_coach_client_links').insert({ coach_id: coachId, client_id: athleteId }));
else console.log('[uat] ok link (exists)');
console.log(`[uat] done. athlete=${athleteId.slice(0, 8)} coach=${coachId.slice(0, 8)}`);
