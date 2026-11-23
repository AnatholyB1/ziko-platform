# UAT branch bootstrap — Supabase branch `uat-v1-20` (ref oloobswzsziidjwycthm)

Date: 2026-11-12. Branch is disposable. Prod (`portfolio`, ubxllsvanurkwkohzxau) was only READ.

## What was applied (branch only)
1. Extensions: unaccent, pg_trgm, btree_gist (pg_net / pgcrypto / pg_cron already present).
2. `scripts/portfolio-migration/00-bootstrap-supabase-functions.sql`
3. All 16 files of `supabase/portfolio-migrations/` in filename order (20261001101852 ... 20261111130000).
   Applied with `supabase db query --linked --project-ref oloobswzsziidjwycthm -f <file>` (NOT `db push`,
   NOT recorded in supabase_migrations.schema_migrations).
4. 10 `ziko-*` storage buckets (config copied from prod: public flag, size limit, mime types). Storage policies
   come from migration 20261002160000 (25 policies).
5. Reference data copied from prod (no user data): ziko_plugins_registry (19), ziko_exercises (1318, non-custom),
   ziko_food_database (7932).
6. Empty schemas `goh, goh_preview, sellerie, sellerie_preview, viktor, viktor_preview` created. REQUIRED: the
   branch inherits prod's PostgREST exposed-schemas list; those schemas did not exist, so PostgREST failed to
   build its schema cache (PGRST002, SQLSTATE 3F000) and every REST call failed. Not related to ziko schema.
7. 2 accounts (created by SQL into auth.users + auth.identities, bcrypt, app=ziko metadata so the signup
   triggers fired): uat-athlete@uat.ziko.test (role client, onboarding_done, goal strength) and
   uat-coach@uat.ziko.test (role coach, ziko_coach_profiles kyc_status=verified), linked by one
   ziko_coach_client_links row. email_verified_at set on both. Credentials: `.uat/env` (gitignored; `.uat/`
   added to .gitignore).

## Verified (branch vs prod)
| item | prod | branch |
|---|---|---|
| ziko_* tables | 104 | 104 |
| tables with RLS on | 104 | 104 |
| policies on ziko_* | 181 | 181 |
| ziko_* functions | 42 | 42 |
| triggers on ziko_* tables | 19 | 19 |
| auth.users triggers | 2 | 2 |
| indexes on ziko_* | 261 | 261 |
| storage policies mentioning ziko | 25 | 25 |
| ziko buckets | 10 | 10 |
Also proven: password login HTTP 200 for both accounts; as athlete, REST `ziko_user_profiles` returns only the
athlete's own row (RLS effective), `ziko_coach_client_links` and `ziko_plugins_registry` readable.

## NOT proven / residual risks
- Counts match, but policy/function BODIES and grants were not diffed against prod (they come from the same
  generated migrations, so drift is unlikely but unchecked).
- Branch Auth settings (email confirmation, SMTP, redirect URLs, rate limits, providers) were not inspected.
  Users were inserted via SQL, not the GoTrue admin API; sign-in works, sign-up/reset flows are untested.
- App-level email verification (ziko_email_verify_settings secret row) is NOT configured; email_verified_at was
  set manually on the 2 accounts only. New signups on the branch will hit the unverified path.
- Edge functions, cron jobs (pg_cron entries), DB webhooks (supabase_functions.hooks) and Vault secrets were not
  recreated; any feature that depends on them will not work on the branch.
- Branch still holds the other repo's 31 non-ziko tables and its MIGRATIONS_FAILED status; untouched.
- Branch has no coach data besides the profile/link (no programs, forms, dashboards, exercises of the coach).
- authenticator statement_timeout was briefly raised to 60s while debugging and restored to 8s (not the cause).

## Missing / how to obtain
- Service-role key: NOT available via the Supabase MCP (get_publishable_keys returns only anon + publishable).
  Get it from Dashboard > branch uat-v1-20 > Settings > API Keys, or `supabase branches get uat-v1-20 -o env`
  (CLI). Needed only for web server code (SUPABASE_SERVICE_ROLE_KEY) and RLS integration tests; the mobile app
  and backend use the publishable key only.
- Pointing the app at the branch: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY and backend
  SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY = values in `.uat/env`.
