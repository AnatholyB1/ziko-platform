// Rejoue les migrations P13 (20261201 1301/1302) sur un Postgres LOCAL jetable et verifie les scenarios.
// Usage : P13_PG_URL=postgres://postgres@127.0.0.1:<port>/p13 node scripts/uat/p13-quests-sql/run.mjs
// Garde-fou : refuse toute URL qui n'est pas locale. Ne touche JAMAIS le projet Supabase portfolio.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const url = process.env.P13_PG_URL;
if (!url) { console.log('P13_PG_URL absent : harnais SQL non execute (SKIP).'); process.exit(0); }
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error('Refus : URL non locale.'); process.exit(2); }

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("SET lc_messages = 'C'");
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS ${name}`); } else { fail++; console.log(`  FAIL ${name} ${extra}`); } };
const q = (sql, params) => client.query(sql, params);
const as = async (uid, role = 'authenticated') => {
  await q('RESET ROLE');
  await q(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [uid ?? '', role]);
  await q(`SET ROLE ${role}`);
};
const reset = async () => { await q('RESET ROLE'); };
const expectErr = async (name, fn, re) => {
  try { await fn(); ok(name, false, '(pas d\'erreur)'); } catch (e) { ok(name, re.test(String(e.message)), e.message); }
  await q('RESET ROLE').catch(() => {});
};
const sync = async (uid) => (await q(`SELECT public.ziko_sync_quests($1) AS r`, [uid])).rows[0].r;
const byslug = (r, slug) => r.quests.find((x) => x.slug === slug);
const coins = async (uid) => Number((await q(`SELECT COALESCE((SELECT coins FROM public.ziko_user_gamification WHERE user_id=$1), 0) AS c`, [uid])).rows[0].c);
const today = `(now() AT TIME ZONE 'Europe/Paris')::date`;

await q('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public;');
await q(readFileSync(resolve(root, 'scripts/uat/p12-rewards-sql/stub-schema.sql'), 'utf8'));
await q(readFileSync(resolve(here, 'stub-extra.sql'), 'utf8'));
await q(readFileSync(resolve(root, 'supabase/portfolio-migrations/20261201120100_badge_award_and_progress.sql'), 'utf8'));
await q(readFileSync(resolve(root, 'supabase/portfolio-migrations/20261201130100_quest_tables.sql'), 'utf8'));
await q(readFileSync(resolve(root, 'supabase/portfolio-migrations/20261201130200_quest_functions.sql'), 'utf8'));
console.log('Migrations appliquees sur la base locale jetable.');

const U = (n) => `00000000-0000-0000-0000-00000000010${n}`;
const [U1, U2, U3, U4, U5] = [1, 2, 3, 4, 5].map(U);
await q(`INSERT INTO auth.users (id) VALUES ($1), ($2), ($3), ($4), ($5)`, [U1, U2, U3, U4, U5]);

console.log('\n[1] Quetes de depart identiques pour tous (QUEST-02)');
await as(U1);
const r1 = await sync(U1);
await as(U2);
const r2 = await sync(U2);
await reset();
ok('3 quetes de depart', r1.quests.length === 3, JSON.stringify(r1.quests.map((x) => x.slug)));
ok('2 du jour puis 1 de la semaine (ordre)', r1.quests.map((x) => x.scope).join() === 'daily,daily,weekly');
const sig = (r) => JSON.stringify(r.quests.map((x) => [x.slug, x.title, x.target, x.reward_coins, x.metric, x.scope, x.icon]));
ok('U1 et U2 recoivent exactement les memes quetes', sig(r1) === sig(r2));
ok('maquette B12 : 25 / 15 / 60 pieces', r1.quests.map((x) => x.reward_coins).join() === '25,15,60');
ok('progression initiale a 0, toutes actives', r1.quests.every((x) => Number(x.progress) === 0 && x.status === 'active'));
ok('aucune icone emoji (noms Ionicons)', r1.quests.every((x) => /^[a-z-]+$/.test(x.icon)));

console.log('\n[2] Idempotence + bornes de periode');
await as(U1);
await sync(U1); await sync(U1);
await reset();
ok('resync : toujours 3 lignes en base', (await q(`SELECT COUNT(*)::int AS n FROM public.ziko_user_quests WHERE user_id=$1`, [U1])).rows[0].n === 3);
const per = (await q(`SELECT scope, period_start, expires_at, (period_start AT TIME ZONE 'Europe/Paris') AS lps FROM public.ziko_user_quests WHERE user_id=$1`, [U1])).rows;
const wk = per.find((p) => p.scope === 'weekly'), dy = per.find((p) => p.scope === 'daily');
ok('semaine = lundi 00:00 Paris', wk.lps.getDay() === 1 && wk.lps.getHours() === 0, String(wk.lps));
ok('jour = 00:00 Paris, la periode contient maintenant', dy.lps.getHours() === 0 && dy.period_start <= new Date() && dy.expires_at > new Date());
ok('semaine dure ~7 jours', Math.abs((wk.expires_at - wk.period_start) / 3.6e6 - 168) <= 1);

console.log('\n[3] Autorisation');
await expectErr('U1 ne peut pas synchroniser U2', async () => { await as(U1); await sync(U2); }, /forbidden/);
await expectErr('anon : refuse', async () => { await as(null, 'anon'); await sync(U1); }, /permission denied|forbidden/);

console.log('\n[4] Progression reelle : eau (QUEST-01)');
await reset();
await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, 1300, ${today})`, [U1]);
await as(U1);
let r = await sync(U1);
await reset();
let w = byslug(r, 'starter_daily_water');
ok('1300 ml bus -> progression 1300 / 2000, encore active', Number(w.progress) === 1300 && w.status === 'active', JSON.stringify(w));
ok('pas encore de pieces', await coins(U1) === 0);
await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, 700, ${today})`, [U1]);
await as(U1);
r = await sync(U1);
await reset();
w = byslug(r, 'starter_daily_water');
ok('2000 ml -> terminee', w.status === 'completed' && Number(w.progress) === 2000 && w.completed_at);
ok('newly_completed contient la quete', r.newly_completed.length === 1 && r.newly_completed[0].coins === 15);
ok('+15 pieces', await coins(U1) === 15);
const tx = (await q(`SELECT source, amount, description FROM public.ziko_coin_transactions WHERE user_id=$1`, [U1])).rows;
ok('transaction source=quest, libelle', tx.length === 1 && tx[0].source === 'quest' && /Boire 2 litres/.test(tx[0].description), JSON.stringify(tx));
await as(U1);
r = await sync(U1);
await reset();
ok('resync : aucun 2e credit', await coins(U1) === 15 && r.newly_completed.length === 0);
ok('quete terminee reste visible jusqu a la fin de sa periode', byslug(r, 'starter_daily_water').status === 'completed');
await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, 5000, ${today} - 1)`, [U2]);
await as(U2);
r = await sync(U2);
await reset();
ok('eau d hier hors periode : non comptee', Number(byslug(r, 'starter_daily_water').progress) === 0);
await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, 9999, ${today})`, [U3]);
ok('eau d un autre utilisateur isolee', Number(byslug(await (async () => { await as(U2); const x = await sync(U2); await reset(); return x; })(), 'starter_daily_water').progress) === 0);

console.log('\n[5] Progression reelle : seances');
const mkSession = async (uid, withSet) => {
  const sid = (await q(`INSERT INTO public.ziko_workout_sessions (user_id) VALUES ($1) RETURNING id`, [uid])).rows[0].id;
  if (withSet) await q(`INSERT INTO public.ziko_session_sets (session_id, exercise_id, set_number, reps, weight_kg, completed) VALUES ($1, gen_random_uuid(), 1, 5, 60, true)`, [sid]);
  return sid;
};
await mkSession(U1, false);
await as(U1); r = await sync(U1); await reset();
ok('seance vide : ne compte pas', Number(byslug(r, 'starter_daily_workout').progress) === 0 && Number(byslug(r, 'starter_weekly_train').progress) === 0);
await mkSession(U1, true);
await as(U1); r = await sync(U1); await reset();
ok('1 seance reelle : quete du jour terminee (+25)', byslug(r, 'starter_daily_workout').status === 'completed' && await coins(U1) === 15 + 25);
ok('hebdo 1 / 3 active', Number(byslug(r, 'starter_weekly_train').progress) === 1 && byslug(r, 'starter_weekly_train').status === 'active');
await mkSession(U1, true); await mkSession(U1, true);
await as(U1); r = await sync(U1); await reset();
ok('3 seances : hebdo terminee (+60)', byslug(r, 'starter_weekly_train').status === 'completed' && await coins(U1) === 15 + 25 + 60, String(await coins(U1)));

console.log('\n[6] Echeance sans atteindre la cible : neutre, aucune penalite (v1.18)');
await as(U4); await sync(U4); await reset();
await q(`UPDATE public.ziko_user_gamification SET xp = 500, current_streak = 7, longest_streak = 7 WHERE user_id = $1`, [U4]).catch(() => {});
await q(`SELECT public.ziko_award_coins($1, 100, 'workout', NULL, 'seed')`, [U4]);
await q(`UPDATE public.ziko_user_quests SET period_start = period_start - interval '2 days', expires_at = expires_at - interval '2 days'
         WHERE user_id = $1 AND slug = 'starter_daily_water'`, [U4]);
const before = (await q(`SELECT xp, coins, current_streak FROM public.ziko_user_gamification WHERE user_id=$1`, [U4])).rows[0];
await as(U4); r = await sync(U4); await reset();
const after = (await q(`SELECT xp, coins, current_streak FROM public.ziko_user_gamification WHERE user_id=$1`, [U4])).rows[0];
const old = (await q(`SELECT status FROM public.ziko_user_quests WHERE user_id=$1 AND slug='starter_daily_water' ORDER BY period_start LIMIT 1`, [U4])).rows[0];
ok('quete echue -> statut expired', old.status === 'expired');
ok('aucune penalite : xp / pieces / serie inchanges', JSON.stringify(before) === JSON.stringify(after), JSON.stringify([before, after]));
ok('remplacee par la quete de la periode courante (active, 0)', byslug(r, 'starter_daily_water')?.status === 'active' && r.quests.length === 3);
ok('echue remplacee : plus renvoyee a l app', !r.quests.some((x) => x.status === 'expired'));
// echue non remplacee (quete IA) : reste visible "expired", hors des actives
await as(null, 'service_role');
const ex = (await q(`SELECT public.ziko_create_quests($1, '[{"title":"Defi eau","metric":"hydration_ml","target":5000,"scope":"daily","reward_coins":10,"duration_hours":2}]'::jsonb) AS r`, [U4])).rows[0].r;
await reset();
await q(`UPDATE public.ziko_user_quests SET period_start = now() - interval '5 hours', expires_at = now() - interval '3 hours' WHERE id = $1`, [ex.created[0]]);
await as(U4); r = await sync(U4); await reset();
const exq = r.quests.find((x) => x.id === ex.created[0]);
ok('quete IA echue non remplacee : visible, statut expired (rendu neutre cote app)', exq && exq.status === 'expired', JSON.stringify(exq));
ok('elle ne compte pas dans les actives', r.quests.filter((x) => x.status === 'active').length === 3);
ok('toujours aucune penalite', JSON.stringify((await q(`SELECT xp, coins, current_streak FROM public.ziko_user_gamification WHERE user_id=$1`, [U4])).rows[0]) === JSON.stringify(after));

console.log('\n[7] Quete atteinte pendant sa periode mais synchronisee apres echeance : creditee (donnees reelles)');
await as(U5); await sync(U5); await reset();
await q(`UPDATE public.ziko_user_quests SET period_start = period_start - interval '2 days', expires_at = expires_at - interval '2 days'
         WHERE user_id = $1 AND slug = 'starter_daily_water'`, [U5]);
await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, 2100, ${today} - 2)`, [U5]);
await as(U5); r = await sync(U5); await reset();
const late = (await q(`SELECT status FROM public.ziko_user_quests WHERE user_id=$1 AND slug='starter_daily_water' ORDER BY period_start LIMIT 1`, [U5])).rows[0];
ok('creditee et terminee, pas echouee', late.status === 'completed' && await coins(U5) === 15, JSON.stringify(late));

