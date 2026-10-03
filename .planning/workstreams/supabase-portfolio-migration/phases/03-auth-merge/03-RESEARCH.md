# Phase 3: Auth Merge - Research

**Researched:** 2026-10-01
**Domain:** Supabase GoTrue `auth` schema transplant between two Postgres 17.6 projects, shared-pool trigger scoping, auth config merge, user notification
**Confidence:** HIGH on schema/data facts (live-queried today), MEDIUM on auth-config merge (no access token in session), MEDIUM on GoTrue login behavior for hand-inserted rows (to be proven in rehearsal)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The colliding user (ziko `auth.users.id` `ea0f0b65-6681-4780-8ee0-dbf20b95d4d9`, masked `a***@***.com`) is confirmed by the user to be the **same person** as the existing portfolio account.
- **D-02:** **Portfolio's UUID wins.** The existing portfolio `auth.users` row is untouched (zero regression on `rh_*`/`gecko_*`). Phase 4's data copy must remap `user_id` `ea0f0b65…` → the portfolio UUID across every `ziko_*` table/column that references it (scripted, with a dedicated verification step). This is the single exception to "IDs preserved".
- **D-03:** For the merged user, **keep portfolio's password**; copy any ziko `auth.identities` (OAuth links) re-pointed to the portfolio UUID. Do not copy ziko's `encrypted_password` for this user. The user is told via the re-login notice (D-12).
- **D-04:** Re-run the collision check immediately before the real write and again at final delta sync (ziko is live; the collision set can grow). Any *new* collision is a blocking human checkpoint, never auto-resolved (Phase 1 D-01).
- **D-05:** `ziko_handle_new_user` / `ziko_handle_new_user_credits` are gated by a **signup metadata flag**: they early-return unless `NEW.raw_user_meta_data->>'app' = 'ziko'`. Mobile, web, and backend signup paths (including OAuth) must pass `options.data { app: 'ziko' }` — the call-site changes belong to Phase 6; Phase 3 delivers the gated functions and documents every signup path that must set the flag.
- **D-06:** **Sequencing:** import the 39 users with **no triggers attached** (avoids duplicate profile/credit rows, since Phase 4 copies those). Then attach the gated triggers on `portfolio`'s `auth.users` after import and before cutover (completes the deferral from Phase 2 D-02).
- **D-07:** Verification (success criterion 3): a test signup on an `rh_*`/`gecko_*` path produces zero Ziko-side rows, and a flagged Ziko test signup produces profile + credits. Test users are cleaned up afterwards.
- **D-08:** Write users via **direct SQL `INSERT` into `auth.users` and `auth.identities`** (service-role/Postgres connection, in a transaction), copying id, `encrypted_password`, metadata, timestamps, and confirmation fields exactly. This deviates from ROADMAP/REQUIREMENTS wording ("Admin API `createUser`") in favor of full fidelity for IDs, hashes and identities; validate with real login tests on a sample of users in the scratch rehearsal.
- **D-09:** The import script is **idempotent** (`ON CONFLICT (id) DO NOTHING`, collision pre-check). Flow: rehearse on the Phase 2 scratch project → real run on `portfolio` in Phase 3 → **delta re-run right before Phase 6 cutover** to catch signups made on ziko in between. `ziko_waitlist_founder_seq` `setval` is read live from ziko at that final run (87 on 2026-10-01 — never hardcode).
- **D-10:** Email templates are global per project and cannot be additive, so **portfolio's existing templates are kept untouched**. Ziko-specific mail goes through the backend/Resend path already in place. Redirect URLs (and any providers/site URL entries) are merged **additively** — snapshot portfolio's config before and diff after to prove nothing was removed/overwritten.
- **D-11:** Document the JWT-secret consequence: ziko sessions cannot carry over, all 39 users must re-login after cutover.
- **D-12:** Notify users by **email via Resend (FR primary, EN) plus an in-app banner/alert on the current ziko app**. Phase 3 delivers the recipient list, template and send script; the actual send date is chosen during Phase 6 planning (a few days before cutover).

