# Phase 4: Data Copy & Integrity Verification - Research

**Researched:** 2026-10-02
**Domain:** Postgres-to-Postgres bulk data copy (COPY streaming over Supabase session pooler), trigger/FK suppression, UUID remap, parity/integrity verification
**Confidence:** MEDIUM-HIGH (live DB state HIGH; direct-connection credential flow MEDIUM, needs a probe task)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Transport is a **Node script in `scripts/portfolio-migration/`** (`.mjs`, same conventions as Phase 2/3 scripts) that streams each table with `COPY TO` (source) -> `COPY FROM` (destination) over two `pg` connections (session-mode pooler). Table-name mapping comes from `rename-map.generated.json`; the UUID remap is applied in-flight. Not `pg_dump | sed`, not MCP `execute_sql`.
- **D-02:** Triggers and FK checks are suppressed with **`SET session_replication_role = replica`** per load session, so load order does not matter; FK validation (`VALIDATE CONSTRAINT` + orphan queries) runs afterwards. **Probe first** that the connecting role may set it on portfolio; if not, fall back to per-table `ALTER TABLE ... DISABLE TRIGGER USER` with guaranteed re-enable in a `finally`. After load, assert no user trigger on any `ziko_*` table is left disabled (`pg_trigger.tgenabled`).
- **D-03:** The final delta sync before Phase 6 cutover is a **full truncate-and-reload of every `ziko_*` table** inside the write-freeze, using the identical script/code path as Phase 4 (DB is ~42 MB). No incremental/upsert logic.
- **D-04:** Truncation scope is guarded: the script **refuses to run unless every target table is `ziko_`-prefixed** and never touches `auth.*`, `rh_*`, `gecko_*`, or other portfolio-own tables. Pre-seeded/static `ziko_*` rows (if Phase 2 seeded any) are removed by the truncate and reloaded from source, so they also reach exact parity.
- **D-05:** **Rehearse on the Phase 2 scratch project first** (full load + full verification suite), then a human typed-phrase checkpoint (same pattern as Phase 3 plan 10), then the real portfolio load. Scratch needs the Phase 3 auth import state for FKs to resolve; plan must ensure that precondition.
- **D-06:** Recovery model: **one transaction per table**; a mid-run failure leaves a known state, and recovery is re-run from the start (begins with the guarded `ziko_*` truncate). No single giant transaction.
- **D-07:** Collision user remap (`ea0f0b65-6681-4780-8ee0-dbf20b95d4d9` -> target read from `scripts/auth-merge/uuid-remap.json`, never hardcoded) covers (a) all FK-discovered columns referencing `auth.users` (query at run time per `03-UUID-REMAP-SPEC.md` section 3), (b) known non-FK columns (`ziko_exercises_merge_backup.user_id`, polymorphic `ziko_coin_transactions.source_id` / `ziko_xp_transactions.source_id`), and (c) a text/jsonb scan: replace the UUID string inside every text/jsonb column in-flight. Verification asserts zero occurrences of the source UUID as text in any uuid/text/jsonb column of any `ziko_*` table on portfolio, and per-table counts of target-UUID rows on portfolio equal source-UUID rows on ziko (spec section 6). Pre-check (spec section 5): portfolio target UUID has zero rows in all `ziko_*` tables before load.
- **D-08:** Exact row-count parity on every table, no exclusion list (DATA-03). Load is trigger-silent so no trigger-created rows exist; any mismatch fails the suite.
- **D-09:** Verification lives in `scripts/portfolio-migration/` as `.mjs` + `node:test`, modeled on `scripts/auth-merge/06-verify.mjs` (`--check <name>` / `--check all`). Checks: per-table counts source vs destination, RLS enabled on all `ziko_*` tables, `VALIDATE CONSTRAINT` + orphan query per FK, sequence reconcile + a rolled-back test insert (DATA-02), UUID-remap zero-occurrence. Output is machine-readable JSON plus a PII-safe masked summary (no raw emails/IDs of users in git-tracked files, per Phase 1 protocol). Re-runnable on demand (DATA-05).
- **D-10:** Sequences (non-UUID PKs) are reconciled with `setval` from ziko's live values (never hardcoded); `ziko_waitlist_founder_seq` was already set in Phase 3 (87/true) - re-read live and confirm it is not regressed by the load.

### Claude's Discretion
Exact module layout, script names/numbering (continue `scripts/portfolio-migration/NN-*.mjs` series), batching/stream tuning, how the in-flight text/jsonb replacement is implemented (stream transform vs staging table), per-table load ordering for readability, connection-string handling and secret hygiene (follow Phase 2/3 RUNBOOK conventions).

