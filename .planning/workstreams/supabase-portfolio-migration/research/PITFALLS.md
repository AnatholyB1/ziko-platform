# Pitfalls Research

**Domain:** Merging one live Supabase project's schema + data + auth + storage into another already-active, multi-tenant Supabase project ("ziko" → "portfolio")
**Researched:** 2026-09-21
**Confidence:** MEDIUM — Supabase does not publish an official "merge two projects" playbook; findings synthesize the official auth-migration troubleshooting doc, Supabase CLI dump/restore docs, GitHub discussions on `auth.identities`/storage RLS, and standard Postgres/GoTrue architecture knowledge. Anything not directly sourced from Supabase docs is flagged LOW/MEDIUM and should be validated against `portfolio`'s actual Postgres/extension versions before executing the real cutover.

## Critical Pitfalls

### Pitfall 1: auth.users ID / email collisions when merging two user pools

**What goes wrong:**
Ziko's `auth.users` rows are inserted into `portfolio`'s shared `auth.users` table. Two failure modes: (a) a Ziko user's `id` (UUID) happens to already exist in `portfolio` (astronomically unlikely for random v4 UUIDs, but not zero if any seed/test data used low-entropy or hand-picked UUIDs in either project) — insert fails on the `auth.users_pkey` constraint; (b) far more likely, a Ziko user's `email` matches an existing `rh_*`/`gecko_*` user's email (same person signed up for two of your apps with the same address) — insert fails on the `auth.users_email_partial_key` unique index (partial unique index on `email` where `is_sso_user = false`). A raw `INSERT ... SELECT` across the two auth schemas will hard-fail on the first collision, or worse, silently succeed if you disabled the constraint first and now have two `auth.users` rows with the same email, breaking Supabase's login-by-email/password-reset flow with ambiguous results.

**Why it happens:**
Teams assume "merge users" is a straightforward `COPY`/`INSERT` because both are Postgres tables with the same DDL. The uniqueness scope is *per-project* in each source system's mental model, but becomes *global* the moment both pools land in one `auth.users` table. Nobody audits email overlap before the copy because there's no obvious place to check it pre-migration.