### Claude's Discretion
- Script language/location for import, collision check, and verification (must follow repo conventions; `.js` import suffix rule applies to backend TS).
- Exact set of `auth.users` columns copied (all non-generated columns, excluding anything instance-specific such as `instance_id` which must be set to portfolio's value).
- Format of the auth-config before/after snapshot and PII-safe handling (no raw emails in git-tracked files, per Phase 1 protocol).

### Deferred Ideas (OUT OF SCOPE)
- Backend auth middleware tenant check and signup call-site metadata changes — Phase 6.
- Actual send date of the re-login notice — decided in Phase 6 planning.
- "Trigger + lazy provisioning fallback" (idempotent ensure-profile on first login) — considered as a hardening option; revisit in Phase 6 if flag coverage proves incomplete.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTHMIG-01 | 39 accounts migrated, UUID preserved, hash pass-through | Column parity table below; 38 clean inserts + 1 collision handled separately; txn insert proven on scratch; D-08 SQL path via `supabase db query --file` |
| AUTHMIG-02 | `auth.identities` copied for OAuth-linked accounts | Ziko has 39 identities, **all provider `email`, zero OAuth**; copy all 39 (38 as-is, 1 re-pointed). Google provider is disabled on both projects |
| AUTHMIG-03 | Triggers scoped to Ziko signups | Gated function bodies + trigger DDL proven on scratch (rolled back); OAuth cannot carry the flag (see Pitfall 3) |
| AUTHMIG-04 | Auth config merged additively | `supabase config push` is DANGEROUS (overwrites); use Management API read-merge-write; needs a PAT not present in this session |
| AUTHMIG-05 | Users informed of re-login | Resend path exists in `backend/api`; no `packages/email` template yet; mobile banner needs a release |
</phase_requirements>

## Summary

The schema side is the easy part: `auth.users` (35 columns) and `auth.identities` (9 columns) are **column-for-column identical** between ziko and portfolio (names, types, nullability, generated flags), and both are the same GoTrue family on Postgres 17.6. The only generated columns are `auth.users.confirmed_at` and `auth.identities.email`; they must be excluded from the INSERT column list. Ziko's `instance_id` is the all-zeros UUID on all 39 rows, which is also portfolio's value for 5 of its 6 users, so it can be copied verbatim. Every ziko identity has `provider='email'` and `provider_id = user_id::text`; there are zero OAuth identities and Google OAuth is disabled on both projects (checked via the public `/auth/v1/settings` endpoint).

Three live findings change the picture versus CONTEXT.md and need planner attention. (1) The **collision account on portfolio has no password hash, no identities and a NULL `instance_id`** (created 2026-05-22), so D-03 "keep portfolio's password" leaves that person with no password at all; this needs a user confirmation (Open Question 1). (2) Portfolio now has **6 users, not 5** (one created after the Phase 1 audit, still only 1 email collision), which validates D-04's re-check. (3) **`signInWithOAuth` has no `data`/metadata option**, so D-05's "including OAuth" is not achievable at the client; today it is moot (Google is disabled) but it must be documented and any future OAuth enablement needs the lazy-provisioning fallback.

Auth-config merge cannot be completed from this session: no `SUPABASE_ACCESS_TOKEN` is in the environment and the CLI has no "read auth config" command. `supabase config push` rewrites config from a local `config.toml` and must not be used on portfolio. The plan needs a human checkpoint to supply a PAT (or to read redirect URLs from the dashboard) and a read-merge-write script against `GET/PATCH /v1/projects/{ref}/config/auth`.

**Primary recommendation:** Build one idempotent Node script (`scripts/auth-merge/`, `.mjs`, transport = `supabase db query --linked --project-ref <ref> --file`, same as the Phase 2 tooling) that exports ziko rows as JSON, generates a single-transaction `INSERT ... SELECT ... FROM jsonb_populate_recordset(null::auth.users, ...) ON CONFLICT (id) DO NOTHING` with the column list built live from `information_schema` (`is_generated='NEVER'`), handles the collision user by a separate explicit branch, and prints only counts/masked ids.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| auth.users / identities import | Database / Storage | Operator script | Direct SQL per D-08; GoTrue only reads the rows afterwards |
| Signup-trigger scoping | Database / Storage | API / Backend (Phase 6 call sites) | Trigger lives on `auth.users`; flag set by clients/backend |
| Auth config merge (redirects, site URL) | Supabase Management API | Operator | Project-level config, not in DB |
| Re-login notice email | API / Backend (Resend) | Operator send script | Resend key and sender domain live in backend env |
| In-app banner | Browser/Client (web) + Mobile client | — | Needs a code change and release per surface |
| Waitlist sequence | Database / Storage | — | `setval` on `public.ziko_waitlist_founder_seq` |

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Supabase CLI `supabase db query --linked --project-ref --file` | 2.116.0 installed (2.119.0 available) | Transport for all SQL (read and write) | Already the Phase 2 pattern (`01-generate-rename-map.mjs`, `03-run-verify.mjs`); verified live that a `--file` with BEGIN/INSERT/ROLLBACK runs as `postgres` and rolls back cleanly [VERIFIED: live probe on scratch] |
| Node ESM `.mjs` scripts in `scripts/` | Node 20 | Import, verify, notice send | Matches `scripts/portfolio-migration/*.mjs`, `scripts/purge-test-accounts/*.mjs` |
| `resend` | ^6.12.3 (backend/api dep; also hoisted in root `node_modules`) | Notice email | Already used for WeeklyDigest [VERIFIED: backend/api/package.json] |
| `@react-email/components` | ^1.0.12 | Notice template | Already the `packages/email` stack [VERIFIED: packages/email/package.json] |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@supabase/supabase-js` (already in repo) | Admin API `getUserById` / login probes (`/auth/v1/token`) for post-import verification | Rehearsal login test and portfolio GET-by-id check |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL INSERT (D-08, locked) | Admin API `createUser` | Cannot preserve hashes+identities+timestamps with fidelity; locked out by D-08 |
| `supabase db query` | `pg` driver / direct DB connection | `pg` is not installed in the repo; needs DB password handling; no benefit at 39 rows |

**Installation:** nothing new. Notice script reuses `resend` and `@react-email/components`; if the template goes into `packages/email`, `tsup.config.ts` has a single hard-coded entry (`src/templates/WeeklyDigest.tsx`) and `package.json` `exports` lists only WeeklyDigest, so both must be extended (or keep the template inside the script folder and render with `@react-email/render`).

## Package Legitimacy Audit

No new external packages are recommended. `resend`, `@react-email/components`, `@supabase/supabase-js` are existing repo dependencies, not newly introduced. slopcheck not run (nothing to install).

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Live Facts (queried 2026-10-01, schema/count queries only, no PII)

### Column parity
| Table | ziko cols | portfolio cols | Diff | Generated | NOT NULL |
|-------|-----------|----------------|------|-----------|----------|
| `auth.users` | 35 | 35 | none (name+type+nullability+generated) | `confirmed_at` | `id`, `is_sso_user`, `is_anonymous` |
| `auth.identities` | 9 | 9 | none | `email` | `provider_id`, `user_id`, `identity_data`, `provider`, `id` |

Constraints/indexes are also identical on both: `users_pkey(id)`, `users_phone_key UNIQUE(phone)`, **`users_email_partial_key UNIQUE(email) WHERE is_sso_user=false`**, `identities_pkey(id)`, `identities_provider_id_provider_unique UNIQUE(provider_id, provider)`, `identities_user_id_fkey ... ON DELETE CASCADE`. Consequence: `ON CONFLICT (id) DO NOTHING` does **not** guard the email unique index; a second email collision would raise a unique violation and abort the whole transaction. This is desirable (fails loudly, D-04) but the pre-check must run first and the script must not use a bare `ON CONFLICT DO NOTHING`. [VERIFIED: live pg_constraint/pg_indexes]

### ziko `auth` data shape
- 39 users, 39 identities, no user without an identity; 0 MFA factors; 1 one-time-token; 52 sessions (dropped on cutover, matches D-11); no last sign-in in the last 7 days; 0 users created since 2026-09-22.
- All `instance_id` = `00000000-0000-0000-0000-000000000000`; all `aud='authenticated'`, `role='authenticated'`; no anonymous, no SSO, no phone, no banned users; all hashes start `$2a$` (bcrypt); all email-confirmed.
- All identities: `provider='email'`, `provider_id = user_id::text`, `identity_data` keys `{email,email_verified,phone_verified,sub}` (+`full_name` on 21). `raw_app_meta_data = {"provider":"email","providers":["email"]}` on all.
- 18 users have `raw_user_meta_data = {"email_verified":true}`; 21 have `email,email_verified,full_name,phone_verified,sub`. **None has an `app` key** (so imported rows never satisfy the gate; see Pattern 3).
- Every ziko user already has a `user_profiles` and `user_ai_credits` row on ziko (0 missing), so Phase 4's data copy supplies them and triggers must not fire for imports.
- Two triggers on ziko `auth.users`: `on_auth_user_created`, `on_auth_user_created_credits`. Portfolio: **0** triggers.

### portfolio `auth` data shape
- **6 users** (Phase 1 recorded 5; one was created after 2026-09-22), 4 identities. 2 users have no identity; 1 has `NULL` password hash; 1 has `NULL` `instance_id` (5 have all-zeros).
- Collision check re-run today via MD5-of-lowercased-email compare (hashes held only in memory/scratchpad, files deleted): **1 collision**, same as Phase 1.
- **The collision account on portfolio (id `2b6a60fa-f37a-45a8-bf3f-e6b6681917e5`)**: no password hash, 0 identities, NULL `instance_id`, created 2026-05-22. The ziko side (created 2026-03-18, last sign in 2026-05-31) has a hash and 1 identity.
- Public `/auth/v1/settings` on both projects: only `email` provider enabled, `disable_signup=false`, `mailer_autoconfirm=true`.
- Postgres role used by the CLI is `postgres` (not superuser, BYPASSRLS true) with `INSERT` on `auth.users`/`auth.identities` and `TRIGGER` on `auth.users` even though the table owner is `supabase_auth_admin`. [VERIFIED: has_table_privilege + a rolled-back CREATE TRIGGER / INSERT on scratch]

### Waitlist sequence
Ziko `public.waitlist_founder_seq`: `last_value=87, is_called=true` (next value is 88). Portfolio `public.ziko_waitlist_founder_seq`: `last_value=1, is_called=false`. [VERIFIED: live]

**Trap:** `public.ziko_reset_waitlist_founder_sequence(p_next_value)` calls `setval(seq, p_next_value, false)`, i.e. `p_next_value` is the NEXT value returned. Passing 87 would re-issue 87. Do the direct `SELECT setval('public.ziko_waitlist_founder_seq', <last_value>, <is_called>)` copying both fields, or call the function with `last_value+1` when `is_called` is true.

### Columns referencing `auth.users` (UUID remap scope for Phase 4, D-02)
Portfolio has FKs from ~100 `ziko_*` columns to `auth.users(id)` (most `ON DELETE CASCADE`, a few `SET NULL`). The remap list is derivable at run time from `pg_constraint` where `confrelid='auth.users'::regclass` and the referencing table name starts with `ziko_`; do not hardcode. Examples that matter: `ziko_user_profiles.id`, `ziko_coach_client_links.{client_id,coach_id}`, `ziko_coach_invitations.{coach_id,used_by}`, `ziko_ai_tool_audit.{coach_id,target_client_id}`, `ziko_friendships.{requester_id,addressee_id}`, `ziko_workout_programs.{user_id,assigned_to_user_id,created_by_coach_id}`.

**Columns with a user UUID but NO FK to auth.users (a remap that only follows FKs would miss these):** `ziko_exercises_merge_backup.user_id`; `ziko_coin_transactions.source_id` and `ziko_xp_transactions.source_id` are polymorphic source ids (may equal a user id for gifts; inspect). Also text/JSON content (`ziko_ai_messages`, `ziko_athlete_decisions.evidence/outcome`, `ziko_coach_*` JSONB, notification payloads) may embed the user UUID in free-form fields; Phase 4 should grep the collision UUID as a string across the whole dump before and after remap, not only FK columns.

Also affects other phases: **storage paths** in ziko buckets use `<user_uuid>/...` as the first folder and the storage RLS policies match `(storage.foldername(name))[1] = auth.uid()::text`. Objects of the collision user must be re-keyed to the portfolio UUID in Phase 5 (flag to that phase).

**Danger for cascade:** deleting or re-pointing the portfolio row would cascade-delete ziko data; the collision handling must never `UPDATE auth.users SET id=` and never delete/reinsert the portfolio user (its `rh_users`/`gecko_admins` rows cascade).

## Architecture Patterns

### Flow
```
ziko (read-only)                                   portfolio (write)
 auth.users/identities --JSON export--> script --> [txn] collision pre-check (hash compare, count only)
 (scratchpad, ephemeral)                            [txn] INSERT 38 users (jsonb_populate_recordset, explicit non-generated cols)
                                                    [txn] INSERT 38 identities (+ re-pointed identity for collision user)
                                                    [txn] verify counts == expected, else ROLLBACK
                                                    --> attach gated triggers (separate step, after import)
                                                    --> setval waitlist seq (read live at that run)
 Management API (PAT) --GET config--> snapshot --> merge --> PATCH --> GET --> diff (nothing removed)
 recipient list (scratchpad only) --> Resend send script (dry-run default, send flag)
```

### Recommended structure
```
scripts/auth-merge/
├── lib.mjs                   # runSql(ref, sql|file), maskEmail(), column discovery
├── 01-collision-check.mjs    # hash-compare, prints counts + masked ids + portfolio uuid only; exit 1 on new collision
├── 02-import-auth.mjs        # --project-ref required, no default; --dry-run (BEGIN..ROLLBACK) / --apply
├── 03-attach-triggers.mjs    # or a SQL migration in supabase/portfolio-migrations/
├── 04-sync-waitlist-seq.mjs
├── 05-auth-config-merge.mjs  # snapshot / merge / diff via Management API
├── 06-verify.mjs             # idempotent verification suite
├── 07-notify-relogin.mjs     # dry-run default; builds list in memory, never writes emails to repo
└── RUNBOOK.md
```
Keep the `--project-ref` required, no-default rule from `03-run-verify.mjs` (production safety).

### Pattern 1: Column-list-from-catalog import (no hardcoded column list)
Query `information_schema.columns` on the **destination** for `table_schema='auth' AND table_name='users' AND is_generated='NEVER'`, intersect with ziko's, then:
```sql
-- Source: Postgres jsonb_populate_recordset; shape verified on scratch (txn probe)
INSERT INTO auth.users (<non_generated_cols>)
SELECT <non_generated_cols>
FROM jsonb_populate_recordset(null::auth.users, $json$[ ...exported rows... ]$json$::jsonb) r
WHERE r.id <> ALL (<collision ids>)
ON CONFLICT (id) DO NOTHING;
```
Export rows with `select to_jsonb(u) from auth.users u` (the generated `confirmed_at` key is ignored by the explicit column list). Wrap the file in `BEGIN; ... COMMIT;`; note `supabase db query --file` returns only the **last** statement's result, so end with a `SELECT` of counts. Any error aborts the txn (no partial import). Use a `$json$` dollar-quote tag that cannot appear in the data. [VERIFIED: txn+rollback probe; jsonb_populate pattern ASSUMED-OK, prove in rehearsal]

### Pattern 2: Collision user (explicit branch, portfolio row untouched except possibly NULL password)
- Do NOT insert the ziko `auth.users` row for `ea0f0b65-…`.
- Insert ziko's single email identity re-pointed: `user_id = <portfolio uuid>`, `provider_id = '<portfolio uuid>'` (ziko convention `provider_id = user_id::text`), `identity_data.sub = '<portfolio uuid>'`; keep `email`, `email_verified`, `phone_verified`; keep ziko's `created_at`/`last_sign_in_at`. Generate a new identity `id` or keep ziko's (PK is separate, no conflict). `identities_provider_id_provider_unique` is on `(provider_id, provider)`, so there is no clash.
- Resolve the portfolio uuid at run time by email-hash compare, never by hardcoding and never by printing the email.
- Record the mapping `ea0f0b65… -> <portfolio uuid>` in a tracked (non-PII, UUID-only) file such as `scripts/auth-merge/uuid-remap.json` produced by the script; Phase 4 consumes it.

### Pattern 3: Gated trigger functions + triggers
Deliver as a **new** migration under `supabase/portfolio-migrations/` (never edit the two existing files; that series is applied manually, outside CI). Proven on scratch inside a rolled-back txn: after one unflagged and one `{"app":"ziko"}` insert, exactly 1 profile row existed.
```sql
CREATE OR REPLACE FUNCTION public.ziko_handle_new_user() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'app','') <> 'ziko' THEN RETURN NEW; END IF;
  INSERT INTO public.ziko_user_profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END $$;
