// Rejoue les migrations P12/P13/P14 sur un Postgres LOCAL jetable et verifie le plafond de 3 quetes actives,
// la reservation de generation (niveau / plus de quete / quota), le relais starter -> IA et le statut neutre.
// Usage : P14_PG_URL=postgres://postgres@127.0.0.1:<port>/p14 node scripts/uat/p14-quests-sql/run.mjs
// Garde-fou : refuse toute URL qui n'est pas locale. Ne touche JAMAIS le projet Supabase portfolio.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const url = process.env.P14_PG_URL;
if (!url) { console.log('P14_PG_URL absent : harnais SQL non execute (SKIP).'); process.exit(0); }
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
const sync = async (uid) => { await as(uid); const r = (await q(`SELECT public.ziko_sync_quests($1) AS r`, [uid])).rows[0].r; await reset(); return r; };
const claim = async (uid, force = false, cap = 2) => { await as(uid, 'service_role'); const r = (await q(`SELECT public.ziko_quest_ai_claim($1, $2, $3) AS r`, [uid, cap, force])).rows[0].r; await reset(); return r; };
const createAi = async (uid, quests) => { await as(uid, 'service_role'); const r = (await q(`SELECT public.ziko_create_ai_quests($1, $2::jsonb) AS r`, [uid, JSON.stringify(quests)])).rows[0].r; await reset(); return r; };
const countActive = async (uid) => Number((await q(`SELECT COUNT(*) AS n FROM public.ziko_user_quests WHERE user_id=$1 AND status='active' AND expires_at > now()`, [uid])).rows[0].n);
const Q = (metric, target = 1, extra = {}) => ({ title: `Quete ${metric}`, metric, target, scope: 'daily', duration_hours: 24, reward_coins: 10, ...extra });

await q('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public;');
await q(readFileSync(resolve(root, 'scripts/uat/p12-rewards-sql/stub-schema.sql'), 'utf8'));
await q(readFileSync(resolve(root, 'scripts/uat/p13-quests-sql/stub-extra.sql'), 'utf8'));
for (const f of ['202612011201_badge_award_and_progress', '202612011301_quest_tables', '202612011302_quest_functions', '202612011401_quest_ai_state', '202612011402_quest_sync_ai_handover']) {
  await q(readFileSync(resolve(root, `supabase/migrations/${f}.sql`), 'utf8'));
}
console.log('Migrations 1201, 1301, 1302, 1401, 1402 appliquees sur la base locale jetable.');

const U = (n) => `00000000-0000-0000-0000-00000000040${n}`;
const [U1, U2, U3, U4, U5, U6, U7, U8] = [1, 2, 3, 4, 5, 6, 7, 8].map(U);
await q(`INSERT INTO auth.users (id) SELECT unnest($1::uuid[])`, [[U1, U2, U3, U4, U5, U6, U7, U8]]);

console.log('\n[1] Droits : reserve a service_role');
await expectErr('authenticated ne peut pas reserver', async () => { await as(U1); await q(`SELECT public.ziko_quest_ai_claim($1, 2, false)`, [U1]); }, /permission denied|forbidden/);
await expectErr('authenticated ne peut pas creer', async () => { await as(U1); await q(`SELECT public.ziko_create_ai_quests($1, '[]'::jsonb)`, [U1]); }, /permission denied|forbidden/);
await expectErr('anon refuse', async () => { await as(null, 'anon'); await q(`SELECT public.ziko_quest_ai_claim($1, 2, false)`, [U1]); }, /permission denied|forbidden/);
await expectErr('etat de generation illisible par un client', async () => { await as(U1); await q(`SELECT * FROM public.ziko_quest_ai_state`); }, /permission denied/);