console.log('\n[8] Grants restreints : aucune ecriture client');
await expectErr('INSERT direct refuse', async () => { await as(U1); await q(`INSERT INTO public.ziko_user_quests (user_id, slug, scope, title, icon, metric, target, period_start, expires_at) VALUES ($1,'x','daily','t','flag','habit_logs',1,now(),now()+interval '1 day')`, [U1]); }, /permission denied/);
await expectErr('UPDATE direct refuse (pas de triche de progression)', async () => { await as(U1); await q(`UPDATE public.ziko_user_quests SET status='completed' WHERE user_id=$1`, [U1]); }, /permission denied/);
await expectErr('DELETE direct refuse (refus de quete impossible)', async () => { await as(U1); await q(`DELETE FROM public.ziko_user_quests WHERE user_id=$1`, [U1]); }, /permission denied/);
await expectErr('UPDATE catalogue refuse', async () => { await as(U1); await q(`UPDATE public.ziko_quest_templates SET reward_coins = 500`); }, /permission denied/);
await as(U1);
let own = (await q(`SELECT COUNT(*)::int AS n FROM public.ziko_user_quests`)).rows[0].n;
ok('SELECT : seulement ses propres quetes (RLS)', own === (await q(`SELECT COUNT(*)::int AS n FROM public.ziko_user_quests WHERE user_id = $1`, [U1])).rows[0].n && own > 0);
const tpl = (await q(`SELECT COUNT(*)::int AS n FROM public.ziko_quest_templates`)).rows[0].n;
ok('catalogue lisible (3 modeles)', tpl === 3);
await reset();
await expectErr('creation IA refusee a un client', async () => { await as(U1); await q(`SELECT public.ziko_create_quests($1, '[]'::jsonb)`, [U1]); }, /permission denied/);
await expectErr('mesure interne non appelable par un client', async () => { await as(U1); await q(`SELECT public.ziko_quest_metric_value($1,'hydration_ml',now(),now())`, [U1]); }, /permission denied/);
await expectErr('anon : aucune lecture', async () => { await as(null, 'anon'); await q(`SELECT 1 FROM public.ziko_user_quests`); }, /permission denied/);

