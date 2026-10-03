# Feature Research

**Domain:** Supabase-to-Supabase project migration (schema-prefixed merge into an existing live multi-tenant project)
**Researched:** 2026-09-21
**Confidence:** MEDIUM — the generic dump/restore/auth-migration mechanics are HIGH confidence (official Supabase docs). The specific scenario here — renaming/prefixing every object while merging into an *already-live, shared, multi-tenant* project with its own users and RLS — is not an officially documented Supabase pattern. Those parts are LOW/MEDIUM confidence, reasoned from Postgres fundamentals + Supabase docs, and should be validated with a dry run before touching production.

## Note on template fit

This is an infrastructure migration, not a user-facing feature set. "Table Stakes" below means **steps a correct migration cannot skip**; "Differentiators" means **safety nets that reduce risk but aren't strictly required**; "Anti-Features" means **approaches that look appealing but are the wrong fit for this specific migration** (39 users, shared destination project, prefix rename). "MVP Definition" maps to phase sequencing rather than product scope.

## Feature Landscape

### Table Stakes (A Correct Migration Cannot Skip These)

| Step | Why Required | Complexity | Notes |
|------|--------------|------------|-------|
| **Full inventory of source project** — 93 tables, all functions/RPCs, triggers, RLS policies, storage buckets, extensions, custom types/enums, sequences, publications (Realtime), auth config (providers, redirect URLs, email templates, JWT secret) | You can't verify parity against a target you never listed; also the basis for the rename map (`table` → `ziko_table`) | LOW-MEDIUM | Query `information_schema` + `pg_policies` + `pg_proc` + `supabase_realtime` publication membership; cross-reference with the 73 migration files. Confirms 93 tables is complete and current. |
| **Capacity/quota check on the shared destination** — DB size headroom, Supavisor pooler max client connections, Storage quota, plan tier limits — evaluated against portfolio's *existing* rh_/gecko_ load | portfolio is not an empty project; adding ~93 tables + production data + connection load from a third app can degrade rh_/gecko_ if headroom wasn't checked | LOW | Check Supabase project usage dashboard for portfolio before migrating, not after. |
| **Schema export + rewrite with `ziko_` prefix** (tables, PK/FK/unique/check constraints, indexes, sequences, custom types/enums, views) — column types, defaults, and constraints preserved exactly, no functional schema changes | Explicit scope boundary (PROJECT.md): rename/prefix only, no schema redesign. A dump against `ziko` gives unprefixed DDL; every `CREATE TABLE`, `REFERENCES`, index name, and constraint name needs mechanical rewriting | MEDIUM-HIGH | `supabase db dump -f schema.sql` gives the DDL baseline (HIGH confidence — official CLI flow); the prefix rewrite itself is a scripted regex/AST pass you must write and test, not something Supabase provides. FK targets must be rewritten consistently or restore fails on missing referenced tables. |
| **Function/RPC/trigger re-creation against prefixed tables** — `deduct_ai_credits`, `is_coach_of`, `record_athlete_decision`, and all `SECURITY DEFINER` functions rewritten to reference `ziko_*` table names | These are hardcoded to reference specific table names internally; a naive schema-only dump does not fix internal references inside function bodies | MEDIUM-HIGH | Also decide whether function names themselves get a `ziko_` prefix — recommended, since `public` schema is shared across ziko/rh/gecko and bare names like `is_coach_of` risk future collisions even if none exist today. |
| **RLS policy re-creation, 1:1 with source, on every `ziko_*` table** | RLS is not migrated by `pg_dump`/restore by default per Supabase's own migration docs — "RLS status on tables is not migrated." Every table must be re-verified as RLS-enabled with equivalent policies post-restore | MEDIUM | Post-restore query: `SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE 'ziko_%'` must show `true` for all 93; diff `pg_policies` counts against the source project. |
| **Auth merge preserving `auth.users.id`** — copy `auth.users` + `auth.identities` (+ OAuth-linked identity rows for the new Google/Apple sign-in from v1.17) into portfolio's shared auth pool, IDs unchanged | All `ziko_*` FKs to `user_id` depend on the UUID being identical after migration; this is the one migration axis where "close enough" is not acceptable — a single ID drift silently orphans that user's data | HIGH | Official Supabase guidance confirms full `auth.users`+`auth.identities` migration preserves logins without password resets (hashed passwords copy as opaque data). Must run **before** restoring `ziko_*` table data if FKs to `auth.users(id)` are validated at insert/restore time. |
| **Collision check before merge: email + ID overlap between ziko's 39 users and portfolio's existing (rh_/gecko_) users** | A shared auth.users table means one email can only exist once; if the same person already has a portfolio account under a different app, insertion fails or silently creates ambiguity | MEDIUM | One-time `SELECT` diff on email between source and destination before any auth write. Given portfolio hosts unrelated HR/restaurant apps, real overlap is expected to be near-zero, but must be checked, not assumed. |
| **Auth config merge, not overwrite** — Site URL / additional redirect URLs list, JWT secret decision, email templates, OAuth provider config (Google/Apple) — all project-wide settings shared across ziko/rh/gecko | Supabase Auth settings (redirect URLs, email templates, provider keys) are **per-project, not per-app** — blindly changing them for ziko can break rh_/gecko_ auth flows, and vice versa | MEDIUM-HIGH | Redirect URL list must be additive (append ziko's callback URLs, keep existing ones). Email template branding is a real conflict risk if rh/gecko already customized it — needs an explicit decision (shared generic template vs per-app email via a custom SMTP+template layer, out of scope for Auth itself). JWT secret: reuse portfolio's existing secret to avoid forcing every rh_/gecko_/ziko user to re-auth; do not import ziko's old JWT secret into a shared project. |
| **Custom `auth.users` triggers reviewed for collision** — if ziko has an `on_auth_user_created` style trigger (e.g. auto-provisioning `user_profiles`), it must coexist with any equivalent trigger already on portfolio's `auth.users` from rh_/gecko_ | Two apps writing competing "on signup, create profile row" triggers on the same shared `auth.users` table can silently interfere (last-registered trigger order, exceptions aborting the whole insert) | MEDIUM | Enumerate existing triggers on portfolio's `auth.users` first; ziko's trigger must be scoped/guarded (e.g., check that the row's provisioning is app-specific) so it can't break rh/gecko signups or vice versa. |
| **Data copy via COPY-based dump/restore into the renamed schema**, triggers disabled during load | `--use-copy --data-only`, `session_replication_role = replica` is Supabase's own documented pattern to avoid double-firing triggers (e.g. credit/XP triggers) during bulk load | MEDIUM | Must run after auth users exist and after prefixed schema/constraints are in place. Order matters: schema → auth users → data. |
| **Row-count parity check per table** (all 93 `ziko_*` tables vs source) | Baseline, non-negotiable correctness check | LOW | `SELECT count(*)` per table, source vs destination; script it, don't eyeball 93 tables manually. Cross-check spot totals already known: 39 users, 1,318 exercises, 1,495 supplements, 3,106 prices. |
| **Foreign key integrity check post-restore** | A restore that "succeeds" can still leave dangling FKs if constraints were deferred/skipped during COPY-based load | LOW-MEDIUM | Re-validate constraints post-load (`ALTER TABLE ... VALIDATE CONSTRAINT` or a manual orphan-row query per FK) rather than trusting silent success. |
| **Storage bucket + object migration** (exercise-media, scan-photos, exports, plus any others) — buckets re-created in portfolio (respecting original public/private setting), objects copied, storage RLS policies (path-prefix pattern per this codebase) re-created | Supabase's own docs confirm storage objects are **not** migrated by project restore — "the new project has the old project's Storage buckets [config], but the Storage objects need to be migrated manually" | MEDIUM-HIGH | No native cross-project copy API for buckets at this scale; requires a script that lists+downloads from ziko and uploads to portfolio (community pattern, not official tooling). Must preserve bucket privacy flag (exercise-media is public, scan-photos/exports are private) and re-apply the `storage.foldername(name)` RLS pattern this codebase already uses. |
| **Storage object count + checksum verification per bucket** | Silent partial uploads (network errors mid-migration) are the most likely failure mode for a bulk object copy script | LOW-MEDIUM | Compare object count and size (or hash, if cheap to compute) per bucket, source vs destination, before trusting the copy. |
| **Signed URL flow re-verification** | Signed URLs are project-specific (host + key); every "upload photo" / "view exercise GIF" flow that depends on signed URLs must be functionally re-tested against portfolio, not just assumed to work because objects exist | LOW-MEDIUM | Manual or scripted hit of `/storage/upload-url` equivalents in each affected plugin (pantry photos, scan-photos, exercise-media) post-cutover. |
| **Realtime publication membership** — add `ziko_*` tables to `supabase_realtime` publication if any plugin relies on Realtime subscriptions | Publication membership is not implied by table restore; a table can exist with correct data and RLS but emit zero realtime events until explicitly added | LOW | Check which of the 93 tables are currently in ziko's realtime publication before assuming none are (community/chat plugin is the likely candidate). |
| **Extension availability/version check** | `CREATE EXTENSION` statements in the 73 migrations (uuid-ossp, pgcrypto, pg_trgm, etc.) must exist and be compatible versions in portfolio, which may have a different extension set already enabled for rh_/gecko_ | LOW | One-time diff of `pg_available_extensions`/`pg_extension` between the two projects before schema apply. |
| **Env cutover — backend** (`backend/api/.env.local` + Vercel env vars for the API project: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) with redeploy | Backend is the single point every mobile/web request flows through for DB access; must point at portfolio before anything else can be verified end-to-end | LOW | Vercel redeploy is near-instant; low individual complexity, but gated on all prior schema/data/auth/storage steps being verified first. |
| **Env cutover — web** (`apps/web/.env.local` + Vercel env vars for the web project: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) with redeploy | Same reasoning as backend; web also holds the service-role key which must never leak client-side (existing `server-only` guard must be re-verified post-cutover, not assumed) | LOW | |
| **Env cutover — mobile** (`apps/mobile/.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`, `EXPO_PUBLIC_API_URL` if it changes) | `EXPO_PUBLIC_` variables are inlined into the JS bundle at build/publish time, not read at runtime — this is the step most likely to be under-scoped if treated like a normal `.env` change | MEDIUM | Confirmed via Expo's own docs: EAS Build inlines from the build-time `.env`; **EAS Update also re-inlines from the environment present at publish time**, meaning a same-day OTA update (no app-store review) can repoint already-installed apps at portfolio without a native rebuild. A native rebuild is still needed eventually so future fresh installs/store binaries carry the new default, but it is not on the critical path for cutover day. |
| **Post-cutover functional smoke test against portfolio, before touching the old project** — real login, real data read, real write (e.g. log a workout), AI chat round-trip, storage upload, coach CRM read — for both mobile and web | "It restored" and "it works for real users" are different claims; this is the actual go/no-go gate | MEDIUM | Should be a repeatable checklist/script, not ad hoc clicking — this becomes the acceptance criteria for the cutover phase. |
| **Regression check on rh_/gecko_ apps** — confirm the other two apps on portfolio are unaffected (auth flows, connection headroom, storage) after ziko's schema/data/load lands | portfolio is shared; a migration that "succeeds" for ziko but silently degrades an unrelated live app is not a correct migration | LOW-MEDIUM | Quick smoke pass on rh_/gecko_ core flows post-migration; check portfolio's connection/error metrics before and after. |
| **Explicit, separate confirmation gate before deleting the old `ziko` project** | Deletion is irreversible; PROJECT.md already calls this out as "dernière étape, confirmation explicite séparée" | LOW (procedurally) | Should not be bundled into the same approval as "cutover looks good" — a distinct, deliberate step after a monitoring window. |

