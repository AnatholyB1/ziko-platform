#!/usr/bin/env node
// v1.21 : lecture seule (service role de la branche jetable) de l'etat d'un compte frais : programmes, seances, quetes, credits.
// Usage: node scripts/uat/v121-peek.mjs [email]
import { loadEnv, resolveTarget, adminClient } from './lib.mjs';

const env = loadEnv();
const t = resolveTarget(env);
const email = process.argv[2] || env.UAT_FRESH_EMAIL || 'uat-fresh@uat.ziko.test';
const db = await adminClient(t);
const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const u = list.users.find((x) => x.email === email);
if (!u) { console.error('compte introuvable'); process.exit(2); }
const show = async (label, q) => { const r = await q; console.log(label, r.error ? `ERR ${r.error.message}` : JSON.stringify(r.data)); };
await show('ai_generated_programs', db.from('ziko_ai_generated_programs').select('*').eq('user_id', u.id));
await show('workout_programs', db.from('ziko_workout_programs').select('id,name,is_active,created_at').eq('user_id', u.id));
await show('workout_sessions', db.from('ziko_workout_sessions').select('*').eq('user_id', u.id));
await show('workshop_drafts', db.from('ziko_workshop_drafts').select('*').eq('user_id', u.id));
await show('user_quests', db.from('ziko_user_quests').select('slug,status,progress,target').eq('user_id', u.id));
await show('credits', db.from('ziko_user_ai_credits').select('balance').eq('user_id', u.id));