### Deferred Ideas (OUT OF SCOPE)
- Executing the real final delta / write-freeze - Phase 6.
- Storage object re-keying for the collision user - Phase 5.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | All `ziko_*` tables loaded via COPY with triggers disabled | `SET LOCAL session_replication_role = replica` empirically accepted on portfolio and scratch (via Management API as `postgres`); pg-copy-streams COPY TO/FROM pipeline; guarded TRUNCATE of all 99 tables in one statement |
| DATA-02 | Sequences reconciled with `setval` for non-PK-uuid | Live probe: ziko has exactly ONE sequence (`waitlist_founder_seq`=87), zero identity columns, zero `nextval()` column defaults. Reconcile is a generic discovery + single `setval`; never call `nextval()` as a "test insert" (not rolled back) |
| DATA-03 | Row-count parity table by table | 99/99 table pairs; column lists/types/order verified identical on both sides; `count(*)` (NOT `pg_stat n_live_tup`, which is stale: `food_database` shows 0 vs 7932 real) |
| DATA-04 | FKs re-validated + orphan detection | 144 FKs on portfolio `ziko_*` (all `convalidated`), 97 FK columns to `auth.users` (92 CASCADE, 5 SET NULL), 2 self-refs; spec section 3 discovery query is BROKEN (see Pitfall 1) |
| DATA-05 | Reusable verification suite in repo | Mirror `06-verify.mjs` dispatcher; pure evaluators unit-tested with `node:test`; JSON + masked summary |
</phase_requirements>

## Summary

The live state is much friendlier than the planning docs imply. Both portfolio and scratch already contain the full `ziko_*` schema: 99 tables, **column names/types/nullability/order identical to ziko for all 99 pairs** (verified by diffing `information_schema.columns` against `rename-map.generated.json`), 144 FKs (all valid), RLS enabled on all 99, the 18 public user triggers plus 2 `ziko_on_auth_user_created*` triggers on `auth.users` (all enabled, origin mode), and all `ziko_*` tables are empty. ziko holds 99 tables / ~20.9k rows total (42 tables empty; largest `food_database` 7,932, `exercise_import_log` 3,498, `supplement_prices` 3,169). No generated columns, no identity columns, no serial defaults, no bytea, no views/matviews, no partitioning/inheritance, no deferrable FKs. Types in use: `_text, bool, date, int4, int8, jsonb, numeric, text, time, timestamptz, uuid`. Because every column list matches, `COPY public.<src> (cols) TO STDOUT` piped to `COPY public.<dst> (cols) FROM STDIN` in text format is safe with no per-table column mapping.

Triggers are attached and enabled on portfolio, so suppression is mandatory (the `updated_at` triggers would rewrite timestamps and the two `supabase_functions.http_request` triggers would POST to `api.ziko-app.com`; the credit-balance BEFORE INSERT trigger would rewrite `balance_after`). `SET LOCAL session_replication_role = replica` was **tested live** on portfolio and scratch through the Management API (`postgres` role, `rolsuper=false`, `rolbypassrls=true`) and works, even though `has_parameter_privilege(...,'SET')` reports false (do not rely on that function as the probe; do a real SET + `current_setting` round trip).

The remaining real risks are (1) obtaining direct pg credentials without leaking secrets or resetting portfolio's shared DB password, (2) the spec section 3 FK-discovery query returning zero rows because of `regclass::text` schema-qualification behavior, (3) scratch is not currently in a valid rehearsal state for the remap (39 auth users but neither the source collision UUID nor portfolio's target UUID exists there), and (4) text/jsonb in-flight replacement must be line-oriented and case-insensitive.

