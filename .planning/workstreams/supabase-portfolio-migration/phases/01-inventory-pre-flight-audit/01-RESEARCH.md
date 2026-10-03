# Phase 1: Inventory & Pre-Flight Audit - Research

**Researched:** 2026-09-22
**Domain:** Live Supabase project introspection (Postgres system catalogs + Management API) for a two-project migration pre-flight audit
**Confidence:** HIGH — every finding below was executed live against both real projects in this research session (not simulated), using a verified, working tool-call pattern. The only unresolved item is portfolio's exact plan-tier storage/connection quota ceiling (Vercel-marketplace-managed billing, not exposed via SQL or the CLI subcommands available).

## Summary

This phase has one job: replace every "unverified"/"assumed" flag in the milestone-level research (SUMMARY.md, ARCHITECTURE.md, PITFALLS.md) with live, queried facts from both `ziko` (`slkobhavpwsubnsmuhya`) and `portfolio` (`ubxllsvanurkwkohzxau`). This research session found and validated a working, low-friction tool-call pattern to do exactly that — `supabase db query --linked [--project-ref <ref>] "<SQL>"` — authenticated and already working in this environment, requiring no DB password, no `psql`, and no `supabase link` state change. Using it, this session already ran the actual INV-01/02/04/05 read-only queries (schema, RLS, functions, triggers, extensions, buckets, sizes) against both live projects and got real numbers, which are reported below as verified findings the planner can build tasks directly on top of. INV-03 (email collision) was resolved to an aggregate count only (1 collision found) — the raw email/user identity was deliberately not persisted to any file in this session; identifying and resolving that specific account is Phase 1's own execution work, done with the PII-handling discipline documented below.