console.log('\n[2] Reservation : jamais avant les quetes de depart, rien a faire quand tout est plein');
let c = await claim(U1);
ok('aucune quete synchronisee : not_initialized, pas d appel IA', c.proceed === false && c.reason === 'not_initialized', JSON.stringify(c));
let r = await sync(U1);
ok('3 quetes de depart actives', r.quests.length === 3 && await countActive(U1) === 3);
c = await claim(U1);
ok('3 actives : full (0 place), pas d appel IA', c.proceed === false && c.reason === 'full' && c.slots === 0, JSON.stringify(c));
let res = await createAi(U1, [Q('habit_logs'), Q('nutrition_logs')]);
ok('plafond : 0 creee, 2 ignorees quand 3 sont deja actives', res.created.length === 0 && res.skipped === 2 && await countActive(U1) === 3, JSON.stringify(res));

console.log('\n[3] Plus aucune quete : declenche, le nombre cree complete ce qui reste');
await q(`UPDATE public.ziko_user_quests SET status='completed', completed_at=now() WHERE user_id=$1`, [U1]);
c = await claim(U1);
ok('0 active : no_quest, proceed, 3 places', c.proceed === true && c.reason === 'no_quest' && c.slots === 3, JSON.stringify(c));
res = await createAi(U1, [Q('habit_logs', 2), Q('nutrition_logs', 2), Q('hydration_ml', 2000), Q('workout_sessions', 3, { scope: 'weekly', duration_hours: 168 })]);
ok('4 proposees, 3 places : 3 creees, 1 ignoree', res.created.length === 3 && res.skipped === 1 && res.slots_before === 3, JSON.stringify(res));
ok('exactement 3 actives IA, source ai', await countActive(U1) === 3 && Number((await q(`SELECT COUNT(*) n FROM public.ziko_user_quests WHERE user_id=$1 AND source='ai' AND status='active'`, [U1])).rows[0].n) === 3);
const row = (await q(`SELECT slug, ai_meta, expires_at - period_start AS dur FROM public.ziko_user_quests WHERE user_id=$1 AND source='ai' ORDER BY created_at LIMIT 1`, [U1])).rows[0];
ok('chaque quete IA a une duree limite (expires_at > debut)', row.dur !== null && row.slug.startsWith('ai-'));
res = await createAi(U1, [Q('habit_logs')]);
ok('4e quete refusee (plafond 3)', res.created.length === 0 && await countActive(U1) === 3);

console.log('\n[4] Quota quotidien des appels automatiques (2 par jour) ; la demande explicite n est pas limitee');
await sync(U2);
await q(`UPDATE public.ziko_user_quests SET status='completed', completed_at=now() WHERE user_id=$1`, [U2]);
const a1 = await claim(U2), a2 = await claim(U2), a3 = await claim(U2);
ok('1er et 2e appels automatiques passent', a1.proceed && a2.proceed, JSON.stringify([a1, a2]));
ok('3e appel automatique : daily_cap, rien d appele', a3.proceed === false && a3.reason === 'daily_cap', JSON.stringify(a3));
const f1 = await claim(U2, true);
ok('demande utilisateur (force) : requested, hors quota', f1.proceed === true && f1.reason === 'requested', JSON.stringify(f1));
await q(`UPDATE public.ziko_quest_ai_state SET auto_day = auto_day - 1 WHERE user_id=$1`, [U2]);
ok('lendemain : le quota est remis a zero', (await claim(U2)).proceed === true);

console.log('\n[5] Passage de niveau');
await sync(U3);
await q(`UPDATE public.ziko_user_quests SET status='completed', completed_at=now() WHERE user_id=$1 AND scope='weekly'`, [U3]);
await q(`UPDATE public.ziko_user_quests SET status='completed', completed_at=now() WHERE id = (SELECT id FROM public.ziko_user_quests WHERE user_id=$1 AND status='active' LIMIT 1)`, [U3]);
// 1 active restante => 2 places ; niveau 1
await q(`INSERT INTO public.ziko_user_gamification (user_id, level) VALUES ($1, 1) ON CONFLICT (user_id) DO UPDATE SET level = 1`, [U3]);
c = await claim(U3);
ok('niveau inchange, 1 active : not_needed (le niveau 1 est memorise)', c.proceed === false && c.reason === 'not_needed' && c.slots === 2, JSON.stringify(c));
await q(`UPDATE public.ziko_user_gamification SET level = 2 WHERE user_id=$1`, [U3]);
c = await claim(U3);
ok('niveau 1 -> 2 : level_up, 2 places', c.proceed === true && c.reason === 'level_up' && c.slots === 2 && c.level === 2, JSON.stringify(c));
c = await claim(U3);
ok('le meme niveau ne redeclenche pas', c.proceed === false && c.reason === 'not_needed', JSON.stringify(c));
res = await createAi(U3, [Q('habit_logs'), Q('nutrition_logs'), Q('hydration_ml', 1500)]);
ok('niveau gagne : le nombre cree complete ce qui reste (2 sur 3)', res.created.length === 2 && res.skipped === 1 && await countActive(U3) === 3, JSON.stringify(res));