-- same early-return at the top of ziko_handle_new_user_credits(); keep its existing body
-- (welcome 5 credits, ON CONFLICT (user_id) DO NOTHING, then ziko_ai_credit_transactions row)

CREATE TRIGGER ziko_on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.ziko_handle_new_user();
CREATE TRIGGER ziko_on_auth_user_created_credits
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.ziko_handle_new_user_credits();
```
Current deployed bodies (read live from portfolio): `ziko_handle_new_user` inserts `(id, name)` into `ziko_user_profiles`; `ziko_handle_new_user_credits` has a `search_path=public` (no `pg_temp`) and inserts a balance row with `ON CONFLICT DO NOTHING` plus a `'welcome'/'signup'` transaction row (this second insert is NOT idempotent, which is why the gate and import order matter). Give the triggers `ziko_`-prefixed names so they cannot be confused with, or collide with, future portfolio triggers (ziko's originals were `on_auth_user_created*`).

Sequencing consequence: because imported rows carry no `app` key, attaching triggers **before** the delta re-run is safe, the gate no-ops. Do **not** stamp `app:'ziko'` into imported metadata; that would make the delta insert fire the triggers and duplicate profile/credit rows that Phase 4 copies. Also note trigger functions can be replaced (gated) well before the triggers are attached, so the gated functions can ship in an earlier plan.

### Pattern 4: Auth config additive merge
Management API `GET/PATCH https://api.supabase.com/v1/projects/{ref}/config/auth`, field names `site_url`, `uri_allow_list` (comma-separated string), `jwt_exp`, `external_*`, `mailer_templates_*`, `mailer_subjects_*`, rate limits [CITED: supabase.com/docs/reference/api/v1-update-auth-service-config]. The docs do not say PATCH merges `uri_allow_list`; treat it as full replacement [ASSUMED]. Procedure: GET portfolio config -> save snapshot (it contains secrets, keep in scratchpad, commit only a redacted key list) -> compute union of `uri_allow_list` (portfolio entries first, then ziko's missing ones, dedupe) -> PATCH **only** `uri_allow_list` (never send template or provider fields) -> GET again -> assert every pre-existing entry still present and all other fields byte-equal to the snapshot. Keep `site_url` as portfolio's (single value; ziko's goes into the allow-list). Ziko's redirect URLs come from the same GET on ziko (project `slkobhavpwsubnsmuhya`) plus code scheme URLs (mobile deep link scheme, `https://ziko-app.com/**`, local dev).

