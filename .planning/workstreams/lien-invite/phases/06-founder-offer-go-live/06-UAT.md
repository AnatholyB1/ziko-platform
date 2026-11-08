# Phase 06 — UAT (real submission on a disposable database)

Run: 2026-11-07, branch `phase/06-uat`, agent U6. Closes the two accepted Phase 5 gaps (real `/fondateurs`
success + duplicate states; live FOND-06 counter reveal) and runs the backend RLS suite on the portfolio schema.

## Stack actually used (all local, nothing real touched)

| Layer | Real or proxy |
|---|---|
| PostgreSQL 18.6 (local scoop install, port 54440) | real Postgres, **not** Supabase-managed |
| Schema | the real `supabase/portfolio-migrations/*.sql` (+ `00-bootstrap`), applied in the CI order; **storage-policies migration skipped** (no storage service), `pg_net` stubbed |
| Auth | **real GoTrue** (supabase/auth v2.170.0, built locally; Windows patch: SO_REUSEPORT hook removed) — own `auth` schema, real `admin.createUser` / password sign-in |
| REST | **real PostgREST 16.5** behind a 40-line node gateway mapping `/rest/v1` and `/auth/v1` (what Kong does) |
| Web app | real `next dev --turbopack` on 3141, real server action `claimWaitlistSpot`, real supabase-js with a service-role JWT signed by a throwaway secret |
| Browser | Playwright (`playwright-core` 1.65, headless chromium shell); 390x844 = mobile emulation (isMobile, touch, DPR 2), 1440x900 desktop |
| Rate limit | `apps/web/src/lib/ratelimit.ts` **fails open** when `UPSTASH_REDIS_REST_URL/TOKEN` are absent (returns `success:true`), and the action also catches Upstash outages. So the rate limiter was **not exercised** (no Upstash). |
| BotID | `checkBotId()` runs in its local-dev bypass (isBot=false); not exercised for real |

Reproduce: `scripts/founder-offer-go-live/uat/01-setup.sh` -> `02-run-web.sh` -> `03-run-uat.mjs` -> `05-run-rls.sh` -> `06-teardown.ps1`
(`04-start-api.sh` restarts PostgREST+gateway). Machine lock is taken around the DB start only.

## Results (36/36 checks pass after the fix below; `uat/results.json`)

| Check | Result | Evidence |
|---|---|---|
| Locales fr+en x audiences athlete+coach x 390x844 + 1440x900 render, picker offers both | PASS | A-* rows in results.json; `uat/form-{fr,en}-{390x844,1440x900}.jpg` |
| Consent checkbox unchecked by default, a separate `input[type=checkbox]` (not inside the submit), submit disabled until ticked | PASS (all 4 locale/viewport combos x 2 audiences) | `checked=false submitDisabled=true separate=true` |
| RGPD notice at point of collection (controller, purpose) shown with the form, fr and en | PASS | notice "Ziko (responsable du traitement) collecte votre adresse e-mail pour vous informer du lancement..." / "Ziko (data controller) collects your email address..." |
| Disposable domain refused (mailinator.com en/athlete, yopmail.com fr/coach), same sentence as bad syntax, no row written | PASS | `rows=0`; `uat/disposable-refused-en-1440x900.jpg` |
| WAIT-05 real submit success (fr/athlete, 390x844, UTM params) | PASS | "Vous êtes fondateur·rice n°1 sur 200."; row `athlete|fr|founder|rank 1|consent_version set|consent_given_at set|uat|wave1`; `uat/success-founder-fr-390x844.jpg` |
| WAIT-05 real submit en/coach, 1440x900 | PASS | "You're founder #2 of 200."; `uat/success-founder-en-1440x900.jpg` |
| WAIT-06 duplicate (Gmail dot + `+suffix` variant, other audience) => neutral success, no rank, no second row, stored audience untouched | PASS | "Vous êtes inscrit·e ! Nous vous préviendrons dès le lancement." rows=1 audience=athlete; `uat/duplicate-neutral-fr-390x844.jpg` |
| WAIT-06 exact duplicate (other locale) => same neutral success | PASS | en generic sentence |
| WAIT-06 no oracle: duplicate text byte-identical to a brand-new non-founder (201st) success text | PASS | both = generic sentence |
| FOND-06 default threshold 30: hidden at 100 and 169 claimed, appears at 170 with the real value 30 | PASS (seeded) | counter JSON in results.json |
| FOND-06 live reveal, threshold set to 12 on the disposable DB: hidden at 187 claimed (13 left), then 12>11>10>9>8 after 5 **real UI submissions**; only decreases; every value = 200 - claimed rank | PASS | `observed` array; `uat/counter-live-fr-1440x900.jpg` |
| FOND-06 "Plus que 1" at 199, 200th real signup told #200, widget flips to the complete state, 201st real signup = non-founder generic success (rank 201 stored, never shown) | PASS (seeded) | `uat/counter-one-left-fr-390x844.jpg`, `uat/counter-complete-fr-390x844.jpg` |

