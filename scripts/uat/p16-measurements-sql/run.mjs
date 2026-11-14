// Rejoue les migrations P12..P16 sur un Postgres LOCAL jetable et verifie les RPC d'objectifs de mesures de la
// phase 16 (creation service_role, modification encadree + historique, acquittement) et la metrique de quete
// measurement_logs (MEAS-09). Stubs : memes que P12/P13 + tables objectifs/mesures (comme le harnais P15).
// Usage : P16_PG_URL=postgres://postgres@127.0.0.1:<port>/p16 node scripts/uat/p16-measurements-sql/run.mjs
// Garde-fou : refuse toute URL non locale. Ne touche JAMAIS le projet Supabase portfolio.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const url = process.env.P16_PG_URL;
if (!url) { console.log('P16_PG_URL absent : harnais SQL non execute (SKIP).'); process.exit(0); }
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
  try { await fn(); ok(name, false, "(pas d'erreur)"); } catch (e) { ok(name, re.test(String(e.message)), e.message); }
  await q('RESET ROLE').catch(() => {});
};
const svc = async (uid, sql, params) => { await as(uid, 'service_role'); try { return (await q(sql, params)).rows[0]; } finally { await reset(); } };
const create = (uid, key, start, target, date = null) => svc(uid, `SELECT public.ziko_ai_create_measurement_goal($1,$2,$3,$4,$5::date) AS r`, [uid, key, start, target, date]).then((x) => x.r);
const revise = (uid, goal, reason, target, date = null, statement = null) =>
  svc(uid, `SELECT public.ziko_ai_revise_measurement_goal($1,$2,$3,$4,$5::date,'detail test',$6) AS r`, [uid, goal, reason, target, date, statement]).then((x) => x.r);

await q('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public;');
await q(readFileSync(resolve(root, 'scripts/uat/p12-rewards-sql/stub-schema.sql'), 'utf8'));
await q(readFileSync(resolve(root, 'scripts/uat/p13-quests-sql/stub-extra.sql'), 'utf8'));
await q(`
CREATE OR REPLACE FUNCTION public.ziko_handle_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TABLE IF NOT EXISTS public.ziko_athlete_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
  goal_text text NOT NULL, target_metric text, target_value numeric, target_date date,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active','achieved','abandoned')),
  created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TRIGGER trg_athlete_goals_updated BEFORE UPDATE ON public.ziko_athlete_goals FOR EACH ROW EXECUTE FUNCTION public.ziko_handle_updated_at();
ALTER TABLE public.ziko_athlete_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY g_sel ON public.ziko_athlete_goals FOR SELECT USING (auth.uid() = user_id);
REVOKE ALL ON public.ziko_athlete_goals FROM PUBLIC; GRANT SELECT ON public.ziko_athlete_goals TO authenticated;
CREATE TABLE IF NOT EXISTS public.ziko_body_measurements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
  weight_kg numeric(5,2), body_fat_pct numeric(4,1), waist_cm numeric(5,1), chest_cm numeric(5,1),
  arm_cm numeric(5,1), thigh_cm numeric(5,1), hip_cm numeric(5,1), photo_url text,
  date date DEFAULT CURRENT_DATE NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public.ziko_body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY m_own ON public.ziko_body_measurements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ziko_body_measurements TO authenticated;
`);
for (const f of ['20261201120100_badge_award_and_progress', '20261201130100_quest_tables', '20261201130200_quest_functions', '20261201140100_quest_ai_state', '20261201140200_quest_sync_ai_handover',
  '20261201150100_measurement_goals_extend', '20261201150200_measurement_goals_achieved_trigger', '20261201160100_ai_measurement_goals', '20261201160200_quest_measurement_metric']) {
  await q(readFileSync(resolve(root, `supabase/portfolio-migrations/${f}.sql`), 'utf8'));
}
console.log('Migrations 1201, 1301, 1302, 1401, 1402, 1501, 1502, 1601, 1602 appliquees sur la base locale jetable.');

const U = (n) => `00000000-0000-0000-0000-00000000060${n}`;
const [U1, U2, U3] = [1, 2, 3].map(U);
await q(`INSERT INTO auth.users (id) SELECT unnest($1::uuid[])`, [[U1, U2, U3]]);