### Anti-Patterns to Avoid
- **`supabase config push`:** pushes a local `config.toml` over the linked project; repo has no `supabase/config.toml`, so it would apply defaults to portfolio's shared auth (breaks rh_/gecko_ redirect URLs and settings). Never use it on portfolio.
- **Bare `ON CONFLICT DO NOTHING`** (hides email-unique collisions) and **`UPDATE auth.users SET id`** (cascades).
- Selecting `email` in any command whose output is logged or committed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column list for the transplant | Hardcoded 33-column list | Catalog query on both sides (`is_generated='NEVER'`, intersect) | GoTrue adds columns across versions; both projects are currently identical, but a hardcoded list rots |
| Collision detection | String compare of emails in tracked output | MD5/lowercase hash join in memory, print counts + masked ids | PII rule |
| Password verification | Re-hashing / custom bcrypt checks | GoTrue itself: password grant on a rehearsal user | Only GoTrue proves the row is accepted |
| Config merge | Hand editing in dashboard without snapshot | API read-merge-write with snapshot+diff | D-10 requires proof nothing was overwritten |
| Email rendering/sending | Custom SMTP | Existing `resend` + `@react-email/components` | Already wired, sender domain verified |

## Common Pitfalls

### Pitfall 1: Collision account has no password (D-03 premise is false)
**What goes wrong:** D-03 says "keep portfolio's password", but the portfolio row has `encrypted_password IS NULL` and no identity (likely created via a non-password flow or manual insert; `instance_id` NULL). The merged person has no password on the shared pool and cannot sign in to Ziko until they run a password reset.
**How to avoid:** Get a user decision (Open Question 1). Lowest-risk option: `UPDATE auth.users SET encrypted_password = <ziko hash> WHERE id = <portfolio uuid> AND encrypted_password IS NULL` (guarded so it can never overwrite an existing credential), plus the re-pointed identity. Alternative (literal D-03): leave untouched and have the notice tell this user to use "Forgot password". Either way, test GoTrue password-recovery works with `mailer_autoconfirm=true`/default SMTP limits.
**Warning signs:** `has_password=false` in the pre-check output for the collision row.