**Primary recommendation:** One Node script family using `pg@8.23.1` + `pg-copy-streams@7.0.0`, two session-pooler clients (one read-only `REPEATABLE READ` snapshot on source, one writer on destination), credentials from the Management API `cli/login-role` endpoint (PAT via `SUPABASE_ACCESS_TOKEN`, Phase 3 convention), `SET LOCAL session_replication_role=replica` inside a per-table transaction, a line-based COPY-text transform doing case-insensitive UUID replacement, one guarded 99-table `TRUNCATE` first, `setval` from live source, then a `--check` verification suite. Keep a Management-API-only fallback (JSON recordset, the Phase 3 pattern) documented in case direct credentials prove unobtainable.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bulk row transport | Operator-side Node script (outside the app) | Database (COPY protocol) | One-shot migration tooling, not an app tier |
| Trigger/FK suppression | Database session setting | - | `session_replication_role` is per-session/transaction |
| UUID remap | Node stream transform | Database (post-load verification query) | In-flight per D-07; DB only verifies |
| Integrity verification | Operator Node script | Database (catalog + count queries) | Re-runnable CLI (DATA-05) |
| Credentials | Management API (`cli/login-role`) | Env var in gitignored file (fallback) | Temporary roles avoid long-lived secrets |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | 8.23.1 (published 2026-09-30) | Postgres client for both connections | De facto Node driver; required by pg-copy-streams [VERIFIED: npm registry; slopcheck OK; created 2010; maintainer brianc] |
| `pg-copy-streams` | 7.0.0 (2025-05-27) | `copyTo` / `copyFrom` streams over a `pg` client | Official brianc-maintained COPY streaming add-on; supports `destroy()` -> CopyFail abort (6.0.0+); node >= 16 [VERIFIED: npm registry, github.com/brianc/node-pg-copy-streams via WebFetch; slopcheck OK] |
| `node:stream/promises` `pipeline`, `node:test`, `node:readline`/custom Transform | Node 26.4.0 (local) | Plumbing + tests | Built-ins; matches Phase 3 "Node built-ins only" convention except for the two packages above |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase CLI | 2.116.0 installed | `projects list`, `db query --linked` for read-only spot checks and fallback transport | Existing `runSql` in `scripts/auth-merge/lib.mjs` |
| Reuse `scripts/auth-merge/lib.mjs` | - | `PROJECTS`, `parseCliArgs`, `requireRef`, `assertWriteAllowed`, `redactPii`, `maskEmail`, `isMain`, `loadAccessToken` | Import directly (cross-directory import is fine); do not duplicate safety guards |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg-copy-streams (D-01 locked) | Management-API JSON recordset (`jsonb_populate_recordset` in one SQL file, as `02-import-auth.mjs`) | Needs no direct credentials and is already proven in this repo; only ~21k rows. Keep as documented FALLBACK if login-role credentials fail. SET LOCAL replica works through it (verified). |
| `psql \copy` / `pg_dump` | - | Neither `psql` nor `pg_dump` is installed locally; and D-01 excludes it |

**Installation (root devDependencies, workspace hoisting):**
```bash
npm install --save-dev pg@8.23.1 pg-copy-streams@7.0.0
```
**Version verification:** `npm view pg version` -> 8.23.1; `npm view pg-copy-streams version` -> 7.0.0 (run 2026-10-02). Neither has a `postinstall` script (`scripts.postinstall` empty). Neither `pg` nor `pg-copy-streams` is currently in `node_modules` (verified), so install is a Wave 0 task.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| pg | npm | ~16 yrs | very high (not queried) | github.com/brianc/node-postgres | [OK] | Approved |
| pg-copy-streams | npm | ~13 yrs | moderate (not queried) | github.com/brianc/node-pg-copy-streams | [OK] | Approved |

**Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** none. Both confirmed via official GitHub README (WebFetch) and `slopcheck scan --pkg npm`.

## Architecture Patterns

### System Architecture Diagram

```
operator CLI (node 04-load-data.mjs --source-ref ziko --project-ref <scratch|portfolio> --confirm-ref ...)
   |
   | 1. guards: refs, confirm-ref, all targets ziko_-prefixed, map has 99 entries
   | 2. get creds: POST /v1/projects/{ref}/cli/login-role (read_only:true for ziko, false for target)
   v
 ┌──────────────┐  COPY (cols) TO STDOUT   ┌─────────────────────┐   COPY (cols) FROM STDIN   ┌───────────────────┐
 │ ziko pooler  │ ───────────────────────▶ │ line-based Transform │ ─────────────────────────▶ │ target pooler     │
 │ session :5432│  single REPEATABLE READ  │ UUID s/src/tgt/gi    │  per-table BEGIN;          │ session :5432     │
 │ READ ONLY txn│  snapshot, tables in seq │ (+ counts rows)      │  SET LOCAL repl=replica;   │ postgres-equivalent│
 └──────────────┘                          └─────────────────────┘  COPY; COMMIT              └───────────────────┘
                                                                          ^
 pre: guarded TRUNCATE of all 99 ziko_* (one statement, one txn) ─────────┘
 post: setval from live ziko seq -> verify suite (--check counts|rls|triggers|fk|orphans|sequence|remap|all)
```

### Recommended Project Structure
```
scripts/portfolio-migration/
├── 04-load-data.mjs          # guarded truncate + per-table COPY + setval; --plan / --dry-run / --apply
├── 04-load-data.test.mjs     # pure-function tests (transform, guards, table plan)
├── 05-verify-data.mjs        # --check counts|rls|triggers|fk|orphans|sequence|remap|all, JSON + masked summary
├── 05-verify-data.test.mjs
├── lib-data.mjs              # connect(), login-role, remap transform, table plan, FK discovery SQL
└── RUNBOOK.md                # append a "Phase 4" section (scratch -> checkpoint -> portfolio -> Phase 6 delta)
```
(Numbering continues the existing `NN-*` series; existing files go up to `04-rls-smoke-test.js`, so pick 05/06 or a distinct subfolder if the planner prefers. Keep names collision-free.)

