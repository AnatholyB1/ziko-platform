// UAT run 9 defaut 1 : une recompense de quete ne doit jamais etre perdue en silence (plafond 24 h de ziko_award_coins).
// Postgres LOCAL jetable : QR_PG_URL=postgres://postgres@127.0.0.1:8215/qr node scripts/uat/quest-reward-sql/run.mjs
// Garde-fou : refuse toute URL non locale. Ne touche JAMAIS le projet portfolio. Migration testee : 202612012904.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const url = process.env.QR_PG_URL;
if (!url) { console.log('QR_PG_URL absent : harnais SQL non execute (SKIP).'); process.exit(0); }
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
const reset = async () => { await q('RESET ROLE'); await q(`SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)`); };
const sync = async (uid) => { await as(uid); try { return (await q(`SELECT public.ziko_sync_quests($1) AS r`, [uid])).rows[0].r; } finally { await reset(); } };
const coins = async (uid) => Number((await q(`SELECT COALESCE((SELECT coins FROM public.ziko_user_gamification WHERE user_id=$1), 0) AS c`, [uid])).rows[0].c);
const ledger = async (uid) => Number((await q(`SELECT COUNT(*) n FROM public.ziko_coin_transactions WHERE user_id=$1 AND source='quest'`, [uid])).rows[0].n);
const questRow = async (uid, slug) => (await q(`SELECT rewarded_at, status FROM public.ziko_user_quests WHERE user_id=$1 AND slug=$2`, [uid, slug])).rows[0];
const today = `(now() AT TIME ZONE 'Europe/Paris')::date`;
const mig = (f) => readFileSync(resolve(root, `supabase/migrations/${f}.sql`), 'utf8');
// Copie fidele d'une fonction de 2701 (du CREATE au `$function$;` suivant).
const fn2701 = (name) => {
  const s = mig('202612012701_security_hardening');
  const i = s.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const j = s.indexOf('\n$function$;', i);
  if (i < 0 || j < 0) throw new Error(`fonction ${name} introuvable dans 2701`);
  return s.slice(i, j + '\n$function$;'.length);
};

await q('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public;');
await q(readFileSync(resolve(root, 'scripts/uat/p12-rewards-sql/stub-schema.sql'), 'utf8'));
await q(readFileSync(resolve(root, 'scripts/uat/p13-quests-sql/stub-extra.sql'), 'utf8'));
for (const f of ['202612011201_badge_award_and_progress', '202612011301_quest_tables', '202612011302_quest_functions', '202612011401_quest_ai_state', '202612011402_quest_sync_ai_handover']) await q(mig(f));
// Etat de prod : helpers + ziko_award_coins DURCI (plafond 10 000 / 24 h pour un appelant non fiable, retour silencieux).
for (const n of ['ziko_sec_jwt_role', 'ziko_sec_is_trusted', 'ziko_sec_ensure_gamification_profile', 'ziko_award_coins']) await q(fn2701(n));
await q('GRANT EXECUTE ON FUNCTION public.ziko_sec_jwt_role(), public.ziko_sec_is_trusted() TO anon, authenticated, service_role');
await q('GRANT EXECUTE ON FUNCTION public.ziko_award_coins(uuid, integer, text, uuid, text) TO authenticated, service_role');
console.log('Etat de prod rejoue (1302/1402 + award_coins durci 2701) sur la base locale jetable.');

const U = (n) => `00000000-0000-0000-0000-00000000090${n}`;
const [A, B, C, D, E] = [1, 2, 3, 4, 5].map(U);
await q(`INSERT INTO auth.users (id) SELECT unnest($1::uuid[])`, [[A, B, C, D, E]]);
const tpl = (await q(`SELECT slug, reward_coins, target FROM public.ziko_quest_templates WHERE is_starter AND metric='hydration_ml' AND scope='daily' LIMIT 1`)).rows[0];
const SLUG = tpl.slug; const REWARD = Number(tpl.reward_coins); const targetMl = Number(tpl.target);
// A : plafond atteint (+20 000 sur 24 h) ; B : normal ; C : plafond atteint apres migration ; D : echec d'attribution ; E : droits
const seedCap = (uid) => q(`INSERT INTO public.ziko_coin_transactions (user_id, amount, source, description) VALUES ($1, 10000, 'workout', 'seed'), ($1, 10000, 'workout', 'seed')`, [uid]);
const drink = (uid) => q(`INSERT INTO public.ziko_hydration_logs (user_id, amount_ml, date) VALUES ($1, $2, ${today})`, [uid, targetMl + 100]);
await q(`INSERT INTO public.ziko_user_gamification (user_id, coins) VALUES ($1, 20000)`, [A]);
await seedCap(A);