What was **simulated**: the climb to 186/199 founders used the real `ziko_claim_waitlist_signup` RPC called from SQL (real sequence,
real unique index), not 199 browser submissions. Everything at the reveal edge (187..192, the 200th, the 201st) was a real browser submission.
Not proven: Upstash limiting, BotID, Resend/email, Vercel edge caching of `/api/waitlist/count` (`s-maxage=30` only matters behind a CDN; in
dev the value was fresh on every load), production build mode (ran `next dev`).

## Bugs found

| SEV | File:line | Problem | Fix |
|---|---|---|---|
| HIGH (fixed) | `apps/web/src/components/marketing/WaitlistFounderBanner.tsx:17,27`; `FoundersOfferSection.tsx:18` | `t('success.founder')` / `t('counter.remaining')` were called on the server without the `{rank}` / `{remaining}` argument. next-intl raises FORMATTING_ERROR and returns the key, so a new founder saw the literal text `fondateurs.success.founder` instead of "fondateur n°N", and the counter never rendered a number (pre-threshold sentence also vanished) on `/fondateurs` and the home section. Unit tests passed because they feed strings directly to the client components. | Pass the raw ICU template: `t.raw('success.founder') as string`, `t.raw('counter.remaining') as string` (client does the `.replace`). Applied; 36/36 after. |
| MED | `supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql:1663-1665` (and every table block) | Generated grants give `anon` and `authenticated` full DML (INSERT/UPDATE/DELETE/TRUNCATE...) on `ziko_app_config` and all tables; protection relies on RLS alone. Two RLS specs that expect an *error* for `anon.update` on `ziko_app_config` fail (`waitlist-config-rpc.spec.ts:38`, `premium-credit-gate.spec.ts:91`): RLS silently filters instead. Not a data leak (deny-all policy holds) but table privileges are broader than the pre-migration intent. | Add a portfolio migration `REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON ziko_app_config, ziko_waitlist_signups FROM anon, authenticated;` (or relax the specs to assert "0 rows affected"). Needs a decision, not applied. |
| LOW | `backend/api/test/rls/onboarding-profile.spec.ts:192` vs `20261001101853_portfolio_ziko_functions.sql:856` | Spec expects `next_review_due_at` null after `onboarding_profile`; the function now stamps `NOW()+7d` for onboarding_profile (its own comment says so). Spec drift. | Update the spec. |
| LOW | `backend/api/test/rls/weekly-review-duplicate-fire.spec.ts:152,241` | `runWeeklyReview` returns `no_state` instead of `already_recorded`/success on the portfolio schema; not triaged (athlete_state seeding path; may depend on seed data absent locally). | Investigate on a seeded DB. |
| INFO | `backend/api/test/rls/coach-rls.spec.ts:200` | needs `seed.sql` exercises (not loaded locally) — environment, not a defect. | Load seed on the test project. |

## Backend RLS suite (`backend/api` `test:rls`, 16 files, 129 tests) on the disposable portfolio schema

First ever run on the portfolio schema: **118 pass / 11 fail** with an empty `ziko_app_config`. After seeding the three config rows the
specs expect (`waitlist_reveal_threshold`=30, `waitlist_retention_years`=3, `premium_credit_cap_enabled`=false — data, not schema, which
`05-load-data` carries in the real migration) and a clean waitlist table: **123 pass / 6 fail** — the 6 are the rows in the bug table
(2 grant-posture, 1 onboarding spec drift, 2 weekly-review, 1 missing exercise seed). All waitlist specs pass except the one grant-posture
assertion (`waitlist-rls.spec.ts` 19/19, `waitlist-config-rpc.spec.ts` 11/12). The suite ran against real GoTrue, so auth-dependent specs are genuine.
Caveat: tests ran from a stubbed `pg_net`, no storage service, local PG 18 rather than Supabase's PG 15/17 build.

## Teardown

`06-teardown.ps1` run at the end: processes on 3141-3144 killed by port, disposable Postgres stopped, `apps/web/.env.local` and the scratch
directory removed. The production portfolio project (`ubxllsvanurkwkohzxau`) and any real credential were never referenced.

## Addendum — client-DML revoke + red-spec triage (builder B7, branch `phase/06-revoke-rls`)

Same disposable stack, ports 54450 / 3151-3154 (scripts now honour `UAT_*_PORT`, `UAT_PORTS` for teardown). Production portfolio project not touched.

### Migration `supabase/portfolio-migrations/20261107170000_ziko_revoke_client_dml.sql`