### Pitfall 2: Portfolio's NULL `instance_id` user
One portfolio user (the collision account) has `instance_id IS NULL`. GoTrue historically scoped user lookups by `instance_id`; rows with a NULL value may not be found by some GoTrue versions. Not caused by this migration, but if the collision person is to log in, verify with an Admin API `getUserById` / password grant on the rehearsal copy and, if broken, set it to the zeros UUID (changes only a NULL column; confirm with user as it touches a portfolio row). [ASSUMED: GoTrue behavior; prove empirically]

### Pitfall 3: OAuth cannot carry the `app` flag
`signInWithOAuth` options are `redirectTo`, `scopes`, `queryParams`, `skipBrowserRedirect`; no user-metadata option [CITED: supabase.com/docs/reference/javascript/auth-signinwithoauth; docs excerpt silent on `data`, so treat as MEDIUM]. A future Google signup would hit the trigger with no flag and get no profile/credits. Today: Google provider is disabled on both projects and ziko has zero OAuth identities, yet `apps/mobile/app/(auth)/welcome.tsx` still calls `signInWithOAuth({provider:'google'})`. Phase 6 must either keep Google off, or add the deferred lazy ensure-profile fallback. Document it in the signup-path table.

### Pitfall 4: Metadata flag is client-controllable
`raw_user_meta_data` is user-writable at `signUp`, so any rh_/gecko_ client could set `app:'ziko'` and create Ziko rows for itself. Impact is limited (own profile + 5 welcome credits per account) but it is a free-credit vector. A server-set `raw_app_meta_data` flag would be stronger but needs the Admin API and contradicts D-05. Accept per D-05, record as a residual risk; the backend credit gate remains authoritative.

### Pitfall 5: `ziko_reset_waitlist_founder_sequence` is off-by-one for this use
See "Waitlist sequence" above; copy `last_value` and `is_called` with direct `setval`.

