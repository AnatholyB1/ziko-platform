// Facturation IA inactive : teste la migration 20261201290500_ziko_deduct_ai_credits_fix sur un Postgres LOCAL jetable.
// DC_PG_URL=postgres://postgres@127.0.0.1:8216/dc node scripts/uat/deduct-credits-sql/run.mjs
// Garde-fou : refuse toute URL non locale. Ne touche JAMAIS le projet portfolio.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const url = process.env.DC_PG_URL;
if (!url) { console.log('DC_PG_URL absent : harnais SQL non execute (SKIP).'); process.exit(0); }
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error('Refus : URL non locale.'); process.exit(2); }

const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query("SET lc_messages = 'C'");
let pass = 0, fail = 0;
const ok = (n, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS ${n}`); } else { fail++; console.log(`  FAIL ${n} ${extra}`); } };
const q = (s, p) => c.query(s, p);
const mig = readFileSync(resolve(root, 'supabase/portfolio-migrations/20261201290500_ziko_deduct_ai_credits_fix.sql'), 'utf8');

await q('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
await q(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`);
// Stub minimal (colonnes/index copies de la prod).
await q(`
CREATE TABLE public.ziko_app_config (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ziko_user_ai_credits (user_id uuid PRIMARY KEY, balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ziko_ai_credit_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, type text NOT NULL
  CHECK (type = ANY (ARRAY['deduct','earn','welcome','daily_base','monthly_base','admin_adjust','premium_grant','quota'])),
  amount integer NOT NULL, source text, idempotency_key text, balance_after integer, metadata jsonb DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX ziko_idx_credit_tx_idempotency ON public.ziko_ai_credit_transactions (user_id, source, idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE FUNCTION public.ziko_credit_tx_balance_after() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  SELECT balance INTO NEW.balance_after FROM public.ziko_user_ai_credits WHERE user_id = NEW.user_id; RETURN NEW; END $$;
CREATE TRIGGER trg_balance_after BEFORE INSERT ON public.ziko_ai_credit_transactions FOR EACH ROW EXECUTE FUNCTION public.ziko_credit_tx_balance_after();
GRANT SELECT ON public.ziko_app_config TO anon, authenticated; GRANT ALL ON public.ziko_app_config, public.ziko_user_ai_credits, public.ziko_ai_credit_transactions TO service_role;
`);
// Definition PROD actuelle (pg_get_functiondef du 2026-11-14).
await q(`CREATE OR REPLACE FUNCTION public.ziko_deduct_ai_credits(p_user_id uuid, p_cost integer, p_action_type text, p_idempotency_key text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_balance INTEGER;
BEGIN
  SELECT balance INTO v_balance FROM public.ziko_user_ai_credits WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RETURN jsonb_build_object('success', false, 'balance', 0, 'required', p_cost); END IF;
  IF v_balance < p_cost THEN RETURN jsonb_build_object('success', false, 'balance', v_balance, 'required', p_cost); END IF;
  UPDATE public.ziko_user_ai_credits SET balance = balance - p_cost, updated_at = NOW() WHERE user_id = p_user_id;
  INSERT INTO public.ziko_ai_credit_transactions (user_id, type, amount, source, idempotency_key, metadata)
  VALUES (p_user_id, 'deduct', -p_cost, p_action_type, p_idempotency_key, '{}'::jsonb)
  ON CONFLICT (user_id, source, idempotency_key) DO NOTHING;
  RETURN jsonb_build_object('success', true, 'balance_after', v_balance - p_cost);
END; $function$`);
await q(`REVOKE ALL ON FUNCTION public.ziko_deduct_ai_credits(uuid,integer,text,text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.ziko_deduct_ai_credits(uuid,integer,text,text) TO service_role`);

const U = (n) => `00000000-0000-0000-0000-0000000008${String(n).padStart(2, '0')}`;
const seed = async (u, bal) => q('INSERT INTO public.ziko_user_ai_credits (user_id, balance) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET balance=$2', [u, bal]);
const bal = async (u) => Number((await q('SELECT balance FROM public.ziko_user_ai_credits WHERE user_id=$1', [u])).rows[0].balance);
const ntx = async (u) => Number((await q("SELECT count(*) n FROM public.ziko_ai_credit_transactions WHERE user_id=$1 AND type='deduct'", [u])).rows[0].n);
const deduct = async (u, cost, action, key) => (await q('SELECT public.ziko_deduct_ai_credits($1,$2,$3,$4) AS r', [u, cost, action, key])).rows[0].r;

console.log('[A] ETAT AVANT (definition prod) : le defaut est reproduit');
await seed(U(1), 10);
let err = null;
try { await deduct(U(1), 4, 'chat', 'k-before'); } catch (e) { err = e; }
ok('prod : ON CONFLICT sans predicat => erreur 42P10', err && err.code === '42P10', err ? err.code : 'pas d erreur');
ok('prod : erreur => transaction de la fonction annulee, solde inchange', await bal(U(1)) === 10);

console.log('\n[B] Application de la migration (deux fois : idempotence)');
await q(mig); await q(mig);
const cfg = (await q("SELECT value FROM public.ziko_app_config WHERE key='billing_enabled'")).rows;
ok('billing_enabled cree a false, une seule ligne apres 2 applications', cfg.length === 1 && cfg[0].value === false);
await q("UPDATE public.ziko_app_config SET value='true'::jsonb WHERE key='billing_enabled'");
await q(mig);
ok('re-application ne remet PAS le flag a false (DO NOTHING)', (await q("SELECT value FROM public.ziko_app_config WHERE key='billing_enabled'")).rows[0].value === true);
await q("UPDATE public.ziko_app_config SET value='false'::jsonb WHERE key='billing_enabled'");