console.log('\n[6] Niveau gagne alors que 3 quetes sont actives : rien a creer, niveau consomme');
await sync(U4);
await q(`INSERT INTO public.ziko_user_gamification (user_id, level) VALUES ($1, 1) ON CONFLICT (user_id) DO UPDATE SET level = 1`, [U4]);
await claim(U4);
await q(`UPDATE public.ziko_user_gamification SET level = 3 WHERE user_id=$1`, [U4]);
c = await claim(U4);
ok('level_up avec 3 actives : full, pas d appel IA', c.proceed === false && c.reason === 'full', JSON.stringify(c));
await q(`UPDATE public.ziko_user_quests SET status='completed', completed_at=now() WHERE id = (SELECT id FROM public.ziko_user_quests WHERE user_id=$1 AND status='active' LIMIT 1)`, [U4]);
c = await claim(U4);
ok('une place se libere ensuite : pas de rattrapage du niveau deja consomme', c.proceed === false && c.reason === 'not_needed', JSON.stringify(c));

console.log('\n[7] Course : deux creations simultanees ne depassent jamais 3 actives');
await sync(U5);
await q(`UPDATE public.ziko_user_quests SET status='completed', completed_at=now() WHERE user_id=$1`, [U5]);
const c2 = new pg.Client({ connectionString: url }); await c2.connect();
const mk = async (cl) => {
  await cl.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`); await cl.query('SET ROLE service_role');
  return cl.query(`SELECT public.ziko_create_ai_quests($1, $2::jsonb) AS r`, [U5, JSON.stringify([Q('habit_logs'), Q('nutrition_logs'), Q('hydration_ml', 1000)])]);
};
const [ra, rb] = await Promise.all([mk(client), mk(c2)]);
await reset(); await c2.end();
ok('6 proposees en parallele : 3 actives au total', await countActive(U5) === 3, `${ra.rows[0].r.created.length}+${rb.rows[0].r.created.length}`);
ok('une seule des deux a cree', ra.rows[0].r.created.length + rb.rows[0].r.created.length === 3);

console.log('\n[8] Validation (metrique hors liste, cible, duree, pieces)');
await sync(U6);
await q(`UPDATE public.ziko_user_quests SET status='completed', completed_at=now() WHERE user_id=$1`, [U6]);
await expectErr('metrique hors liste blanche', async () => { await createAi(U6, [Q('steps')]); }, /invalid_metric/);
await expectErr('cible nulle', async () => { await createAi(U6, [Q('habit_logs', 0)]); }, /invalid_target/);
await expectErr('duree > 840 h', async () => { await createAi(U6, [Q('habit_logs', 1, { duration_hours: 9999 })]); }, /invalid_duration/);
await expectErr('pieces > 500', async () => { await createAi(U6, [Q('habit_logs', 1, { reward_coins: 501 })]); }, /invalid_reward/);
ok('rien cree apres ces refus (transaction annulee)', await countActive(U6) === 0);

console.log('\n[9] Relais starter -> IA (la sync ne reoccupe pas les places)');
await sync(U7);
const startersBefore = Number((await q(`SELECT COUNT(*) n FROM public.ziko_user_quests WHERE user_id=$1 AND source='starter'`, [U7])).rows[0].n);
await q(`UPDATE public.ziko_user_quests SET status='completed', completed_at=now() WHERE user_id=$1`, [U7]);
await createAi(U7, [Q('habit_logs', 5)]);
await q(`UPDATE public.ziko_user_quests SET period_start = period_start - interval '2 days', expires_at = expires_at - interval '2 days' WHERE user_id=$1 AND source='starter'`, [U7]);
r = await sync(U7);
const startersAfter = Number((await q(`SELECT COUNT(*) n FROM public.ziko_user_quests WHERE user_id=$1 AND source='starter'`, [U7])).rows[0].n);
ok('apres une quete IA : aucune nouvelle quete de depart creee', startersAfter === startersBefore && startersBefore === 3, `${startersBefore}->${startersAfter}`);
ok('lecture : la quete IA active + les departs deja termines de la periode ; plus aucun depart actif ni echu', r.quests.filter((x) => x.status === 'active').length === 1 && r.quests.every((x) => x.source === 'ai' || x.status === 'completed'), JSON.stringify(r.quests.map((x) => [x.source, x.status])));
const sp = await (async () => { await q(`DELETE FROM public.ziko_user_quests WHERE user_id=$1`, [U8]); return sync(U8); })();
ok('avant toute quete IA : comportement P13 inchange (3 departs)', sp.quests.length === 3);

console.log('\n[10] Quete IA echue : visible, neutre, hors des 3, sans penalite, jusqu a son remplacement (QUEST-07)');
await q(`UPDATE public.ziko_user_quests SET status='completed', completed_at=now() WHERE user_id=$1`, [U7]);
await q(`INSERT INTO public.ziko_user_gamification (user_id, level, xp, coins, current_streak) VALUES ($1, 3, 500, 100, 7) ON CONFLICT (user_id) DO UPDATE SET xp=500, coins=100, current_streak=7`, [U7]);
await createAi(U7, [Q('nutrition_logs', 4)]);
await q(`UPDATE public.ziko_user_quests SET period_start = now() - interval '3 days', expires_at = now() - interval '1 day' WHERE user_id=$1 AND metric='nutrition_logs' AND source='ai'`, [U7]);
const g0 = (await q(`SELECT xp, coins, current_streak FROM public.ziko_user_gamification WHERE user_id=$1`, [U7])).rows[0];
r = await sync(U7);
const g1 = (await q(`SELECT xp, coins, current_streak FROM public.ziko_user_gamification WHERE user_id=$1`, [U7])).rows[0];
const ex = r.quests.find((x) => x.metric === 'nutrition_logs' && x.status === 'expired');
ok('quete echue renvoyee avec le statut neutre expired (le libelle « Non terminee » est affiche par l app)', !!ex);
ok('hors du compte des 3 : 0 active', await countActive(U7) === 0);
ok('aucune penalite : xp / pieces / serie inchanges', JSON.stringify(g0) === JSON.stringify(g1), JSON.stringify([g0, g1]));
c = await claim(U7);
ok('plus aucune quete active : la generation automatique se declenche', c.proceed === true && c.reason === 'no_quest' && c.slots === 3, JSON.stringify(c));
await createAi(U7, [Q('hydration_ml', 2000)]);
r = await sync(U7);
ok('remplacee par une quete IA plus recente : la quete echue disparait de la lecture', !r.quests.some((x) => x.status === 'expired') && r.quests.filter((x) => x.status === 'active').length === 1, JSON.stringify(r.quests.map((x) => x.status)));
ok('l ancienne ligne est conservee en base (historique), statut expired', Number((await q(`SELECT COUNT(*) n FROM public.ziko_user_quests WHERE user_id=$1 AND status='expired' AND metric='nutrition_logs'`, [U7])).rows[0].n) === 1);

console.log('\n[11] Ecritures client toujours interdites (QUEST-06 : pas de refus possible)');
await expectErr('DELETE direct refuse', async () => { await as(U7); await q(`DELETE FROM public.ziko_user_quests WHERE user_id=$1`, [U7]); }, /permission denied/);
await expectErr('UPDATE direct refuse', async () => { await as(U7); await q(`UPDATE public.ziko_user_quests SET status='expired' WHERE user_id=$1`, [U7]); }, /permission denied/);

await client.end();
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