console.log('\n[A] ETAT AVANT migration : plafond atteint => recompense perdue en silence (le defaut)');
await sync(A);
await drink(A);
const before = await sync(A);
const rowA = await questRow(A, SLUG);
ok('defaut reproduit : quete terminee + rewarded_at pose', rowA.status === 'completed' && rowA.rewarded_at !== null, JSON.stringify(rowA));
ok('defaut reproduit : AUCUNE ligne de ledger quest et solde inchange (perte silencieuse)', await ledger(A) === 0 && await coins(A) === 20000, `ledger=${await ledger(A)} coins=${await coins(A)}`);
ok('defaut reproduit : la carte annonce pourtant la recompense (newly_completed)', before.newly_completed.length === 1 && before.newly_completed[0].coins === REWARD);

console.log('\n[B] Application de la migration 2904 (deux fois : idempotence)');
await q(mig('202612012904_quest_reward_system_award'));
ok('reparation : la perte historique de A est versee une fois', await ledger(A) === 1 && await coins(A) === 20000 + REWARD, `ledger=${await ledger(A)} coins=${await coins(A)}`);
await q(mig('202612012904_quest_reward_system_award'));
ok('re-application : aucune double attribution (idempotent)', await ledger(A) === 1 && await coins(A) === 20000 + REWARD);

console.log('\n[C] Cas normal inchange : une seule attribution');
await sync(B); await drink(B);
const rb = await sync(B);
ok('B : quete terminee, rewarded_at pose', (await questRow(B, SLUG)).status === 'completed' && (await questRow(B, SLUG)).rewarded_at !== null);
ok('B : exactement 1 ligne de ledger + solde = recompense', await ledger(B) === 1 && await coins(B) === REWARD, `ledger=${await ledger(B)} coins=${await coins(B)}`);
ok('B : newly_completed annonce la meme recompense', rb.newly_completed.length === 1 && rb.newly_completed[0].coins === REWARD);
await sync(B); await sync(B);
ok('B : resyncs successifs = toujours 1 attribution', await ledger(B) === 1 && await coins(B) === REWARD);

console.log('\n[D] Plafond atteint APRES migration : la recompense systeme est versee (pas de plafond anti-abus client)');
await q(`INSERT INTO public.ziko_user_gamification (user_id, coins) VALUES ($1, 20000)`, [C]);
await seedCap(C); await sync(C); await drink(C);
await sync(C);
ok('C : plafond de 24 h depasse mais recompense versee une fois', await ledger(C) === 1 && await coins(C) === 20000 + REWARD, `ledger=${await ledger(C)} coins=${await coins(C)}`);

console.log("\n[E] Echec d'attribution : pas de rewarded_at, quete rejouable, une seule attribution au final");
await sync(D); await drink(D);
await q(`CREATE FUNCTION public.qr_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ledger_down'; END $$`);
await q(`CREATE TRIGGER qr_fail BEFORE INSERT ON public.ziko_coin_transactions FOR EACH ROW WHEN (NEW.source = 'quest') EXECUTE FUNCTION public.qr_fail()`);
let failed = null;
try { await sync(D); } catch (e) { failed = String(e.message); }
const rowD = await questRow(D, SLUG);
ok('D : la synchro echoue franchement (pas de silence)', failed !== null && /ledger_down/.test(failed), String(failed));
ok('D : rewarded_at NON pose et quete toujours active (rejouable)', rowD.rewarded_at === null && rowD.status === 'active', JSON.stringify(rowD));
await q('DROP TRIGGER qr_fail ON public.ziko_coin_transactions');
const rd = await sync(D);
ok('D : rejoue apres retablissement : 1 attribution, rewarded_at pose', await ledger(D) === 1 && await coins(D) === REWARD && rd.newly_completed.length === 1);

console.log('\n[F] Droits : chemin interne introuvable pour le client ; plafond client inchange');
for (const role of ['authenticated', 'anon', 'service_role']) {
  let err = null;
  try { await as(role === 'anon' ? null : E, role); await q(`SELECT public.ziko_award_coins_system($1, 5, 'quest', NULL, 'x')`, [E]); } catch (e) { err = String(e.message); }
  await reset();
  ok(`${role} ne peut pas appeler ziko_award_coins_system`, err !== null && /permission denied/.test(err), String(err));
}
await q(`INSERT INTO public.ziko_user_gamification (user_id, coins) VALUES ($1, 0)`, [E]);
await seedCap(E);
await as(E); await q(`SELECT public.ziko_award_coins($1, 100, 'workout', NULL, 'client')`, [E]); await reset();
ok('ziko_award_coins (client) reste plafonne : retour silencieux au-dela de 10 000 / 24 h', Number((await q(`SELECT COUNT(*) n FROM public.ziko_coin_transactions WHERE user_id=$1 AND description='client'`, [E])).rows[0].n) === 0);
ok('ziko_sync_quests reste refuse pour un autre utilisateur', await (async () => { try { await as(E); await q(`SELECT public.ziko_sync_quests($1)`, [A]); await reset(); return false; } catch (e) { await reset(); return /forbidden/.test(String(e.message)); } })());

console.log(`\n${pass} PASS, ${fail} FAIL`);
await client.end();
process.exit(fail ? 1 : 0);