### Pattern 1: Per-table load transaction (D-06, D-02)
```js
// Source: pg-copy-streams README (github.com/brianc/node-pg-copy-streams)
import { pipeline } from 'node:stream/promises';
import { to as copyTo, from as copyFrom } from 'pg-copy-streams';

await dst.query('BEGIN');
try {
  await dst.query('SET LOCAL session_replication_role = replica');
  const chk = await dst.query("SELECT current_setting('session_replication_role') v");
  if (chk.rows[0].v !== 'replica') throw new Error('replica mode not active');
  const out = src.query(copyTo(`COPY public.${s} (${cols}) TO STDOUT`));
  const inn = dst.query(copyFrom(`COPY public.${d} (${cols}) FROM STDIN`));
  await pipeline(out, remapTransform, inn);
  await dst.query('COMMIT');
} catch (e) { await dst.query('ROLLBACK').catch(() => {}); throw e; }
```
Use `client.query()` on dedicated `pg.Client` instances, never `pool.query()` for COPY. Wait for `finish` (pipeline handles it).

### Pattern 2: Source snapshot
Open the source connection with `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` once and keep it for all 99 tables, so FK-related rows are mutually consistent even if ziko still takes writes during rehearsal. [ASSUMED standard Postgres behavior; well known.] Never write to ziko (`assertWriteAllowed` already refuses it).

### Pattern 3: Line-based remap transform
COPY text format escapes newline/tab/backslash, so one record is exactly one `\n`-terminated line; process per line (carry over a partial trailing line between chunks). Replace with a case-insensitive global regex built from the source UUID (`new RegExp(src, 'gi')`), because text/jsonb columns may hold upper-case UUID or the UUID embedded in a path or URL (`<uuid>/file.jpg`). UUID characters (hex + hyphens) are unaffected by COPY escaping, so a plain replace on the raw line is exact. Count replacements per table (for the verify cross-check) and never log the values.

### Pattern 4: FK-to-auth.users column discovery (corrected)
See Pitfall 1. Use `pg_class.relnamespace` + `relname LIKE 'ziko\_%'`:
```sql
SELECT r.relname AS tbl, a.attname AS col, c.confdeltype
FROM pg_constraint c
JOIN pg_class r ON r.oid = c.conrelid
JOIN LATERAL unnest(c.conkey) AS k(attnum) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
  AND r.relnamespace = 'public'::regnamespace AND r.relname LIKE 'ziko\_%'
ORDER BY 1, 2;
```
Live result: 97 columns across 78 source tables. Because the in-flight scan already covers every text/jsonb/uuid column (D-07c), the FK list is used for the *verification* cross-check and to prove the transform covered every FK column, not as the replacement driver.

### Pattern 5: Guarded truncate (D-03/D-04)
One statement, one transaction, all 99 tables, **no CASCADE**:
`TRUNCATE public.ziko_a, public.ziko_b, ... ;` TRUNCATE on a table referenced by an FK fails unless every referencing table is in the same statement, so a single 99-table statement is required (works with FK triggers irrelevant; TRUNCATE does not fire row triggers). Guard checks before executing: (a) every name came from `Object.values(rename-map.tables)` and matches `/^ziko_[a-z0-9_]+$/`; (b) a catalog query shows no non-`ziko_` table has an FK referencing a `ziko_*` table (otherwise TRUNCATE without CASCADE errors, which is the safe outcome; never add CASCADE); (c) `--confirm-ref` equals the portfolio ref for portfolio; (d) ziko ref refused as target.

### Anti-Patterns to Avoid
- **Using `pg_stat_user_tables.n_live_tup` for parity or inventory.** Stale (e.g. `food_database` reports 0, real 7932). Use `count(*)` on both sides.
- **`nextval()` as a "rolled-back test insert".** Sequences are not transactional: it would burn a value and regress the founder-offer rank state. Verify by comparing `last_value`/`is_called` instead (see Pitfall 4).
- **Transaction-mode pooler (port 6543).** `SET LOCAL`/COPY/session state need session mode (5432).
- **`TRUNCATE ... CASCADE`.** Could reach tables outside the guard.
- **Replacing the UUID after load with UPDATE.** Violates D-07/spec section 2 (FK to auth.users would fail on the ziko UUID first; under replica mode it would not, but the in-flight rule is locked).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| COPY wire protocol | Custom protocol code | `pg-copy-streams` | CopyFail/abort handling, backpressure |
| CSV/escape parsing of rows | Parse COPY text into columns | Raw line string replace on COPY text | UUID has no escapable chars; no need to parse columns, avoids bugs with `\N`, `\\`, array literals |
| Safety guards (ref format, write protection, PII redaction) | New guards | `scripts/auth-merge/lib.mjs` exports | Already tested; keeps single source of truth |
| Per-table column mapping | A map | Identical column lists (verified) + explicit column list from `information_schema` at runtime, assert equality between sides | Fail loudly on future drift |
| FK/orphan queries | Hand-written per FK | Generate from `pg_constraint` (`pg_get_constraintdef`, `conkey`, `confkey`) | 144 FKs; static lists rot |

## Runtime State Inventory