**How to avoid:**
- Before any auth write: `SELECT email FROM ziko.auth.users` (via `dblink`/`postgres_fdw` or export) minus `SELECT email FROM portfolio.auth.users`, and get the intersection to zero or handled explicitly.
- For any real overlap, decide per-row: same person → link Ziko's `user_id`-referencing FKs to the *existing* `portfolio` auth user id (not the Ziko id) and drop the duplicate `auth.users` row; different person → this scenario should not occur if emails are meant to be globally unique per human, but if allowed, portfolio's auth config must not have `email` uniqueness assumptions your app relies on.
- Since IDs are being preserved (per the milestone's confirmed decision) specifically so `ziko_*` table FKs don't need remapping, any email-collision resolution that changes a user's effective ID means a follow-up UPDATE pass across every `ziko_user_id`-shaped FK before or immediately after the auth insert — do this in the same transaction/phase, never as a "cleanup later" task.
- Run the email-collision check again immediately before the actual cutover insert (not just during planning) — Ziko is still live and accepting signups until cutover, so the collision set can grow between research and execution.

**Warning signs:** Any duplicate count > 0 in the email-intersection query; `auth.users` insert throwing `duplicate key value violates unique constraint "users_email_partial_key"` or `users_pkey`.

**Phase to address:** Auth merge (pre-flight check) — must run and be signed off *before* the data-copy phase begins, since resolving collisions may require ID remapping that the schema/data phases need to know about.

---

### Pitfall 2: RLS policies and trigger functions silently referencing old table/schema names after the `ziko_` rename

**What goes wrong:**
Renaming `user_profiles` → `ziko_user_profiles` (etc.) does not automatically break RLS policies defined with `ALTER TABLE ... RENAME`, because Postgres updates policy bodies that reference the table via its OID under the hood — *but* it does NOT fix: (a) policies/functions that reference other tables by hardcoded name inside `USING`/`WITH CHECK` subqueries (e.g. `EXISTS (SELECT 1 FROM coach_client_links WHERE ...)` inside a policy on `workout_programs` — if you recreate the migrations fresh in `portfolio` rather than `ALTER TABLE RENAME`ing live objects, every cross-table reference in every policy, trigger function, and `SECURITY DEFINER` RPC (`is_coach_of`, `deduct_ai_credits`, `record_athlete_decision`) must be hand-edited to the new prefixed name; (b) any RLS policy or function body containing table names as **strings** (dynamic SQL, `format('SELECT * FROM %I', ...)`, or the `storage.objects` folder-prefix patterns that reference a plugin's business table by name) — these are not caught by static rename tooling at all; (c) foreign-table references inside views (`CREATE VIEW ... AS SELECT ... FROM user_profiles`) which silently keep working if the view itself gets renamed but break if it's redefined against a table that no longer exists under the old name.

Given Ziko has 73 migrations with 93 tables, RLS "everywhere" per project conventions, plus `SECURITY DEFINER` RPCs, this is the single highest-surface-area pitfall in the whole migration — a policy that references a stale table name doesn't throw a clear error, it just returns `0 rows` (RLS defaults to deny), so the failure mode looks like "empty data" or "permission denied for relation ziko_x" rather than a crash.

**Why it happens:**
The migration approach (replaying 73 migrations with a global find/replace of table names vs. `pg_dump`+rename in place) determines the risk. A blind text find/replace across SQL migration files can miss: names embedded in comments-turned-logic, names built via `format()`/string concatenation, partial matches (renaming `user_profiles` also touches `coach_user_profiles_view` unless the regex is anchored), and column names that coincidentally match table names.

**How to avoid:**
- Prefer replaying migrations with prefixing done at the DDL-generation step (script that programmatically prefixes every `CREATE TABLE`, `REFERENCES`, and known internal `SELECT`/`EXISTS` targets) rather than a manual regex pass, and generate a diff report of every changed identifier for human review.
- After schema+RLS are stood up in `portfolio`, run `SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'ziko_%'` and grep the `qual`/`with_check` text for any **unprefixed** table name pattern (i.e., a bare word matching one of the original 93 table names without `ziko_` in front) — any hit is a bug.
- Do the same for function bodies: `SELECT proname, prosrc FROM pg_proc WHERE prosrc ~* '(old_table_name_1|old_table_name_2|...)'` for all `SECURITY DEFINER` functions and triggers.
- Write one integration test per RLS-protected table that asserts a real query returns the expected row count as an authenticated non-owner (expect 0) and as the owner (expect >0) — a policy silently deny-listing everything passes a naive "does it run" smoke test but fails this.
- Verify with `pg_trigger`/`information_schema.triggers` that every trigger from the 73 migrations was recreated and points at prefixed names (a missed trigger doesn't error either — it just doesn't fire).

**Warning signs:** Any RLS-protected query from the app returns empty/zero rows where production data should exist; `is_coach_of()` always returns false post-migration; credit deduction RPC succeeds but never decrements (would indicate the RPC still points at the old, now-nonexistent, unprefixed table and Postgres either errors — caught — or, if the RPC itself references a name that still resolves to a *different* table like another app's `user_ai_credits`-shaped table in `portfolio`, silently corrupts the wrong tenant's data — check for accidental name collisions with `rh_*`/`gecko_*` tables too).

**Phase to address:** Schema/rename phase for the mechanical rename + automated audit script; data-copy phase should not start until the `pg_policies`/`pg_proc` grep comes back clean; a dedicated RLS-verification phase (or a hard gate at the end of schema/rename) should run the per-table authenticated-query test suite before any production traffic is cut over.

---

### Pitfall 3: Storage bucket RLS using `storage.foldername()` patterns breaks because bucket/table identity changes on copy

**What goes wrong:**
Ziko's storage RLS is documented as path-prefix based: `(storage.foldername(name))[1] = auth.uid()::text` (per project's own Key Decisions). Two things break this during a merge into a shared project: (1) if bucket names collide or get renamed (e.g. `exercise-media` might need a `ziko-` prefix too, since `portfolio` already hosts `rh_*`/`gecko_*` buckets and a generic name like `exports` or `scan-photos` could already exist or be ambiguous) — every signed-URL-generation code path and every RLS policy referencing the literal bucket name must be updated in lockstep, or uploads silently land in / read from the wrong bucket; (2) `storage.objects` RLS policies are stored per-project just like table RLS — copying files via `supabase storage cp`/rclone/direct object copy does **not** copy the bucket's RLS policies, which must be recreated by hand in `portfolio`, and until they are, the bucket is either fully open or fully locked (Storage defaults deny) after data lands; (3) since `auth.uid()` is embedded in path prefixes (e.g. `{user_id}/photo.jpg`), and Ziko's user IDs are being preserved into `portfolio`'s auth pool, this only works correctly if the ID-preservation from Pitfall 1 is 100% clean — any user whose ID had to be remapped due to an email collision will have storage objects whose folder prefix no longer matches their new `auth.uid()`, permanently locking them out of their own historical files under the exact same RLS pattern that worked in Ziko.

**Why it happens:**
Storage bucket/object copy tooling (Supabase CLI, S3-compatible `rclone`, or custom scripts) is often treated as "just move the files" — RLS policies on `storage.objects`, bucket-level settings (public/private, file size limits, allowed MIME types), and the object `owner`/`metadata` columns are separate concerns that don't travel with a naive file copy.

**How to avoid:**
- Enumerate all `storage.objects` RLS policies (`SELECT * FROM pg_policies WHERE schemaname='storage'`) in Ziko before touching anything, and recreate the equivalent policies against `portfolio`'s bucket names *before* copying a single object.
- Decide bucket-naming collisions explicitly (e.g. every Ziko bucket gets a `ziko-` prefix, same convention as tables) and update every reference: signed-URL generation code, the 3 buckets used by web/mobile, `exercise-media`, and any lifecycle cron job (the documented daily 90-day scan-photo cleanup / 7-day export cleanup crons) that references bucket names literally.
- If any user ID gets remapped during auth merge (Pitfall 1), run a corresponding rename pass on that user's `storage.objects.name` path prefix in the same transaction/phase as the ID remap — never leave the two out of sync.
- After copy, spot-check signed URL generation and download for a sample of real (non-test) rows per bucket, per plugin that uses storage (pantry photos, scan-photos, exports, exercise-media, coach videos, progress photos) — an RLS misconfiguration on Storage returns 400/403, not silent 0 rows, so this is more detectable than table RLS but only if someone actually tests authenticated access post-migration rather than just checking the object exists in the bucket via the dashboard (which uses service-role, bypassing RLS).

**Warning signs:** Dashboard shows the file exists (service-role bypasses RLS) but the app gets 403 on signed URL fetch; signed URL generation succeeds but returns a 404 because bucket name in code doesn't match the renamed bucket.

**Phase to address:** Storage phase — explicitly gate "storage RLS policies recreated and bucket-name references updated everywhere in code" as a checklist item before the object copy runs, and re-verify after any Pitfall-1 ID remap.

---

### Pitfall 4: Sequence, identity-column, and default-value collisions on merge

**What goes wrong:**
Any Ziko table using `SERIAL`/`IDENTITY`/`bigserial` primary keys or numeric ledger sequences (rather than UUID) will have its sequence's current value reset or restart from 1 in a fresh schema replay, and if any `portfolio` table shares the same sequence name (unlikely given prefixing, but real risk for any **shared/global** sequence Postgres creates implicitly, or for extension-owned sequences), inserts can collide or silently continue from the wrong value. More subtly: if the migration replays Ziko's 73 migration files as literal `CREATE TABLE` statements without also correctly resuming each sequence to `MAX(id)+1` after the data copy, the **next INSERT after cutover** will attempt to reuse an ID already present in the copied data, throwing a duplicate-key error that only surfaces in production traffic, not during the copy itself (empty-table DDL replay always starts sequences at 1, so the failure is invisible until real inserts happen against `portfolio`).

**Why it happens:**
`pg_dump --schema-only` (or a fresh migration replay) creates sequences at their default starting value; only `pg_dump` with data (`--data-only` or a full dump) correctly emits `SELECT setval(...)` to restore sequence position. If schema and data are migrated via separate tracks (schema replayed from migration files, data bulk-copied via `COPY`/`INSERT`), the `setval` step is easy to forget entirely since it isn't part of either "replay migrations" or "copy rows" mental models.

**Why it's relevant here:** most Ziko tables use `uuid` PKs (mitigating most of this), but any table using an integer PK/ledger sequence (worth auditing — e.g. anything log/ledger-shaped like `ai_cost_log`, credit ledgers, exercise import logs) is exposed.

**How to avoid:**
- Audit all 93 tables for non-UUID primary keys / any column with a sequence default (`SELECT column_name, table_name, column_default FROM information_schema.columns WHERE column_default LIKE 'nextval%'`).
- For every such sequence, after data copy, explicitly run `SELECT setval('<seq>', (SELECT COALESCE(MAX(<col>),1) FROM <table>), true);` before allowing any write traffic against the new project.
- Add this `setval` reconciliation as a scripted, idempotent step (not a manual one-off) so it can be safely re-run if the data-copy phase is repeated (e.g. delta-sync before final cutover).

**Warning signs:** First production INSERT after cutover throws `duplicate key value violates unique constraint` on a sequence-backed PK; error only appears hours/days after migration once organic traffic resumes.

**Phase to address:** Data-copy phase — sequence reconciliation is part of the same phase as the row copy, verified before the cutover phase begins.

---

### Pitfall 5: Extension version / availability mismatch between the two Postgres instances

**What goes wrong:**
`ziko` and `portfolio` are separate Supabase projects, provisioned independently and possibly on different Postgres major versions or different extension versions (`pgcrypto`, `pg_trgm`, `postgis`, `pg_cron`, `uuid-ossp`, `vector`/`pgvector` if AI embeddings are used anywhere, etc.). A schema replay that assumes an extension version/behavior from `ziko` can fail outright (extension not installed/available on `portfolio`'s Postgres version) or — worse — install successfully but with different default behavior (e.g. a `pg_trgm` similarity threshold, or `gen_random_uuid()` semantics) that produces subtly different results than in `ziko`. Confirmed per Supabase's own guidance: pg_dump refuses to run against a server with a newer major Postgres version than the local pg_dump binary, and self-hosted/cross-project restores can fail if an extension available in the source isn't available in the destination.

**Why it happens:**
Teams assume "same platform, same Postgres" between two Supabase projects, but each project can be created at a different time and inherit a different default Postgres version, and extensions are opt-in per-project — nothing guarantees `portfolio` has every extension `ziko`'s 73 migrations depend on already enabled, especially since `portfolio` was built for unrelated `rh_*`/`gecko_*` apps with different needs.

**How to avoid:**
- Before schema replay: `SELECT extname, extversion FROM pg_extension` on both `ziko` and `portfolio`, diff the lists, and pre-install/upgrade any missing extension in `portfolio` via the Supabase dashboard (Database → Extensions) — do this as an explicit pre-flight step, not discovered mid-migration-run.
- Check both projects' Postgres major version (Settings → Infrastructure) before choosing a `pg_dump`/CLI version to run the migration from; use a `pg_dump` binary matching (or newer than) the higher of the two versions.
- Specifically verify `pgcrypto`/`uuid-ossp` (used for UUID generation across FK-heavy schema) and any Ziko-specific extension used by AI/vector features, cron (`pg_cron` for the 7 documented Vercel crons — though those are Vercel-side, not pg_cron, so likely N/A, but verify no DB-side scheduled jobs exist) or full-text search.
- Run the full 73-migration replay against a **throwaway** `portfolio`-like Postgres instance first (or a Supabase branch/preview if available) to surface any extension/version failure before touching the real shared project.

**Warning signs:** `CREATE EXTENSION` fails with "extension not available" during schema replay; a function that behaved one way in `ziko` produces different results in `portfolio` (e.g. UUID format, trigram similarity ranking) despite no code change.

**Phase to address:** Schema/rename phase — extension audit and reconciliation is a pre-flight blocker before the first `CREATE TABLE ziko_*` statement runs.

---

### Pitfall 6: Orphaned foreign keys from partial/incremental migration

**What goes wrong:**
Given the scale (93 tables, 39 users, thousands of rows across exercises/supplements/prices/coach data), the data copy will likely be sequenced (e.g. parent tables before children, or batched by domain) and may need a delta-sync pass right before cutover (since `ziko` remains live and accepting writes until the final cutover moment). If the copy order doesn't respect FK dependency order, or if the final delta-sync misses rows written to `ziko` *during* the migration window, `portfolio` ends up with FK-referencing rows whose parent was never copied (e.g. a `ziko_session_sets` row referencing a `ziko_workout_sessions.id` that doesn't exist in `portfolio` because it was created in `ziko` after the bulk copy snapshot but before cutover). If FKs are enforced with `NOT VALID` or deferred during bulk load (common performance practice) and never re-validated, these orphans go completely undetected — `ALTER TABLE ... VALIDATE CONSTRAINT` was skipped, so Postgres itself has no idea the data is inconsistent.

**Why it happens:**
Bulk-loading with FKs disabled/deferred for insert performance is standard practice, but the mandatory "re-enable and validate" step is often treated as optional or is only run once (before, not after, the final delta-sync that closes the live-traffic gap).

**How to avoid:**
- Do the bulk copy with FK constraints temporarily deferred (or disabled and explicitly `VALIDATE CONSTRAINT`d afterward) — never leave a constraint permanently `NOT VALID`.
- Freeze writes to `ziko` (read-only mode, or a very short maintenance window) for the *final* delta-sync immediately before cutover, so there is a hard cutoff with no ongoing writes to reconcile — this is far safer than trying to catch a moving target with a second incremental sync.
- After the full copy + final delta-sync, run `ALTER TABLE ziko_<child> VALIDATE CONSTRAINT <fk_name>` for every FK across all 93 tables (scripted, not manual) and treat any validation failure as a hard blocker to cutover.
- Independently, run row-count-per-table comparisons AND an orphan-detection query pattern (`SELECT count(*) FROM ziko_child c LEFT JOIN ziko_parent p ON c.parent_id = p.id WHERE c.parent_id IS NOT NULL AND p.id IS NULL`) for every FK relationship as an explicit verification step, not just trusting constraint validation (which only catches it if the constraint was actually deferred/re-validated correctly).

**Warning signs:** `VALIDATE CONSTRAINT` throws on a table you assumed was fully copied; app-level 500s post-cutover on joins that used to work in `ziko` (e.g. a session detail screen failing to load its sets).

**Phase to address:** Data-copy phase for the bulk load + validation; cutover phase must include a final short-freeze delta-sync + re-validation immediately before traffic switches, not rely solely on the earlier bulk-copy validation.

---

### Pitfall 7: Split-brain window from Vercel env var propagation lag during cutover

**What goes wrong:**
Ziko's backend (Hono on Vercel), web app, and mobile app all read Supabase URL/keys from environment variables (`.env.local` locally, Vercel project env vars in production, `EXPO_PUBLIC_*` baked into mobile builds). Updating these is not instantaneous or atomic across the fleet: (1) Vercel env var changes require a **redeploy** to take effect for serverless functions already built — simply changing the dashboard value does not hot-swap a running deployment; (2) if web and backend are separate Vercel projects (per this repo's structure — `apps/web` and `backend/api` deploy independently), one can be redeployed with new `portfolio` credentials while the other still points at `ziko`, causing requests to be authenticated against one project's auth pool while data operations hit the other; (3) mobile is the worst case — `EXPO_PUBLIC_*` vars are compiled into the app binary at build time, so **already-installed app instances on users' phones will keep talking to the old `ziko` project indefinitely** until they update to a new build (which requires an EAS build + app store review/rollout, not an instant switch), meaning any mobile user on an old binary continues writing to `ziko` after `portfolio` is declared the source of truth — and if `ziko` is deleted per this milestone's final step while old app binaries are still in the wild, those users get instant, unrecoverable failures.

**Why it happens:**
Web/backend env var updates are treated as "instant" because they usually are perceived that way (a redeploy is one click), but the mobile binary distribution lag (hours to days for staged rollouts, longer for users who don't auto-update) is systematically underestimated in cutover planning that's modeled on web-only deploys.

**How to avoid:**
- Sequence cutover as: (1) put `ziko` in read-only/maintenance mode or accept a short full outage window; (2) redeploy backend API first with new `portfolio` credentials and confirm health; (3) redeploy web with new credentials; (4) only then consider mobile — and for mobile, ship a build that supports **both** projects via a remote-config/feature-flag or a forced-update gate, or simply accept and plan for a multi-week tail where old binaries either hard-fail gracefully (clear "please update" message) or the old `ziko` project is kept alive read-only (or fully alive) specifically to serve stale binaries until adoption of the new build is near-total.
- Do not delete `ziko` on any timeline tied to "we redeployed" — tie it instead to mobile analytics showing negligible traffic on the old API/project (see Pitfall 8).
- Verify each redeployed surface against `portfolio` explicitly (not just "no errors in logs") — e.g. hit `/health` or a known read endpoint and confirm the response reflects `portfolio` data, not cached/stale `ziko` data, since Vercel edge/ISR caching can mask a misconfigured env var for a while.

**Warning signs:** Two simultaneously-live surfaces (web vs backend) returning inconsistent data for the same user; Vercel deployment logs showing the old `SUPABASE_URL` still active after a dashboard env var change (redeploy not triggered); crash reports (Sentry) spiking from old mobile binaries after `ziko` changes.

**Phase to address:** Cutover phase — this deserves its own explicit runbook with an ordered surface-by-surface switch sequence and an accepted mobile-tail strategy, decided *before* execution, not improvised live.

---

### Pitfall 8: Final project deletion triggered before all data/mobile-tail is verified

**What goes wrong:**
This milestone explicitly ends with **irreversible deletion** of the `ziko` project. The two realistic ways this goes wrong: (1) deletion is done too early — triggered right after the web/backend cutover looks clean, without accounting for the mobile binary tail (Pitfall 7) or without a final row-count/checksum reconciliation, and some data written to `ziko` in the final hours/days (from stale mobile clients, or from a missed table in the copy) is permanently lost with no source to recover from; (2) verification is declared "done" based on spot-checks (a few tables, a few users) rather than a systematic per-table row-count + sampled-content diff across all 93 tables, so a silently-missed table or a partially-copied table isn't discovered until well after `ziko` no longer exists.

**Why it happens:**
Project deletion in Supabase is a single dashboard action gated by a confirmation modal, not a graduated/reversible process (no soft-delete, no 30-day recovery window the way some SaaS platforms offer) — the operational safeguard has to be entirely process-based (checklists, sign-off, waiting period) since the platform doesn't provide a technical safety net.

**How to avoid:**
- Treat deletion as a separate, explicitly gated phase (per the milestone's own "Suppression du projet Supabase ziko — dernière étape, confirmation explicite séparée après vérification complète" framing) with a hard, written checklist: per-table row-count match (all 93 tables, not a sample), spot-content diff on a random sample per table, auth user count + sampled login test against `portfolio`, storage object count match per bucket, zero write traffic to `ziko` observed for a defined minimum window (e.g. 7–14 days of Vercel/Supabase logs showing no incoming requests), and mobile crash/analytics confirming negligible old-binary traffic.
- Before deleting, take a final full `pg_dump` (schema + data) **and** a Storage bucket export of `ziko` to cold storage (outside Supabase) as a last-resort recovery artifact — this costs little and converts an irreversible action into one with a (slow, manual) fallback.
- Require an explicit, separate human confirmation step for deletion that is not bundled into the same session/command as the cutover — i.e., don't let "migration looks done" and "delete the old project" happen in the same breath.
- Downgrade (pause billing / free tier) rather than delete first, if Supabase supports pausing a project, as an intermediate irreversibility-reducing step before hard deletion — confirm this option's actual availability/retention behavior on the current Supabase plan before relying on it (LOW confidence — verify in Supabase dashboard for this project's plan).

**Warning signs:** Any stakeholder asking "did we check X" *after* deletion is scheduled rather than before; the row-count verification script has never been run against 100% of tables, only a "looks fine" manual spot check.

**Phase to address:** Decommission phase — must be its own phase, gated behind explicit sign-off, sequenced after a defined stable-traffic-on-`portfolio` observation window, never combined with the cutover phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|-----------------|
| Disabling FK constraints for bulk load and forgetting `VALIDATE CONSTRAINT` | Faster bulk copy | Silent orphaned rows, undetected data corruption (Pitfall 6) | Only if validation is scripted as a mandatory follow-up step, never manual/optional |
| Keeping `ziko` project alive read-only indefinitely instead of deciding a deletion date | Avoids the hard "are we sure" decision | Ongoing cost, and indefinite delay of the "done" milestone; risk the decision never gets revisited | Acceptable short-term (weeks) while mobile tail drains, not as a permanent state |
| Text find/replace across migration files for the `ziko_` prefix instead of a scripted, audited rename | Fast to write | Misses string-embedded/dynamic-SQL table references (Pitfall 2) | Never for RLS policies or `SECURITY DEFINER` function bodies — acceptable only for pure `CREATE TABLE`/`REFERENCES` DDL with a follow-up automated grep |
| Reusing the old JWT secret in `portfolio` to avoid forcing re-login | No forced logout for Ziko users | `portfolio`'s existing users' sessions/tokens are already signed with `portfolio`'s own JWT secret — you cannot "reuse Ziko's secret" without invalidating every existing `rh_*`/`gecko_*` session too, since JWT secret is project-wide, not per-tenant | Never in a merge-into-existing-project scenario — accept that Ziko users need one re-login post-cutover; this is not optional the way a project-to-project migration's docs imply, because portfolio's secret can't be replaced without breaking the other apps |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Supabase Auth (GoTrue) | Assuming `auth.users` copy is complete without also copying `auth.identities` (OAuth/email identity records) — breaks Google/Apple-linked accounts even though `auth.users` row exists | Copy `auth.users` AND `auth.identities` (and `auth.mfa_factors`/`auth.sessions` if any Ziko user has MFA enabled) together, in the same transaction, keyed by the same (preserved) user id — verify with a login test per auth method actually in use (password, Google, Apple per the `connexion` workstream) |
| Vercel env vars (multi-project) | Updating one Vercel project's (web) env vars and assuming the sibling project (backend API) picked up the same change | Each Vercel project (web, backend API) has independent env vars and independent redeploy triggers — update and redeploy both explicitly, verify both independently |
| Supabase Storage RLS | Copying objects via a script that uses the service-role key, then assuming the copy "worked" because objects are visible in the dashboard | Dashboard/service-role access bypasses RLS entirely; always test with an authenticated non-service-role client against a real user session post-copy |
| Supabase CLI dump/restore | Running raw `pg_dump`/`psql` against a Supabase connection string without accounting for CLI-specific schema exclusions (`supabase db dump` filters internal schemas and adds `IF NOT EXISTS`, raw `pg_dump` does not) | Prefer `supabase db dump`/`db push` tooling where it fits the workflow, or replicate its filtering manually if using raw `pg_dump`, and always pin the local `pg_dump` binary version to match or exceed the higher of the two projects' Postgres versions |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Copying `auth.users.encrypted_password` hashes across projects without verifying the bcrypt/argon2 work-factor and GoTrue version compatibility between `ziko` and `portfolio` | If GoTrue versions differ significantly, password hash format assumptions could mismatch, causing valid passwords to fail verification post-migration for all Ziko users simultaneously | Test login with a small batch of real (consented/test) accounts against `portfolio` before the full cutover, not just verify row insertion succeeded |
| Leaving `ziko`'s service-role key valid/undocumented after cutover | A forgotten hardcoded reference to the old service-role key (in a script, CI secret, or old `.env` committed pre-`.gitignore`) keeps write access to a database you believe is decommissioned, or worse, becomes a live attack surface as the project sits unmonitored | Rotate/revoke `ziko`'s API keys as part of the pre-deletion checklist, and grep the entire repo history (not just current tree) for the old project ref/keys before declaring "no code path still points at ziko" |
| Merging RLS-protected `ziko_*` tables into `portfolio` without re-checking that `portfolio`'s existing `rh_*`/`gecko_*` policies can't accidentally match `ziko_*` tables (e.g. an overly broad policy using `tablename LIKE '%'` patterns or a shared helper function assuming a specific schema shape) | Cross-tenant data leakage between unrelated apps sharing one project | Audit `portfolio`'s existing policies/functions for any non-table-scoped logic before adding `ziko_*` tables to the same schema; confirm `ziko_*` tables are never granted to a role broader than the app's own service/anon roles |

## "Looks Done But Isn't" Checklist

- [ ] **Auth merge:** Users can log in with the correct password — verify beyond "row count matches `auth.users`"; also confirm `auth.identities` rows exist for every OAuth-linked Ziko user and that provider linking still works.
- [ ] **RLS after rename:** Every table returns non-zero rows to its rightful owner under RLS, not just "policy exists" — verify beyond `pg_policies` having 93 rows; empty-but-present policies are the most common silent failure mode here.
- [ ] **Storage:** Signed URL generation and authenticated download work end-to-end per bucket, not just "object exists in bucket via dashboard."
- [ ] **Sequences:** A real INSERT succeeds against every non-UUID-PK table post-migration, not just "data copied, count matches."
- [ ] **Foreign keys:** All FK constraints are `VALID` (not `NOT VALID`/deferred-forever), verified via `pg_constraint.convalidated`, not just "no errors during copy."
- [ ] **Cutover:** All three surfaces (mobile, web, backend) independently confirmed to be reading/writing `portfolio`, not inferred from one surface working.
- [ ] **Decommission:** A cold-storage backup of `ziko` (DB dump + storage export) exists outside Supabase before deletion — verify the backup file is retrievable, not just that the export command exited 0.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Email collision discovered mid-auth-merge | LOW–MEDIUM | Halt the auth insert; resolve the specific collision manually (link vs. reject); re-run the pre-flight collision check before resuming |
| RLS policy silently denying all access post-rename | LOW | Not destructive — data is intact, just inaccessible; grep `pg_policies`/`pg_proc` for stale unprefixed names, fix, re-test; no data loss risk since RLS-deny fails closed |
| Orphaned FK discovered via `VALIDATE CONSTRAINT` failure | MEDIUM | Identify orphan rows via the LEFT JOIN diagnostic query; re-run the delta-sync for the missing parent rows from `ziko` (if `ziko` still exists and hasn't been deleted yet — this is why deletion must wait); re-validate |
| Sequence collision causing duplicate-key errors in production | LOW | Run the `setval` reconciliation immediately; the failed INSERT itself didn't corrupt data, it just didn't commit — safe to retry after fixing the sequence |
| Mobile split-brain (old binaries writing to `ziko` post-cutover) | HIGH if `ziko` already deleted, LOW if not | If `ziko` still exists: capture the delta and replay it into `portfolio` before final deletion. If `ziko` is already deleted: this data is unrecoverable — which is exactly why Pitfall 8's gating matters |
| Storage RLS misconfigured, users can't access own files | LOW | Non-destructive; objects are intact, just inaccessible; fix policy, no data loss |
| Post-deletion discovery of a missed table/row | HIGH (irreversible without cold backup) | Only recoverable if the pre-deletion `pg_dump`/storage export (see checklist) was actually taken and is retrievable — otherwise, unrecoverable; this is the entire justification for that backup step |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|--------------|
| auth.users ID/email collisions | Auth merge (pre-flight) | Email-intersection query returns 0, or every overlap has an explicit resolution recorded, re-checked immediately before the real insert |
| RLS/trigger referencing stale unprefixed names | Schema/rename | `pg_policies`/`pg_proc` text grep for unprefixed old table names returns 0 hits; per-table authenticated-query test suite passes |
| Storage RLS + bucket rename breakage | Storage | Authenticated signed-URL fetch succeeds per bucket per plugin, post-copy, using a real (non-service-role) session |
| Sequence/identity collisions | Data copy | `setval` reconciliation script run and idempotent; a real INSERT against every non-UUID-PK table succeeds post-copy |
| Extension version/availability mismatch | Schema/rename (pre-flight) | `pg_extension` diff between `ziko` and `portfolio` is fully reconciled before first `CREATE TABLE ziko_*` runs; full migration replay tested against a throwaway instance first |
| Orphaned FKs from partial/incremental copy | Data copy + cutover | All FKs report `convalidated = true`; orphan-detection LEFT JOIN query returns 0 for every FK relationship, re-run after the final pre-cutover delta-sync |
| Vercel env propagation / split-brain | Cutover | Each of web/backend/mobile independently confirmed reading `portfolio` via a live data check, not log absence of errors; ordered runbook followed, not ad hoc |
| Premature/unverified project deletion | Decommission (separate, gated phase) | Full checklist complete (row counts, storage counts, auth login test, zero-traffic observation window, cold backup taken and confirmed retrievable) with explicit separate human sign-off before the delete action |

## Sources

- [Supabase Docs — Migrating Auth Users Between Supabase Projects](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects) — HIGH confidence, official, but explicitly incomplete on collision/ID-conflict handling
- [GitHub — Migrating Auth Users Between Supabase Projects (Discussion #35953)](https://github.com/orgs/supabase/discussions/35953) — MEDIUM confidence, community discussion
- [GitHub — Migrating Authenticated Users (Discussion #36664)](https://github.com/orgs/supabase/discussions/36664) — MEDIUM confidence
- [GitHub — supabase/gotrue Issue #313, Link Multiple Auth Providers to an Account](https://github.com/supabase/gotrue/issues/313) — MEDIUM confidence, on `auth.identities` linkage
- [Supabase Docs — Storage: Inefficient folder operations and hierarchical RLS challenges](https://supabase.com/docs/guides/troubleshooting/supabase-storage-inefficient-folder-operations-and-hierarchical-rls-challenges-b05a4d) — HIGH confidence, official
- [GitHub — Storage RLS on specific folder with a table join (Discussion #28160)](https://github.com/orgs/supabase/discussions/28160) — MEDIUM confidence
- [Supabase Docs — Restore a Platform Project to Self-Hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform) — HIGH confidence, official, source for extension/Postgres-version mismatch behavior
- [Supabase Docs — Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) — HIGH confidence, official, source for `supabase db dump` schema-filtering behavior
- [GitHub — Creating database dumps now that Supabase is using Postgres 14 (Discussion #4345)](https://github.com/orgs/supabase/discussions/4345) — MEDIUM confidence, on `pg_dump` version-mismatch failure mode
- Project conventions (`CLAUDE.md`, `.planning/PROJECT.md`) — HIGH confidence for Ziko-specific facts: path-prefix storage RLS pattern, `SECURITY DEFINER` RPC list, 73 migrations/93 tables, Vercel multi-project deploy topology, mobile `EXPO_PUBLIC_*` build-time env baking
- General Postgres/GoTrue architecture knowledge (sequences, `VALIDATE CONSTRAINT`, partial unique indexes on `auth.users.email`) — MEDIUM confidence, training-data based, not independently re-verified against `portfolio`'s exact current schema/version — **verify directly against both live projects before executing any phase**

---
*Pitfalls research for: Supabase live project merge (ziko → portfolio)*
*Researched: 2026-09-21*
