#!/usr/bin/env node
// v1.21 : complete les quetes repas + seance du compte frais (jetable) par insertion service role (garde lib.mjs : refuse la prod).
// L'eau (2 L) se logge par l'UI (flow v121-n02b-part1). Usage: node scripts/uat/v121-complete-quests.mjs [email]
import { loadEnv, resolveTarget, adminClient } from './lib.mjs';

const env = loadEnv();
const t = resolveTarget(env);
const email = process.argv[2] || env.UAT_FRESH_EMAIL || 'uat-fresh@uat.ziko.test';
const db = await adminClient(t);
const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const u = list.users.find((x) => x.email === email);
if (!u) { console.error('compte introuvable'); process.exit(2); }
const now = new Date();
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
const must = (label, r) => {
  if (r.error) { console.error('ERR', label, r.error.message); process.exit(3); }
  console.log('ok', label);
  return r.data;
};
must('nutrition', await db.from('ziko_nutrition_logs').insert({ user_id: u.id, date, meal_type: 'lunch', food_name: 'Poulet riz UAT', serving_g: 300, calories: 520, protein_g: 40, carbs_g: 60, fat_g: 10 }));
const ex = must('exercise', await db.from('ziko_exercises').select('id').limit(1));
const s = must('session', await db.from('ziko_workout_sessions').insert({ user_id: u.id, name: 'Seance UAT', started_at: new Date(now.getTime() - 20 * 60000).toISOString(), ended_at: now.toISOString(), total_sets: 1 }).select('id'));
must('set', await db.from('ziko_session_sets').insert({ session_id: s[0].id, exercise_id: ex[0].id, set_number: 1, reps: 10, weight_kg: 20, completed: true }));