console.log('\n[C] Interrupteur OFF : reponse ok, ni debit ni erreur');
await seed(U(2), 10);
const off = await deduct(U(2), 4, 'chat', 'k-off-1');
ok('off : success true, balance_after = solde courant', off.success === true && off.balance_after === 10, JSON.stringify(off));
ok('off : solde inchange, aucune ligne de ledger', await bal(U(2)) === 10 && await ntx(U(2)) === 0);
const offLow = await deduct(U(2), 99, 'chat', 'k-off-2');
ok('off : meme un cout > solde renvoie ok sans debit', offLow.success === true && await bal(U(2)) === 10);
const offNull = await deduct(U(2), 4, 'chat', null);
ok('off : cle NULL toleree', offNull.success === true && await bal(U(2)) === 10);
ok('off : utilisateur sans ligne de credits => ok, balance_after 0', (await deduct(U(9), 4, 'chat', 'k')).success === true);
await q("DELETE FROM public.ziko_app_config WHERE key='billing_enabled'");
ok('off : cle de config absente => traite comme false', (await deduct(U(2), 4, 'chat', 'k-x')).success === true && await bal(U(2)) === 10);
await q("INSERT INTO public.ziko_app_config (key, value) VALUES ('billing_enabled','false'::jsonb)");

console.log('\n[D] Interrupteur ON');
await q("UPDATE public.ziko_app_config SET value='true'::jsonb WHERE key='billing_enabled'");
await seed(U(3), 10);
const d1 = await deduct(U(3), 4, 'chat', 'k-on-1');
ok('on : un debit', d1.success === true && d1.balance_after === 6 && await bal(U(3)) === 6 && await ntx(U(3)) === 1, JSON.stringify(d1));
const ledger = (await q("SELECT amount, balance_after, source FROM public.ziko_ai_credit_transactions WHERE user_id=$1", [U(3)])).rows[0];
ok('on : ledger amount -4, balance_after 6 (trigger)', ledger.amount === -4 && ledger.balance_after === 6 && ledger.source === 'chat', JSON.stringify(ledger));
const d2 = await deduct(U(3), 4, 'chat', 'k-on-1');
ok('on : rejeu meme cle => PAS de second debit, reponse ok', d2.success === true && d2.duplicate === true && await bal(U(3)) === 6 && await ntx(U(3)) === 1, JSON.stringify(d2));
const d3 = await deduct(U(3), 3, 'scan', 'k-on-1');
ok('on : meme cle mais autre source => debit distinct (index par source)', d3.success === true && await bal(U(3)) === 3 && await ntx(U(3)) === 2);
const d4 = await deduct(U(3), 4, 'chat', 'k-on-4');
ok('on : solde insuffisant => refus propre, aucun debit, aucune ligne', d4.success === false && d4.balance === 3 && d4.required === 4 && await bal(U(3)) === 3 && await ntx(U(3)) === 2, JSON.stringify(d4));
const d5 = await deduct(U(3), 1, 'recipes', null);
const d6 = await deduct(U(3), 1, 'recipes', null);
ok('on : cle NULL toleree (pas d idempotence : 2 debits)', d5.success === true && d6.success === true && await bal(U(3)) === 1 && await ntx(U(3)) === 4);
const d7 = await deduct(U(99), 4, 'chat', 'k-nouser');
ok('on : utilisateur sans ligne de credits => refus propre', d7.success === false && d7.balance === 0);
const d8 = await deduct(U(3), 0, 'import', 'k-import');
ok('on : cout 0 (import) => ok sans changement de solde', d8.success === true && await bal(U(3)) === 1);
// Concurrence : 5 appels simultanes, meme cle => un seul debit
await seed(U(4), 20);
const cc = [];
for (let i = 0; i < 5; i++) { const cl = new pg.Client({ connectionString: url }); await cl.connect(); cc.push(cl); }
await Promise.all(cc.map((cl) => cl.query('SELECT public.ziko_deduct_ai_credits($1,4,$2,$3)', [U(4), 'chat', 'k-race'])));
await Promise.all(cc.map((cl) => cl.end()));
ok('on : 5 rejeux concurrents de la meme cle => un seul debit', await bal(U(4)) === 16 && await ntx(U(4)) === 1, `bal=${await bal(U(4))} tx=${await ntx(U(4))}`);

console.log('\n[E] Droits');
const exec = async (role) => (await q(`SELECT has_function_privilege($1, 'public.ziko_deduct_ai_credits(uuid,integer,text,text)'::regprocedure, 'EXECUTE') AS p`, [role])).rows[0].p;
ok('anon sans EXECUTE', (await exec('anon')) === false);
ok('authenticated sans EXECUTE', (await exec('authenticated')) === false);
ok('service_role avec EXECUTE', (await exec('service_role')) === true);
for (const role of ['anon', 'authenticated']) {
  let e2 = null;
  await q(`SET ROLE ${role}`);
  try { await deduct(U(3), 1, 'chat', 'k-' + role); } catch (e) { e2 = e; }
  await q('RESET ROLE');
  ok(`${role} : appel refuse (42501)`, e2 && e2.code === '42501', e2 ? e2.code : 'pas d erreur');
}
const publicAcl = (await q(`SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.ziko_deduct_ai_credits(uuid,integer,text,text)'::regprocedure AND a.grantee = 0) AS p`)).rows[0].p;
ok('PUBLIC sans EXECUTE', publicAcl === false);

console.log(`\n${pass} PASS / ${fail} FAIL`);
await c.end();
process.exit(fail ? 1 : 0);
