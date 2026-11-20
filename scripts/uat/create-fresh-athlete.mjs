#!/usr/bin/env node
// Creates (or recreates) a FRESH athlete on the throwaway branch that has NOT finished onboarding:
// auth user (email_confirm) + signup-trigger profile (onboarding_done=false), no athlete_state, no coach link.
// Usage: node scripts/uat/create-fresh-athlete.mjs [email]   (default uat-fresh@uat.ziko.test)
// Password = UAT_ATHLETE_PASSWORD from the env file. Never prints secrets.
import { loadEnv, resolveTarget, adminClient, identities } from './lib.mjs';

const env = loadEnv();
const t = resolveTarget(env);
const email = process.argv[2] || env.UAT_FRESH_EMAIL || 'uat-fresh@uat.ziko.test';
const password = identities(env).athlete.password;
if (!password) { console.error('[uat] REFUSED: UAT_ATHLETE_PASSWORD missing'); process.exit(2); }

const db = await adminClient(t);
const { data: list, error: le } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (le) throw le;
const found = list.users.find((u) => u.email === email);
if (found) {
  const { error } = await db.auth.admin.deleteUser(found.id);
  if (error) throw error;
  console.log('[uat] deleted previous', email);
}
const { data, error } = await db.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { app: 'ziko' },
});
if (error) throw error;
const id = data.user.id;
// Mark the email verified like create-accounts did (app-level verification is not configured on the branch).
await db.from('ziko_user_profiles').update({ email_verified_at: new Date().toISOString() }).eq('id', id);
const { data: prof } = await db.from('ziko_user_profiles').select('id, role, onboarding_done').eq('id', id).maybeSingle();
const { data: st } = await db.from('ziko_athlete_state').select('status').eq('user_id', id).maybeSingle();
console.log(`[uat] fresh athlete ${email} id=${id.slice(0, 8)} profile=${JSON.stringify(prof)} athlete_state=${st ? st.status : 'none'}`);
