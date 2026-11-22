// Revue B (v1.20) : rejoue les migrations correctives 2801..2804 sur un Postgres LOCAL jetable.
//  - H1  fenetre de dates des quetes IA (ziko_quest_metric_value) : saisies AVANT la creation exclues, quete creee a 21 h juste
//  - M2  semaine sans activite = neutre (absence a tous les paliers : jamais de descente)
//  - M3  repos du modele de ligue apres un refus (cooldown)
// (M1 : scripts/uat/p14-quests-sql/run.mjs.)
// Usage : RB_PG_URL=postgres://postgres@127.0.0.1:<port>/rb node scripts/uat/review-b-sql/run.mjs
// Garde-fou : refuse toute URL qui n'est pas locale. Ne touche JAMAIS le projet Supabase portfolio.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const url = process.env.RB_PG_URL;
if (!url) { console.log('RB_PG_URL absent : harnais SQL non execute (SKIP).'); process.exit(0); }
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error('Refus : URL non locale.'); process.exit(2); }

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("SET lc_messages = 'C'");
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS ${name}`); } else { fail++; console.log(`  FAIL ${name} ${extra}`); } };
const q = (sql, params) => client.query(sql, params);
const one = async (sql, p) => (await q(sql, p)).rows[0];
const as = async (uid, role = 'authenticated') => {
  await q('RESET ROLE');
  await q(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [uid ?? '', role]);
  await q(`SET ROLE ${role}`);
};
const reset = async () => { await q('RESET ROLE'); };
const mig = (f) => q(readFileSync(resolve(root, `supabase/portfolio-migrations/${f}.sql`), 'utf8'));
const rpc = async (who, fn, args = [], role = 'authenticated') => {
  await as(who, role);
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  try { return (await q(`SELECT public.${fn}(${ph}) AS r`, args)).rows[0].r; } finally { await reset(); }
};
// Instant Paris -> timestamptz
const P = (s) => `('${s}'::timestamp AT TIME ZONE 'Europe/Paris')`;

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[A] H1 : fenetre de dates des quetes IA');
await q('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public;');
await q(readFileSync(resolve(root, 'scripts/uat/p12-rewards-sql/stub-schema.sql'), 'utf8'));
await q(readFileSync(resolve(root, 'scripts/uat/p13-quests-sql/stub-extra.sql'), 'utf8'));
await q(`CREATE TABLE public.ziko_body_measurements (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric, date date DEFAULT CURRENT_DATE NOT NULL, created_at timestamptz DEFAULT now() NOT NULL)`);
for (const f of ['20261201120100_badge_award_and_progress', '20261201130100_quest_tables', '20261201130200_quest_functions', '20261201140100_quest_ai_state',
  '20261201140200_quest_sync_ai_handover', '20261201160200_quest_measurement_metric', '20261201280100_quest_metric_window']) await mig(f);
await mig('20261201280100_quest_metric_window'); // rejouabilite
console.log('Migrations 1201..1602 + 2801 appliquees (2801 deux fois).');

const U = (n) => `00000000-0000-0000-0000-0000000b${String(n).padStart(4, '0')}`;
const uA = U(1), uB = U(2), uC = U(3);
await q(`INSERT INTO auth.users (id) SELECT unnest($1::uuid[])`, [[uA, uB, uC]]);
const mv = async (metric, from, to, uid = uA) => Number((await one(`SELECT public.ziko_quest_metric_value($1, $2, ${from}, ${to}) AS v`, [uid, metric])).v);
const hyd = (uid, ml, date, createdAt) => q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date, created_at) VALUES ($1, $2, $3::date, ${createdAt})`, [uid, ml, date]);

// Fonction pure : quete IA creee le 10/11 a 21 h (Paris), duree 24 h => fenetre [10/11 21:00 ; 11/11 21:00].
await hyd(uA, 2000, '2026-11-10', P('2026-11-10 20:00'));   // AVANT la creation (meme jour) : ne compte pas
await hyd(uA, 500, '2026-11-10', P('2026-11-10 21:30'));    // apres la creation, meme jour : compte
await hyd(uA, 750, '2026-11-11', P('2026-11-11 10:00'));    // lendemain avant l'expiration : compte (avant : jamais)
await hyd(uA, 900, '2026-11-11', P('2026-11-11 22:00'));    // apres l'expiration : ne compte pas
ok('quete IA creee a 21 h : 500 + 750 = 1250 (la saisie de 20 h et celle apres l expiration sont exclues)',
  await mv('hydration_ml', P('2026-11-10 21:00'), P('2026-11-11 21:00')) === 1250);