### Differentiators (Safety Nets — Reduce Risk, Not Strictly Required)

| Practice | Value | Complexity | Notes |
|----------|-------|------------|-------|
| **Dry run on a scratch/staging Supabase project first** (or a Supabase branch) | Proves the rename script, function rewrites, and restore order actually work before touching the live shared `portfolio` project | MEDIUM | Cheapest form of risk reduction available; catches FK-ordering and rewrite-script bugs without any exposure to real users or the other two live apps. |
| **Keep the old `ziko` project alive, read-only, for a rollback window (days, not weeks) after cutover** | If cutover reveals a data or auth gap post-hoc, the source of truth still exists to re-diff or re-pull from | LOW | Supabase projects can be paused/kept without deleting; costs are the only downside. Directly supports the "verify before delete" requirement already in PROJECT.md. |
| **Incremental/delta resync immediately before final cutover** (dump only rows changed since the initial full dump, e.g. by `updated_at` watermark) | Shrinks the write-freeze window from "however long the full dump/restore takes" to "however long the delta takes" — meaningfully reduces user-facing downtime for a live app | MEDIUM | Requires every migrated table to have a reliable `updated_at`/`created_at` watermark; some of the 93 tables may not (e.g., pure log/event tables may only need an append-only delta by ID instead). |
| **Maintenance-mode banner + write-freeze on the old project during the final cutover window** | Simple, low-tech way to guarantee no writes land in `ziko` after the final data pull starts, avoiding split-brain data | LOW | A short, communicated freeze (minutes, given 39 users and moderate data volume) is far simpler than any dual-write or replication scheme for this scale. |
| **Automated verification script** (row counts, FK orphan checks, RLS-enabled check, storage counts) run as one command rather than manual spot checks | Removes human error from re-checking 93 tables + N buckets every time the migration is rehearsed | MEDIUM | Pays for itself if the dry run (above) is done at least once — same script runs in staging and production. |
| **Reuse portfolio's existing JWT secret rather than importing ziko's** | Avoids forcing rh_/gecko_'s already-logged-in users to re-authenticate, since JWT secret is project-wide | LOW | Tradeoff: ziko's existing sessions/tokens become invalid regardless (different project = different endpoint), so ziko users re-authenticate once either way — the benefit is purely for not disturbing rh_/gecko_. |
| **Post-cutover monitoring window with existing tooling (Sentry)** before decommission | Ziko already has Sentry wired (`@sentry/react-native`); watching error rates for a defined window after cutover is near-zero incremental cost and catches issues real usage surfaces that a smoke test won't | LOW | |

