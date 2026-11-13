// Harnais de non-regression SQL du durcissement securite v1.20 (migrations 202612012701/2702/2703).
// Sur un Postgres LOCAL jetable : (A) etat AVANT = corps historiques + attaques de l'audit qui REUSSISSENT ;
// (B) application des migrations (deux fois : idempotence) ; (C) memes attaques qui ECHOUENT + flux legitimes qui PASSENT.
// Usage : SEC_PG_URL=postgres://postgres@127.0.0.1:<port>/sec node scripts/uat/sec-sql/run.mjs
// Garde-fou : refuse toute URL non locale. Ne touche JAMAIS le projet portfolio.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const url = process.env.SEC_PG_URL;
if (!url) { console.log('SEC_PG_URL absent : harnais SQL non execute (SKIP).'); process.exit(0); }
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error('Refus : URL non locale.'); process.exit(2); }

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("SET lc_messages = 'C'");
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS ${name}`); } else { fail++; console.log(`  FAIL ${name} ${extra}`); } };
const q = (sql, params) => client.query(sql, params);
const as = async (uid, role = 'authenticated') => {
  await q('RESET ROLE');
  await q(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [uid ?? '', role ?? '']);
  if (role) await q(`SET ROLE ${role}`);
};
const reset = async () => { await q('RESET ROLE'); await q(`SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)`); };
const mig = (f) => readFileSync(resolve(root, `supabase/migrations/${f}.sql`), 'utf8');
// Execute fn et renvoie { r } ou { e } (message d'erreur), puis remet le role admin.
const run = async (uid, role, sql, params) => {
  try { await as(uid, role); const r = await q(sql, params); await reset(); return { r }; }
  catch (e) { await reset(); return { e: String(e.message) }; }
};
const denied = (x) => !!x.e && /permission denied|forbidden|write-protected|invalid_amount/.test(x.e);

await q('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS extensions CASCADE; CREATE SCHEMA public;');
await q(readFileSync(resolve(here, 'stub.sql'), 'utf8'));
await q(readFileSync(resolve(here, 'legacy-functions.sql'), 'utf8'));
// Policies (copiees de la branche de test)
await q(`
  ALTER TABLE public.ziko_user_profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY users_own_profile ON public.ziko_user_profiles USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  CREATE POLICY user_profiles_coach_read ON public.ziko_user_profiles FOR SELECT USING (auth.uid() = id OR public.ziko_is_coach_of(auth.uid(), id));
  ALTER TABLE public.ziko_ai_cost_log ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ai_cost_log_own ON public.ziko_ai_cost_log USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ALTER TABLE public.ziko_user_inventory ENABLE ROW LEVEL SECURITY;
  CREATE POLICY user_inventory_own ON public.ziko_user_inventory USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`);
// Etat de prod : pas d'INSERT client sur l'inventaire (migration 20260822120000), UPDATE de toutes les colonnes.
await q('REVOKE INSERT ON public.ziko_user_inventory FROM authenticated');
await q(mig('202612012102_friend_rpc'));
await q(mig('202612012103_public_profile_rpc'));
await q(mig('202612012605_collective_challenges'));

const U = (n) => `00000000-0000-0000-0000-0000000050${String(n).padStart(2, '0')}`;
const [A, B, C, D, E, F, COACH] = [1, 2, 3, 4, 5, 6, 7].map(U);
await q(`INSERT INTO auth.users (id) SELECT unnest($1::uuid[])`, [[A, B, C, D, E, F, COACH]]);
await q(`INSERT INTO public.ziko_user_profiles (id, name, handle, goal, is_public, role) VALUES
  ($1,'Alice Alpha','alice','strength',true,'client'), ($2,'Bob Prive','bobp','fat_loss',false,'client'),
  ($3,'Carole Publique','carole','health',true,'client'), ($4,'Dan Prive Ami','danp','strength',false,'client'),
  ($5,'Eve Eve','eve','health',true,'client'), ($6,'Fred Fred','fred','health',true,'client'), ($7,'Coach Coco','coco',NULL,true,'coach')`,
  [A, B, C, D, E, F, COACH]);
await q(`INSERT INTO public.ziko_coach_client_links (coach_id, client_id) SELECT $1, unnest($2::uuid[])`, [COACH, [A, B, C, D]]);
await q(`INSERT INTO public.ziko_user_gamification (user_id, coins, xp) VALUES ($1, 500, 0), ($2, 0, 0)`, [A, B]);
const item = (await q(`INSERT INTO public.ziko_shop_items (name, price) VALUES ('Titre cher', 300), ('Titre pas cher', 10) RETURNING id, price`)).rows;
const [ITEM_BIG, ITEM_SMALL] = [item.find((i) => i.price === 300).id, item.find((i) => i.price === 10).id];
await q(`INSERT INTO public.ziko_user_ai_credits (user_id, balance) VALUES ($1, 10)`, [B]);
await q(`INSERT INTO public.ziko_ai_cost_log (user_id, source) VALUES ($1, 'quest_generation')`, [A]);
const form = (await q(`INSERT INTO public.ziko_coach_forms (coach_id, trigger_config) VALUES ($1, '{"type":"manual"}') RETURNING id`, [COACH])).rows[0].id;
await q(`INSERT INTO public.ziko_user_inventory (user_id, item_id) VALUES ($1, $2)`, [A, ITEM_SMALL]);
// friendship : Dan (prive) est ami accepte de Alice ; Carole a une demande en attente envers Bob (prive)
await q(`INSERT INTO public.ziko_friendships (requester_id, addressee_id, status) VALUES ($1,$2,'accepted'), ($3,$4,'pending')`, [A, D, C, B]);
// un peu de donnees publiques pour Bob (prive) : habit + seance
await q(`INSERT INTO public.ziko_habit_logs (user_id, date, value) VALUES ($1, (now() AT TIME ZONE 'Europe/Paris')::date, 1)`, [B]);
await q(`INSERT INTO public.ziko_user_gamification (user_id, coins, xp, level) VALUES ($1, 5, 120, 2) ON CONFLICT DO NOTHING`, [C]);

const sqlEarn = `SELECT public.ziko_earn_ai_credits($1, 'x', $2, 5, 1000000) AS r`;
const sqlDeduct = `SELECT public.ziko_deduct_ai_credits($1, 3, 'chat', $2) AS r`;
const sqlForm = `SELECT public.ziko_create_form_instances_for_trigger('manual', $1, $2) AS r`;

console.log('\n[A] AVANT migration : les attaques de l audit REUSSISSENT (preuve que le harnais est valide)');
let x = await run(null, 'anon', sqlEarn, [A, 'atk-1']);
ok('anon gonfle ses credits IA (earn)', !x.e && x.r.rows[0].r.credited === true, x.e);
x = await run(null, 'anon', sqlDeduct, [B, 'atk-d1']);
ok('anon vide le solde de la victime (deduct)', !x.e && x.r.rows[0].r.success === true, x.e);
x = await run(null, 'anon', `SELECT public.ziko_award_coins($1, 900, 'workout', NULL, 'atk')`, [A]);
ok('anon s attribue des pieces (award_coins)', !x.e, x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_award_coins($1, 900, 'workout', NULL, 'atk')`, [B]);
ok('un utilisateur credite UN AUTRE (award_coins)', !x.e, x.e);
x = await run(null, 'anon', `SELECT public.ziko_send_coin_gift($1, $2, 100, 'vol') AS r`, [A, C]);
ok('anon vole des pieces d une victime (send_coin_gift)', !x.e && x.r.rows[0].r.success === true, x.e);
x = await run(null, 'anon', sqlForm, [B, COACH]);
ok('anon spamme un formulaire (create_form_instances)', !x.e && Number(x.r.rows[0].r) === 1, x.e);
x = await run(null, 'anon', `SELECT * FROM public.ziko_search_users_fuzzy('a', $1, 20)`, [E]);
ok('anon enumere les utilisateurs (search_users_fuzzy)', !x.e && x.r.rowCount > 0, x.e);
x = await run(null, 'anon', `SELECT public.ziko_is_coach_of($1, $2) AS r`, [COACH, A]);
ok('anon sonde une relation coach/athlete (is_coach_of)', !x.e && x.r.rows[0].r === true, x.e);
x = await run(A, 'authenticated', `UPDATE public.ziko_user_profiles SET tier='premium', subscription_tier='premium', is_lifetime_premium=true WHERE id=$1`, [A]);
ok('auto-promotion premium sur son profil', !x.e && x.r.rowCount === 1, x.e);
await q(`UPDATE public.ziko_user_profiles SET tier='free', subscription_tier='free', is_lifetime_premium=false WHERE id=$1`, [A]);
x = await run(A, 'authenticated', `DELETE FROM public.ziko_ai_cost_log WHERE user_id=$1`, [A]);
ok('suppression de son journal de cout IA', !x.e && x.r.rowCount === 1, x.e);
x = await run(A, 'authenticated', `UPDATE public.ziko_user_inventory SET item_id=$2 WHERE user_id=$1`, [A, ITEM_BIG]);
ok('echange d article d inventaire (item_id)', !x.e && x.r.rowCount === 1, x.e);
await q(`UPDATE public.ziko_user_inventory SET item_id=$2 WHERE user_id=$1`, [A, ITEM_SMALL]);
await q(`INSERT INTO public.ziko_ai_cost_log (user_id, source) VALUES ($1, 'quest_generation')`, [A]);
const priv0 = (await run(E, 'authenticated', `SELECT public.ziko_get_public_profile($1) AS r`, [B])).r.rows[0].r;
ok('profil PRIVE lisible en entier par un non-ami (goal, badges...)', priv0.goal === 'fat_loss' && Array.isArray(priv0.recent_workouts), JSON.stringify(priv0).slice(0, 120));