The one meaningful correction to the milestone-level research: `portfolio` is not just a host for `rh_*`/`gecko_*` — it has its **own unprefixed application tables** (`albums`, `album_photos`, `categories`, `orders`, `portfolio_photos`, `products`, `prospects`) and **its own buckets** (`album-photos`, `portfolio-photos`, etc.), a third tenant not called out by name in prior research. This matters for the defensive-prefixing decision in Phase 2 (generic ziko function/table names must avoid colliding with `portfolio_*`'s own generic names too, not just rh_/gecko_).

**Primary recommendation:** Use `supabase db query --linked --project-ref <ref> "<SQL>"` (Supabase CLI, already authenticated in this environment) as the primary inspection tool for this phase, with the `mcp__claude_ai_Supabase__execute_sql`-family MCP tools (per this phase's task description) as an equally valid alternative if available in the executor's tool list — both hit the same Management API path. Run the read-only, non-PII queries below to build `INVENTORY.md`; run the `auth.users` email queries separately and immediately reduce them to counts/flags before writing anything to a committed file.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema/RLS/function/trigger/extension inventory | Database (Postgres system catalogs: `pg_catalog`, `information_schema`) | Ops tooling (Supabase CLI / MCP as the query transport) | The data lives in Postgres; the CLI/MCP tool is just the authenticated transport, not a source of truth itself |
| Storage bucket/object inventory | Database/Storage (`storage.buckets`, `storage.objects` — Supabase Storage is Postgres-metadata-backed) | — | Bucket and object metadata are rows in `storage` schema tables, queryable with the same SQL transport as the app schema |
| Auth user/collision inventory | Database (`auth.users`, `auth.identities` — GoTrue-managed Postgres tables) | Ops tooling (diff logic) | Raw data is in Postgres; the collision *diff* itself is a cross-project comparison that must happen outside SQL (no live cross-project join), in a script/report layer |
| Capacity/quota (DB size, storage size, `max_connections`) | Database (SQL-introspectable part: `pg_database_size`, `SHOW max_connections`, `storage.objects` size sum) | Platform/Management API or Dashboard (plan-tier ceiling, pooler client limits, billing-level storage quota) | Postgres exposes *current usage*; the *ceiling* (what plan tier allows) is a platform/billing concept outside Postgres, especially for a Vercel-marketplace-managed Supabase org like this one |
| Audit report authorship | Documentation (repo, `.planning/`) | — | `INVENTORY.md` is a durable artifact in this repo, not a runtime component |

## User Constraints

<user_constraints>
### Locked Decisions (from CONTEXT.md)

- **D-01 (Collision Handling):** Any email collision between a ziko user and an existing `portfolio` user (rh_* or gecko_*) is flagged in the collision report for **manual resolution only** — never auto-merged, never auto-suffixed. Resolution happens as a human decision before Phase 3 proceeds for that user.
- **D-02 (Version/Extension Mismatch):** Document Postgres version and extension diffs precisely (exact versions, exact extension list). No automatic upgrade/alignment of `portfolio`. Only escalate for a decision if a gap actually blocks something a ziko migration needs.
- **D-03 (Quota Insufficiency):** If `portfolio` lacks capacity (DB size, connections, or storage), report the exact deficit and **stop** — do not upgrade `portfolio`'s plan automatically. The upgrade decision belongs to the user (billing implication).
- **D-04 (Audit Deliverable):** Produce a committed `INVENTORY.md` report in this phase's directory — a durable audit trail, not an ephemeral finding. It must be referenceable by the Phase 7 decommission checklist.

### Claude's Discretion

- Exact format/structure of `INVENTORY.md` (tables vs. prose, level of detail per section) — as long as it covers all 5 Phase 1 success criteria (live ziko inventory, live portfolio inventory, collision report, version/extension diff, quota check).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope (per both `01-CONTEXT.md` and `01-DISCUSSION-LOG.md`).
</user_constraints>

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| INV-01 | Inventaire complet de `ziko` (tables, fonctions, RLS, triggers, buckets, extensions, realtime) via `information_schema` live | Verified live in this session — see "Verified Findings: ziko" below; exact queries provided for the executor to reproduce/expand |
| INV-02 | Inventaire complet de `portfolio` existant (rh_*, gecko_*: tables, fonctions, triggers sur `auth.users`, buckets, extensions) | Verified live in this session — see "Verified Findings: portfolio" below; also surfaces `portfolio`'s own unprefixed tenant tables/buckets not previously documented |
| INV-03 | Rapport de collision email/ID entre les 39 users `ziko` et les users existants `portfolio` | Aggregate collision count verified live (1 collision found) without persisting PII; exact query pattern + PII-handling protocol documented below for the executor to produce the full per-user resolution list |
| INV-04 | Vérification parité version Postgres + extensions entre les deux projets | Verified live — both on Postgres 17.6 (engine); extension diff computed exactly (pg_net, unaccent present only in ziko; pg_cron present only in portfolio) |
| INV-05 | Vérification capacité/quota disponible sur `portfolio` (DB size, connexions, storage) | DB size, storage-per-bucket, and `max_connections` verified live; plan-tier ceiling (Vercel-marketplace billing) flagged as requiring a Dashboard/Vercel check — not SQL-introspectable |
</phase_requirements>

## Verified Tool-Call Pattern (HIGH confidence — executed live this session)

**Primary transport, tested and working in this environment, zero side effects:**

```bash
# Query the currently-linked project (this repo is linked to ziko)
supabase db query --linked "<SQL>"

# Query ANY other project by ref, via Management API, WITHOUT changing the local link
# (verified: does not touch supabase/config.toml or the linked project state)
supabase db query --linked --project-ref <project-ref> "<SQL>"
```

- `ziko` ref: `slkobhavpwsubnsmuhya`
- `portfolio` ref: `ubxllsvanurkwkohzxau`
- Auth: already logged in via `supabase login` in this environment (`supabase projects list` succeeds) — no DB password, no `psql`, no local Postgres client needed.
- **Do not run bare `--project-ref` without `--linked`** — the CLI rejects it (`--project-ref only applies when targeting the linked project; use it with --linked`). The combination `--linked --project-ref <ref>` is the correct, non-mutating form for querying a project other than the one linked in this repo.
- **Avoid `supabase link --project-ref ubxllsvanurkwkohzxau`** as a way to switch targets — it persists a local project-ref change in this repo's Supabase config, which is an unnecessary and avoidable side effect on a dev machine that's otherwise linked to `ziko` for day-to-day work. The `--linked --project-ref` combination above achieves the same query without that side effect.

**If the executor's environment instead exposes the `mcp__claude_ai_Supabase__*` MCP tool family** (per this phase's task description — not present in this research session's own tool list, so its exact parameter names were not independently verified here): the equivalent calls are `mcp__claude_ai_Supabase__execute_sql` with a `project_id`/`project_ref` and `query` parameter, `mcp__claude_ai_Supabase__list_tables`, and `mcp__claude_ai_Supabase__get_advisors`. Both transports hit the same underlying Postgres/Management API — use whichever is available; the SQL below is transport-agnostic.

**Fallback if neither is available:** `supabase db dump --db-url <session-mode-connection-string>` piped through `psql` requires the project's direct/session-pooler connection string (Dashboard → Project Settings → Database) and a locally installed `psql` — **not installed in this environment** (`which psql` → not found). Only fall back to this if both the CLI `db query` path and MCP tools are unavailable.

## Verified Findings: ziko (`slkobhavpwsubnsmuhya`)

All queried live in this session, 2026-09-22.

| Item | Value | Query used |
|------|-------|------------|
| Postgres version | `PostgreSQL 17.6` (engine `17`, build `17.6.1.084`) | `SELECT version();` / `supabase projects list` |
| Tables in `public` | **99** | `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname='public';` |
| Tables with RLS enabled | **99 / 99 (100%)** | same query, `+ count(*) FILTER (WHERE relrowsecurity)` |
| Functions in `public` | **37** | `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';` |
| `SECURITY DEFINER` functions | **29** | same query, `+ count(*) FILTER (WHERE prosecdef)` |
| RLS policies in `public` | **176** | `SELECT count(*) FROM pg_policies WHERE schemaname='public';` |
| Triggers on `auth.users` | **2** — `on_auth_user_created` → `handle_new_user`, `on_auth_user_created_credits` → `handle_new_user_credits` | see query below |
| Storage buckets | **10** (not 9 — see correction below) | `SELECT id, name, public FROM storage.buckets ORDER BY name;` |
| Extensions | **7**: `pg_net 0.20.0`, `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, `unaccent 1.1`, `uuid-ossp 1.1` | `SELECT extname, extversion FROM pg_extension ORDER BY extname;` |
| Realtime publication (`supabase_realtime`) membership | **0 tables** — publication has no member tables at all | `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';` |
| DB size | **42 MB** | `SELECT pg_size_pretty(pg_database_size(current_database()));` |
| Sequence-backed (non-UUID) PKs in `public` | **0** — no column has a `nextval(...)` default anywhere in `public` | `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_default LIKE 'nextval%';` |
| `auth.users` count | **39** (matches REQUIREMENTS.md) | `SELECT count(*) FROM auth.users;` |
| Storage object count / size, all buckets | **2,699 objects / ~205 MB total** — heaviest: `exercise-media` (2,660 objects, 144 MB) | see per-bucket table below |
| `max_connections` (Postgres-level) | **60** | `SHOW max_connections;` |

**Storage buckets, exact list (10, not 9):** `ai-imports` (private, 9 obj/26 MB), `avatars` (public, 2 obj/160 kB), `coach-exercises` (private, 5 obj/2.9 MB), `coach-kyc` (private, 6 obj/13 MB), `coach-logos` (public, 1 obj/742 kB), **`coach-videos`** (private, 0 obj — this 10th bucket exists but is empty; not listed as one of the "9 buckets" in prior milestone-level research), `exercise-media` (public, 2,660 obj/144 MB), `exports` (private, 0 obj), `profile-photos` (private, 3 obj/1.6 MB), `scan-photos` (private, 13 obj/16 MB).

**Correction to STORAGE-01 requirement scope:** the requirement text says "9 buckets" — live inventory found **10**. `coach-videos` must be added to the Phase 5 rename/recreate list (it is currently empty, so no data-copy risk, only a schema/bucket-creation omission risk if the planner trusts the "9" figure).

**Auth trigger definitions (exact, no PII):**
```sql
SELECT t.tgname, c.relname AS table_name, p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND n.nspname = 'auth';
-- returns: on_auth_user_created -> handle_new_user (table: users)
--          on_auth_user_created_credits -> handle_new_user_credits (table: users)
```
Confirms ARCHITECTURE.md's Critical Integration Point exactly as predicted from migration-file reading — both triggers exist live, unscoped, on `auth.users`.

## Verified Findings: portfolio (`ubxllsvanurkwkohzxau`)

All queried live in this session, 2026-09-22, via `supabase db query --linked --project-ref ubxllsvanurkwkohzxau "<SQL>"`.

| Item | Value |
|------|-------|
| Postgres version | `PostgreSQL 17.6` (engine `17`, build `17.6.1.105`) — **same major/minor as ziko (17.6)**; build-number difference is a Supabase internal patch build, not a compatibility concern |
| Tables in `public` | **34** |
| Tables with RLS enabled | **34 / 34 (100%)** |
| Functions in `public` | **5** — `gecko_is_admin` (SECURITY DEFINER), `gecko_update_reservation_timestamp`, `gecko_update_updated_at_column`, `set_updated_at`, `swap_shift_employees` (SECURITY DEFINER) |
| Triggers on `auth.users` | **0** — confirmed empty; no existing `rh_*`/`gecko_*` equivalent of `handle_new_user` exists today |
| Storage buckets | **7**: `album-backgrounds`, `album-covers`, `album-photos`, `gecko-menu-images`, `portfolio-photos`, `product-images`, `sellerie-preview-product-images` — all `public: true` |
| Extensions | **6**: `pg_cron 1.6.4`, `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, `uuid-ossp 1.1` |
| DB size | **20 MB** |
| Storage object count / size, all buckets | **2,125 objects / ~1,227 MB total** — heaviest: `album-photos` (1,877 objects, 1,071 MB) |
| `auth.users` count | **5** |
| `max_connections` (Postgres-level) | **60** |

**Full table list (34), for the Phase 2 collision/rename-map baseline:**
- `gecko_*` (13): `gecko_admins`, `gecko_announcement`, `gecko_menu_categories`, `gecko_menu_items`, `gecko_menu_pages`, `gecko_opening_hours`, `gecko_phone_verifications`, `gecko_reservations`, `gecko_restaurant_settings`, `gecko_special_hours`, `gecko_table_assignments`, `gecko_table_configuration_tables`, `gecko_table_configurations`, `gecko_tables`
- `rh_*` (11): `rh_chat_messages`, `rh_chat_sessions`, `rh_employee_sites`, `rh_employees`, `rh_leave_requests`, `rh_notifications`, `rh_shift_swaps`, `rh_shift_types`, `rh_shifts`, `rh_sites`, `rh_tenants`, `rh_unavailabilities`, `rh_users`
- **Unprefixed — belongs to the "portfolio" app itself, a third live tenant not previously named in milestone research** (7): `album_photos`, `albums`, `categories`, `orders`, `portfolio_photos`, `products`, `prospects`

**Important scope correction:** prior research (ARCHITECTURE.md, PITFALLS.md, FEATURES.md) consistently frames `portfolio` as "a project hosting `rh_*` and `gecko_*`." Live inventory shows a third, unprefixed tenant (the `portfolio` app itself: albums/products/orders/prospects/categories). Every "defensive prefix to avoid colliding with rh_/gecko_" recommendation in Phase 2 research must also check against these 7 generic unprefixed names and the `portfolio-photos`/`album-photos`/`product-images`/`album-covers`/`album-backgrounds` bucket names.

**Function name collision check (ziko's 37 functions vs. portfolio's 5): zero collisions found.** Verified by running `SELECT proname FROM pg_proc ... WHERE proname IN ('set_updated_at','gecko_is_admin','gecko_update_reservation_timestamp','gecko_update_updated_at_column','swap_shift_employees')` against `ziko` — empty result. None of `ziko`'s ~37 functions (including the ~22 named RPCs from ARCHITECTURE.md) share a name with any of `portfolio`'s 5. This resolves one of ARCHITECTURE.md's flagged Anti-Pattern-2 risks for the current state (still recommend defensive `ziko_` prefixing per that pattern for *future*-proofing, since it's cheap and portfolio is an actively growing shared project).

**Bucket name collision check: zero collisions found.** None of ziko's 10 bucket names match any of portfolio's 7.

## Version/Extension Diff (INV-04 — resolved)

| | ziko | portfolio | Diff |
|---|------|-----------|------|
| Postgres engine | 17 (build 17.6.1.084) | 17 (build 17.6.1.105) | **Same major/minor (17.6) — no version-parity blocker for Phase 2's dump/restore path.** |
| `pg_net` | 0.20.0 | not installed | **ziko-only.** Used for async HTTP calls from Postgres (webhooks). If any `ziko_*` trigger/function calls `net.http_post`/similar, this extension must be installed on `portfolio` before that function is created there — verify during Phase 2's function-body audit. |
| `unaccent` | 1.1 | not installed | **ziko-only.** Likely backs `search_users_fuzzy` (per ARCHITECTURE.md's ~22 RPC list) or similar text-normalization logic. Must be installed on `portfolio` before that function is created there. |
| `pg_cron` | not installed | 1.6.4 | **portfolio-only.** No action needed for ziko's migration (ziko's 7 scheduled jobs run as Vercel crons, not `pg_cron`, per CLAUDE.md) — but confirms `portfolio` already has an in-DB scheduler other tenants may depend on; do not disturb it. |
| `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp` | present | present | Shared — no gap. |

**Action for Phase 2 planning:** add `CREATE EXTENSION IF NOT EXISTS pg_net;` and `CREATE EXTENSION IF NOT EXISTS unaccent;` as an explicit pre-step before applying ziko's renamed schema to `portfolio`, gated on confirming (via `pg_proc.prosrc` grep, Phase 2's own job) that at least one migrated function actually references them. No blocker found — D-02's "escalate only if a gap blocks something" condition is not triggered; this is a straightforward two-line fix, not an escalation.

## Collision Report (INV-03 — aggregate only; PII handling protocol)

**Verified live, this session:** ziko has 39 `auth.users` rows, portfolio has 5. Comparing lowercased emails between the two sets (computed in an ephemeral scratch script, never written to any repo file): **1 email collision found.**

**What this means for planning:** D-01's manual-resolution flow is not hypothetical for this migration — there is exactly one real account that needs human review before Phase 3 can proceed for that user. The planner should size a concrete task for this ("resolve the 1 flagged collision") rather than a generic "handle collisions if any are found" placeholder.

**PII handling protocol — required for whatever task actually identifies the colliding account(s):**
- **Do not commit raw email addresses into `INVENTORY.md`** (or any other git-tracked file). `INVENTORY.md` is a durable, permanent artifact per D-04 — email addresses are personal data with no legitimate reason to live in git history indefinitely, especially post-decommission when this becomes the only surviving record referencing `ziko`.
- Recommended structure: `INVENTORY.md` (committed) states the **count** and a **masked/partial identifier** per collision (e.g., `j***@g****.com`, or the ziko `auth.users.id` UUID alone, which is not itself PII in the same way and is directly actionable for the Phase 3 resolution task). The **full email**, if needed for the actual human-contact resolution step, goes in a local file under `.planning/**/.cache/` (already a gitignored pattern in this repo's `.gitignore`) or is handled entirely out-of-band (e.g., referenced only in the live GSD conversation/handoff, not persisted to disk).
- Query pattern used (run against each project separately — no live cross-project SQL join exists between two separate Supabase projects):
```sql
-- Run on ziko
SELECT lower(email) AS email, id FROM auth.users ORDER BY 1;
-- Run on portfolio
SELECT lower(email) AS email, id FROM auth.users ORDER BY 1;
-- Diff the two result sets programmatically (Node/Python set intersection) —
-- do this in an ephemeral script/scratch location, never as a committed SQL JOIN
-- (the two databases are not network-joinable without dblink/postgres_fdw, which
-- is unnecessary complexity to set up for a one-time 39-vs-5-row diff).
```
- Re-run this check again immediately before the actual Phase 3 auth-write cutover — per PITFALLS.md, `ziko` remains live and accepting signups until then, so the collision set can grow between this research/audit snapshot (2026-09-22) and execution.

## Capacity/Quota Check (INV-05 — resolved, with one open item)

| Dimension | ziko usage | portfolio usage (pre-migration) | Combined post-migration | Assessment |
|-----------|------------|-----------------------------------|--------------------------|-------------|
| DB size | 42 MB | 20 MB | ~62 MB | **No concern at any Supabase plan tier** — trivially small even for Free tier's 500 MB soft-limit framing. |
| Storage | ~205 MB (2,699 objects) | ~1,227 MB (2,125 objects) | ~1,432 MB (~1.4 GB) | **Needs plan-tier confirmation** — portfolio alone is already above the commonly-cited Free-tier 1 GB storage allowance, meaning `portfolio` is very likely already on a paid tier (consistent with it being an active multi-tenant project), but the *exact* plan and its storage ceiling was not resolvable via SQL/CLI in this session (see below). Report the ~1.4 GB combined figure to the user and have them confirm against the actual plan limit before Phase 5 (Storage Migration) proceeds. |
| `max_connections` (Postgres-level) | 60 | 60 | n/a (shared pool after merge) | Both projects report the same Postgres-level ceiling. Note this is the **direct** connection limit, not the Supavisor pooler's client-facing limit (which is typically higher and is the one application code actually hits, per STACK.md's session-mode-vs-transaction-pooler guidance) — Phase 6 cutover should use the pooler connection string, not raw Postgres, for the same reason STACK.md already recommends for `pg_dump`/`psql`. |

**Open item — plan tier / storage quota ceiling:** This project's Supabase organization (`vercel_icfg_y5brWcl0o23xn4A50p4NAUFG`) is a **Vercel Marketplace-managed integration** (confirmed via `supabase orgs list` — the org slug is a Vercel integration ID, not a normal Supabase org). Billing/plan-tier and quota ceilings for Vercel-marketplace Supabase projects are managed through the Vercel dashboard's Storage/Integrations tab, not through `supabase orgs`/`projects` CLI subcommands (none expose plan tier) and not through any SQL-introspectable Postgres setting. **This is a Dashboard-only check** (Vercel dashboard → Storage → the Supabase integration → usage/limits, or Supabase dashboard → Settings → Billing for the linked project) — flag this as the one item in this phase that cannot be automated via CLI/MCP/SQL and must be a manual verification step (or a `checkpoint:human-verify` task) in the plan.

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** All inspection in this phase uses tools already present in this environment: the Supabase CLI (already installed and authenticated, v2.116.0 — one patch behind latest 2.117.0, update recommended but not blocking for read-only `db query`) and/or the `mcp__claude_ai_Supabase__*` MCP tool family described in the phase task. No `npm install`/`pip install` is needed for INV-01 through INV-05.

## Architecture Patterns

### Recommended INVENTORY.md structure

```
01-INVENTORY.md   (sibling to 01-CONTEXT.md / 01-DISCUSSION-LOG.md, same NN- prefix convention)
├── Executive Summary (one paragraph: table/function/bucket/extension counts, collision count, quota verdict)
├── ziko Live Inventory (INV-01)
│   ├── Tables (count, RLS-enabled count, full list — or link to a generated CSV if too long for prose)
│   ├── Functions (count, SECURITY DEFINER count, full list with prosecdef flag)
│   ├── RLS Policies (count; note if per-table detail is deferred to Phase 2's own grep-based audit)
│   ├── Triggers (full list, especially auth.users — this is the highest-risk item, name it explicitly)
│   ├── Storage Buckets (list with public/private flag, object count, size)
│   ├── Extensions (full list with versions)
│   └── Realtime Publications (list of member tables, or "none" if empty like ziko's)
├── portfolio Live Inventory (INV-02)
│   └── (same subsections as above, PLUS an explicit "existing tenants" breakdown: rh_*, gecko_*, and
│        the unprefixed portfolio-app-own tables — do not omit the third tenant)
├── Collision Report (INV-03)
│   ├── Aggregate counts (ziko user count, portfolio user count, collision count)
│   ├── Masked/redacted collision detail (NOT raw emails — see PII protocol above)
│   └── Resolution status per flagged collision (Pending / Resolved — same-person / Resolved — distinct)
├── Version & Extension Diff (INV-04)
│   ├── Postgres version comparison
│   └── Extension diff table (ziko-only / portfolio-only / shared) with an explicit action recommendation
├── Capacity & Quota Check (INV-05)
│   ├── DB size, storage size, connection limits (measured)
│   └── Plan-tier ceiling (Dashboard-confirmed, or flagged as open/pending human check)
└── Risks & Escalations (anything that trips D-01/D-02/D-03's "stop and report" conditions)
```

Rationale for this structure: Phase 2 needs the rename map input (table/function/bucket lists), Phase 3 needs the collision report, Phase 7 needs to reference the whole document for its decommission checklist — a single flat file with these named sections lets each downstream phase link directly to the relevant `##` anchor rather than re-deriving the same inventory.

### Pattern: two-phase query execution (structural facts, then PII facts, separately)

**What:** Run all structural/schema/extension/bucket queries (Sections ziko/portfolio Live Inventory, Version/Extension Diff, non-PII parts of Capacity Check) first, write them directly into `INVENTORY.md`. Run the `auth.users` email queries in a separate, later step, reduce to counts/masked identifiers before writing anything.
**When:** Always, for this phase specifically.
**Why:** Keeps the majority of the audit trivially safe to commit as-is, and isolates the one part of the phase (PII) that needs deliberate handling to a small, clearly-bounded task — rather than needing PII discipline throughout the entire audit.

### Anti-Patterns to Avoid

- **Running a raw `SELECT * FROM auth.users` and pasting the output into `INVENTORY.md`:** this is the single most likely accidental-PII-commit failure mode for this phase. Every `auth.users` query in the executor's task list should explicitly select only non-PII columns for anything destined for the committed file (`id`, `created_at`, `raw_app_meta_data->>'provider'`, counts) — email only in ephemeral/local scratch use.
- **Trusting REQUIREMENTS.md's "9 buckets" / "39 users" figures as complete without re-verifying:** the 39-user figure was confirmed correct live, but the 9-bucket figure was found to be **wrong** (10 buckets exist, including an empty `coach-videos`). Always let the live query be the source of truth per this phase's own stated purpose — don't silently carry forward a milestone-doc number without checking it.
- **Switching the repo's linked Supabase project (`supabase link --project-ref ...`) to query `portfolio`:** unnecessary — `supabase db query --linked --project-ref <ref>` queries any project without changing local link state, verified working in this session.

## Common Pitfalls

### Pitfall 1: Row-count queries via `pg_class.reltuples` are estimates, not exact counts
**What goes wrong:** `reltuples`-based or `pg_stat_user_tables.n_live_tup`-based row counts (fast, no table scan) can drift from the true count if `ANALYZE` hasn't run recently, especially on small/rarely-analyzed tables.
**Why it happens:** Postgres only updates `reltuples` on `ANALYZE`/`VACUUM`, not on every write.
**How to avoid:** For this phase's purposes (structural inventory, capacity sizing), estimates are acceptable and should be labeled "approximate" in `INVENTORY.md`. Exact per-table row-count parity is explicitly DATA-03's job in Phase 4, not this phase's — don't over-invest in exact counts here.
**Warning signs:** A table inventory count that looks suspiciously round or stale relative to known activity.

### Pitfall 2: `supabase db query` silently drops earlier statements in a multi-statement string
**What goes wrong:** Sending `SELECT a; SELECT b;` as one string to `supabase db query` in this session returned only the last statement's result set (observed directly: a combined DB-size-then-user-count query returned only the user-count rows).
**Why it happens:** The underlying Management API query endpoint appears to execute the batch but only surface the final result set (undocumented behavior, discovered empirically this session — not confirmed against official docs, so treat as MEDIUM confidence and always verify empirically rather than assuming a specific multi-statement semantics).
**How to avoid:** Run one query per `supabase db query`/tool invocation. Don't try to batch multiple `SELECT`s into a single call expecting all result sets back.
**Warning signs:** A query with two `SELECT`s that returns only one row set with no error.

### Pitfall 3: Treating `portfolio` as a two-tenant project (rh_*/gecko_* only)
**What goes wrong:** Prior milestone research (ARCHITECTURE.md, PITFALLS.md) consistently frames collision risk as "against rh_*/gecko_*." Live inventory found a third, unprefixed tenant (portfolio's own app tables/buckets) that any defensive-prefixing or collision-check task must also cover.
**Why it happens:** No prior session had live read access to `portfolio`'s actual table list before this research pass.
**How to avoid:** Anywhere Phase 2 planning says "check against rh_*/gecko_*," expand it to "check against rh_*, gecko_*, AND portfolio's own unprefixed tables (`albums`, `album_photos`, `categories`, `orders`, `portfolio_photos`, `products`, `prospects`)."
**Warning signs:** A Phase 2 task description that only mentions two tenant prefixes.

### Pitfall 4: Assuming Vercel-marketplace Supabase billing is queryable the same way as a native Supabase org
**What goes wrong:** Attempting to find `portfolio`'s plan tier/storage quota via `supabase orgs`/`projects` CLI subcommands or a SQL query wastes execution time — none of these expose it for this org type.
**Why it happens:** This Supabase org is provisioned through the Vercel Marketplace integration (org slug `vercel_icfg_...`), which manages billing/quotas through Vercel's own dashboard, not Supabase's native billing pages.
**How to avoid:** Go straight to a `checkpoint:human-verify` task pointing at the Vercel dashboard (Storage/Integrations tab) rather than spending execution time hunting for a CLI/SQL path that doesn't exist for this org type.
**Warning signs:** `supabase orgs`/any billing-related CLI subcommand returning only `id`/`slug`/`name`, no plan/quota fields (confirmed behavior this session).

## Code Examples

### Full ziko inventory query set (verified working, non-PII)
```sql
-- Table + RLS inventory
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public'
ORDER BY c.relname;

-- Function inventory (flag SECURITY DEFINER)
SELECT p.proname, p.prosecdef AS security_definer,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- RLS policies, full detail (for the Phase 2 stale-reference grep baseline)
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Triggers, any schema (run with n.nspname IN ('public','auth'))
SELECT n.nspname AS schema, c.relname AS table_name, t.tgname AS trigger_name,
       p.proname AS function_name, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth')
ORDER BY schema, table_name;

-- Storage buckets + usage
SELECT b.id, b.name, b.public, count(o.id) AS object_count,
       pg_size_pretty(coalesce(sum((o.metadata->>'size')::bigint),0)) AS total_size
FROM storage.buckets b
LEFT JOIN storage.objects o ON o.bucket_id = b.id
GROUP BY b.id, b.name, b.public
ORDER BY b.name;

-- Storage RLS policies (needed by Phase 5, but cheap to capture now)
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Extensions
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- Realtime publication membership
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;

-- Non-UUID sequence-backed PKs (feeds Phase 4's sequence-reconciliation scope)
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND column_default LIKE 'nextval%';

-- Capacity: DB size, connection ceiling
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;
SHOW max_connections;

-- Non-PII auth facts
SELECT count(*) AS user_count FROM auth.users;
```

### Email collision check (PII-isolated — do not adapt this to write raw emails to a committed file)
```sql
-- Run separately against each project, pipe to an ephemeral scratch file (NOT under .planning/),
-- diff programmatically, delete the scratch files immediately after computing the count.
SELECT lower(email) AS email, id FROM auth.users ORDER BY 1;
```

### Exact CLI invocation pattern (verified this session)
```bash
# ziko (linked project in this repo)
supabase db query --linked "SELECT version();"

# portfolio (by ref, no link-state change)
supabase db query --linked --project-ref ubxllsvanurkwkohzxau "SELECT version();"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Assuming `portfolio`'s internals are "invisible from this repo" and treating every downstream decision as provisional (per SUMMARY.md/ARCHITECTURE.md's own Research Flags) | Live-queried and verified in this session — trigger/function/bucket/extension/table lists for both projects are now known facts, not assumptions | This research session, 2026-09-22 | Phase 2 planning can now lock the defensive-prefix decision against a real name list (37 ziko functions × 5 portfolio functions × 7 portfolio unprefixed tables) instead of planning around an unknown |
| "9 storage buckets" (REQUIREMENTS.md/STORAGE-01 wording) | 10 buckets confirmed live (`coach-videos` added) | This session | STORAGE-01's task scope in Phase 5 must be corrected to 10 buckets |

**Deprecated/outdated:** Nothing in the tooling itself is deprecated — `supabase db query --linked` is current CLI (v2.116.0, one patch behind 2.117.0 latest per STACK.md's own version check; the `db query`/`db advisors` subcommands used here are stable in both versions).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `mcp__claude_ai_Supabase__execute_sql`/`list_tables`/`get_advisors` accept a `project_id`/`project_ref` + `query` parameter shape roughly matching the community Supabase MCP server's known tools | Verified Tool-Call Pattern | If the actual parameter names differ, the executor's first MCP call will error with a clear schema-validation message — low risk, self-correcting; the CLI fallback documented alongside it is independently verified and does not depend on this assumption |
| A2 | Vercel-marketplace-managed Supabase orgs have no CLI/SQL-exposed plan-tier/quota-ceiling field (only tested that `supabase orgs list` returns no such field; did not exhaustively test every CLI subcommand) | Capacity/Quota Check | If a CLI subcommand does expose it, the plan may include an unnecessary `checkpoint:human-verify` task that could have been automated — low-cost error, not a correctness risk |
| A3 | The 1 found email collision is a genuine same-string match and not a false positive from encoding/whitespace differences (lowercased comparison only; did not trim whitespace or normalize unicode) | Collision Report | If it's a false positive, Phase 3's collision-resolution task targets a non-issue — low risk, the manual-resolution step (D-01) would simply confirm "not actually colliding" and move on |

## Open Questions (RESOLVED)

1. **Exact storage quota ceiling for `portfolio`'s current Vercel-marketplace Supabase plan**
   - What we know: current combined usage post-migration would be ~1.4 GB storage, 62 MB DB, both projects report `max_connections=60`
   - What's unclear: the plan's actual ceiling for storage/connections (pooler client limit specifically, not raw Postgres `max_connections`)
   - RESOLVED: routed to 01-01 Task 3's blocking `checkpoint:human-verify` task, pointing at the Vercel dashboard's Storage/Integrations tab (or Supabase dashboard Settings → Billing for `ubxllsvanurkwkohzxau`), per D-03's "stop and report, don't auto-upgrade" policy

2. **Whether `ziko`'s `pg_net`/`unaccent` usage is load-bearing for any migrated function**
   - What we know: both extensions are installed on ziko, neither on portfolio; ziko has 29 SECURITY DEFINER functions total
   - What's unclear: whether any of those functions actually call `net.*`/`unaccent()` (this phase counted/named functions but did not grep every function body for extension-specific calls — that's arguably Phase 2's job, not Phase 1's, since it's about the *rewrite*, not the *inventory*)
   - RESOLVED: explicitly out of scope for this phase, deferred to Phase 2's function-rewrite research/planning, which should grep `pg_proc.prosrc` for `net\.` and `unaccent(` across all 37 ziko functions as its own pre-flight step

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Primary inspection transport (verified working this session) | ✓ | 2.116.0 (latest: 2.117.0 — update recommended, not blocking) | — |
| `mcp__claude_ai_Supabase__*` MCP tools | Alternative inspection transport named in phase task description | Not present in this research session's own tool list — not independently verified here | — | Supabase CLI `db query` (verified, primary) |
| `psql` / local Postgres client | Last-resort fallback if both CLI and MCP unavailable | ✗ (`which psql` → not found) | — | Supabase CLI `db query --linked` (already the primary path — no action needed unless both other options fail) |
| Supabase CLI authentication (`supabase login`) | Required for `db query --linked` to work at all | ✓ (confirmed — `supabase projects list` succeeds without prompting) | — | — |

**Missing dependencies with no fallback:** None — the primary path (Supabase CLI) is fully available and was used to produce every verified finding in this document.

**Missing dependencies with fallback:** `mcp__claude_ai_Supabase__*` tools (unconfirmed in this session) — fallback (Supabase CLI) already proven working; no action needed unless the executor's environment specifically requires MCP-only tooling for policy reasons.

## Validation Architecture

This phase produces a documentation artifact (`INVENTORY.md`), not application code — there is no unit/integration test framework to wire up. "Validation" here means confirming each live query actually ran and its output was captured, not running an automated test suite.

### Phase Requirements → Verification Map

| Req ID | Behavior | Verification Method | Command | Verified in this research session? |
|--------|----------|---------------------|---------|--------------------------------------|
| INV-01 | ziko schema/RLS/function/trigger/bucket/extension/realtime inventory captured | Re-run each query in "Code Examples" above against ziko, confirm non-error JSON response, confirm counts match this document (99 tables, 37 functions, 176 policies, 10 buckets, 7 extensions) | `supabase db query --linked "<SQL>"` | ✅ Yes — all counts above were produced live |
| INV-02 | portfolio schema/RLS/function/trigger/bucket/extension inventory captured | Same queries against portfolio, confirm counts (34 tables, 5 functions, 0 auth triggers, 7 buckets, 6 extensions) | `supabase db query --linked --project-ref ubxllsvanurkwkohzxau "<SQL>"` | ✅ Yes |
| INV-03 | Collision report produced, PII-safe | Confirm `INVENTORY.md` contains only counts/masked identifiers for `auth.users` data, never raw emails; confirm the actual resolution task references the 1 found collision | Manual review of the committed file's diff before commit | ✅ Aggregate count verified (1); raw identity deliberately not resolved in this research pass |
| INV-04 | Version/extension parity documented | Confirm `INVENTORY.md`'s diff table matches: same Postgres 17.6 engine, `pg_net`+`unaccent` ziko-only, `pg_cron` portfolio-only | `SELECT version();` + `SELECT extname,extversion FROM pg_extension;` on both | ✅ Yes |
| INV-05 | Capacity/quota check with explicit deficit-or-clear verdict | Confirm DB size/storage/connections captured for both projects; confirm plan-tier ceiling is either confirmed via Dashboard or explicitly flagged as an open `checkpoint:human-verify` item, never silently skipped | `pg_database_size`, per-bucket storage sum, `SHOW max_connections`, + Dashboard check | ✅ Measured items verified; plan-tier ceiling explicitly flagged open (not silently skipped) |

### Sampling Rate
- **Per query:** confirm the JSON response has no `error` field and `rows` is non-empty (or explicitly expected-empty, e.g., realtime publication).
- **Phase gate:** all 5 verification rows above must show a captured, non-placeholder value in `INVENTORY.md` before `/gsd:verify-work` runs for this phase — a "TBD" or "assumed" value in any INV section fails the gate, since D-01/D-02/D-03 explicitly require exact figures for their stop/escalate logic to function.

### Wave 0 Gaps
None — this phase has no code test suite to bootstrap; the "tests" are the live queries themselves, all of which are demonstrated working in this document.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No (read-only inspection, no auth flow built this phase) | — |
| V3 Session Management | No | — |
| V4 Access Control | No (no RLS/access-control changes this phase — inspection only) | — |
| V5 Input Validation | No (no user input processed this phase — all queries are executor-authored SQL, not user-submitted) | — |
| V6 Cryptography | No | — |
| **Data Privacy (not a numbered ASVS section here, but the phase's actual risk)** | **Yes** | Minimize PII in the committed audit trail — see PII Handling Protocol above |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Committing raw `auth.users.email` values into a permanent git-tracked file (`INVENTORY.md`) | Information Disclosure | Query only non-PII columns for anything destined for the committed file; reduce `auth.users` comparisons to aggregate counts + masked identifiers; keep any full-email working data in an ephemeral, gitignored location and delete it after use (this session's own practice: written to a temp scratch path, diffed, then deleted — never written into the repo) |
| Accidentally persisting a Supabase Management API access token or service-role key into a committed script/log while building the audit tooling | Information Disclosure / Elevation of Privilege | The verified `supabase db query --linked` pattern needs no explicit token in the command itself (uses the CLI's own stored session) — prefer it over any pattern that would require embedding a service-role key or PAT literally in a script argument |

## Sources

### Primary (HIGH confidence — executed live, this session, 2026-09-22)
- `supabase db query --linked "<SQL>"` against ziko (`slkobhavpwsubnsmuhya`) — all "Verified Findings: ziko" figures
- `supabase db query --linked --project-ref ubxllsvanurkwkohzxau "<SQL>"` against portfolio — all "Verified Findings: portfolio" figures
- `supabase projects list` — confirmed both projects' Postgres engine/build versions, ACTIVE_HEALTHY status, region
- `supabase orgs list` — confirmed Vercel-marketplace org type, informing the plan-tier open question
- `supabase db --help` / `supabase db query --help` / `supabase db advisors --help` — confirmed exact CLI subcommand flags used throughout this document

### Secondary (MEDIUM confidence)
- Milestone-level research (`SUMMARY.md`, `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `FEATURES.md`, all dated 2026-09-21) — used for cross-referencing which prior assumptions this session's live data confirmed or corrected

### Tertiary (LOW confidence)
- `mcp__claude_ai_Supabase__*` tool parameter shapes (A1 in Assumptions Log) — not independently tested in this research session; assumed to follow the common Supabase MCP server tool shape based on the phase task description's own naming

## Metadata

**Confidence breakdown:**
- Standard stack (tool-call pattern): HIGH — the exact CLI invocation was tested live, multiple times, against both real projects, with zero side effects confirmed via `git status`
- Architecture (INVENTORY.md structure, PII-handling pattern): HIGH for the underlying facts it's built on; MEDIUM for the specific file-structure recommendation (Claude's Discretion per CONTEXT.md — reasonable but not the only valid structure)
- Pitfalls: HIGH — Pitfalls 1, 3, 4 are directly observed in this session (not theoretical); Pitfall 2 (multi-statement batching) is an empirical observation from one test, flagged MEDIUM pending confirmation against official Supabase CLI docs (not found during this session's research)

**Research date:** 2026-09-22
**Valid until:** 7 days for the specific numeric findings (both projects are live and actively changing — `ziko` still accepts signups per PITFALLS.md, so table/user/storage counts will drift; re-run the queries at execution time rather than trusting this document's numbers verbatim for anything beyond initial task sizing). 30 days for the tool-call pattern and structural recommendations (CLI subcommand shape is stable).