### Pitfall 6: Token columns and NULL vs empty string
GoTrue scans token columns (`confirmation_token`, `recovery_token`, `email_change*`, `phone_change*`, `reauthentication_token`) into non-null Go strings in many versions; NULLs can produce 500s at login. Ziko rows come from GoTrue so they should hold `''`; copying verbatim preserves that. Do not "clean" or null them. Verify per-row in the rehearsal by an actual password grant. [ASSUMED]

### Pitfall 7: `supabase db query` limits
Only the last statement's result is returned; errors in the middle abort the file, which is the desired all-or-nothing behavior only when wrapped in `BEGIN/COMMIT`. Large payloads: 39 rows is trivial. A multi-hundred-second statement can hit a client-side timeout; the probes here took 60-100 s for a few statements on scratch (cold login-role init), so use generous timeouts and never retry blindly; always re-run the pre-check (idempotent design handles retries).

### Pitfall 8: In-app banner on mobile needs a release
No existing remote-banner mechanism in mobile (`app_config` is only read by the backend credit gate). Web banner ships via Vercel immediately; a mobile banner only reaches users who install a new binary (the project explicitly forbids forced OTA, REQUIREMENTS "Out of Scope"). Recommend: email is the guaranteed channel; mobile gets a small version-gated alert via `showAlert` driven by a date constant, shipped in the next binary; accept partial coverage and say so in the notice plan.

### Pitfall 9: Test accounts in the recipient list
The repo has a test-account purge workstream (criterion: exact domain `ziko-app.com`). The recipient builder must reuse `isTestAccountEmail` from `scripts/purge-test-accounts/lib.mjs` to exclude test addresses, and count excluded vs sent.

## Signup paths that must set `options.data = { app: 'ziko' }` (Phase 6 work, enumerated here per D-05)
| Path | Location | Notes |
|------|----------|-------|
| Mobile email signup | `apps/mobile/app/(auth)/register.tsx:37` `supabase.auth.signUp` | add `options.data.app` |
| Mobile Google OAuth | `apps/mobile/app/(auth)/welcome.tsx:13` `signInWithOAuth` | cannot carry metadata; provider currently disabled |
| Web signup | grep found no `signUp` in `apps/web/src`; confirm whether web has a signup form (coaches may be provisioned from mobile or the `/coach/identity` backend route) | re-grep in Phase 6 incl. server actions |
| Admin-created users | `apps/web/src/actions/account.ts` uses `admin.auth.admin.listUsers/deleteUser` (no createUser found); `backend/api/src/coach/ai/service.ts` uses `getUserById` | `admin.listUsers({perPage:1000})` now lists the **shared** pool (rh_/gecko_ users too): a Phase 6 tenant-leak concern for `account.ts` |
| iOS native SwiftUI dev launcher | `apps/*/SwiftUI/DevLauncherViewModel.swift:302` `signUp()` | dev tooling; check whether it must set the flag |
(Grep covered `apps`, `backend`, `packages`, `plugins`; the final enumeration should be re-run in Phase 6.)

## Code Examples

### Verify gate behavior (rehearsal and portfolio, rolled back)
```sql
-- Proven on scratch: run inside a DO block that ends with RAISE EXCEPTION to force rollback
-- and surface the count (CLI returns only the last result, so RAISE is the easiest probe).
DO $t$ DECLARE n int; BEGIN
  INSERT INTO auth.users (instance_id,id,aud,role,email,raw_user_meta_data)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),'authenticated','authenticated','probe-a@example.invalid','{}');
  INSERT INTO auth.users (instance_id,id,aud,role,email,raw_user_meta_data)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),'authenticated','authenticated','probe-b@example.invalid','{"app":"ziko"}');
  SELECT count(*) INTO n FROM public.ziko_user_profiles;
  RAISE EXCEPTION 'PROBE profiles=% credits=%', n, (SELECT count(*) FROM public.ziko_user_ai_credits);
END $t$;
```
Expected: `profiles=1 credits=1` and zero rows left afterwards. For D-07's real-path test on portfolio, prefer this rolled-back SQL probe over creating real GoTrue users on a shared prod pool (also run one real `signUp` on scratch with and without the flag; scratch is throwaway). If a real signup on portfolio is still wanted, use an `@example.invalid` address and delete via Admin API, then assert 0 residual `ziko_*` rows and no leftover `auth.users` row.

### Rehearsal login test
On scratch: import the 39 rows, then for ONE sampled imported user overwrite `encrypted_password` with `crypt('<throwaway>', gen_salt('bf'))` (pgcrypto, available on both), then `POST /auth/v1/token?grant_type=password` with the scratch publishable key. This proves GoTrue accepts a hand-inserted row (instance_id, aud, confirmed, tokens, identity). On portfolio after the real import: Admin API `GET /auth/v1/admin/users/{id}` for all 38 ids (read-only, no password needed) and compare count + ids.

## Notification (AUTHMIG-05)
- Resend wiring: `backend/api/src/coach/ai/service.ts` sends from `Ziko Coach <coach@ziko-app.com>` using `new Resend(process.env.RESEND_API_KEY)` and `render(...)` from `@react-email/components`. Reuse the same sender (domain already verified there). `packages/email` currently exports only `WeeklyDigest` (single entry in `tsup.config.ts` and `package.json` `exports`).
- Deliver: `ReloginNotice.tsx` template with FR (primary) and EN blocks, a send script with **dry-run default**, per-recipient idempotence log keyed by user id (UUIDs only, no emails) in a tracked file, `--send` flag, and rate pacing. Content must state: re-login needed after the migration date, same email and password (except the collision user per Open Question 1), no data loss, mobile app update guidance. Exclude test domain (Pitfall 9) and unconfirmed users.
- The recipient list is built in memory (or scratchpad) from ziko `auth.users` at send time; never persisted to the repo.
- The user may also want a link/CTA; there is no re-login URL to give until Phase 6 defines the cutover date. Template should take date as an argument.

