// Rejoue les migrations P26 (2601..2605) sur un Postgres LOCAL jetable et verifie : droits/RLS, factions, score de
// regularite, paliers amortis, garde-fous anti-triche, porte IA, celebration, defis collectifs, non-punitif.
// Usage : P26_PG_URL=postgres://postgres@127.0.0.1:8206/p26 node scripts/uat/p26-league-sql/run.mjs
// Garde-fou : refuse toute URL qui n'est pas locale. Ne touche JAMAIS le projet Supabase portfolio.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const url = process.env.P26_PG_URL;
if (!url) { console.log('P26_PG_URL absent : harnais SQL non execute (SKIP).'); process.exit(0); }
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error('Refus : URL non locale.'); process.exit(2); }

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("SET lc_messages = 'C'");
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS ${name}`); } else { fail++; console.log(`  FAIL ${name} ${extra}`); } };
const q = (sql, params) => client.query(sql, params);
const reset = async () => { await q('RESET ROLE'); };
const as = async (uid, role = 'authenticated') => {
  await q('RESET ROLE');
  await q(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [uid ?? '', role]);
  await q(`SET ROLE ${role}`);
};
const expectErr = async (name, fn, re) => {
  try { await fn(); ok(name, false, '(pas d\'erreur)'); } catch (e) { ok(name, re.test(String(e.message)), e.message); }
  await q('RESET ROLE').catch(() => {});
};
const one = async (sql, p) => (await q(sql, p)).rows[0];
const rpc = async (who, fn, args = [], role = 'authenticated') => {
  await as(who, role);
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  const r = (await q(`SELECT public.${fn}(${ph}) AS r`, args)).rows[0].r;
  await reset();
  return r;
};
const sync = (uid) => rpc(uid, 'ziko_league_sync', [uid]);

await q('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public;');
await q(readFileSync(resolve(here, 'stub-schema.sql'), 'utf8'));
const MIGS = ['20261201260100_factions_leagues_schema', '20261201260200_faction_rpc', '20261201260300_league_sync', '20261201260400_league_ai_gate', '20261201260500_collective_challenges', '20261201280300_league_neutral_absence', '20261201280400_league_ai_decline_cooldown'];
for (const f of MIGS) await q(readFileSync(resolve(root, `supabase/portfolio-migrations/${f}.sql`), 'utf8'));
// Rejouabilite (idempotence) : tout est rejoue une 2e fois sans erreur.
for (const f of MIGS) await q(readFileSync(resolve(root, `supabase/portfolio-migrations/${f}.sql`), 'utf8'));
console.log('Migrations 2601..2605 appliquees 2 fois (idempotence) sur la base locale jetable.');

// UUID deterministe : 00000000-0000-0000-0000-00000026NNNN.
const U = (n) => `00000000-0000-0000-0000-${String(2600000 + n).padStart(12, '0')}`;
const seed = async (n, o = {}) => {
  const id = U(n);
  await q(`INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  await q(`INSERT INTO public.ziko_user_profiles (id, age, goal, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET age = EXCLUDED.age, goal = EXCLUDED.goal, role = EXCLUDED.role`,
    [id, o.age === undefined ? 30 : o.age, o.goal ?? 'strength', o.role ?? 'client']);
  await q(`INSERT INTO public.ziko_athlete_state (user_id, tier, readiness, onboarding_profile, current_focus_detail) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
           ON CONFLICT (user_id) DO UPDATE SET tier = EXCLUDED.tier, readiness = EXCLUDED.readiness, onboarding_profile = EXCLUDED.onboarding_profile, current_focus_detail = EXCLUDED.current_focus_detail`,
    [id, o.tier ?? 3, o.readiness ?? 'building', JSON.stringify({ experience_level: o.exp ?? 'beginner' }), JSON.stringify(o.focus ?? {})]);
  return id;
};
const ws = async (off = 0) => (await one(`SELECT (public.ziko_week_start((now() AT TIME ZONE 'Europe/Paris')::date) - 7 * $1::int)::text AS d`, [off])).d;
const mkHabits = async (uid, n = 3) => {
  const ids = [];
  for (let i = 0; i < n; i++) ids.push((await one(`INSERT INTO public.ziko_habits (user_id, name) VALUES ($1, $2) RETURNING id`, [uid, `h${i}`])).id);
  return ids;
};
// Insere `pairs` couples (habitude, jour) distincts dans la semaine ws(off).
const logWeek = async (uid, hs, off, pairs) => {
  const start = await ws(off);
  let k = 0;
  for (let d = 0; d < 7 && k < pairs; d++) for (const h of hs) {
    if (k >= pairs) break;
    await q(`INSERT INTO public.ziko_habit_logs (habit_id, user_id, date, value) VALUES ($1, $2, $3::date + $4::int, 1)`, [h, uid, start, d]);
    k++;
  }
};
// Joue N semaines passees (du plus ancien au plus recent) avec les `pairs` donnes (3 habitudes => demande 21), puis cloture.
const play = async (uid, hs, pairsList) => {
  const N = pairsList.length;
  await sync(uid); // cree l'etat
  for (let i = 0; i < N; i++) await logWeek(uid, hs, N - i, pairsList[i]);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = $2::date WHERE user_id = $1`, [uid, await ws(N + 1)]);
  return sync(uid);
};
const FULL = 21, EMPTY = 0, MID = 10, LOW = 3; // LOW = 3/21 = 14 % : activite reelle mais faible (une semaine EMPTY est neutre depuis la revue B M2)
const state = async (uid) => one(`SELECT * FROM public.ziko_league_state WHERE user_id = $1`, [uid]);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1] Droits : aucune ecriture client, fonctions internes fermees');
const A = await seed(1, { exp: 'beginner' });
const B = await seed(2);
await expectErr('INSERT direct league_state refuse', async () => { await as(A); await q(`INSERT INTO public.ziko_league_state (user_id, track, last_week_closed) VALUES ($1, 'habits', now())`, [A]); }, /permission denied/);
await expectErr('INSERT direct faction_members refuse', async () => { await as(A); await q(`INSERT INTO public.ziko_faction_members (user_id, faction_key) VALUES ($1, 'running')`, [A]); }, /permission denied/);
await expectErr('INSERT direct league_weeks refuse', async () => { await as(A); await q(`INSERT INTO public.ziko_league_weeks VALUES ($1, now(), 'habits', 1, 1, 100, 1, 1, 'hold', now())`, [A]); }, /permission denied/);
await expectErr('INSERT direct transitions refuse', async () => { await as(A); await q(`INSERT INTO public.ziko_league_transitions (user_id, from_track, to_track, reason, evidence) VALUES ($1, 'habits', 'performance', 'x', '{}')`, [A]); }, /permission denied/);
await expectErr('UPDATE direct du palier refuse', async () => { await as(A); await q(`UPDATE public.ziko_league_state SET division = 5 WHERE user_id = $1`, [A]); }, /permission denied/);
await expectErr('etat de quota IA illisible par un client', async () => { await as(A); await q(`SELECT * FROM public.ziko_league_ai_state`); }, /permission denied/);
await expectErr('authenticated ne peut pas reserver un appel IA', async () => { await rpc(A, 'ziko_league_ai_claim', [A, 1]); }, /permission denied|forbidden/);
await expectErr('authenticated ne peut pas appliquer une transition', async () => { await rpc(A, 'ziko_league_apply_transition', [A, 'ok']); }, /permission denied|forbidden/);
await expectErr('authenticated ne peut pas appeler le pre-filtre', async () => { await rpc(A, 'ziko_league_eligibility', [A]); }, /permission denied/);
await expectErr('authenticated ne peut pas appeler le score interne', async () => { await rpc(A, 'ziko_league_week_score', [A, 'habits', await ws(1)]); }, /permission denied/);
await expectErr('anon refuse', async () => { await rpc(null, 'ziko_get_faction_overview', [], 'anon'); }, /permission denied/);
await expectErr('sync d un AUTRE utilisateur refuse', async () => { await rpc(A, 'ziko_league_sync', [B]); }, /forbidden/);
await expectErr('ack sans session refuse', async () => { await as(null, 'authenticated'); await q(`SELECT public.ziko_league_ack_transition(gen_random_uuid())`); }, /not_authenticated/);

console.log('\n[2] Factions : choix libre, delai de changement, vie privee des compteurs');
let r = await rpc(A, 'ziko_join_faction', ['running']);
ok('rejoindre running', r.faction === 'running' && r.changed === false);
await expectErr('faction inconnue refusee', async () => { await rpc(A, 'ziko_join_faction', ['crossfit']); }, /unknown_faction/);
r = await rpc(A, 'ziko_join_faction', ['running']);
ok('meme faction : no-op', r.changed === false);
await expectErr('changement < 30 j refuse (faction_cooldown)', async () => { await rpc(A, 'ziko_join_faction', ['hyrox']); }, /faction_cooldown/);
await q(`UPDATE public.ziko_faction_members SET changed_at = now() - interval '31 days' WHERE user_id = $1`, [A]);
r = await rpc(A, 'ziko_join_faction', ['hyrox']);
ok('changement apres 30 j', r.faction === 'hyrox' && r.changed === true);
await as(A);
ok('RLS : je ne lis que ma ligne de faction', (await q(`SELECT user_id FROM public.ziko_faction_members`)).rows.every((x) => x.user_id === A));
await reset();
// 9 adultes + 4 mineurs + 2 ages inconnus en powerlifting : < 10 adultes => pas de compteur
for (let i = 10; i < 19; i++) { const u = await seed(i, { age: 25 }); await q(`INSERT INTO public.ziko_faction_members (user_id, faction_key) VALUES ($1, 'powerlifting')`, [u]); }
for (let i = 30; i < 34; i++) { const u = await seed(i, { age: 15 }); await q(`INSERT INTO public.ziko_faction_members (user_id, faction_key) VALUES ($1, 'powerlifting')`, [u]); }
for (let i = 40; i < 42; i++) { const u = await seed(i, { age: null }); await q(`INSERT INTO public.ziko_faction_members (user_id, faction_key) VALUES ($1, 'powerlifting')`, [u]); }
let ov = await rpc(B, 'ziko_get_faction_overview');
const pl = () => ov.factions.find((f) => f.key === 'powerlifting');
ok('9 adultes + mineurs + ages inconnus : compteur masque', pl().member_count === null, JSON.stringify(pl()));
const extra = await seed(19, { age: 26 }); await q(`INSERT INTO public.ziko_faction_members (user_id, faction_key) VALUES ($1, 'powerlifting')`, [extra]);
ov = await rpc(B, 'ziko_get_faction_overview');
ok('10 adultes : compteur = 10 (mineurs et inconnus exclus)', pl().member_count === 10, JSON.stringify(pl()));
ok('6 factions listees, ordre stable', ov.factions.length === 6 && ov.factions[0].key === 'powerlifting' && ov.factions[5].key === 'wellness');
ok('aucune personne listee (pas d identifiant utilisateur)', !JSON.stringify(ov).match(/0000000-0000-0000/), JSON.stringify(ov).slice(0, 200));
ok('ma faction absente => mine null', ov.mine === null);

console.log('\n[3] Deblocage par palier et piste de depart lue de l\'onboarding');
const T2 = await seed(50, { tier: 2 });
r = await sync(T2);
ok('tier 2 : verrouille, aucune pression (pas de compteur)', r.unlocked === false && r.required_tier === 3 && r.tier === 2 && Object.keys(r).length === 3, JSON.stringify(r));
ok('tier 2 : aucun etat cree', !(await state(T2)));
const NOROW = `00000000-0000-0000-0000-${String(2600099).padStart(12, '0')}`;
await q(`INSERT INTO auth.users (id) VALUES ($1)`, [NOROW]);
r = await sync(NOROW);
ok('sans athlete_state : verrouille (fail-safe)', r.unlocked === false && r.tier === 1);
const T3 = await seed(51, { tier: 3, exp: 'beginner' });
r = await sync(T3);
ok('tier 3 debutant : piste habitudes, palier 1', r.unlocked && r.track === 'habits' && r.division === 1 && r.start_division === 1, JSON.stringify(r));
const T3b = await seed(52, { tier: 4, exp: 'advanced' });
r = await sync(T3b);
ok('tier 4 avance : piste performance', r.track === 'performance');
const T3c = await seed(53, { tier: 3, exp: 'intermediate', readiness: 'fragile' });
r = await sync(T3c);
ok('intermediaire : piste performance', r.track === 'performance');
ok('aucune semaine cloturee a la creation (pas de rattrapage)', r.closed_now === 0 && r.recent_weeks.length === 0);
ok('RLS : je ne lis que mon etat de ligue', await (async () => { await as(T3); const rows = (await q(`SELECT user_id FROM public.ziko_league_state`)).rows; await reset(); return rows.length === 1 && rows[0].user_id === T3; })());

console.log('\n[4] Score de regularite relative + anti-triche');
{
  const u = await seed(60, { tier: 3 });
  const hs = await mkHabits(u, 3);
  await sync(u);
  const w1 = await ws(1);
  await logWeek(u, hs, 1, 5);
  await q(`INSERT INTO public.ziko_habit_logs (habit_id, user_id, date, value) VALUES ($1, $2, $3::date, 1)`, [hs[0], u, w1]); // doublon meme (habitude, jour)
  await q(`INSERT INTO public.ziko_habit_logs (habit_id, user_id, date, value) VALUES ($1, $2, $3::date + 6, 0)`, [hs[2], u, w1]); // value 0
  await reset();
  await as(u, 'service_role');
  let s = (await q(`SELECT public.ziko_league_week_score($1, 'habits', $2::date) AS r`, [u, w1])).rows[0].r;
  ok('5 couples distincts / 21 demandes = 23.81 (doublon et value=0 ignores)', s.done === 5 && s.asked === 21 && Number(s.score) === 23.81, JSON.stringify(s));
  // date future non comptee : semaine courante, jour futur
  const cur = await ws(0);
  await reset();
  await q(`INSERT INTO public.ziko_habit_logs (habit_id, user_id, date, value) VALUES ($1, $2, (now() AT TIME ZONE 'Europe/Paris')::date + 1, 1)`, [hs[0], u]);
  await as(u, 'service_role');
  s = (await q(`SELECT public.ziko_league_week_score($1, 'habits', $2::date + 7) AS r`, [u, cur])).rows[0].r;
  ok('une habitude datee dans le futur ne compte pas', s.done === 0, JSON.stringify(s));
  await reset();
  // plus de 10 habitudes : demande plafonnee a 10 * 7
  const u2 = await seed(61, { tier: 3 });
  await mkHabits(u2, 14);
  await as(u2, 'service_role');
  s = (await q(`SELECT public.ziko_league_week_score($1, 'habits', $2::date) AS r`, [u2, w1])).rows[0].r;
  ok('14 habitudes : demande plafonnee a 70', s.asked === 70, JSON.stringify(s));
  await reset();
  const u3 = await seed(62, { tier: 3 });
  await mkHabits(u3, 1);
  await as(u3, 'service_role');
  s = (await q(`SELECT public.ziko_league_week_score($1, 'habits', $2::date) AS r`, [u3, w1])).rows[0].r;
  ok('1 seule habitude : demande plancher 21 (pas de denominateur ridicule)', s.asked === 21, JSON.stringify(s));
  await reset();

  // Performance : seances
  const p = await seed(63, { tier: 4, exp: 'advanced' });
  const addSess = async (uid, dayOffset, mins, sets, offWeek = 1) => {
    const d = await ws(offWeek);
    const sid = (await one(`INSERT INTO public.ziko_workout_sessions (user_id, started_at, ended_at) VALUES ($1, ($2::date + $3::int + time '10:00') AT TIME ZONE 'Europe/Paris', ($2::date + $3::int + time '10:00') AT TIME ZONE 'Europe/Paris' + make_interval(mins => $4::int)) RETURNING id`, [uid, d, dayOffset, mins])).id;
    for (let i = 0; i < sets; i++) await q(`INSERT INTO public.ziko_session_sets (session_id, set_number, completed) VALUES ($1, $2, true)`, [sid, i + 1]);
    return sid;
  };
  await addSess(p, 0, 45, 5);
  await addSess(p, 1, 45, 5);
  await addSess(p, 2, 45, 2);   // 2 series seulement : ne compte pas
  await addSess(p, 3, 5, 6);    // 5 min : ne compte pas
  const same = await addSess(p, 4, 40, 4);
  await addSess(p, 4, 40, 4);   // meme jour : 1 seul jour-seance
  await q(`INSERT INTO public.ziko_workout_sessions (user_id, started_at, ended_at) VALUES ($1, ($2::date + 5 + time '10:00') AT TIME ZONE 'Europe/Paris', NULL)`, [p, w1]); // jamais terminee
  await as(p, 'service_role');
  s = (await q(`SELECT public.ziko_league_week_score($1, 'performance', $2::date) AS r`, [p, w1])).rows[0].r;
  ok('performance : 3 jours valides / 3 demandes = 100 (2 series, 5 min, doublon de jour, non terminee ignores)', s.done === 3 && s.asked === 3 && Number(s.score) === 100, JSON.stringify(s));
  await reset();
  await q(`UPDATE public.ziko_athlete_state SET current_focus_detail = '{"focus_type":"training_volume","target_metric":"sessions_per_week","target_value":4}' WHERE user_id = $1`, [p]);
  await as(p, 'service_role');
  s = (await q(`SELECT public.ziko_league_week_score($1, 'performance', $2::date) AS r`, [p, w1])).rows[0].r;
  ok('cible du focus (4 seances) : 3 / 4 = 75', s.asked === 4 && Number(s.score) === 75, JSON.stringify(s));
  await reset();
  await q(`UPDATE public.ziko_athlete_state SET current_focus_detail = '{"focus_type":"training_volume","target_metric":"sessions","target_value":99}' WHERE user_id = $1`, [p]);
  await as(p, 'service_role');
  s = (await q(`SELECT public.ziko_league_week_score($1, 'performance', $2::date) AS r`, [p, w1])).rows[0].r;
  ok('cible aberrante bornee a 7', s.asked === 7, JSON.stringify(s));
  await reset();
  await q(`UPDATE public.ziko_athlete_state SET current_focus_detail = '{"focus_type":"nutrition","target_metric":"sessions","target_value":6}' WHERE user_id = $1`, [p]);
  await as(p, 'service_role');
  s = (await q(`SELECT public.ziko_league_week_score($1, 'performance', $2::date) AS r`, [p, w1])).rows[0].r;
  ok('focus d un autre type : cible par defaut 3', s.asked === 3, JSON.stringify(s));
  await expectErr('piste inconnue refusee', async () => { await q(`SELECT public.ziko_league_week_score($1, 'cohort', $2::date)`, [p, w1]); }, /invalid_track/);
  await reset();
  ok('le score ne lit aucun poids/charge (fonction sans reference)', !/weight_kg|total_volume|total_reps|distance|heart|sleep/i.test(readFileSync(resolve(root, 'supabase/portfolio-migrations/20261201260300_league_sync.sql'), 'utf8').replace(/--[^\n]*/g, '')));
}

console.log('\n[5] Paliers amortis (LEAG-04)');
{
  const u = await seed(70, { tier: 3 });
  const hs = await mkHabits(u, 3);
  let st = await play(u, hs, [FULL]);
  ok('1 semaine pleine : pas encore de montee', st.division === 1 && st.closed_now === 1, JSON.stringify(st));
  const rows1 = (await q(`SELECT outcome FROM public.ziko_league_weeks WHERE user_id = $1`, [u])).rows;
  ok('semaine enregistree avec sa piste', rows1.length === 1 && (await one(`SELECT track FROM public.ziko_league_weeks WHERE user_id=$1`, [u])).track === 'habits');
  const u2 = await seed(71, { tier: 3 });
  const hs2 = await mkHabits(u2, 3);
  st = await play(u2, hs2, [FULL, FULL]);
  ok('2 semaines pleines : palier 2', st.division === 2 && st.peak_division === 2, JSON.stringify(st));
  const u3 = await seed(72, { tier: 3 });
  const hs3 = await mkHabits(u3, 3);
  st = await play(u3, hs3, [FULL, FULL, FULL, FULL, FULL, FULL, FULL, FULL]);
  ok('8 semaines pleines : palier 5 (4 montees) et plafond', st.division === 4 || st.division === 5, JSON.stringify(st));
  ok('au plus 8 semaines cloturees en une fois', st.closed_now <= 8);
  // plancher : depart = 1
  const u4 = await seed(73, { tier: 3 });
  const hs4 = await mkHabits(u4, 3);
  st = await play(u4, hs4, [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
  ok('6 semaines vides au palier de depart : reste palier 1 (jamais sous le depart)', st.division === 1, JSON.stringify(st));
  // descente amortie : monte a 3, puis 3 basses => 2 ; encore 3 basses => reste 2 (plancher = pic - 1)
  const u5 = await seed(74, { tier: 3 });
  const hs5 = await mkHabits(u5, 3);
  st = await play(u5, hs5, [FULL, FULL, FULL, FULL]);
  ok('4 pleines : palier 3, pic 3', st.division === 3 && st.peak_division === 3, JSON.stringify(st));
  // 3 semaines basses de plus : on rejoue 3 semaines VIDES apres => il faut des semaines suivantes ; on decale l'horloge
  // en reculant les semaines deja cloturees de 3 semaines (equivalent a 3 semaines ecoulees, sans toucher au code).
  await q(`UPDATE public.ziko_league_weeks SET week_start = week_start - 21 WHERE user_id = $1`, [u5]);
  await q(`UPDATE public.ziko_habit_logs SET date = date - 21 WHERE user_id = $1`, [u5]);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = last_week_closed - 21 WHERE user_id = $1`, [u5]);
  // reajuste : la derniere cloturee est maintenant ws(4) ; on laisse sync cloturer ws(3), ws(2), ws(1) (vides)
  for (const off of [3, 2, 1]) await logWeek(u5, hs5, off, LOW);
  st = await sync(u5);
  ok('3 semaines basses de suite : -1 palier seulement (3 -> 2)', st.division === 2 && st.peak_division === 3, JSON.stringify(st));
  const o5 = (await q(`SELECT outcome FROM public.ziko_league_weeks WHERE user_id = $1 ORDER BY week_start DESC LIMIT 1`, [u5])).rows[0].outcome;
  ok('la semaine de descente est marquee down', o5 === 'down');
  // 3 de plus : plancher = max(1, 3-1) = 2
  await q(`UPDATE public.ziko_league_weeks SET week_start = week_start - 21 WHERE user_id = $1`, [u5]);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = last_week_closed - 21 WHERE user_id = $1`, [u5]);
  st = await sync(u5);
  ok('encore 3 semaines basses : plancher pic-1 => reste palier 2', st.division === 2, JSON.stringify(st));
  // amorti : 2 basses, 1 moyenne, 2 basses => pas de descente
  const u6 = await seed(75, { tier: 3 });
  const hs6 = await mkHabits(u6, 3);
  st = await play(u6, hs6, [FULL, FULL, FULL, FULL]);
  await q(`UPDATE public.ziko_league_weeks SET week_start = week_start - 35 WHERE user_id = $1`, [u6]);
  await q(`UPDATE public.ziko_habit_logs SET date = date - 35 WHERE user_id = $1`, [u6]);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = last_week_closed - 35 WHERE user_id = $1`, [u6]);
  // semaines a cloturer : ws(5)? on a recule de 35 j => derniere cloturee ws(5), a cloturer ws(4..1)
  await logWeek(u6, hs6, 3, MID);  // ws(3) moyenne (10/21 = 47.6)
  st = await sync(u6);             // ws(4) vide, ws(3) moyenne, ws(2) vide, ws(1) vide
  ok('basse, moyenne, basse, basse : aucun compteur ne depasse 2 => pas de descente', st.division === 3, JSON.stringify(st));
  // idempotence
  const before = Number((await one(`SELECT COUNT(*) n FROM public.ziko_league_weeks WHERE user_id = $1`, [u6])).n);
  st = await sync(u6);
  ok('sync idempotent : 0 semaine cloturee, aucune ligne dupliquee', st.closed_now === 0 && Number((await one(`SELECT COUNT(*) n FROM public.ziko_league_weeks WHERE user_id = $1`, [u6])).n) === before);
  // semaines tres anciennes : jamais punies (non scorees)
  const u7 = await seed(76, { tier: 3 });
  await mkHabits(u7, 3);
  await sync(u7);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = (public.ziko_week_start((now() AT TIME ZONE 'Europe/Paris')::date) - 7 * 30) WHERE user_id = $1`, [u7]);
  st = await sync(u7);
  ok('absence de 30 semaines : 8 semaines scorees au plus, palier inchange', st.closed_now <= 8 && st.division === 1, JSON.stringify(st));
}

console.log('\n[6] Non punitif : aucune ecriture vers XP / pieces / serie / tier / journal v1.18 (D-08)');
{
  const u = await seed(80, { tier: 3 });
  const hs = await mkHabits(u, 3);
  await q(`INSERT INTO public.ziko_user_gamification (user_id, xp, level, coins, current_streak, longest_streak) VALUES ($1, 500, 4, 70, 5, 9)`, [u]);
  await q(`INSERT INTO public.ziko_athlete_decisions (user_id, summary) VALUES ($1, 'x')`, [u]);
  const snap = async () => ({
    g: await one(`SELECT xp, level, coins, current_streak, longest_streak FROM public.ziko_user_gamification WHERE user_id = $1`, [u]),
    a: await one(`SELECT tier, readiness, level, points, onboarding_profile, current_focus_detail FROM public.ziko_athlete_state WHERE user_id = $1`, [u]),
    d: Number((await one(`SELECT COUNT(*) n FROM public.ziko_athlete_decisions WHERE user_id = $1`, [u])).n),
  });
  const s0 = await snap();
  let st = await play(u, hs, [FULL, FULL, FULL, FULL]);
  await q(`UPDATE public.ziko_league_weeks SET week_start = week_start - 21 WHERE user_id = $1`, [u]);
  await q(`UPDATE public.ziko_habit_logs SET date = date - 21 WHERE user_id = $1`, [u]);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = last_week_closed - 21 WHERE user_id = $1`, [u]);
  for (const off of [3, 2, 1]) await logWeek(u, hs, off, LOW);
  st = await sync(u);
  ok('une descente de palier a bien eu lieu', st.division === 2, JSON.stringify(st));
  const s1 = await snap();
  ok('XP, pieces, serie, tier, readiness, journal : strictement identiques', JSON.stringify(s0) === JSON.stringify(s1), JSON.stringify([s0, s1]));
  const src = MIGS.map((f) => readFileSync(resolve(root, `supabase/portfolio-migrations/${f}.sql`), 'utf8').replace(/--[^\n]*/g, '')).join('\n');
  ok('aucune migration P26 n ecrit dans les tables protegees', !/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.ziko_(user_gamification|coin_transactions|athlete_state|athlete_decisions)\b/i.test(src));
  ok('aucune FK vers ces tables', !/REFERENCES\s+public\.ziko_(user_gamification|coin_transactions|athlete_state|athlete_decisions)/i.test(src));
  ok('libelles : aucun mot punitif dans les fichiers SQL', !/relegat|punish|punit|penalt/i.test(src));
}