console.log('\n[B] Application des migrations 2701, 2702, 2703 (puis 2701 une 2e fois : idempotence)');
for (const f of ['202612012701_security_hardening', '202612012702_public_profile_privacy', '202612012703_collective_progress_privacy', '202612012701_security_hardening']) {
  try { await q(mig(f)); ok(`${f} appliquee`, true); } catch (e) { ok(`${f} appliquee`, false, e.message); }
}

console.log('\n[C1] APRES : les attaques echouent');
await q(`UPDATE public.ziko_user_ai_credits SET balance = 10 WHERE user_id = $1`, [B]);
const credBefore = Number((await q(`SELECT balance FROM public.ziko_user_ai_credits WHERE user_id=$1`, [A])).rows[0]?.balance ?? 0);
x = await run(null, 'anon', sqlEarn, [A, 'atk-2']); ok('anon earn refuse', denied(x), x.e);
x = await run(A, 'authenticated', sqlEarn, [A, 'atk-3']); ok('authenticated earn refuse (reserve backend)', denied(x), x.e);
x = await run(null, 'anon', sqlDeduct, [B, 'atk-d2']); ok('anon deduct refuse', denied(x), x.e);
x = await run(A, 'authenticated', sqlDeduct, [B, 'atk-d3']); ok('authenticated deduct refuse', denied(x), x.e);
ok('solde de la victime intact', Number((await q(`SELECT balance FROM public.ziko_user_ai_credits WHERE user_id=$1`, [B])).rows[0].balance) === 10);
ok('aucun credit supplementaire pour l attaquant', Number((await q(`SELECT balance FROM public.ziko_user_ai_credits WHERE user_id=$1`, [A])).rows[0]?.balance ?? 0) === credBefore);
x = await run(null, 'anon', `SELECT public.ziko_award_coins($1, 10, 'workout', NULL, 'atk')`, [A]); ok('anon award_coins refuse', denied(x), x.e);
x = await run(null, 'anon', `SELECT public.ziko_award_xp($1, 10, 'workout', NULL, 'atk')`, [A]); ok('anon award_xp refuse', denied(x), x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_award_coins($1, 10, 'workout', NULL, 'atk')`, [B]); ok('award_coins pour autrui refuse', denied(x), x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_award_xp($1, 10, 'workout', NULL, 'atk')`, [B]); ok('award_xp pour autrui refuse', denied(x), x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_award_coins($1, 999999, 'workout', NULL, 'atk')`, [A]); ok('award_coins montant demesure refuse', denied(x), x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_award_coins($1, -50, 'workout', NULL, 'atk')`, [A]); ok('award_coins montant negatif refuse', denied(x), x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_ensure_gamification_profile($1)`, [B]); ok('ensure_gamification_profile pour autrui refuse', denied(x), x.e);
x = await run(null, 'anon', `SELECT public.ziko_ensure_gamification_profile($1)`, [B]); ok('anon ensure_gamification_profile refuse', denied(x), x.e);
x = await run(null, 'anon', `SELECT public.ziko_purchase_shop_item($1, $2)`, [A, ITEM_SMALL]); ok('anon purchase_shop_item refuse', denied(x), x.e);
x = await run(B, 'authenticated', `SELECT public.ziko_purchase_shop_item($1, $2)`, [A, ITEM_BIG]); ok('purchase au nom d autrui refuse', denied(x), x.e);
x = await run(null, 'anon', `SELECT public.ziko_send_coin_gift($1, $2, 100, 'vol')`, [A, C]); ok('anon send_coin_gift refuse', denied(x), x.e);
x = await run(B, 'authenticated', `SELECT public.ziko_send_coin_gift($1, $2, 100, 'vol')`, [A, B]); ok('send_coin_gift au nom d autrui refuse', denied(x), x.e);
x = await run(B, 'authenticated', `SELECT public.ziko_send_xp_gift($1, $2, 100, 'vol')`, [A, B]); ok('send_xp_gift au nom d autrui refuse', denied(x), x.e);
x = await run(null, 'anon', `SELECT public.ziko_increment_community_stat($1, 'messages_sent', 1)`, [A]); ok('anon increment_community_stat refuse', denied(x), x.e);
x = await run(B, 'authenticated', `SELECT public.ziko_increment_community_stat($1, 'messages_sent', 1)`, [A]); ok('increment sur la ligne d autrui refuse', denied(x), x.e);
x = await run(B, 'authenticated', `SELECT public.ziko_increment_community_stat($1, 'xp_received', 1)`, [B]); ok('auto-increment d un compteur recu refuse', denied(x), x.e);
x = await run(B, 'authenticated', `SELECT public.ziko_increment_community_stat($1, 'messages_sent', 500)`, [B]); ok('increment demesure refuse', denied(x), x.e);
x = await run(null, 'anon', sqlForm, [B, COACH]); ok('anon create_form_instances refuse', denied(x), x.e);
x = await run(B, 'authenticated', sqlForm, [B, COACH]); ok('authenticated create_form_instances refuse', denied(x), x.e);
x = await run(null, 'anon', `SELECT * FROM public.ziko_search_users_fuzzy('a', $1, 20)`, [E]); ok('anon search_users_fuzzy refuse', denied(x), x.e);
x = await run(A, 'authenticated', `SELECT * FROM public.ziko_search_users_fuzzy('a', $1, 20)`, [E]); ok('search_users_fuzzy avec l id d un autre renvoie 0 ligne', !x.e && x.r.rowCount === 0, x.e);
x = await run(null, 'anon', `SELECT public.ziko_is_coach_of($1, $2) AS r`, [COACH, A]); ok('anon is_coach_of ne revele plus rien (false)', !x.e && x.r.rows[0].r === false, x.e);
x = await run(E, 'authenticated', `SELECT public.ziko_is_coach_of($1, $2) AS r`, [COACH, A]); ok('tiers is_coach_of ne revele plus rien (false)', !x.e && x.r.rows[0].r === false, x.e);
x = await run(A, 'authenticated', `UPDATE public.ziko_user_profiles SET is_lifetime_premium=true WHERE id=$1`, [A]); ok('auto-promotion is_lifetime_premium refusee', denied(x), x.e);
x = await run(A, 'authenticated', `UPDATE public.ziko_user_profiles SET tier='premium' WHERE id=$1`, [A]); ok('auto-promotion tier refusee', denied(x), x.e);
x = await run(A, 'authenticated', `UPDATE public.ziko_user_profiles SET subscription_tier='coach' WHERE id=$1`, [A]); ok('auto-promotion subscription_tier refusee', denied(x), x.e);
x = await run(null, 'anon', `UPDATE public.ziko_user_profiles SET tier='premium' WHERE id=$1`, [A]); ok('anon update profil refuse', !!x.e || x.r.rowCount === 0, x.e);
x = await run(A, 'authenticated', `INSERT INTO public.ziko_ai_cost_log (user_id, source) VALUES ($1,'x')`, [A]); ok('insert cost_log client refuse', denied(x), x.e);
x = await run(A, 'authenticated', `DELETE FROM public.ziko_ai_cost_log WHERE user_id=$1`, [A]); ok('delete cost_log client refuse', denied(x), x.e);
x = await run(A, 'authenticated', `UPDATE public.ziko_ai_cost_log SET source='z' WHERE user_id=$1`, [A]); ok('update cost_log client refuse', denied(x), x.e);
x = await run(A, 'authenticated', `UPDATE public.ziko_user_inventory SET item_id=$2 WHERE user_id=$1`, [A, ITEM_BIG]); ok('echange d article refuse (item_id)', denied(x), x.e);
x = await run(null, 'anon', `SELECT public.ziko_sec_ensure_gamification_profile($1)`, [A]); ok('fonction interne ziko_sec_* inaccessible a anon', denied(x), x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_sec_increment_community_stat($1,'messages_sent',1)`, [A]); ok('fonction interne ziko_sec_* inaccessible a authenticated', denied(x), x.e);

