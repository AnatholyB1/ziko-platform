// Rejoue les migrations P12 (20261201 1201/1202) sur un Postgres LOCAL jetable et verifie les scenarios.
// Usage : P12_PG_URL=postgres://postgres@127.0.0.1:<port>/p12 node scripts/uat/p12-rewards-sql/run.mjs
// Garde-fou : refuse toute URL qui n'est pas locale. Ne touche JAMAIS le projet Supabase portfolio.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const url = process.env.P12_PG_URL;
if (!url) { console.log('P12_PG_URL absent : harnais SQL non execute (SKIP).'); process.exit(0); }
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error('Refus : URL non locale.'); process.exit(2); }

const client = new pg.Client({ connectionString: url });
await client.connect();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS ${name}`); } else { fail++; console.log(`  FAIL ${name} ${extra}`); } };
const q = (sql, params) => client.query(sql, params);
const as = async (uid, role = 'authenticated') => {
  await q(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [uid ?? '', role]);
  await q(`SET ROLE ${role}`);
};
const reset = async () => { await q('RESET ROLE'); };
const expectErr = async (name, fn, re) => {
  try { await fn(); ok(name, false, '(pas d\'erreur)'); } catch (e) { ok(name, re.test(String(e.message)), e.message); }
};

await q('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public;');
await q(readFileSync(resolve(here, 'stub-schema.sql'), 'utf8'));
await q(readFileSync(resolve(root, 'supabase/migrations/202612011201_badge_award_and_progress.sql'), 'utf8'));
await q(readFileSync(resolve(root, 'supabase/migrations/202612011202_equip_item_rpc.sql'), 'utf8'));
console.log('Migrations appliquees sur la base locale jetable.');

const U1 = '00000000-0000-0000-0000-000000000001', U2 = '00000000-0000-0000-0000-000000000002', U3 = '00000000-0000-0000-0000-000000000003';
await q(`INSERT INTO auth.users (id) VALUES ($1), ($2), ($3)`, [U1, U2, U3]);

console.log('\n[1] Compte neuf : rien d\'attribue, progression a 0');
await as(U1);
let r = await q(`SELECT public.ziko_check_and_award_badges($1) AS r`, [U1]);
ok('retour jsonb = tableau vide', Array.isArray(r.rows[0].r) && r.rows[0].r.length === 0, JSON.stringify(r.rows[0].r));
r = await q(`SELECT public.ziko_get_badge_progress($1) AS r`, [U1]);
ok('progression : 11 succes', r.rows[0].r.badges.length === 11);
ok('progression : compteurs a 0', Object.values(r.rows[0].r.counters).every((v) => v === 0), JSON.stringify(r.rows[0].r.counters));

console.log('\n[2] 1re seance (R-3) : succes attribue, pieces creditees une seule fois');
await reset();
const sid = (await q(`INSERT INTO public.ziko_workout_sessions (user_id) VALUES ($1) RETURNING id`, [U1])).rows[0].id;
// seance VIDE : ne compte pas (P6 D-02)
await as(U1);
r = await q(`SELECT public.ziko_check_and_award_badges($1) AS r`, [U1]);
ok('seance vide : aucun succes', r.rows[0].r.length === 0, JSON.stringify(r.rows[0].r));
await reset();
await q(`INSERT INTO public.ziko_session_sets (session_id, exercise_id, set_number, reps, weight_kg, completed) VALUES ($1, gen_random_uuid(), 1, 5, 60, true)`, [sid]);
await as(U1);
r = await q(`SELECT public.ziko_check_and_award_badges($1) AS r`, [U1]);
const slugs = r.rows[0].r.map((x) => x.slug).sort();
ok('attribue first_session + first_pr', JSON.stringify(slugs) === JSON.stringify(['first_pr', 'first_session']), JSON.stringify(slugs));
ok('champs du retour (name, coins=25)', r.rows[0].r.every((x) => x.name && x.coins === 25));
await reset();
let g = (await q(`SELECT coins FROM public.ziko_user_gamification WHERE user_id=$1`, [U1])).rows[0];
ok('solde = 2 x 25 pieces', g.coins === 50, String(g.coins));
let tx = (await q(`SELECT source, amount, description FROM public.ziko_coin_transactions WHERE user_id=$1 ORDER BY description`, [U1])).rows;
ok('2 transactions source=achievement', tx.length === 2 && tx.every((t) => t.source === 'achievement' && t.amount === 25), JSON.stringify(tx));
await as(U1);
r = await q(`SELECT public.ziko_check_and_award_badges($1) AS r`, [U1]);
await reset();
g = (await q(`SELECT coins FROM public.ziko_user_gamification WHERE user_id=$1`, [U1])).rows[0];
ok('2e appel idempotent (rien de neuf, solde inchange)', r.rows[0].r.length === 0 && g.coins === 50);
const dates = (await q(`SELECT earned_at FROM public.ziko_user_badges WHERE user_id=$1`, [U1])).rows;
ok('date de deblocage reelle (earned_at non nul)', dates.length === 2 && dates.every((d) => d.earned_at));

console.log('\n[3] Amis : colonnes requester_id/addressee_id (cause racine du bug historique)');
await reset();
await q(`INSERT INTO public.ziko_friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'accepted')`, [U2, U1]);
await as(U1);
r = await q(`SELECT public.ziko_check_and_award_badges($1) AS r`, [U1]);
ok('first_friend attribue (ami accepte cote destinataire)', r.rows[0].r.some((x) => x.slug === 'first_friend'), JSON.stringify(r.rows[0].r));
await reset();
await q(`INSERT INTO public.ziko_friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')`, [U3, U2]);
await as(U3);
r = await q(`SELECT public.ziko_check_and_award_badges($1) AS r`, [U3]);
ok('demande en attente ne compte pas', !r.rows[0].r.some((x) => x.slug === 'first_friend'));