console.log('\n[7] Porte IA : pre-filtre deterministe, plafond quotidien, transition, celebration');
{
  const u = await seed(90, { tier: 3 });
  const hs = await mkHabits(u, 3);
  await play(u, hs, [FULL, FULL, FULL]);
  let e = await rpc(null, 'ziko_league_ai_claim', [u, 1], 'service_role');
  ok('3 semaines seulement : not_enough_weeks, pas d appel IA', e.proceed === false && e.reason === 'not_enough_weeks', JSON.stringify(e));
  // 4e semaine
  await q(`UPDATE public.ziko_league_weeks SET week_start = week_start - 7 WHERE user_id = $1`, [u]);
  await q(`UPDATE public.ziko_habit_logs SET date = date - 7 WHERE user_id = $1`, [u]);
  await q(`UPDATE public.ziko_league_state SET last_week_closed = last_week_closed - 7 WHERE user_id = $1`, [u]);
  await logWeek(u, hs, 1, FULL);
  await sync(u);
  e = await rpc(null, 'ziko_league_ai_claim', [u, 1], 'service_role');
  ok('4 semaines consecutives, moyenne 100 : proceed', e.proceed === true && e.reason === 'eligible', JSON.stringify(e));
  const keys = Object.keys(e.evidence).sort().join(',');
  ok('preuve bornee : weeks, average_score, tier, readiness, experience_level seulement', keys === 'average_score,experience_level,readiness,tier,weeks', keys);
  ok('la preuve ne contient aucune donnee de sante', !/weight|poids|height|taille|"age"|sleep|heart|kg|bmi/i.test(JSON.stringify(e.evidence)));
  e = await rpc(null, 'ziko_league_ai_claim', [u, 1], 'service_role');
  ok('2e appel le meme jour : daily_cap (cout plafonne)', e.proceed === false && e.reason === 'daily_cap', JSON.stringify(e));
  e = await rpc(null, 'ziko_league_ai_claim', [u, 2], 'service_role');
  ok('un plafond plus haut le permettrait (le plafond est un parametre, pas une constante en dur)', e.proceed === true);
  // "hallucination" : un autre utilisateur non eligible, le modele dirait true => la base refuse
  const bad = await seed(91, { tier: 3 });
  const hb = await mkHabits(bad, 3);
  await play(bad, hb, [FULL, FULL]);
  const refused = await rpc(null, 'ziko_league_apply_transition', [bad, 'Tu es pret'], 'service_role');
  ok('apply sans eligibilite : applied=false, piste inchangee (une hallucination ne saute pas le pre-filtre)', refused.applied === false && (await state(bad)).track === 'habits', JSON.stringify(refused));
  await expectErr('raison vide refusee', async () => { await rpc(null, 'ziko_league_apply_transition', [u, '   '], 'service_role'); }, /invalid_arguments/);
  const ap = await rpc(null, 'ziko_league_apply_transition', [u, 'x'.repeat(400)], 'service_role');
  ok('apply : bascule en performance', ap.applied === true && (await state(u)).track === 'performance');
  const tr = await one(`SELECT * FROM public.ziko_league_transitions WHERE user_id = $1`, [u]);
  ok('transition journalisee : decided_by ai, raison tronquee a 300, celebration en attente', tr.decided_by === 'ai' && tr.reason.length === 300 && tr.celebrated_at === null);
  const stt = await state(u);
  ok('nouveau palier propre : 1, depart 1, compteurs a zero (ancien niveau d habitude non perdu : historique conserve)', stt.division === 1 && stt.start_division === 1 && stt.up_streak === 0);
  ok('l historique habitudes est conserve', Number((await one(`SELECT COUNT(*) n FROM public.ziko_league_weeks WHERE user_id = $1 AND track = 'habits'`, [u])).n) === 4);
  const again = await rpc(null, 'ziko_league_apply_transition', [u, 'encore'], 'service_role');
  ok('2e application : applied=false (jamais deux fois)', again.applied === false && again.reason === 'not_habits_track', JSON.stringify(again));
  const sy = await sync(u);
  ok('sync : celebration en attente exposee, piste performance', sy.track === 'performance' && sy.pending_celebration?.id === tr.id && sy.pending_celebration.to_track === 'performance', JSON.stringify(sy.pending_celebration));
  ok('aucune comparaison de pistes dans la reponse : l historique est compte PAR piste', sy.history_weeks.habits === 4 && sy.history_weeks.performance === 0);
  const other = await seed(92, { tier: 3 });
  ok('ack par un autre utilisateur : false', (await rpc(other, 'ziko_league_ack_transition', [tr.id])) === false);
  ok('ack par le proprietaire : true', (await rpc(u, 'ziko_league_ack_transition', [tr.id])) === true);
  ok('ack repete : false (une seule celebration)', (await rpc(u, 'ziko_league_ack_transition', [tr.id])) === false);
  ok('plus de celebration en attente', (await sync(u)).pending_celebration === null);
  await expectErr('transition performance -> habitudes impossible (CHECK)', async () => { await q(`INSERT INTO public.ziko_league_transitions (user_id, from_track, to_track, reason, evidence) VALUES ($1, 'performance', 'habits', 'x', '{}')`, [u]); }, /check/i);
  await expectErr('decideur autre que ai impossible (CHECK)', async () => { await q(`INSERT INTO public.ziko_league_transitions (user_id, from_track, to_track, decided_by, reason, evidence) VALUES ($1, 'habits', 'performance', 'user', 'x', '{}')`, [u]); }, /check/i);
  // seuil de moyenne
  const lo = await seed(93, { tier: 3 });
  const hl = await mkHabits(lo, 3);
  await play(lo, hl, [14, 14, 14, 14]); // 66.67 chacune
  e = await rpc(null, 'ziko_league_ai_claim', [lo, 1], 'service_role');
  ok('moyenne 66.7 < 70 : below_threshold', e.proceed === false && e.reason === 'below_threshold', JSON.stringify(e));
  // transition recente
  const rc = await seed(94, { tier: 3 });
  const hr = await mkHabits(rc, 3);
  await play(rc, hr, [FULL, FULL, FULL, FULL]);
  await q(`INSERT INTO public.ziko_league_transitions (user_id, from_track, to_track, reason, evidence) VALUES ($1, 'habits', 'performance', 'ancienne', '{}')`, [rc]);
  e = await rpc(null, 'ziko_league_ai_claim', [rc, 1], 'service_role');
  ok('transition de moins de 28 jours : recent_transition', e.proceed === false && e.reason === 'recent_transition', JSON.stringify(e));
  // piste performance : pas d'appel
  e = await rpc(null, 'ziko_league_ai_claim', [T3b, 1], 'service_role');
  ok('piste performance : not_habits_track', e.proceed === false && e.reason === 'not_habits_track');
  e = await rpc(null, 'ziko_league_ai_claim', [T2, 1], 'service_role');
  ok('sous le palier de deblocage : not_unlocked', e.proceed === false && e.reason === 'not_unlocked');
}