console.log('\n[1] Droits : creation / modification reservees a service_role');
await expectErr('authenticated ne peut pas creer via la RPC IA', async () => { await as(U1); await q(`SELECT public.ziko_ai_create_measurement_goal($1,'weight_kg',80,75,NULL)`, [U1]); }, /permission denied|forbidden/);
await expectErr('authenticated ne peut pas reviser', async () => { await as(U1); await q(`SELECT public.ziko_ai_revise_measurement_goal($1,$1,'stagnation',70,NULL,NULL,NULL)`, [U1]); }, /permission denied|forbidden/);
await expectErr('anon refuse', async () => { await as(null, 'anon'); await q(`SELECT public.ziko_ai_create_measurement_goal($1,'weight_kg',80,75,NULL)`, [U1]); }, /permission denied|forbidden/);

console.log('\n[2] Creation');
let r = await create(U1, 'weight_kg', 90, 80, '2099-01-01');
ok('creation poids 90 -> 80', r.success === true, JSON.stringify(r));
const g1 = r.goal_id;
const row = (await q(`SELECT * FROM public.ziko_athlete_goals WHERE id=$1`, [g1])).rows[0];
ok('ligne : depart 90, cible 80, kg, active, libelle', Number(row.start_value) === 90 && Number(row.target_value) === 80 && row.unit === 'kg' && row.status === 'active' && row.goal_text === 'Poids 90.0 -> 80.0 kg', JSON.stringify(row));
ok('2e objectif actif meme mesure refuse', (await create(U1, 'weight_kg', 88, 78)).error === 'active_goal_exists');
ok('cible = depart refusee', (await create(U1, 'arm_cm', 35, 35)).error === 'target_equals_start');
ok('hors plage refuse', (await create(U1, 'weight_kg', 80, 5)).error === 'out_of_range');
ok('mesure invalide refusee', (await create(U1, 'bmi', 20, 25)).error === 'invalid_measure');
ok('date cible passee refusee', (await create(U1, 'hip_cm', 100, 95, '2020-01-01')).error === 'target_date_in_past');

console.log('\n[3] Modification encadree (MEAS-07)');
ok('motif hors liste refuse', (await revise(U1, g1, 'user_wants_easier', 85)).error === 'reason_not_allowed');
ok('blessure sans phrase refusee', (await revise(U1, g1, 'injury_pause', null, '2099-06-01')).error === 'user_statement_required');
ok('aucun changement refuse', (await revise(U1, g1, 'stagnation', 80, '2099-01-01')).error === 'no_change');
ok('cible = depart refusee', (await revise(U1, g1, 'stagnation', 90)).error === 'target_equals_start');
ok('changement de sens refuse (stagnation, cible 95 > depart 90)', (await revise(U1, g1, 'stagnation', 95)).error === 'direction_change_not_allowed');
ok('objectif d un autre utilisateur introuvable', (await revise(U2, g1, 'stagnation', 85)).error === 'goal_not_found_or_inactive');
r = await revise(U1, g1, 'stagnation', 85);
ok('stagnation 80 -> 85 acceptee', r.success === true && Number(r.old_target) === 80 && Number(r.new_target) === 85, JSON.stringify(r));
const after = (await q(`SELECT target_value, start_value, goal_text FROM public.ziko_athlete_goals WHERE id=$1`, [g1])).rows[0];
ok('cible mise a jour, depart intact, libelle recalcule', Number(after.target_value) === 85 && Number(after.start_value) === 90 && after.goal_text === 'Poids 90.0 -> 85.0 kg', JSON.stringify(after));
ok('la porte du verrou est refermee apres la RPC', (await q(`SELECT coalesce(current_setting('ziko.allow_goal_edit', true),'') AS v`)).rows[0].v !== 'on');
ok('2e modification < 14 j refusee', (await revise(U1, g1, 'pace', 86)).error === 'revision_too_soon');
const revs = (await q(`SELECT * FROM public.ziko_goal_revisions WHERE goal_id=$1`, [g1])).rows;
ok('historique : 1 ligne, motif, anciennes/nouvelles cibles, non acquittee', revs.length === 1 && revs[0].reason === 'stagnation' && Number(revs[0].old_target) === 80 && Number(revs[0].new_target) === 85 && revs[0].acknowledged_at === null);
await q(`UPDATE public.ziko_goal_revisions SET created_at = now() - interval '20 days' WHERE goal_id=$1`, [g1]);
r = await revise(U1, g1, 'injury_pause', null, '2099-09-01', 'entorse de la cheville');
ok('apres 14 j : blessure avec phrase + nouvelle date acceptee', r.success === true && String(r.new_target_date).startsWith('2099-09-01'), JSON.stringify(r));
r = await revise(U1, g1, 'main_goal_change', 100, null, 'je veux prendre de la masse');
ok('changement d objectif principal : le sens peut changer mais 14 j non ecoules -> refuse', r.error === 'revision_too_soon', JSON.stringify(r));
await q(`UPDATE public.ziko_goal_revisions SET created_at = now() - interval '20 days' WHERE goal_id=$1`, [g1]);
r = await revise(U1, g1, 'main_goal_change', 100, null, 'je veux prendre de la masse');
ok('changement d objectif principal autorise le changement de sens', r.success === true, JSON.stringify(r));