### Anti-Features (Look Appealing, Wrong Fit Here)

| Approach | Why It Looks Appealing | Why It's the Wrong Fit | Alternative |
|----------|------------------------|-------------------------|-------------|
| **Native Postgres logical replication for the whole DB (Supabase's "minimal downtime" project-migration method)** | Supabase does document a logical-replication path for project-to-project migration with minimal downtime | Standard Postgres logical replication requires the **subscriber table names to match the publisher's** — it has no built-in table-rename/remap capability. Using it here would mean replicating into unprefixed shadow tables first, then renaming into the `ziko_*` names as a second pass while reconciling anything written during replication — real added complexity for a 39-user app where a short write-freeze is trivially acceptable | Maintenance-window dump/restore (COPY-based, as above) with an optional pre-freeze delta resync to shrink the window. Logical replication is worth it at a scale/uptime bar this project doesn't have. |
| **True dual-write from the app to both `ziko` and `portfolio` during a transition period** | Sounds like "zero downtime" since both databases stay live and in sync | Doubles write-path complexity in application code, risks silent divergence between two schemas that don't even share table names, and buys nothing over a short freeze window given the user count — this is the kind of pattern that's justified at much larger scale/uptime SLAs, not here | Freeze window + verified cutover; if any zero-downtime need surfaces later, revisit only if user count/SLA actually requires it |
| **Big-bang delete of the old `ziko` project immediately after cutover looks good** | Simpler, one less thing to track, avoids double Supabase billing | Removes the only rollback path if the post-cutover smoke test missed something a real user hits days later; deletion is irreversible | Keep old project paused/read-only for a short explicit window (Differentiator above), then a separate deliberate deletion step |
| **Skipping the prefix on functions/triggers/enums because "public schema collisions are unlikely today"** | Less rewriting work | portfolio is an actively growing shared project (rh_, gecko_, and future apps); an unprefixed function/enum name is exactly the kind of thing that silently collides two apps later, and the cost of fixing it now (during a scripted rewrite pass) is far lower than fixing it after another app claims the same name | Prefix everything server-side (tables, functions, custom types, sequences) for consistency with the already-decided `ziko_` table prefix, not just the tables |

## Feature Dependencies

```
Inventory (schema/functions/RLS/storage/auth/extensions/realtime)
    └──requires──> nothing (first step)

Capacity/quota check on portfolio
    └──requires──> Inventory (need to know what's being added)

Schema export + ziko_ prefix rewrite
    └──requires──> Inventory

Function/RPC/trigger rewrite (reference ziko_ prefixed tables)
    └──requires──> Schema export + prefix rewrite (final table names must be known)

RLS policy re-creation
    └──requires──> Schema export + prefix rewrite (tables must exist to attach policies to)

Extension availability check
    └──requires──> Inventory
    └──enables──> Schema apply (some DDL depends on extensions being present)

Schema + functions + RLS applied to portfolio
    └──requires──> Schema rewrite + Function rewrite + RLS re-creation + Extension check

Auth merge (auth.users + auth.identities, collision check, config merge)
    └──requires──> Inventory (auth config diff)
    └──must complete before──> Data copy (FKs to auth.users(id) need the rows to exist)

Data copy (COPY-based, triggers disabled)
    └──requires──> Schema+functions+RLS applied AND Auth merge complete

Row-count parity check + FK integrity check
    └──requires──> Data copy complete

Storage bucket creation + object copy
    └──requires──> Inventory (bucket list/privacy settings)
    └──independent of──> Data copy (can run in parallel)

Storage checksum/count verification + signed URL re-verification
    └──requires──> Storage object copy complete

Realtime publication membership update
    └──requires──> Schema applied (tables must exist)

Env cutover — backend
    └──requires──> Row-count/FK checks PASS + Storage verification PASS

Env cutover — web
    └──requires──> Env cutover — backend (web calls the same backend/DB)

Env cutover — mobile (EAS Update, then eventual native rebuild)
    └──requires──> Env cutover — backend PASS

Functional smoke test (mobile + web, real flows)
    └──requires──> All env cutovers complete

Regression check on rh_/gecko_
    └──requires──> Data copy + schema apply complete (can run right after, doesn't need ziko's own cutover)

Post-cutover monitoring window
    └──requires──> Functional smoke test PASS

Old project decommission (explicit separate confirmation)
    └──requires──> Monitoring window elapsed with no issues
    └──conflicts with──> Big-bang delete anti-pattern (must not be the same approval step as "cutover looks good")
```

### Dependency Notes

- **Auth merge must complete before data copy, not after or in parallel:** every `ziko_*` table with a `user_id` FK to `auth.users(id)` will fail to restore (or silently need constraint deferral, which then needs separate validation) if the referenced users don't exist yet in portfolio. This is the single most important ordering constraint in the whole migration.
- **Function/RPC rewrite requires the final (prefixed) table names to be locked first** — you cannot correctly rewrite `deduct_ai_credits`'s internal `UPDATE user_ai_credits` to `UPDATE ziko_user_ai_credits` until the rename map is finalized, so schema rename is a hard predecessor.
- **Storage migration is fully independent of the DB migration** and can be worked in parallel — it has its own inventory (buckets), its own copy mechanism (object-level script, not SQL), and its own verification (checksums, not row counts). Don't let it block or be blocked by the schema/data track.
- **Regression-checking rh_/gecko_ doesn't need to wait for ziko's env cutover** — the risk to those apps (shared connection pool, shared auth config, shared schema namespace) is introduced the moment ziko's schema/data/auth land in portfolio, not when ziko's own apps start pointing at it.
- **Decommission is deliberately decoupled from "cutover succeeded"** — PROJECT.md already frames this as a separate explicit confirmation, and the dependency chain above reflects that: a monitoring window sits between the two.

## MVP Definition

Reframed for a migration: this is "what must be true before old `ziko` project deletion is even considered" vs. "what's genuinely optional."

### Must Complete Before Cutover (No Correct Migration Without These)

- [ ] Full inventory of ziko's schema, functions, RLS, storage, auth config, extensions, realtime — the baseline everything else is verified against
- [ ] Schema exported and rewritten with `ziko_` prefix (tables + all dependent objects: constraints, indexes, sequences, functions, triggers)
- [ ] RLS re-created and verified enabled on all 93 `ziko_*` tables
- [ ] Auth merge complete — `auth.users`/`auth.identities` copied with IDs preserved, collision-checked against existing portfolio users, auth config (redirect URLs, email templates, JWT secret) merged additively without breaking rh_/gecko_
- [ ] Data copied and row-count/FK-integrity verified against source, table by table
- [ ] Storage buckets + objects copied and checksum/count-verified, signed URL flows re-tested
- [ ] All three env surfaces (backend, web, mobile) cut over and functionally smoke-tested against portfolio
- [ ] rh_/gecko_ regression check confirms no impact on the other two apps

### Add As Safety Margin, Not Blocking (Do If Time/Risk Tolerance Allows)

- [ ] Dry run of the full pipeline against a scratch project before touching production
- [ ] Incremental delta resync immediately pre-cutover to shrink the write-freeze window
- [ ] Automated (scripted, not manual) verification suite reusable across dry run and production run
- [ ] Defined monitoring window (days) with Sentry watch before decommission is even discussed

### Explicitly Deferred / Out of Scope

- [ ] Any functional schema redesign beyond renaming/prefixing (explicitly out of scope per PROJECT.md)
- [ ] Migrating to a non-Supabase provider (explicitly out of scope per PROJECT.md)
- [ ] True zero-downtime dual-write or logical-replication-based migration — not justified at this user count/scale; a short, communicated write-freeze is sufficient and far lower risk to implement correctly

## Feature Prioritization Matrix

| Step | User/Business Value | Implementation Cost | Priority |
|------|----------------------|----------------------|----------|
| Inventory + capacity check | HIGH (everything downstream depends on it) | LOW | P1 |
| Schema export + prefix rewrite (tables, functions, RLS) | HIGH | HIGH | P1 |
| Auth merge (IDs preserved, collision-checked) | HIGH (correctness-critical) | HIGH | P1 |
| Data copy + row/FK verification | HIGH | MEDIUM | P1 |
| Storage object migration + verification | HIGH | MEDIUM-HIGH | P1 |
| Env cutover (backend/web/mobile) | HIGH | LOW-MEDIUM | P1 |
| Functional smoke test before decommission | HIGH | MEDIUM | P1 |
| rh_/gecko_ regression check | HIGH (protects unrelated live apps) | LOW | P1 |
| Dry run on scratch project | MEDIUM (risk reduction) | MEDIUM | P2 |
| Delta resync to shrink freeze window | MEDIUM (user experience during cutover) | MEDIUM | P2 |
| Automated verification scripting | MEDIUM (repeatability) | MEDIUM | P2 |
| Rollback window before decommission | MEDIUM (safety) | LOW | P2 |
| Native mobile rebuild (post-OTA) | LOW (fresh installs only; EAS Update covers existing installs) | LOW | P3 |

**Priority key:**
- P1: Must have — migration is not "correct" without it
- P2: Should have — meaningfully reduces risk/downtime, cheap relative to the value
- P3: Nice to have — cleanup that can trail the actual cutover

## Sources

- [Migrating within Supabase — Supabase Docs](https://supabase.com/docs/guides/platform/migrating-within-supabase) — MEDIUM confidence (fetched excerpt was introductory; full guide content behind linked sub-pages)
- [Backup and Restore using the CLI — Supabase Docs](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) — HIGH confidence, official CLI commands (`supabase db dump --role-only` / schema / `--use-copy --data-only`, `session_replication_role = replica`)
- [Migrating Auth Users Between Supabase Projects — Supabase Docs (Troubleshooting)](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects) — HIGH confidence on JWT secret behavior and auth.users/auth.identities migration; does not cover the multi-tenant-merge/collision scenario specifically (LOW confidence there, reasoned independently)
- [Move Supabase storage objects between projects (community gist)](https://gist.github.com/inian/78d2263f40abec6fae9b49ba58ea57f9) — MEDIUM confidence, community pattern confirming no official cross-project object copy API
- [Copy Objects — Supabase Storage Docs](https://supabase.com/docs/guides/storage/management/copy-move-objects) — HIGH confidence for the 5GB per-object API copy limit (same-project copy API; not directly usable cross-project)
- [Environment variables in EAS — Expo Docs](https://docs.expo.dev/eas/environment-variables/usage/) and [Environment variables in Expo — Expo Docs](https://docs.expo.dev/guides/environment-variables/) — HIGH confidence: `EXPO_PUBLIC_` vars are inlined at bundle-build time; EAS Update re-inlines from the environment present at publish time, enabling an OTA env cutover without app-store review
- Postgres logical replication table-name-matching limitation — MEDIUM confidence, corroborated across multiple community/PostgreSQL mailing-list threads (no single canonical doc cited; consistent across sources) — [postgresql.org mailing list thread](https://www.postgresql.org/message-id/DB9PR07MB7180EF306DB3AE3ADD25D824CB979%40DB9PR07MB7180.eurprd07.prod.outlook.com)
- `.planning/PROJECT.md` (this repo) — v1.19 milestone scope, explicit out-of-scope boundaries, explicit separate-confirmation-before-deletion requirement
- `.planning/workstreams/supabase-portfolio-migration/STATE.md` — confirms milestone is pre-planning, no prior migration work started

---
*Feature research for: Supabase-to-Supabase project migration (ziko → portfolio)*
*Researched: 2026-09-21*