## State of the Art
| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Dashboard-only trigger creation on `auth.users` | `postgres` role has `TRIGGER` privilege on `auth.users`; CREATE TRIGGER works through the CLI/API | Triggers can be scripted and rehearsed [VERIFIED live] |
| Scratch project requires dashboard creation | CLI create worked (Phase 2 RUNBOOK) | Rehearsal target exists: `rkirvurggtgjlkeuhded` (currently 0 users, 0 auth triggers) |

## Assumptions Log
| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PATCH on `/config/auth` replaces `uri_allow_list` wholesale (not merge) | Pattern 4 | Low, merge procedure is safe either way; only snapshot diff matters |
| A2 | GoTrue may not find users with NULL `instance_id` | Pitfall 2 | Collision user might be unable to log in; mitigated by rehearsal test |
| A3 | Token columns must be `''` not NULL for GoTrue scans | Pitfall 6 | Login 500s if wrong; copying verbatim avoids it |
| A4 | `jsonb_populate_recordset(null::auth.users, ...)` accepts the exported `to_jsonb` rows incl. timestamptz/jsonb columns | Pattern 1 | Fall back to per-column explicit casts; prove in rehearsal |
| A5 | `signInWithOAuth` has no metadata option (docs excerpt silent, not an explicit statement) | Pitfall 3 | If `data` is supported, D-05 holds for OAuth too |
| A6 | Test-account addresses may still exist among the 39 | Pitfall 9 | Wrong recipients; mitigated by reusing `isTestAccountEmail` |
| A7 | Portfolio's `uri_allow_list`/`site_url`/templates are non-trivial and rh_/gecko_ depend on them | Pattern 4 | Not readable this session |

## Open Questions

1. **Collision account has no password (needs user decision).**
   - Known: portfolio row has NULL hash, 0 identities, NULL `instance_id`, created 2026-05-22; ziko row has a hash.
   - Unclear: how that portfolio account is used by the other apps (magic-link/OTP? manual insert?); whether the owner wants the ziko password carried over.
   - Recommendation: ask the user to choose (a) guarded fill of the NULL hash from ziko (`WHERE encrypted_password IS NULL`) + identity, or (b) literal D-03 with a password-reset instruction in the notice. The plan should contain a `checkpoint:decision` before the real write.

2. **Management API access token.** None in env (`SUPABASE_ACCESS_TOKEN` unset; CI has it as a GitHub secret). The plan needs a human checkpoint where the user provides a PAT in the shell session (not stored), or reads `site_url` and `uri_allow_list` for both projects from the dashboard (Authentication -> URL Configuration) so the merge script can take them as input. Without this, AUTHMIG-04 cannot be finished or proven.

3. **Does portfolio's 6th user (new since Phase 1) belong to rh_/gecko_?** Irrelevant to collision (still 1) but confirms live drift; re-run pre-check at real write and at delta.

4. **Delta strategy for ziko users that change password/email between import and cutover.** `ON CONFLICT DO NOTHING` ignores changes to existing rows. Consider an `updated_at`/`encrypted_password` comparison report in the delta run (report only; apply updates after a human check) for rows whose hash changed on ziko after the first import. Ziko had 0 sign-ins in the last 7 days, so risk is low.

5. **Where do the gated trigger functions/triggers ship?** New migration file in `supabase/portfolio-migrations/` (recommended, manual apply like the other two) vs script step. Planner's choice, but keep ziko's history untouched.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (linked, logged in) | all SQL transport | yes | 2.116.0 | - |
| Scratch project `rkirvurggtgjlkeuhded` | rehearsal | yes (ACTIVE_HEALTHY, 0 auth users, ziko schema applied) | PG 17.6.1.166 | - |
| `SUPABASE_ACCESS_TOKEN` (PAT) | AUTHMIG-04 config read/patch | no | - | user supplies PAT or pastes dashboard values (Open Question 2) |
| Node | scripts | yes (CI Node 20) | - | - |
| `resend` pkg / `RESEND_API_KEY` | notice send | package yes (root node_modules); key lives in backend env (`backend/api/.env.local`), not checked | ^6.12.3 | dry-run only until key supplied |
| `pg` / direct DB URL | - | not installed, not needed | - | CLI transport |
| Docker | - | not needed | - | - |

**Missing with no fallback:** none blocking, but AUTHMIG-04 needs a human-supplied PAT or dashboard values.

## Validation Architecture