ok('la saisie de 2000 ml faite a 20 h ne fait PAS terminer une quete 2 L creee a 21 h',
  await mv('hydration_ml', P('2026-11-10 21:00'), P('2026-11-10 23:59')) === 500);
// Quete de depart alignee sur minuit Paris : comportement P13 inchange (jour calendaire, created_at ignore).
ok('depart quotidien aligne (10/11 00:00 -> 11/11 00:00) : toute la journee du 10/11 = 2500', await mv('hydration_ml', P('2026-11-10 00:00'), P('2026-11-11 00:00')) === 2500);
await hyd(uA, 300, '2026-11-12', P('2026-11-11 23:30'));    // decalage de fuseau : date locale du lendemain, saisie avant minuit Paris
ok('depart aligne : une saisie datee du jour mais creee avant minuit (decalage de fuseau) compte', await mv('hydration_ml', P('2026-11-12 00:00'), P('2026-11-13 00:00')) === 300);
ok('depart hebdo aligne (lundi 09/11 -> 16/11) : toute la semaine = 2000 + 500 + 750 + 900 + 300', await mv('hydration_ml', P('2026-11-09 00:00'), P('2026-11-16 00:00')) === 4450);
ok('quete hebdo IA creee mercredi 12 h : seules les saisies creees dans la fenetre comptent (900 + 300, pas les 750 de 10 h)',
  await mv('hydration_ml', P('2026-11-11 12:00'), P('2026-11-18 12:00')) === 1200);
// Autres metriques datees
const kinds = [
  ['nutrition_logs', (d, c) => q(`INSERT INTO public.ziko_nutrition_logs (user_id, date, meal_type, food_name, created_at) VALUES ($1, $2::date, 'lunch', 'x', ${c})`, [uB, d])],
  ['habit_logs', (d, c) => q(`INSERT INTO public.ziko_habit_logs (habit_id, user_id, date, value, created_at) VALUES (gen_random_uuid(), $1, $2::date, 1, ${c})`, [uB, d])],
  ['measurement_logs', (d, c) => q(`INSERT INTO public.ziko_body_measurements (user_id, weight_kg, date, created_at) VALUES ($1, 70, $2::date, ${c})`, [uB, d])],
];
for (const [t, ins] of kinds) {
  await q(`DELETE FROM public.ziko_nutrition_logs WHERE user_id=$1`, [uB]);
  await q(`DELETE FROM public.ziko_habit_logs WHERE user_id=$1`, [uB]);
  await q(`DELETE FROM public.ziko_body_measurements WHERE user_id=$1`, [uB]);
  await ins('2026-11-10', P('2026-11-10 08:00'));  // avant la creation
  await ins('2026-11-10', P('2026-11-10 22:00'));  // apres, meme jour
  await ins('2026-11-11', P('2026-11-11 09:00'));  // lendemain
  ok(`${t} : quete IA creee a 21 h -> 2 saisies comptees (soir + lendemain), pas celle de 8 h`, await mv(t, P('2026-11-10 21:00'), P('2026-11-11 21:00'), uB) === 2);
  ok(`${t} : depart quotidien aligne inchange (2 saisies du 10/11)`, await mv(t, P('2026-11-10 00:00'), P('2026-11-11 00:00'), uB) === 2);
}
ok('workout_sessions : branche conservee (0 seance)', await mv('workout_sessions', P('2026-11-10 21:00'), P('2026-11-11 21:00')) === 0);