console.log('\n[4] Serie visible (Q8) et pieces par palier (Q7)');
await reset();
await q(`UPDATE public.ziko_user_gamification SET current_streak = 5, longest_streak = 5 WHERE user_id = $1`, [U1]);
await as(U1);
r = await q(`SELECT public.ziko_get_badge_progress($1) AS r`, [U1]);
const s7 = r.rows[0].r.badges.find((b) => b.slug === 'streak_7');
ok('streak_7 : 5 sur 7', s7.current === 5, JSON.stringify(s7));
ok('pieces par palier 25/50/100', ['streak_7', 'fifty_sessions', 'streak_100'].map((s) => r.rows[0].r.badges.find((b) => b.slug === s).reward_coins).join() === '25,50,100');
await reset();
await q(`UPDATE public.ziko_user_gamification SET current_streak = 2, longest_streak = 8 WHERE user_id = $1`, [U1]);
await as(U1);
r = await q(`SELECT public.ziko_check_and_award_badges($1) AS r`, [U1]);
ok('serie : longest_streak 8 deverrouille streak_7 (pas de remise a zero punitive)', r.rows[0].r.some((x) => x.slug === 'streak_7'));
ok('streak_7 (palier 1) = 25 pieces', r.rows[0].r.find((x) => x.slug === 'streak_7').coins === 25);

console.log('\n[5] Autorisation');
await as(U2);
await expectErr('check_and_award pour un AUTRE utilisateur refuse', () => q(`SELECT public.ziko_check_and_award_badges($1)`, [U1]), /forbidden/);
await expectErr('get_badge_progress pour un AUTRE utilisateur refuse', () => q(`SELECT public.ziko_get_badge_progress($1)`, [U1]), /forbidden/);
await reset();
await as(null, 'anon');
await expectErr('anon : EXECUTE refuse', () => q(`SELECT public.ziko_check_and_award_badges($1)`, [U1]), /permission denied/);
await expectErr('anon : equip refuse', () => q(`SELECT public.ziko_equip_item(gen_random_uuid())`), /permission denied/);
await reset();
await as(U2);
await expectErr('authenticated : ziko_badge_counters interne non appelable', () => q(`SELECT public.ziko_badge_counters($1)`, [U2]), /permission denied/);
await reset();
await as(null, 'service_role');
r = await q(`SELECT public.ziko_get_badge_progress($1) AS r`, [U1]);
ok('service_role peut lire la progression', r.rows[0].r.badges.length === 11);
await reset();
await q(`SELECT 1`);
const chk = await q(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname = 'ziko_coin_transactions_source_check'`);
ok('CHECK source contient achievement et les anciennes valeurs', /achievement/.test(chk.rows[0].d) && /purchase/.test(chk.rows[0].d) && /level_up/.test(chk.rows[0].d));

console.log('\n[6] Equipement atomique (R-8)');
await reset();
const ids = {};
for (const [k, name, cat, icon] of [['a', 'Machine', 'title', null], ['b', 'Bête', 'title', null], ['t', 'Bleu Océan', 'theme', null], ['badge', 'Coeur', 'badge', 'heart']]) {
  ids[k] = (await q(`INSERT INTO public.ziko_shop_items (name, category, price, icon) VALUES ($1,$2,100,$3) RETURNING id`, [name, cat, icon])).rows[0].id;
}
await q(`INSERT INTO public.ziko_user_inventory (user_id, item_id, is_equipped) VALUES ($1,$2,true), ($1,$3,false), ($1,$4,true)`, [U1, ids.a, ids.b, ids.t]);
await as(U1);
r = await q(`SELECT public.ziko_equip_item($1) AS r`, [ids.b]);
await reset();
ok('equip B reussit', r.rows[0].r.success === true && r.rows[0].r.category === 'title', JSON.stringify(r.rows[0].r));
const inv = (await q(`SELECT item_id, is_equipped FROM public.ziko_user_inventory WHERE user_id=$1`, [U1])).rows;
const equippedTitles = inv.filter((i) => i.is_equipped && [ids.a, ids.b].includes(i.item_id));
ok('un seul titre equipe (B), A deselectionne', equippedTitles.length === 1 && equippedTitles[0].item_id === ids.b);
ok('le theme equipe d\'une AUTRE categorie est intact', inv.find((i) => i.item_id === ids.t).is_equipped === true);
g = (await q(`SELECT equipped_title, equipped_theme FROM public.ziko_user_gamification WHERE user_id=$1`, [U1])).rows[0];
ok('equipped_title mis a jour', g.equipped_title === 'Bête', g.equipped_title);
await as(U1);
r = await q(`SELECT public.ziko_equip_item($1) AS r`, [ids.badge]);
ok('objet NON possede refuse', r.rows[0].r.success === false && /possédé/.test(r.rows[0].r.error), JSON.stringify(r.rows[0].r));
r = await q(`SELECT public.ziko_equip_item(gen_random_uuid()) AS r`);
ok('article inconnu refuse', r.rows[0].r.success === false);
await reset();
await as(U2);
r = await q(`SELECT public.ziko_equip_item($1) AS r`, [ids.a]);
ok('equiper l\'objet d\'un autre utilisateur refuse', r.rows[0].r.success === false);
await reset();

await client.end();
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