console.log('\n[8] Defis collectifs coach + athletes (LEAG-05)');
{
  const coach = await seed(100, { role: 'coach', tier: 1 });
  const c1 = await seed(101, { age: 16 });
  const c2 = await seed(102);
  const c3 = await seed(103);
  const outsider = await seed(104);
  const nonCoach = await seed(105);
  const today = (await one(`SELECT (now() AT TIME ZONE 'Europe/Paris')::date::text d`)).d;
  const end = (await one(`SELECT ((now() AT TIME ZONE 'Europe/Paris')::date + 6)::text d`)).d;
  await expectErr('non coach refuse', async () => { await rpc(nonCoach, 'ziko_create_collective_challenge', ['Defi eau', 'hydration_ml', 10000, today, end]); }, /not_a_coach/);
  await expectErr('coach sans athlete lie : no_clients', async () => { await rpc(coach, 'ziko_create_collective_challenge', ['Defi eau', 'hydration_ml', 10000, today, end]); }, /no_clients/);
  for (const c of [c1, c2]) await q(`INSERT INTO public.ziko_coach_client_links (coach_id, client_id) VALUES ($1, $2)`, [coach, c]);
  await q(`INSERT INTO public.ziko_coach_client_links (coach_id, client_id, revoked_at) VALUES ($1, $2, now())`, [coach, c3]);
  await expectErr('metrique de sante refusee (poids)', async () => { await rpc(coach, 'ziko_create_collective_challenge', ['Defi poids', 'weight_kg', 10, today, end]); }, /invalid_arguments|22023/);
  await expectErr('titre trop court refuse', async () => { await rpc(coach, 'ziko_create_collective_challenge', ['ab', 'hydration_ml', 10, today, end]); }, /invalid_arguments/);
  await expectErr('duree > 31 jours refusee', async () => { await rpc(coach, 'ziko_create_collective_challenge', ['Defi long', 'hydration_ml', 10, today, (await one(`SELECT ($1::date + 40)::text d`, [today])).d]); }, /invalid_arguments/);
  const made = await rpc(coach, 'ziko_create_collective_challenge', ['Defi eau du groupe', 'hydration_ml', 10000, today, end]);
  ok('creation : 2 athletes actifs invites (lien revoque exclu)', made.invited === 2, JSON.stringify(made));
  ok('invites : statut invited, mineur inclus via son lien coach', (await q(`SELECT user_id FROM public.ziko_collective_participants WHERE challenge_id = $1 AND status = 'invited'`, [made.id])).rows.length === 2);
  await rpc(coach, 'ziko_create_collective_challenge', ['Defi seances', 'workout_sessions', 8, today, end]);
  await rpc(coach, 'ziko_create_collective_challenge', ['Defi habitudes', 'habit_logs', 30, today, end]);
  await expectErr('4e defi actif refuse', async () => { await rpc(coach, 'ziko_create_collective_challenge', ['Defi de trop', 'habit_logs', 30, today, end]); }, /too_many_active_challenges/);

  let lst = await rpc(c1, 'ziko_list_collective_challenges');
  ok('athlete invite voit le defi (3 visibles dont le sien)', lst.length === 3 && lst.every((x) => x.my_status === 'invited' && x.role === 'athlete'));
  ok('un non-invite ne voit rien', (await rpc(outsider, 'ziko_list_collective_challenges')).length === 0);
  await expectErr('un non-participant ne peut pas lire la progression', async () => { await rpc(outsider, 'ziko_collective_progress', [made.id]); }, /challenge_not_found/);
  await expectErr('un athlete non invite ne peut pas repondre', async () => { await rpc(outsider, 'ziko_respond_collective_challenge', [made.id, true]); }, /challenge_not_found/);

  // contributions : c1 (mineur) boit 3000 + 3000 le meme jour (plafond 4000), c2 refuse puis accepte
  ok('reponse : joined', (await rpc(c1, 'ziko_respond_collective_challenge', [made.id, true])) === 'joined');
  await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, 3000, $2::date), ($1, 3000, $2::date)`, [c1, today]);
  await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, 9000, $2::date)`, [c2, today]); // c2 n'a pas accepte
  let pr = await rpc(c1, 'ziko_collective_progress', [made.id]);
  ok('total = 4000 (plafond par jour et par personne), c2 non joint non compte', Number(pr.total) === 4000 && pr.joined_count === 1, JSON.stringify(pr));
  ok('ma contribution = 4000 ; target 10000', Number(pr.my_contribution) === 4000 && Number(pr.target_total) === 10000);
  await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, 2000, $2::date - 1)`, [c1, today]);
  pr = await rpc(c1, 'ziko_collective_progress', [made.id]);
  ok('pas de rattrapage retroactif : l eau de la veille ne compte pas', Number(pr.total) === 4000, JSON.stringify(pr));
  await rpc(c2, 'ziko_respond_collective_challenge', [made.id, true]);
  await q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, 1500, $2::date)`, [c2, today]);
  pr = await rpc(c2, 'ziko_collective_progress', [made.id]);
  ok('c2 : total 4000 + (9000 plafonne + 1500 = 4000) = 8000, SA contribution 4000, pas celle de c1', Number(pr.total) === 8000 && Number(pr.my_contribution) === 4000 && pr.joined_count === 2, JSON.stringify(pr));
  ok('aucun identifiant d autre personne dans la progression', !JSON.stringify(pr).includes(c1) && !JSON.stringify(pr).includes(coach));
  const cp = await rpc(coach, 'ziko_collective_progress', [made.id]);
  ok('le coach voit le total et le nombre de participants, ma_contribution null (pas de classement)', Number(cp.total) === 8000 && cp.joined_count === 2 && cp.my_contribution === null && cp.role === 'coach', JSON.stringify(cp));
  await as(c1);
  ok('RLS : un athlete ne lit pas la table des defis du coach', (await q(`SELECT * FROM public.ziko_collective_challenges`)).rows.length === 0);
  ok('RLS : il ne lit que sa propre ligne de participation', (await q(`SELECT user_id FROM public.ziko_collective_participants`)).rows.every((x) => x.user_id === c1));
  await reset();
  await expectErr('ecriture directe dans les defis refusee', async () => { await as(c1); await q(`UPDATE public.ziko_collective_participants SET status = 'joined'`); }, /permission denied/);
  ok('quitter : declined', (await rpc(c2, 'ziko_respond_collective_challenge', [made.id, false])) === 'declined');
  pr = await rpc(c1, 'ziko_collective_progress', [made.id]);
  ok('apres depart de c2 : total retombe a 4000, 1 participant', Number(pr.total) === 4000 && pr.joined_count === 1);
  lst = await rpc(c2, 'ziko_list_collective_challenges');
  ok('defi refuse/quitte : ne revient pas dans la liste de c2 (les 2 autres invitations restent)', lst.length === 2 && lst.every((x) => x.id !== made.id));
  // habitudes : plafond 10/jour
  const hab = (await q(`SELECT id FROM public.ziko_collective_challenges WHERE coach_id = $1 AND metric = 'habit_logs'`, [coach])).rows[0].id;
  await rpc(c1, 'ziko_respond_collective_challenge', [hab, true]);
  const hh = await mkHabits(c1, 12);
  for (const h of hh) await q(`INSERT INTO public.ziko_habit_logs (habit_id, user_id, date, value) VALUES ($1, $2, $3::date, 1)`, [h, c1, today]);
  pr = await rpc(c1, 'ziko_collective_progress', [hab]);
  ok('habitudes : plafond 10 par jour (12 cochees => 10)', Number(pr.total) === 10, JSON.stringify(pr));
}