console.log('\n[9] Stockage pour l outil IA (P14) : ziko_create_quests (service_role)');
await as(null, 'service_role');
let c = (await q(`SELECT public.ziko_create_quests($1, $2::jsonb) AS r`, [U3, JSON.stringify([
  { title: 'Logger une habitude', metric: 'habit_logs', target: 1, scope: 'daily', reward_coins: 20, duration_hours: 24, ai_meta: { reason: 'identite', level: 3 } },
  { title: 'Deux repas notes', metric: 'nutrition_logs', target: 2, scope: 'weekly', reward_coins: 30, unit: 'repas' },
  { title: 'Un 3e', metric: 'hydration_ml', target: 1000, scope: 'daily' },
  { title: 'Un 4e', metric: 'workout_sessions', target: 1, scope: 'weekly' },
])])).rows[0].r;
await reset();
ok('4 quetes IA creees (le plafond de 3 est du ressort de P14)', c.created.length === 4);
const aiRow = (await q(`SELECT source, template_id, slug, ai_meta, icon FROM public.ziko_user_quests WHERE id = $1`, [c.created[0]])).rows[0];
ok('source=ai, sans modele, ai_meta stocke, icone par defaut', aiRow.source === 'ai' && aiRow.template_id === null && aiRow.ai_meta.level === 3 && aiRow.icon === 'flag' && /^ai-/.test(aiRow.slug), JSON.stringify(aiRow));
for (const [name, bad] of [
  ['metrique inconnue', { title: 'x', metric: 'steps', target: 1 }],
  ['cible nulle', { title: 'x', metric: 'habit_logs', target: 0 }],
  ['recompense hors borne', { title: 'x', metric: 'habit_logs', target: 1, reward_coins: 9999 }],
  ['duree hors borne', { title: 'x', metric: 'habit_logs', target: 1, duration_hours: 5000 }],
  ['titre vide', { title: '', metric: 'habit_logs', target: 1 }],
]) {
  await expectErr(`rejet : ${name}`, async () => { await as(null, 'service_role'); await q(`SELECT public.ziko_create_quests($1, $2::jsonb)`, [U3, JSON.stringify([bad])]); }, /invalid_/);
}
await q(`INSERT INTO public.ziko_habit_logs (habit_id, user_id, date) VALUES (gen_random_uuid(), $1, ${today})`, [U3]);
await as(U3); r = await sync(U3); await reset();
const ai1 = r.quests.find((x) => x.id === c.created[0]);
ok('quete IA mesuree sur les vraies donnees (habitude loguee) et creditee (20 + eau de depart 15 = 35)', ai1.status === 'completed' && r.newly_completed.some((x) => x.id === c.created[0]) && await coins(U3) === 35, JSON.stringify(r.newly_completed));
ok('quetes IA + depart coexistent dans la lecture', r.quests.filter((x) => x.source === 'ai').length === 4 && r.quests.filter((x) => x.source === 'starter').length === 3);

console.log('\n[10] Source de pieces `quest` + `achievement` toutes deux acceptees');
await q(`INSERT INTO public.ziko_coin_transactions (user_id, amount, source) VALUES ($1, 1, 'achievement'), ($1, 1, 'quest')`, [U1]);
await expectErr('source inconnue refusee', async () => { await q(`INSERT INTO public.ziko_coin_transactions (user_id, amount, source) VALUES ($1, 1, 'bogus')`, [U1]); }, /check constraint/);

await client.end();
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
