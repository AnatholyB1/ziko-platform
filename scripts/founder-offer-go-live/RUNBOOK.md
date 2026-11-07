# Founder Offer Go-Live - RUNBOOK (re-baselined 2026-11-07, post v1.19)

**Audience:** a person who has not read any planning document and is about to change production.
This document is the whole procedure; its section order is a safety property. Read it top to bottom
before running anything.

**Production is the shared portfolio Supabase project, ref `ubxllsvanurkwkohzxau`.** Every ziko table
and function carries the `ziko_` prefix. The old ziko project (`slkobhavpwsubnsmuhya`) is deleted: never
query or link it. The deployed schema is `supabase/portfolio-migrations/` (5 files, already applied).

**Hard rules (user decisions 2026-11-07):**
- NO `TRUNCATE` and NO sequence reset on production. `ziko_waitlist_signups` holds 94 real signups.
- The claim RPC smoke test runs on a disposable database only (section 7).
- Every production write (sections 8 and 10) is human-fired, on the user's explicit authorization.
- Reads (`SELECT` only) may be run by the operator or by a session with read-only access.
- No secret value is ever written into this runbook, the evidence log (`06-GO-LIVE-LOG.md`) or a chat.
  Record command names and result values only.

Each production step below has the same four parts: READ (verification query), FIRE (exact command),
EXPECT (result), ROLLBACK.

---

## Section 0 - Preconditions
0.1 You can run SQL against project `ubxllsvanurkwkohzxau` (SQL Editor or CLI linked to it). Confirm the
target before every query: `SELECT current_database(), (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ziko\_%')` must show at least 99 ziko_ tables.
0.2 For writes you hold the user's explicit authorization for that step, quoted in the log.
0.3 Read `NEXT_PUBLIC_SITE_URL` from the Vercel production env (or `apps/web/.env.local`) and say what it
is. Examples below use `<site>`; `ziko-app.com` is unconfirmed until you do.
0.4 CI: the `migrate-portfolio` job in `.github/workflows/ci.yml` is dormant
(`vars.PORTFOLIO_MIGRATIONS_ENABLED` must NOT be `true` for this go-live: nothing to apply). It also refuses
any project other than `ubxllsvanurkwkohzxau`. `test-rls.yml` targets a separate test project and proves
nothing about production.

## Section 1 - Deploy the code (push main)
1.1 READ: `git rev-list --count origin/main..milestone/v1.16-waitlist`; `git rev-list --count milestone/v1.16-waitlist..origin/main`; `git diff origin/main --name-status -- supabase/ backend/ apps/`. Report the real numbers.
1.2 FIRE (human): open a PR `milestone/v1.16-waitlist` -> `main`, land it as ONE merge or squash commit.
Record PR number and merge SHA.
1.3 EXPECT: the `push` run on main goes green; `migrate-portfolio` is SKIPPED (dormant by design) and
`migration-guard` passes. A skipped `migrate-portfolio` is correct here, unlike the old project.
1.4 ROLLBACK: Vercel dashboard -> previous production deployment -> Promote (no DB effect).

## Section 2 - Confirm the deploy
2.1 READ: `curl -s -o /dev/null -w '%{http_code}' https://ziko-api-lilac.vercel.app/health` -> 200.
2.2 READ: Vercel production deployment SHA for `ziko-api` and `ziko-web` equals the merge SHA from 1.2.
A 200 alone does not prove which code runs. If /health is not 200, record it as a finding and stop.

## Section 3 - Database state tracer (read-only, no apply)
```sql
SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20261001101852' ORDER BY version;
SELECT key, value, jsonb_typeof(value) FROM public.ziko_app_config ORDER BY key;
```
EXPECT: 5 versions (20261001101852, ...101853, 20261002090000, ...090001, 20261002160000); config rows
`premium_credit_cap_enabled` false, `waitlist_retention_years` 3, `waitlist_reveal_threshold` 200. If the
ledger lists fewer versions, record it; do not hand-apply anything (escalate).

## Section 4 - Full artifact check (read-only; any miss halts)
```sql
SELECT proname FROM pg_proc WHERE proname IN ('ziko_claim_waitlist_signup','ziko_get_waitlist_founder_status','ziko_grant_premium_credits','ziko_reset_waitlist_founder_sequence') ORDER BY 1;
SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='ziko_user_profiles' AND column_name='is_lifetime_premium';
SELECT last_value, is_called FROM public.ziko_waitlist_founder_seq;
```
EXPECT: 4 function names; one boolean column default false; sequence last_value 95 is_called as observed
(it must NOT be changed by this go-live).

## Section 5 - Waitlist and consent snapshot (read-only)
```sql
SELECT count(*) AS total, count(*) FILTER (WHERE is_founder) AS founders,
       count(*) FILTER (WHERE consent_given_at IS NULL) AS no_consent,
       count(*) FILTER (WHERE anonymized_at IS NOT NULL) AS anonymized
FROM public.ziko_waitlist_signups;
```
EXPECT (2026-11-07 reference): 94 / 94 / 19 / record. Growth is fine, shrinkage is a finding. The 19
without consent are kept and excluded from any send; their ids are in `DEPLOY-CHECKLIST-v1.16.md` (RGPD).
Test-account purge (PURGE-05): the portfolio `auth.users` is SHARED with other apps. Run
`node --env-file=<env> scripts/purge-test-accounts/dry-run.mjs` only after confirming it scopes to ziko
users (via `ziko_user_profiles`) and uses ziko_ table names; it removes nothing. Record
`users_scanned`, `candidates`, `flagged_cross_linked`, `to_delete`. `to_delete` > 0 stops the launch and
hands off to `scripts/purge-test-accounts/RUNBOOK.md` (referenced, not restated).