// Bout en bout : quete IA creee MAINTENANT, eau bue AVANT la creation, puis apres.
await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date, created_at) VALUES ($1, 2500, (now() AT TIME ZONE 'Europe/Paris')::date, now() - interval '1 hour')`, [uC]);
await rpc(uC, 'ziko_create_ai_quests', [uC, JSON.stringify([{ title: 'Boire 2 L', metric: 'hydration_ml', target: 2000, scope: 'daily', duration_hours: 24, reward_coins: 20 }])], 'service_role');
let sy = await rpc(uC, 'ziko_sync_quests', [uC]);
const qq = sy.quests.find((x) => x.metric === 'hydration_ml' && x.source === 'ai');
ok('quete IA creee apres 2,5 L deja bus : NON terminee a la 1re synchro, progression 0, aucune piece', !!qq && qq.status === 'active' && Number(qq.progress) === 0 && sy.newly_completed.length === 0, JSON.stringify(qq));
await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, 1200, (now() AT TIME ZONE 'Europe/Paris')::date), ($1, 900, (now() AT TIME ZONE 'Europe/Paris')::date)`, [uC]);
sy = await rpc(uC, 'ziko_sync_quests', [uC]);
ok('apres 2,1 L bus APRES la creation : terminee, pieces creditees', sy.newly_completed.length === 1 && sy.newly_completed[0].coins === 20, JSON.stringify(sy.newly_completed));

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[B] M2 : semaine sans activite = neutre (ligue)');
await q('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public;');
await q(readFileSync(resolve(root, 'scripts/uat/p26-league-sql/stub-schema.sql'), 'utf8'));
const MIGS = ['20261201260100_factions_leagues_schema', '20261201260200_faction_rpc', '20261201260300_league_sync', '20261201260400_league_ai_gate', '20261201260500_collective_challenges',
  '20261201280300_league_neutral_absence', '20261201280400_league_ai_decline_cooldown'];
for (const f of MIGS) await mig(f);
for (const f of MIGS.slice(5)) await mig(f); // rejouabilite
console.log('Migrations 2601..2605 + 2803 + 2804 appliquees (2803/2804 deux fois).');

