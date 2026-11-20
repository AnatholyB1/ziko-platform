#!/usr/bin/env node
// v1.21 UATN-03 (Credits epuises) : met le compte frais a 0 credit ET consomme le quota gratuit chat du jour,
// via le service role de la branche jetable (garde de lib.mjs : refuse la prod). Ne touche que ce compte.
// Usage: node scripts/uat/v121-exhaust-credits.mjs [email]     (defaut uat-fresh@uat.ziko.test)
import { loadEnv, resolveTarget, adminClient } from './lib.mjs';

const env = loadEnv();
const t = resolveTarget(env);
const email = process.argv[2] || env.UAT_FRESH_EMAIL || 'uat-fresh@uat.ziko.test';
const db = await adminClient(t);
const { data: list, error: le } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (le) throw le;
const u = list.users.find((x) => x.email === email);
if (!u) { console.error('[uat] compte introuvable', email); process.exit(2); }

const up = await db.from('ziko_user_ai_credits').upsert({ user_id: u.id, balance: 0, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
if (up.error) throw up.error;
// Quota gratuit du jour (source 'chat') consomme : 2 lignes pour couvrir base + bonus eventuel.
for (const k of ['v121-exhaust-1', 'v121-exhaust-2']) {
  const tx = await db.from('ziko_ai_credit_transactions').insert({ user_id: u.id, type: 'quota', amount: 0, source: 'chat', idempotency_key: `${k}-${Date.now()}` });
  if (tx.error) { console.error('[uat] insert transaction:', tx.error.message); }
}
const { data: b } = await db.from('ziko_user_ai_credits').select('balance').eq('user_id', u.id).maybeSingle();
console.log(`[uat] ${email} id=${u.id.slice(0, 8)} balance=${b?.balance} (quota chat du jour consomme)`);