console.log('\n[4] Verrou client conserve (MEAS-06) et lecture / acquittement (MEAS-08)');
await expectErr('UPDATE direct client refuse', async () => { await as(U1); await q(`UPDATE public.ziko_athlete_goals SET target_value = 1 WHERE id=$1`, [g1]); }, /permission denied/);
await expectErr('INSERT direct dans l historique refuse', async () => { await as(U1); await q(`INSERT INTO public.ziko_goal_revisions (user_id, goal_id, measure_key, reason, old_target, new_target) VALUES ($1,$2,'weight_kg','pace',1,2)`, [U1, g1]); }, /permission denied/);
await as(U1);
ok('le proprietaire lit son historique', (await q(`SELECT count(*)::int AS n FROM public.ziko_goal_revisions`)).rows[0].n === 3);
const revId = (await q(`SELECT id FROM public.ziko_goal_revisions ORDER BY created_at DESC LIMIT 1`)).rows[0].id;
await as(U2);
ok('un autre utilisateur ne voit rien', (await q(`SELECT count(*)::int AS n FROM public.ziko_goal_revisions`)).rows[0].n === 0);
ok('un autre utilisateur ne peut pas acquitter', (await q(`SELECT public.ziko_ack_goal_revision($1) AS r`, [revId])).rows[0].r === false);
await as(U1);
ok('le proprietaire acquitte', (await q(`SELECT public.ziko_ack_goal_revision($1) AS r`, [revId])).rows[0].r === true);
ok('acquittement idempotent (2e = false)', (await q(`SELECT public.ziko_ack_goal_revision($1) AS r`, [revId])).rows[0].r === false);
await reset();

console.log('\n[5] Couplage quetes (MEAS-09) : metrique measurement_logs');
const qr = await svc(U3, `SELECT public.ziko_create_quests($1, $2::jsonb) AS r`, [U3, JSON.stringify([{ title: 'Mets a jour ton poids', metric: 'measurement_logs', target: 2, scope: 'weekly', duration_hours: 168, reward_coins: 40, ai_meta: { goal_id: g1, measure_key: 'weight_kg' } }])]);
ok('quete measurement_logs creee (CHECK + whitelist etendus)', Array.isArray(qr.r.created) && qr.r.created.length === 1, JSON.stringify(qr));
await expectErr('metrique inconnue toujours refusee', async () => { await as(U3, 'service_role'); await q(`SELECT public.ziko_create_quests($1, $2::jsonb)`, [U3, JSON.stringify([{ title: 'x', metric: 'steps', target: 1 }])]); }, /invalid_metric/);
await q(`INSERT INTO public.ziko_body_measurements (user_id, weight_kg, date) VALUES ($1, 86, CURRENT_DATE), ($1, 85.5, CURRENT_DATE)`, [U3]);
await as(U3);
let sync = (await q(`SELECT public.ziko_sync_quests($1) AS r`, [U3])).rows[0].r;
await reset();
const mq = sync.quests.find((x) => x.metric === 'measurement_logs');
ok('progression = nombre de saisies de la periode (2)', mq && Number(mq.progress) === 2 && mq.status === 'completed', JSON.stringify(mq));
ok('metadonnees de couplage conservees', (await q(`SELECT ai_meta FROM public.ziko_user_quests WHERE metric='measurement_logs' AND user_id=$1`, [U3])).rows[0].ai_meta.goal_id === g1);
const cap = await svc(U3, `SELECT public.ziko_create_ai_quests($1, $2::jsonb) AS r`, [U3, JSON.stringify([{ title: 'a', metric: 'measurement_logs', target: 1, scope: 'daily', duration_hours: 24, reward_coins: 5 }, { title: 'b', metric: 'measurement_logs', target: 1, scope: 'daily', duration_hours: 24, reward_coins: 5 }, { title: 'c', metric: 'measurement_logs', target: 1, scope: 'daily', duration_hours: 24, reward_coins: 5 }, { title: 'd', metric: 'measurement_logs', target: 1, scope: 'daily', duration_hours: 24, reward_coins: 5 }])]);
ok('le plafond de 3 actives de P14 reste applique (4 proposees -> 3 max)', cap.r.created.length <= 3 && cap.r.skipped >= 1, JSON.stringify(cap));

await client.end();
console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