console.log('\n[C2] APRES : les flux legitimes passent');
x = await run(null, 'service_role', sqlEarn, [A, 'srv-1']); ok('service_role earn (backend creditService)', !x.e && x.r.rows[0].r.credited === true, x.e);
x = await run(null, 'service_role', sqlDeduct, [A, 'srv-d1']); ok('service_role deduct (backend creditService)', !x.e && x.r.rows[0].r.success === true, x.e);
x = await run(null, 'service_role', sqlForm, [B, COACH]); ok('service_role create_form_instances (backend forms/webhooks)', !x.e, x.e);
const cb = Number((await q(`SELECT coins FROM public.ziko_user_gamification WHERE user_id=$1`, [A])).rows[0].coins);
x = await run(A, 'authenticated', `SELECT public.ziko_award_coins($1, 25, 'workout', NULL, 'Seance')`, [A]); ok('mobile : award_coins pour soi', !x.e, x.e);
ok('  les pieces ont ete creditees', Number((await q(`SELECT coins FROM public.ziko_user_gamification WHERE user_id=$1`, [A])).rows[0].coins) === cb + 25);
x = await run(A, 'authenticated', `SELECT public.ziko_award_xp($1, 150, 'workout', NULL, 'Seance') AS r`, [A]); ok('mobile : award_xp pour soi avec passage de niveau (appel imbrique award_coins level_up)', !x.e && x.r.rows[0].r.leveled_up === true, x.e);
ok('  recompense de niveau creditee (25)', Number((await q(`SELECT coins FROM public.ziko_user_gamification WHERE user_id=$1`, [A])).rows[0].coins) === cb + 25 + 25);
x = await run(A, 'authenticated', `SELECT (public.ziko_ensure_gamification_profile($1)).user_id AS r`, [A]); ok('mobile : ensure_gamification_profile pour soi', !x.e && x.r.rows[0].r === A, x.e);
x = await run(E, 'authenticated', `SELECT (public.ziko_ensure_gamification_profile($1)).user_id AS r`, [E]); ok('mobile : ensure cree le profil d un nouvel utilisateur', !x.e && x.r.rows[0].r === E, x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_purchase_shop_item($1, $2) AS r`, [A, ITEM_BIG]); ok('mobile : purchase_shop_item pour soi', !x.e && x.r.rows[0].r.success === true, x.e);
ok('  article ajoute + pieces debitees', (await q(`SELECT 1 FROM public.ziko_user_inventory WHERE user_id=$1 AND item_id=$2`, [A, ITEM_BIG])).rowCount === 1);
const ca = Number((await q(`SELECT coins FROM public.ziko_user_gamification WHERE user_id=$1`, [A])).rows[0].coins);
x = await run(A, 'authenticated', `SELECT public.ziko_send_coin_gift($1, $2, 40, 'Bravo') AS r`, [A, F]); ok('mobile : send_coin_gift expediteur = soi', !x.e && x.r.rows[0].r.success === true, x.e);
ok('  expediteur debite, destinataire credite, stats a jour', Number((await q(`SELECT coins FROM public.ziko_user_gamification WHERE user_id=$1`, [A])).rows[0].coins) === ca - 40
  && Number((await q(`SELECT coins FROM public.ziko_user_gamification WHERE user_id=$1`, [F])).rows[0].coins) === 40
  && Number((await q(`SELECT coins_received AS n FROM public.ziko_community_user_stats WHERE user_id=$1`, [F])).rows[0].n) === 40);
x = await run(A, 'authenticated', `SELECT public.ziko_send_xp_gift($1, $2, 30, NULL) AS r`, [A, F]); ok('mobile : send_xp_gift expediteur = soi', !x.e && x.r.rows[0].r.success === true, x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_increment_community_stat($1, 'messages_sent', 1)`, [A]); ok('mobile : increment de sa propre statistique', !x.e, x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_increment_community_stat($1, 'encouragements_received', 1)`, [F]); ok('mobile : encouragement recu par un ami (ligne d autrui, +1)', !x.e, x.e);
x = await run(null, null, `SELECT public.ziko_award_coins($1, 5, 'workout', NULL, 'cron')`, [A]); ok('appel serveur sans JWT (cron SQL / migration) : autorise', !x.e, x.e);
x = await run(COACH, 'authenticated', `SELECT public.ziko_is_coach_of($1, $2) AS r`, [COACH, A]); ok('coach : is_coach_of(moi, mon athlete) = true', !x.e && x.r.rows[0].r === true, x.e);
x = await run(A, 'authenticated', `SELECT public.ziko_is_coach_of($1, $2) AS r`, [COACH, A]); ok('athlete : is_coach_of(mon coach, moi) = true', !x.e && x.r.rows[0].r === true, x.e);
x = await run(COACH, 'authenticated', `SELECT id FROM public.ziko_user_profiles WHERE id=$1`, [A]); ok('RLS user_profiles_coach_read : le coach lit son athlete', !x.e && x.r.rowCount === 1, x.e);
x = await run(null, 'anon', `SELECT id FROM public.ziko_user_profiles`, []); ok('RLS : anon lit 0 ligne de profils (sans erreur)', !x.e && x.r.rowCount === 0, x.e);
x = await run(null, 'service_role', `SELECT public.ziko_is_coach_of($1, $2) AS r`, [COACH, A]); ok('service_role : is_coach_of = true', !x.e && x.r.rows[0].r === true, x.e);
x = await run(A, 'authenticated', `SELECT id, name FROM public.ziko_search_users_fuzzy('car', $1, 20)`, [A]); ok('mobile : search_users_fuzzy trouve un profil public', !x.e && x.r.rows.some((r) => r.name === 'Carole Publique'), x.e);
x = await run(A, 'authenticated', `SELECT id FROM public.ziko_search_users_fuzzy('bob', $1, 20)`, [A]); ok('  profil prive masque de la recherche fuzzy', !x.e && x.r.rowCount === 0, x.e);
x = await run(A, 'authenticated', `UPDATE public.ziko_user_profiles SET name='Alice 2', is_public=false, goal='health' WHERE id=$1`, [A]); ok('mobile : mise a jour nom / is_public / objectif', !x.e && x.r.rowCount === 1, x.e);
await q(`UPDATE public.ziko_user_profiles SET is_public=true WHERE id=$1`, [A]);
x = await run(A, 'authenticated', `UPDATE public.ziko_user_profiles SET role='both' WHERE id=$1`, [A]); ok('coach onboarding : role client -> both toujours possible', !x.e && x.r.rowCount === 1, x.e);
await q(`UPDATE public.ziko_user_profiles SET role='client' WHERE id=$1`, [A]);
x = await run(E, 'authenticated', `INSERT INTO public.ziko_user_profiles (id, name) VALUES ($1,'E2') ON CONFLICT (id) DO UPDATE SET is_public = true`, [E]); ok('upsert de profil (security.tsx) sans toucher aux tiers', !x.e || /duplicate/.test(x.e), x.e);
x = await run(null, 'service_role', `UPDATE public.ziko_user_profiles SET tier='premium', subscription_tier='premium', is_lifetime_premium=true WHERE id=$1`, [E]); ok('service_role peut toujours changer tier / premium (backend, webhooks)', !x.e && x.r.rowCount === 1, x.e);
await q(`UPDATE public.ziko_user_profiles SET tier='free', subscription_tier='free', is_lifetime_premium=false WHERE id=$1`, [E]);
x = await run(null, null, `UPDATE public.ziko_user_profiles SET tier='premium' WHERE id=$1`, [E]); ok('connexion directe (editeur SQL) peut changer tier', !x.e, x.e);
await q(`UPDATE public.ziko_user_profiles SET tier='free' WHERE id=$1`, [E]);
x = await run(A, 'authenticated', `SELECT count(*)::int AS n FROM public.ziko_ai_cost_log`, []); ok('mobile : lecture de son propre journal de cout IA', !x.e && x.r.rows[0].n === 1, x.e);
x = await run(null, 'service_role', `INSERT INTO public.ziko_ai_cost_log (user_id, source) VALUES ($1,'quest_generation')`, [A]); ok('backend (service_role) ecrit toujours dans cost_log', !x.e, x.e);
x = await run(A, 'authenticated', `UPDATE public.ziko_user_inventory SET is_equipped=true WHERE user_id=$1`, [A]); ok('mobile : equiper un article (is_equipped)', !x.e && x.r.rowCount >= 1, x.e);

console.log('\n[C3] APRES : profil public et recherche (constat 7)');
x = await run(E, 'authenticated', `SELECT public.ziko_get_public_profile($1) AS r`, [B]);
let p = x.r?.rows[0].r;
ok('non-ami voit un profil PRIVE : contrat minimal', !x.e && p.is_private === true && p.name === 'Bob Prive' && p.goal === null && p.badges_total === 0
  && p.recent_workouts.length === 0 && p.records.length === 0 && p.streak === 0 && p.level === null && p.relation === 'none', x.e ?? JSON.stringify(p));
ok('  memes cles que le contrat complet', ['id', 'name', 'handle', 'avatar_url', 'goal', 'relation', 'friendship_id', 'friends_count', 'followers_count', 'level', 'xp',
  'next_level', 'xp_to_next', 'streak', 'badges', 'badges_total', 'recent_workouts', 'records', 'common_challenges'].every((k) => k in p));
x = await run(C, 'authenticated', `SELECT public.ziko_get_public_profile($1) AS r`, [B]); p = x.r?.rows[0].r;
ok('demande en attente vers un profil prive : minimal + relation sent', !x.e && p.is_private === true && p.relation === 'sent' && p.goal === null, x.e ?? JSON.stringify(p));
x = await run(A, 'authenticated', `SELECT public.ziko_get_public_profile($1) AS r`, [D]); p = x.r?.rows[0].r;
ok('un AMI voit le profil complet d un profil prive', !x.e && p.is_private === false && p.relation === 'friend' && p.goal === 'strength', x.e ?? JSON.stringify(p));
x = await run(B, 'authenticated', `SELECT public.ziko_get_public_profile($1) AS r`, [B]); p = x.r?.rows[0].r;
ok('soi-meme : profil complet meme prive', !x.e && p.is_private === false && p.relation === 'self' && p.goal === 'fat_loss', x.e ?? JSON.stringify(p));
x = await run(E, 'authenticated', `SELECT public.ziko_get_public_profile($1) AS r`, [C]); p = x.r?.rows[0].r;
ok('profil PUBLIC : complet pour tout utilisateur connecte (decision Q-P21a)', !x.e && p.is_private === false && p.goal === 'health' && p.level === 2, x.e ?? JSON.stringify(p));
x = await run(E, 'authenticated', `SELECT public.ziko_get_public_profile('00000000-0000-0000-0000-00000000dead') AS r`, []);
ok('utilisateur inexistant : NULL', !x.e && x.r.rows[0].r === null, x.e);
x = await run(null, 'anon', `SELECT public.ziko_get_public_profile($1)`, [C]); ok('anon : refuse', denied(x), x.e);
x = await run(E, 'authenticated', `SELECT id FROM public.ziko_search_users_with_status('bob', 20)`, []);
ok('recherche : profil prive sans relation absent', !x.e && x.r.rowCount === 0, x.e);
x = await run(E, 'authenticated', `SELECT id FROM public.ziko_search_users_with_status('carole', 20)`, []);
ok('recherche : profil public present', !x.e && x.r.rowCount === 1, x.e);
x = await run(A, 'authenticated', `SELECT id, relation FROM public.ziko_search_users_with_status('dan', 20)`, []);
ok('recherche : profil prive deja ami reste visible', !x.e && x.r.rowCount === 1 && x.r.rows[0].relation === 'friend', x.e);
x = await run(B, 'authenticated', `SELECT id, relation FROM public.ziko_search_users_with_status('carole', 20)`, []);
ok('recherche : profil public avec demande recue present', !x.e && x.r.rowCount === 1 && x.r.rows[0].relation === 'received', x.e);

console.log('\n[C4] APRES : defi collectif (constat 8)');
const today = (await q(`SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS d`)).rows[0].d;
const ch = (await q(`INSERT INTO public.ziko_collective_challenges (coach_id, title, metric, target_total, start_date, end_date)
  VALUES ($1, 'Defi hydra', 'habit_logs', 100, $2::date - 2, $2::date + 5) RETURNING id`, [COACH, today])).rows[0].id;
const joinP = async (u, status = 'joined') => q(`INSERT INTO public.ziko_collective_participants (challenge_id, user_id, status, responded_at)
  VALUES ($1,$2,$3, now() - interval '1 day') ON CONFLICT (challenge_id, user_id) DO UPDATE SET status = EXCLUDED.status`, [ch, u, status]);
for (const u of [A, B, C]) await q(`INSERT INTO public.ziko_habit_logs (user_id, date, value) VALUES ($1, $2::date, 1)`, [u, today]);
await joinP(A);
const prog = async (uid) => (await run(uid, 'authenticated', `SELECT public.ziko_collective_progress($1) AS r`, [ch])).r.rows[0].r;
let g = await prog(COACH);
ok('1 seul participant : le total (donnee individuelle) n est PAS renvoye', g.total === null && g.total_hidden === true && g.joined_count === 1 && g.min_participants === 3, JSON.stringify(g));
await joinP(B);
g = await prog(A);
ok('2 participants : total masque (sinon total - ma contribution = celle de l autre)', g.total === null && g.joined_count === 2 && g.my_contribution === 1, JSON.stringify(g));
await joinP(C);
g = await prog(COACH);
ok('3 participants : total visible par le coach', g.total === 4 && g.total_hidden === false && g.joined_count === 3 && g.my_contribution === null, JSON.stringify(g));
g = await prog(A);
ok('3 participants : total visible par un athlete + sa contribution', g.total === 4 && g.my_contribution === 1, JSON.stringify(g));
await q(`UPDATE public.ziko_coach_client_links SET revoked_at = now() WHERE coach_id=$1 AND client_id=$2`, [COACH, B]);
g = await prog(COACH);
ok('lien de B revoque : B n est plus agrege, total repasse sous le seuil et masque', g.joined_count === 2 && g.total === null && g.total_hidden === true, JSON.stringify(g));
g = await prog(B);
ok('B (lien revoque) ne voit que sa propre contribution (non comptee), jamais le total', g.total === null && g.my_contribution === null, JSON.stringify(g));
await q(`UPDATE public.ziko_coach_client_links SET revoked_at = NULL WHERE coach_id=$1 AND client_id=$2`, [COACH, B]);
await joinP(D); await q(`INSERT INTO public.ziko_habit_logs (user_id, date, value) VALUES ($1, $2::date, 1)`, [D, today]);
await q(`UPDATE public.ziko_coach_client_links SET expires_at = now() - interval '1 hour' WHERE coach_id=$1 AND client_id=$2`, [COACH, D]);
g = await prog(COACH);
ok('lien expire : participant exclu de l agregat (3 actifs restants -> total 4 : A1 + B2 + C1)', g.joined_count === 3 && g.total === 4, JSON.stringify(g));
x = await run(E, 'authenticated', `SELECT public.ziko_collective_progress($1)`, [ch]); ok('tiers non participant : refuse', !!x.e && /challenge_not_found/.test(x.e), x.e);

console.log(`\n${pass} PASS, ${fail} FAIL`);
await client.end();
process.exit(fail ? 1 : 0);