> This is a data-copy phase, not a rename; the rename-style inventory below records state that survives file edits and affects the load.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Portfolio and scratch `ziko_*`: 0 rows in all 99 tables (verified via pg_stat; confirm with `count(*)` in the pre-check). Portfolio `auth.users` = 44 (5 own + 39 imported), collision target row present. Scratch `auth.users` = 39 but contains **neither** the source collision UUID nor portfolio's target UUID | Scratch needs re-seed (`rehearsal-seed-collision.mjs --reset --seed`) + re-import to a state where the scratch collision target exists; the remap target for scratch comes from a scratch-specific remap file, not the committed `uuid-remap.json` |
| Live service config | 2 portfolio/scratch triggers call `supabase_functions.http_request` to `https://api.ziko-app.com/push-events/supabase` (with a secret header) - enabled, origin mode | Suppress via replica role; post-check `tgenabled` unchanged |
| OS-registered state | None - verified (script is run manually) | None |
| Secrets/env vars | New: `SUPABASE_ACCESS_TOKEN` (Phase 3 PAT was to be revoked at phase end, so a new one is needed); no DB passwords stored anywhere (scratch password "uncaptured" per RUNBOOK) | Operator creates a short-lived PAT; delete/revoke at phase end like Phase 3 |
| Build artifacts | `pg`, `pg-copy-streams` not installed | `npm install` (Wave 0) |

## Common Pitfalls

### Pitfall 1: Spec section 3 FK-discovery query returns ZERO rows
**What goes wrong:** `c.conrelid::regclass::text LIKE 'public.ziko\_%'` matches nothing, because `regclass::text` omits the `public.` qualifier when the schema is on the search_path. Verified live: the spec query returned 0 rows on portfolio and scratch; the corrected query (Pattern 4) returns 97.
**How to avoid:** Use `pg_class.relnamespace`/`relname`. Add a unit/assertion that the discovered FK column count is > 0 and equals the `pg_constraint` total for `auth.users` (97 today), and fail the run on 0.
**Warning signs:** "No FK columns found" - treat as a bug, not as "nothing to remap".

### Pitfall 2: RLS silently hides rows on COPY TO / rejects COPY FROM
**What goes wrong:** For a role that is not the table owner and lacks BYPASSRLS, `COPY TO` on an RLS table returns only policy-visible rows (not an error), and `COPY FROM` is subject to INSERT policies. The Management API role is `postgres` (`rolbypassrls=true`), but the temporary `cli_login_postgres` role used for direct connections may differ.
**How to avoid:** Probe `rolbypassrls`/owner membership for the login role up front; in `--plan` print per-table source counts via the same connection and compare with a count obtained independently (e.g. `db query`), failing if they differ. Count parity (D-08) is the backstop. No table has FORCE RLS (0 of 99).