Static, idempotent REVOKEs for **every** `ziko_*` table (99), nothing else. Derivation: `pg_policy` as built by all portfolio migrations + a scan of every
`.from('ziko_*')` writer in apps/, plugins/, packages/, backend/api/src (the only dynamic `.from(var)` is a read in onboarding `ziko-chat.tsx`).
Rules: (1) TRUNCATE/REFERENCES/TRIGGER/MAINTAIN revoked from anon+authenticated everywhere; (2) anon loses INSERT/UPDATE/DELETE everywhere except
3 supplement catalog tables that have explicit `TO anon` write policies and are written by the scraper with the anon key; (3) authenticated keeps a DML
privilege only if a policy covers it AND some code path writes the table with `.from()` (xp/coin/badge/gift/shop writes are SECURITY DEFINER RPCs); (4) server-only
credit tables (`ziko_user_ai_credits`, `ziko_ai_credit_transactions`, `ziko_user_promo_redemptions`; service-key writers + definer RPCs) are SELECT-only for authenticated.
SELECT untouched. Default privileges deliberately not altered (shared project; every new ziko table migration must REVOKE explicitly).
Matrix evidence: `uat/privilege-matrix-before.txt`, `uat/privilege-matrix-after.txt`.

| | before | after |
|---|---|---|
| tables with TRUNCATE/REFERENCES/TRIGGER/MAINTAIN for anon+authenticated | 99 x 2 | 0 |
| anon holds DML | 96 tables full DML | 3 tables (supplement brands/prices/catalog, intentional) |
| authenticated holds full I/U/D | 92 | 48 full + 22 partial; 29 SELECT-only (config, credits, ledgers, waitlist, definitions, gifts/xp/coin ledgers, ...) |

Proof as the real roles: `authenticated UPDATE ziko_user_ai_credits` -> permission denied (was allowed by the `_own` policy: a user could set their own balance);
`anon|authenticated TRUNCATE ziko_habits` -> permission denied; `anon DELETE ziko_waitlist_signups` -> permission denied; kept paths (anon supplements, authenticated own-row writes) still work.
Re-applying the file twice in a transaction: no error. UAT after migration: **36/36**. Backend RLS suite: **123/129 before -> 129/129 after** (with the spec fixes below).

### The 6 red RLS specs — disposition

| Spec | Verdict | Evidence / action |
|---|---|---|
| `premium-credit-gate.spec.ts:91`, `waitlist-config-rpc.spec.ts:38` (anon write to `ziko_app_config` expects an error) | real grant posture bug, **fixed in code** (migration) | now `42501`; specs unchanged and green |
| `onboarding-profile.spec.ts:192` | stale spec | migration 44-01 (Delta 2) deliberately stamps `next_review_due_at=NOW()+7d` on `onboarding_profile` (function comment + `athlete-decisions.spec.ts` asserts it). Spec updated: last_review_at null, due ~ now+7d |
| `weekly-review-duplicate-fire.spec.ts:152,241` (`no_state`) | **test-harness bug** (pre-existing, also in CI): `src/tools/db.ts clientForUser()` reads `SUPABASE_SERVICE_KEY` and falls back to the anon key; the test env only defines `SUPABASE_SERVICE_ROLE_KEY`, so `fetchWeeklyReviewContext` read `ziko_athlete_state` as anon -> 0 rows -> `no_state`. Fixed in `test/setup.ts` (maps ROLE_KEY -> SERVICE_KEY, tests only) |
| `coach-rls.spec.ts:200` (needs exercises seed) | env | spec now self-seeds a throwaway `ziko_exercises` row when `seed.sql` is absent and removes it |
| side effect of the migration | `waitlist-rls.spec.ts` 4 tests asserted the old "silent 0 rows" posture; now PostgREST answers 42501 for anon/authenticated UPDATE/DELETE | assertion widened to "no row written" (42501 or empty) |

### Bugs found (ziko scope)

| SEV | File:line | Problem | Fix |
|---|---|---|---|
| HIGH (fixed) | `supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql:1634+` | every ziko table granted all privileges to anon/authenticated; user could write own `ziko_user_ai_credits.balance`; anon could TRUNCATE any table | new revoke migration |
| MED | `backend/api/src/routes/supplements.ts:5-8`, `scrapers/index.ts` + policies `*_anon_write` (`USING true`) | the supplement catalog scraper writes with the anon (publishable) key, so anyone holding the public anon key can rewrite/delete the supplement catalog | follow-up: scraper -> service role, then drop the 3 anon-write policies and the 3 kept anon DML grants |
| MED | `backend/api/src/services/creditService.ts:14`, `middleware/creditGate.ts`, `coach/ai/service.ts:30` | `SUPABASE_SERVICE_KEY ?? SUPABASE_PUBLISHABLE_KEY` silent fallback: when the service key is missing, credit writes fail under RLS instead of the process refusing to start | fail fast when the key is absent in production (not changed: needs env confirmation) |
| LOW | `plugins/pantry/src/screens/{PantryPlugin,RecipeDetail,ShoppingList}.tsx` | read/write unprefixed `shopping_list` / `shopping_list_items`; no such table exists in the portfolio schema (codemod miss or never created) | confirm intent, add table migration or prefix |
| INFO | tables with `authenticated` DML kept by policy (ziko_coach_*, ziko_ai_cost_log, ...) | backend mixes service-key and user-JWT clients, so a tighter per-table cut needs a code audit | follow-up |

Teardown: `UAT_ROOT=... UAT_PORTS=3151,3152,3153,3154 06-teardown.ps1`, ports 3151-3154 and PG 54450 stopped, scratch removed.