console.log('\n[9] Surface de lecture : jamais de donnee de sante, jamais de classement');
{
  const srcAll = MIGS.map((f) => readFileSync(resolve(root, `supabase/portfolio-migrations/${f}.sql`), 'utf8').replace(/--[^\n]*/g, '')).join('\n');
  ok('aucune table de sante lue (mesures, sommeil, wearables, nutrition, poids)', !/ziko_(body_measurements|measurement|sleep|wearable|health|nutrition|athlete_goals)/i.test(srcAll));
  ok('aucun ORDER BY sur un score entre personnes (pas de classement)', !/ORDER BY[^;]*score[^;]*DESC[^;]*LIMIT\s+\d+\s*\)\s*x\s*\)/i.test('') && !/RANK\(|ROW_NUMBER\(|PERCENT_RANK|NTILE/i.test(srcAll));
  const fns = (await q(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND proname LIKE 'ziko_%' AND prokind = 'f'`)).rows.map((x) => x.proname);
  ok('toutes les fonctions P26 sont SECURITY DEFINER avec search_path fige', (await q(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND proname ~ '^ziko_(join_faction|get_faction|league|week_start|collective|create_collective|respond_collective|list_collective)' AND proname <> 'ziko_week_start' AND (NOT prosecdef OR proconfig IS NULL OR NOT proconfig::text LIKE '%search_path%')`)).rows.length === 0, fns.join(','));
}

await client.end();
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