### Pitfall 3: Short-lived login-role credentials
**What goes wrong:** `POST /v1/projects/{ref}/cli/login-role` returns `role`, `password`, `ttl_seconds` (docs example shows 15 s; actual TTL unknown). The password only needs to be valid at authentication time, but a mid-run reconnect would fail.
**How to avoid:** Fetch creds and connect immediately; open exactly one client per side (max_connections = 60 on all three projects; portfolio is shared with live rh_/gecko_ tenants); do not use a pool/auto-reconnect; if a connection drops, abort and re-run from the start (D-06). Pooler username format is `<role>.<project-ref>`; pooler hosts differ per region (ziko `aws-1-eu-west-1`, portfolio and scratch are `eu-west-3`; prefix `aws-0`/`aws-1` must be read from the project's pooler config / `supabase/.temp/pooler-url` after link, not guessed). The endpoint is Beta (docs say subject to change) and requires a PAT with database write permission even for `read_only:true`. [CITED: supabase.com/docs/reference/api/v1-create-login-role]
**Do NOT:** reset portfolio's `postgres` DB password to get a connection string: other tenants (rh_/gecko_) may use it. If login-role fails, fall back to the Management-API JSON transport (Alternatives table) rather than a password reset.

### Pitfall 4: Sequence "test insert" regresses state
**What goes wrong:** D-09 mentions "sequence reconcile + a rolled-back test insert". The only sequence, `ziko_waitlist_founder_seq`, is consumed by `nextval()` inside an RPC and is not a column default (no serial/identity columns exist anywhere). `nextval()` is not rolled back, so a probe would turn 87/true into 88/true.
**How to avoid:** Discover sequences generically (`pg_sequences` for `ziko\_%` plus `pg_depend` owned-by columns, assert the owned-column set is empty today) and `setval(seq, last_value, is_called)` from live source values; verify with equality of `last_value`/`is_called` (read-only) and, for any future owned sequence, `last_value >= max(col)` without calling `nextval`. For DATA-02's "test insert", only do it for tables that actually have a sequence-backed default (currently none): the generic code path exists but is a no-op, which must be reported explicitly as "0 sequence-backed columns".

### Pitfall 5: Scratch is not a valid rehearsal target as-is
Scratch has 39 auth users but no row for either collision UUID, so any row remapped to a scratch target would fail FK validation and a non-remapped ziko UUID row would also lack its parent. Plan must (1) re-run the Phase 3 rehearsal seed/import on scratch, (2) point the loader at a scratch remap file via a `--remap-file` option (default: `scripts/auth-merge/uuid-remap.json` for portfolio only; refuse the committed file for scratch since its `target_ref` is portfolio), and (3) assert `remaps[].target_ref === --project-ref`.

### Pitfall 6: TRUNCATE ordering and FK errors
TRUNCATE of fewer than all 99 tables fails on FK references; use one statement for all 99, no CASCADE. Under `replica` role the TRUNCATE still checks the FK catalog (not triggers). Run the TRUNCATE in its own transaction, separate from the per-table loads (D-06).

### Pitfall 7: Storage-linked strings inside copied rows
Row scan on ziko: the collision UUID appears in 36 tables (~420 rows incl. `ai_conversations` 61, `workout_sessions` 49, `nutrition_logs` 50, `hydration_logs` 36, `coin_transactions` 39, `xp_transactions` 26, ...) and the ziko project ref `slkobhavpwsubnsmuhya` appears in 3 rows (`user_profiles` 2, `body_measurements` 1), i.e. stored full storage URLs. The UUID replace will also rewrite storage paths like `<uuid>/avatar.jpg` (consistent with Phase 5 re-keying, which therefore must key by target UUID). The embedded project-ref URLs are NOT rewritten by D-07 and will still point at the ziko project; flag for Phase 5/6 (rewrite or leave while ziko stays alive for the rollback window). Do not silently expand Phase 4 scope; record as an open question.

### Pitfall 8: Case and boundary handling in remap
Use case-insensitive replace and apply per line. Do not use a chunk-wise replace (a UUID can straddle the 64 kB chunk boundary). `ai_messages` and `athlete_decisions` contain zero occurrences today, but the delta re-run in Phase 6 may differ, so keep the generic scan.

### Pitfall 9: Parity vs trigger-created rows
Portfolio triggers on `auth.users` (`ziko_on_auth_user_created*`) are irrelevant to load (no auth writes), but any ziko signup flow on portfolio between rehearsal and cutover would create `ziko_user_profiles`/credit rows. D-03's truncate-and-reload resolves this; the pre-check "target UUID has zero rows" must run after the truncate and before load, and the parity check runs after load.

## Code Examples

### Replica-mode probe (verified live through the Management API)
```sql
BEGIN;
SET LOCAL session_replication_role = replica;
SELECT current_setting('session_replication_role');  -- 'replica'
ROLLBACK;
```
Do NOT use `has_parameter_privilege(current_user,'session_replication_role','SET')` as the probe (returned `false` even though SET succeeded).

### Post-load trigger assertion
```sql
SELECT r.relname, t.tgname, t.tgenabled::text
FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid
WHERE NOT t.tgisinternal AND r.relnamespace = 'public'::regnamespace AND r.relname LIKE 'ziko\_%'
  AND t.tgenabled <> 'O';   -- expect 0 rows (note: cast ::text; "char" || text is ambiguous)
```
Baseline today: 18 public user triggers, all `O`; plus `ziko_on_auth_user_created`, `ziko_on_auth_user_created_credits` on `auth.users`, all `O`.

### Zero-occurrence check (text-level, every column)
Row-wide `t::text ILIKE '%<src-uuid>%'` per table, via `query_to_xml` loop (tested on ziko, returns per-table counts; works for uuid/text/jsonb/text[] together). Expected on portfolio: 0 for every table; expected target-UUID row counts per table equal ziko's source-UUID counts (36 tables today).

### Orphan query (generated per FK from `pg_constraint`)
```sql
SELECT count(*) FROM public.<child> c
WHERE c.<fkcol> IS NOT NULL AND NOT EXISTS (SELECT 1 FROM <parent> p WHERE p.<refcol> = c.<fkcol>);
```
Use `ALTER TABLE ... VALIDATE CONSTRAINT` as well; all 144 are already `convalidated=true`, so VALIDATE is a re-check that raises on violation (it takes SHARE UPDATE EXCLUSIVE; run only on `ziko_*`). Multi-column FKs need all key columns in the join (generate from `conkey`/`confkey` arrays, handle `MATCH SIMPLE` NULL semantics).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dump + sed + psql | Streamed `COPY TO`/`COPY FROM` in Node with in-flight transform | - | Matches D-01; no psql/pg_dump on this machine |
| Reset DB password / copy from dashboard | CLI-style temporary login role via Management API (`cli/login-role`) | CLI 2.x (Beta endpoint) | No long-lived secret; Beta so keep fallback |
| Disable FKs per-constraint | `session_replication_role = replica` | long-standing; Supabase backup/restore docs recommend it | One setting disables triggers incl. FK RI triggers [CITED: supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The temporary `cli_login_postgres` role (direct pooler connection) can also `SET session_replication_role=replica`, has BYPASSRLS/owner-equivalent access to `ziko_*` tables, and can TRUNCATE them. (Verified only for the Management API `postgres` role.) | Summary, Pitfalls 2-3 | Plan 1 spike must probe; fallback = `ALTER TABLE DISABLE TRIGGER USER` or the Management-API JSON transport |
| A2 | `login-role` TTL is short (docs example 15 s) and only gates authentication | Pitfall 3 | If TTL also bounds session life the load would be killed mid-run (42 MB, expect seconds-to-minutes); re-run is safe by D-06 |
| A3 | Pooler hosts for portfolio/scratch are `aws-?-eu-west-3.pooler.supabase.com:5432` | Pitfall 3 | Wrong host fails fast; read the actual pooler config |
| A4 | `REPEATABLE READ READ ONLY` snapshot on the source over the pooler works for the whole run | Pattern 2 | If pooler drops idle txn, load per table in its own source txn (parity still checked) |
| A5 | Management API `db query` accepts COPY-free multi-statement payloads of a few MB (fallback path) | Alternatives | Fallback needs chunking by table |
| A6 | A new PAT is available/creatable by the user (Phase 3's was to be revoked) | Environment | Blocks direct-connection path until provided |

## Open Questions

1. **Direct connection credentials (blocking for D-01 only if A1/A6 fail).**
   - Known: no `psql`, no stored DB passwords; CLI is logged in but its token is not readable by scripts; Phase 3 used `SUPABASE_ACCESS_TOKEN`/`.access-token`.
   - Recommendation: Wave 1 spike task `--probe` (read-only): fetch login-role for ziko (`read_only:true`) and scratch, open pooler sessions, run `SELECT current_user, rolbypassrls`, a `SET LOCAL replica` round trip and a `BEGIN; TRUNCATE ... ; ROLLBACK` on scratch. Record the result; choose DISABLE TRIGGER fallback or Management-API fallback accordingly.
2. **Embedded ziko storage URLs in 3 rows (`user_profiles`, `body_measurements`).** Out of D-07 scope; decide in Phase 5/6 whether to rewrite or tolerate during the rollback window.
3. **`ziko_exercises_merge_backup` has RLS enabled with zero policies** (smoke-test finding in 02-05): not a Phase 4 problem, but COPY must still run as a bypassing role.
4. **Scratch collision UUID.** The scratch rehearsal seed creates its own collision target; the loader must accept it via `--remap-file` (Pitfall 5).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | scripts, `node:test` | yes | 26.4.0 | - |
| npm | install pg, pg-copy-streams | yes | - | - |
| Supabase CLI | spot checks, fallback transport | yes | 2.116.0 (update available) | - |
| `pg`, `pg-copy-streams` | D-01 transport | no (not installed) | target 8.23.1 / 7.0.0 | install in Wave 0 |
| `psql` / `pg_dump` | - | no | - | not needed (D-01) |
| Management API PAT (`SUPABASE_ACCESS_TOKEN`) | login-role creds | not present (`.access-token` absent) | - | Management-API JSON transport via logged-in CLI |
| ziko / portfolio / scratch reachable via `db query --linked` | verification, spot checks | yes (all three tested) | PG 17.6 each | - |
| Postgres `max_connections` | connection budget | 60 on all three | - | 1 client per side |

**Missing with no fallback:** none. **Missing with fallback:** direct DB credentials (see Open Question 1).

## Validation Architecture

> `workflow.nyquist_validation` is not set to false (workstream config only has `_auto_chain_active`; root config enables nyquist validation per CLAUDE.md).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 26.4.0), same as `scripts/auth-merge/*.test.mjs` |
| Config file | none |
| Quick run command | `node --test "scripts/portfolio-migration/*.test.mjs"` (glob form required on Node 26) |
| Full suite command | quick command + `node scripts/portfolio-migration/05-verify-data.mjs --project-ref <ref> --source-ref slkobhavpwsubnsmuhya --check all` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Table plan = 99 `ziko_*` pairs; refuses non-`ziko_` or ziko-as-target; transform replaces UUID (case-insensitive, per line, boundary-safe) without touching other bytes; trigger-state assertion evaluator | unit | `node --test "scripts/portfolio-migration/04-load-data.test.mjs"` | no (Wave 0) |
| DATA-01 | Live: after load, 0 user triggers with `tgenabled <> 'O'` | integration (scratch/portfolio, read-only) | `... 05-verify-data.mjs --check triggers` | no (Wave 0) |
| DATA-02 | Sequence discovery + `setval` SQL builder; no `nextval` anywhere (static grep test); live equality `last_value/is_called` | unit + integration | `... --check sequence` | no (Wave 0) |
| DATA-03 | Count comparison evaluator (exact, no exclusions); live `count(*)` per table both sides | unit + integration | `... --check counts` | no (Wave 0) |
| DATA-04 | FK discovery returns >0 and equals catalog count; orphan SQL generator incl. multi-column FKs; all `convalidated`; orphan count 0 | unit + integration | `... --check fk` and `--check orphans` | no (Wave 0) |
| DATA-05 | RLS enabled on 99/99; `--check all` exit codes 0/1/2; JSON output + masked summary contains no emails/UUID of users | unit + integration | `... --check rls`, `--check all` | no (Wave 0) |
| D-07 | Zero source-UUID occurrences (all tables) and per-table target-count equality; pre-check target UUID has 0 rows | integration | `... --check remap` | no (Wave 0) |

### Sampling Rate
- **Per task commit:** unit tests quick command (no network).
- **Per wave merge:** quick command plus read-only live checks against scratch.
- **Phase gate:** scratch full load + `--check all` green, human typed-phrase checkpoint, portfolio load + `--check all` green, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `04-load-data.test.mjs`, `05-verify-data.test.mjs` - cover all DATA-xx pure logic
- [ ] `npm install --save-dev pg@8.23.1 pg-copy-streams@7.0.0` (and `package-lock.json` update)
- [ ] gitignore entries for any new raw-output temp dir or token file (mirror `scripts/auth-merge/.access-token`, `.tmp-*`)
- [ ] Scratch state restore (seed collision + auth import + scratch remap file)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (service credentials only) | Temporary login role via Management API; PAT from env, never committed; revoke at phase end |
| V3 Session Management | no | - |
| V4 Access Control | yes | `assertWriteAllowed` (ziko never writable; portfolio needs `--confirm-ref`), ziko_-only truncate guard, read-only role for source |
| V5 Input Validation | yes | Identifier whitelist `/^[a-z_][a-z0-9_]*$/` and map-derived table names only; UUIDs regex-validated; no string-built SQL from data |
| V6 Cryptography | no | None (password hashes already copied in Phase 3; never printed) |
| V7/V8 Data protection & logging | yes | PII-safe output: counts, table names, booleans; `redactPii` on errors; raw data only in OS temp or in memory; no rows ever written to tracked files |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| TRUNCATE hitting other tenants (`rh_*`, `gecko_*`, `auth.*`) | Tampering | Map-derived `ziko_` whitelist, no CASCADE, FK-reference guard, `--confirm-ref` |
| Credential leakage (connection URL with password in logs/error text) | Information disclosure | Build config objects (not URLs) for `pg`, redact in catch; never echo env |
| Webhook secret in trigger definitions printed during trigger checks | Information disclosure | Verify only `tgname`/`tgenabled`, never `pg_get_triggerdef` output |
| Push webhooks firing during load | Tampering/Spoofing | replica role + post-assert; consider confirming webhook trigger count unchanged |
| Silent partial loads | Repudiation | Exact count parity, per-table transaction, JSON report per run |

## Sources

### Primary (HIGH confidence)
- Live inspection 2026-10-02 via `supabase db query --linked` (read-only, plus a `BEGIN; SET LOCAL ...; RAISE EXCEPTION` probe that always aborts) against ziko, portfolio, scratch: schema parity, constraint/trigger/sequence inventory, role attributes, row counts, UUID occurrence counts
- Repo: `scripts/auth-merge/lib.mjs`, `02-import-auth.mjs`, `06-verify.mjs`, `04-sync-waitlist-seq.mjs`, `RUNBOOK.md`, `uuid-remap.json` (masked), `rename-map.generated.json` (99 table entries, 33 functions, 0 types); `03-UUID-REMAP-SPEC.md`; `04-CONTEXT.md`; `01-INVENTORY.md`
- https://github.com/brianc/node-pg-copy-streams - copyTo/copyFrom usage, chunking, destroy/CopyFail
- https://supabase.com/docs/reference/api/v1-create-login-role - endpoint, body, response, auth scope
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore - `session_replication_role = replica`, data-only restore

### Secondary (MEDIUM confidence)
- WebSearch on `cli_login_postgres` / pooler username format (`cli_login_postgres.<suffix>`), Supabase troubleshooting docs

### Tertiary (LOW confidence)
- TTL semantics of login-role passwords (A2), exact pooler hostnames (A3) - to be confirmed by the probe task

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - registry-verified, slopcheck OK, matches the locked decision
- Architecture: MEDIUM-HIGH - schema parity and replica mode proven live; direct-connection role privileges unproven (A1)
- Pitfalls: HIGH - the FK-query bug, stale stats, nextval non-transactionality, and scratch state were each observed or well-established

**Research date:** 2026-10-02
**Valid until:** ~2026-11-01 (login-role endpoint is Beta; re-check before Phase 6 delta)