const LU = (n) => `00000000-0000-0000-0000-0000000c${String(n).padStart(4, '0')}`;
const seed = async (n, o = {}) => {
  const id = LU(n);
  await q(`INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  await q(`INSERT INTO public.ziko_user_profiles (id, age, goal, role) VALUES ($1, 30, 'strength', 'client') ON CONFLICT DO NOTHING`, [id]);
  await q(`INSERT INTO public.ziko_athlete_state (user_id, tier, readiness, onboarding_profile, current_focus_detail) VALUES ($1, 3, 'building', $2::jsonb, '{}'::jsonb)
           ON CONFLICT (user_id) DO NOTHING`, [id, JSON.stringify({ experience_level: o.exp ?? 'beginner' })]);
  return id;
};
const ws = async (off = 0) => (await one(`SELECT (public.ziko_week_start((now() AT TIME ZONE 'Europe/Paris')::date) - 7 * $1::int)::text AS d`, [off])).d;
const mkHabits = async (uid, n = 3) => {
  const ids = [];
  for (let i = 0; i < n; i++) ids.push((await one(`INSERT INTO public.ziko_habits (user_id, name) VALUES ($1, $2) RETURNING id`, [uid, `h${i}`])).id);
  return ids;
};
const logWeek = async (uid, hs, off, pairs) => {
  const start = await ws(off);
  let k = 0;
  for (let d = 0; d < 7 && k < pairs; d++) for (const h of hs) {
    if (k >= pairs) break;
    await q(`INSERT INTO public.ziko_habit_logs (habit_id, user_id, date, value) VALUES ($1, $2, $3::date + $4::int, 1)`, [h, uid, start, d]);
    k++;
  }
};
const sync = (uid) => rpc(uid, 'ziko_league_sync', [uid]);
const FULL = 21;

// Absence a chaque palier (1..5) : l'etat est pose directement au palier, puis N semaines sans aucune activite.
for (const [palier, absent] of [[1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [4, 7], [5, 7]]) {
  const u = await seed(100 + palier * 10 + absent);
  await mkHabits(u, 3);
  await sync(u);
  await q(`UPDATE public.ziko_league_state SET division = $2, peak_division = $2 WHERE user_id = $1`, [u, palier]);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = $2::date WHERE user_id = $1`, [u, await ws(absent + 1)]);
  const st = await sync(u);
  const outs = (await q(`SELECT outcome FROM public.ziko_league_weeks WHERE user_id = $1`, [u])).rows.map((r) => r.outcome);
  const c = await one(`SELECT low_streak, up_streak FROM public.ziko_league_state WHERE user_id = $1`, [u]);
  ok(`palier ${palier}, ${absent} semaines d absence : palier inchange, toutes neutres, aucun compteur`, st.division === palier && st.closed_now === absent && outs.every((o) => o === 'neutral') && c.low_streak === 0 && c.up_streak === 0, JSON.stringify([st.division, st.closed_now, outs, c]));
}
{ // Une semaine basse mais REELLE (3 sur 21 = 14 %) reste scoree : 3 basses de suite => descente (regle D-07 inchangee)
  const u = await seed(30);
  const hs = await mkHabits(u, 3);
  await sync(u);
  await q(`UPDATE public.ziko_league_state SET division = 3, peak_division = 3 WHERE user_id = $1`, [u]);
  for (let i = 0; i < 3; i++) await logWeek(u, hs, 3 - i, 3);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = $2::date WHERE user_id = $1`, [u, await ws(4)]);
  const st = await sync(u);
  ok('palier 3, puis 3 semaines a 14 % (activite reelle basse) : descente a 2, regle amortie inchangee', st.division === 2 && st.peak_division === 3, JSON.stringify(st));
}
{ // Absence entre deux semaines basses reelles : l'absence ne compte pas dans la serie
  const u = await seed(31);
  const hs = await mkHabits(u, 3);
  await sync(u);
  await q(`UPDATE public.ziko_league_state SET division = 3, peak_division = 3 WHERE user_id = $1`, [u]);
  await logWeek(u, hs, 5, 3); // basse
  await logWeek(u, hs, 4, 3); // basse
  // ws(3), ws(2) : absence ; ws(1) : basse
  await logWeek(u, hs, 1, 3);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = $2::date WHERE user_id = $1`, [u, await ws(6)]);
  const st = await sync(u);
  const o = (await q(`SELECT outcome FROM public.ziko_league_weeks WHERE user_id = $1 ORDER BY week_start`, [u])).rows.map((r) => r.outcome);
  ok('basse, basse, absence, absence, basse : les absences sont neutres et ne cassent ni ne gonflent la serie (3e basse => descente)', o.join() === 'hold,hold,neutral,neutral,down' && st.division === 2, JSON.stringify([o, st.division]));
}

console.log('\n[C] M3 : repos apres refus de transition');
{
  const u = await seed(40);
  const hs = await mkHabits(u, 3);
  await sync(u);
  for (let i = 0; i < 4; i++) await logWeek(u, hs, 4 - i, FULL);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = $2::date WHERE user_id = $1`, [u, await ws(5)]);
  await sync(u);
  let c = await rpc(u, 'ziko_league_ai_claim', [u, 1], 'service_role');
  ok('4 semaines >= 70 : eligible, appel reserve', c.proceed === true && c.reason === 'eligible', JSON.stringify(c));
  await rpc(u, 'ziko_league_ai_decline', [u, 7], 'service_role');
  await q(`UPDATE public.ziko_league_ai_state SET auto_day = auto_day - 1 WHERE user_id = $1`, [u]);
  c = await rpc(u, 'ziko_league_ai_claim', [u, 1], 'service_role');
  ok('lendemain, meme preuve : cooldown, le modele n est PAS rappele', c.proceed === false && c.reason === 'cooldown', JSON.stringify(c));
  await q(`UPDATE public.ziko_league_ai_state SET declined_until = now() - interval '1 minute' WHERE user_id = $1`, [u]);
  c = await rpc(u, 'ziko_league_ai_claim', [u, 1], 'service_role');
  ok('apres 7 jours : le modele peut etre rappele', c.proceed === true, JSON.stringify(c));
  await as(u);
  let err = '';
  try { await q(`SELECT public.ziko_league_ai_decline($1, 7)`, [u]); } catch (e) { err = e.message; }
  await reset();
  ok('authenticated ne peut pas poser un cooldown', /permission denied|forbidden/.test(err), err);
}

await client.end();
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