Existing infra: Vitest v3 for backend/web; the Phase 2 pattern is committed idempotent verification scripts (`03-run-verify.mjs` + SQL). `.planning/config.json` has `nyquist_validation: true`. Phase 3 deliverables are operational scripts, so verification is SQL/Node assertion scripts with exit codes, plus one Vitest-free unit test file for pure helpers (mask function, column intersection, URL-list union).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node `node:test` (built in, no new dep) for pure helpers; `06-verify.mjs` SQL assertions for live state |
| Config file | none, see Wave 0 |
| Quick run command | `node --test scripts/auth-merge/` |
| Full suite command | `node scripts/auth-merge/06-verify.mjs --project-ref <ref>` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTHMIG-01 | 38 ziko ids present on target with identical `encrypted_password`/metadata/timestamps; collision id absent; total = 39 distinct people; 0 rows lost | live-SQL | `node scripts/auth-merge/06-verify.mjs --project-ref <ref> --check users` (compares per-row MD5 of non-generated columns computed on both sides; prints counts/ids only) | Wave 0 |
| AUTHMIG-01 | GoTrue accepts imported row (password grant on rehearsal; admin GET-by-id for all ids on portfolio) | integration | `node scripts/auth-merge/06-verify.mjs --check gotrue` | Wave 0 |
| AUTHMIG-02 | identities count 39 on target for ziko users, `provider_id`/`user_id` consistent, collision identity re-pointed to portfolio uuid | live-SQL | `... --check identities` | Wave 0 |
| AUTHMIG-03 | exactly 2 `ziko_`-named triggers on `auth.users`; rolled-back probe gives unflagged -> 0 Ziko rows, flagged -> profile+credits; portfolio tenants' tables unchanged | live-SQL | `... --check triggers` | Wave 0 |
| AUTHMIG-04 | post-merge `uri_allow_list` is a superset of snapshot; all other config fields equal | API diff | `node scripts/auth-merge/05-auth-config-merge.mjs --diff` | Wave 0 |
| AUTHMIG-05 | recipient count == confirmed non-test ziko users; dry-run renders FR+EN HTML; send log has one entry per user id | dry-run | `node scripts/auth-merge/07-notify-relogin.mjs --dry-run` | Wave 0 |
| SC6 | `ziko_waitlist_founder_seq` `last_value/is_called` equals ziko's live values | live-SQL | `... --check sequence` | Wave 0 |
| Regression | portfolio pre-existing 6 users untouched (hash of rows unchanged except the optional guarded fill), `rh_*/gecko_*` row counts unchanged | live-SQL | `... --check tenants` (take a baseline snapshot before first write) | Wave 0 |

### Sampling Rate
- Per task commit: `node --test scripts/auth-merge/`
- Per wave merge: rehearsal run on scratch + `06-verify.mjs` against scratch
- Phase gate: `06-verify.mjs` against portfolio all green, plus human checkpoint for the collision decision and config diff

### Wave 0 Gaps
- [ ] `scripts/auth-merge/lib.mjs` and helper unit tests
- [ ] baseline snapshot of portfolio (tenant row counts, hashes of the 6 existing user rows, auth config) taken BEFORE any write
- [ ] scratch seeded from a ziko export (scratch currently has no users)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Hashes copied verbatim, never logged; GoTrue does all verification |
| V3 Session Management | yes | Sessions deliberately not migrated (JWT secret differs); 52 ziko sessions end at cutover |
| V4 Access Control | yes | Shared pool: any portfolio JWT is valid for the backend until Phase 6 tenant check; `admin.listUsers` now spans tenants |
| V5 Input Validation | yes | Dollar-quote tag choice, parameterless generated SQL built only from DB-derived JSON |
| V6 Cryptography | yes | No custom crypto; bcrypt `$2a$` hashes as-is; `crypt()` only in scratch test |
| V8 Data Protection | yes | PII rule: emails/hashes only in scratchpad, deleted after; tracked files hold counts/UUIDs/masked values |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Password hashes or emails leaking into git/logs | Information disclosure | export to scratchpad only, delete on exit (`finally`), `.gitignore` check, mask in logs |
| Account takeover via collision merge | Spoofing/Elevation | user-confirmed same person (D-01); no overwrite of existing portfolio credential (guarded fill only if NULL) |
| Client-set `app:'ziko'` to farm credits | Tampering | residual risk accepted (Pitfall 4); backend credit gate authoritative |
| Overwriting shared auth config | Tampering/DoS on other tenants | snapshot+diff, PATCH only `uri_allow_list`, never `config push` |
| Wrong-project execution | Tampering | required `--project-ref`, no default; echo target ref before apply; apply requires explicit flag |
| Webhook secret in trigger args (Phase 1 note) | Information disclosure | not touched in this phase |

## Sources

### Primary (HIGH confidence)
- Live queries via `supabase db query` against ziko `slkobhavpwsubnsmuhya`, portfolio `ubxllsvanurkwkohzxau`, scratch `rkirvurggtgjlkeuhded` on 2026-10-01 (column parity, constraints, data shape, triggers, privileges, sequences, FK map, rolled-back DML/trigger probes)
- Repo: `supabase/portfolio-migrations/20261001101853_portfolio_ziko_functions.sql`, `scripts/portfolio-migration/*`, `backend/api/src/coach/ai/service.ts`, `packages/email`
- Public `GET /auth/v1/settings` on both projects (providers, autoconfirm)

### Secondary (MEDIUM confidence)
- https://supabase.com/docs/reference/api/v1-update-auth-service-config (endpoint, field names; merge semantics not stated)
- https://supabase.com/docs/reference/javascript/auth-signinwithoauth (options list; metadata not shown)

### Tertiary (LOW confidence)
- GoTrue handling of NULL `instance_id` / NULL token columns (A2, A3): from general knowledge, to be proven in rehearsal

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, all pieces already in the repo and probed
- Architecture: HIGH for import and triggers (proven by rolled-back probes), MEDIUM for config merge (no PAT), MEDIUM for GoTrue login acceptance (rehearsal pending)
- Pitfalls: HIGH for the live-data ones (collision row state, 6 users, OAuth disabled, seq semantics), LOW-MEDIUM for GoTrue internals

**Research date:** 2026-10-01
**Valid until:** 2026-10-08 for live counts (ziko and portfolio are live; re-run all pre-checks at execution); 30 days for patterns