## Section 6 - Premium grandfathering and finite allocation (read-only)
```sql
SELECT count(*) FILTER (WHERE tier='premium') AS premium,
       count(*) FILTER (WHERE tier='premium' AND is_lifetime_premium) AS lifetime,
       count(*) FILTER (WHERE tier='premium' AND NOT is_lifetime_premium) AS not_grandfathered,
       count(*) AS profiles
FROM public.ziko_user_profiles;
```
EXPECT: premium 21, lifetime 21, not_grandfathered 0, profiles 40. `not_grandfathered > 0` halts: a premium
user without the lifetime flag is an unreviewed case (user decision needed).
Allocation (every premium user must already hold this month's grant, `PREMIUM_MONTHLY_GRANT` = 300,
written by the cron `/credits/cron/premium-grant` on the 1st at 00:00 UTC, independent of the flag):
```sql
SELECT count(*) AS premium_without_grant FROM public.ziko_user_profiles p
WHERE p.tier='premium' AND NOT EXISTS (SELECT 1 FROM public.ziko_ai_credit_transactions t
  WHERE t.user_id=p.id AND t.source='premium_grant'
    AND t.idempotency_key='premium_grant_'||to_char(now() AT TIME ZONE 'UTC','YYYY-MM'));
```
EXPECT 0. If > 0: the cron did not fund them. Do not flip the flag. Human trigger of the cron
(`GET /credits/cron/premium-grant` with the cron secret, idempotent per month) then re-read; or escalate.

## Section 7 - Smoke test of `ziko_claim_waitlist_signup` (DISPOSABLE DATABASE ONLY)
Never run against `ubxllsvanurkwkohzxau`. Use a throwaway Postgres (ports 3140-3179 / 54440-54479 per
the orchestration file; lock `.planning/.machine-lock`), bootstrapped with
`scripts/portfolio-migration/00-bootstrap-supabase-functions.sql`, then the 5 files of
`supabase/portfolio-migrations/` in order.
```sql
SELECT * FROM public.ziko_claim_waitlist_signup('smoke@example.invalid','athlete','fr',NULL,NULL);  -- as service_role
SELECT * FROM public.ziko_claim_waitlist_signup('smoke@example.invalid','athlete','fr',NULL,NULL);  -- repeat
SELECT * FROM public.ziko_get_waitlist_founder_status();
```
EXPECT: first call `is_new` true, `is_founder` true, `founder_rank` 1 (fresh DB); repeat call `is_new`
false, same rank, no error. The function is service_role-only; an anon call failing is a caller error.
Also covers Phase 5's carried-forward "real submission success/duplicate" gap at DB level. Drop the
database afterwards. No production counterpart exists: production rows are real.

## Section 8 - Reveal threshold 200 -> 30 (PRODUCTION WRITE, human-fired, explicit authorization)
READ (before): `SELECT value, jsonb_typeof(value) FROM public.ziko_app_config WHERE key='waitlist_reveal_threshold';` -> 200 / number.
FIRE: `UPDATE public.ziko_app_config SET value='30'::jsonb, updated_at=now() WHERE key='waitlist_reveal_threshold';` -> `UPDATE 1`.
EXPECT (after READ): 30 / number. Meaning: the counter stays hidden until remaining <= 30, i.e. 170 of
200 claimed; at 94 claimed it is hidden. `SELECT * FROM public.ziko_get_waitlist_founder_status();`
-> `should_display` false.
ROLLBACK: same UPDATE with `'200'::jsonb`.

## Section 9 - Legal text live (reads, before section 10)
`curl -sI <site>/fr/cgv`, `<site>/fr/cgu`, `<site>/en/cgv`, `<site>/en/cgu`: all four 200 (a redirect chain
ending on the same document is fine). Open one in a browser: it must render the terms, not an error
page. Any failure stops here: the flag does not flip.

## Section 10 - Enable the credit cap (PRODUCTION WRITE, human-fired, after 6 and 9 are green)
READ (before): `SELECT value, jsonb_typeof(value) FROM public.ziko_app_config WHERE key='premium_credit_cap_enabled';` -> false / boolean.
FIRE: `UPDATE public.ziko_app_config SET value='true'::jsonb, updated_at=now() WHERE key='premium_credit_cap_enabled';` -> `UPDATE 1`.
EXPECT (after READ): true / boolean. A string type means the flag is silently off
(`creditGate.ts` tests `value === true`): reissue. creditGate re-reads on every request, so no deploy.
After the flip the 21 grandfathered premium users run on the finite 300/month allocation, like everyone.
ROLLBACK (allowed, immediate, no deploy): `UPDATE ... SET value='false'::jsonb ...` and repeat the READ.

## Section 11 - Public surface and carried-forward Phase 5 gaps
Click every entry point on `<site>` in fr and en (homepage founders section, both `/coachs` CTAs landing
on `/fondateurs` with the coach profile pre-selected, header, footer); confirm the founders path is in
the served sitemap. Submit one real address you control: this CREATES a real row (no cleanup, no
TRUNCATE); resubmit the same address and confirm an indistinguishable response. Look for the
`waitlist_signup` event in Vercel Analytics (external dashboard, backstop check; links working says
nothing about the event). FOND-06 live reveal: it needs the threshold raised, which is a production
write; do it only with separate explicit authorization, and restore to 30 in the same sitting. Otherwise
record the gap as open (the disposable-DB test in section 7 covers the RPC, not the display).

## Section 12 - Rollback summary
Flag back to false (section 10); threshold back to 200 (section 8); delink entry points; Vercel previous
deployment. There is no irreversible step in this procedure. Do not improvise anything else.
