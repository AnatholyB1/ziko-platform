# Phase 4: Data Copy & Integrity Verification - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Phase Boundary

All ziko production data (every `ziko_*` table, ~99 source tables / ~42 MB) is copied from the `ziko` project (`slkobhavpwsubnsmuhya`) into `portfolio` (`ubxllsvanurkwkohzxau`) with triggers silenced during load, sequences reconciled, row counts exactly matching, all FKs validated with zero orphans, and the collision user's UUID remapped everywhere. A re-runnable verification suite is committed. Out of scope: storage objects (Phase 5), backend/web/mobile cutover and the actual write-freeze/final delta execution (Phase 6), decommission (Phase 7). Phase 4 delivers the tooling so the Phase 6 delta is the same code path.

</domain>

<decisions>
## Implementation Decisions

### Load mechanism & trigger suppression
- **D-01:** Transport is a **Node script in `scripts/portfolio-migration/`** (`.mjs`, same conventions as Phase 2/3 scripts) that streams each table with `COPY TO` (source) → `COPY FROM` (destination) over two `pg` connections (session-mode pooler). Table-name mapping comes from `rename-map.generated.json`; the UUID remap is applied in-flight. Not `pg_dump | sed`, not MCP `execute_sql`.
- **D-02:** Triggers and FK checks are suppressed with **`SET session_replication_role = replica`** per load session, so load order does not matter; FK validation (`VALIDATE CONSTRAINT` + orphan queries) runs afterwards. **Probe first** that the connecting role may set it on portfolio; if not, fall back to per-table `ALTER TABLE ... DISABLE TRIGGER USER` with guaranteed re-enable in a `finally`. After load, assert no user trigger on any `ziko_*` table is left disabled (`pg_trigger.tgenabled`).
- Rationale: ziko triggers include `handle_updated_at` (would rewrite `updated_at`) and push webhooks to `api.ziko-app.com` that must not fire during load.

### Re-run / final delta strategy
- **D-03:** The final delta sync before Phase 6 cutover is a **full truncate-and-reload of every `ziko_*` table** inside the write-freeze, using the identical script/code path as Phase 4 (DB is ~42 MB). No incremental/upsert logic.
- **D-04:** Truncation scope is guarded: the script **refuses to run unless every target table is `ziko_`-prefixed** and never touches `auth.*`, `rh_*`, `gecko_*`, or other portfolio-own tables. Pre-seeded/static `ziko_*` rows (if Phase 2 seeded any) are removed by the truncate and reloaded from source, so they also reach exact parity.

### Rehearsal & rollback
- **D-05:** **Rehearse on the Phase 2 scratch project first** (full load + full verification suite), then a human typed-phrase checkpoint (same pattern as Phase 3 plan 10), then the real portfolio load. Scratch needs the Phase 3 auth import state for FKs to resolve; plan must ensure that precondition.
- **D-06:** Recovery model: **one transaction per table**; a mid-run failure leaves a known state, and recovery is re-run from the start (begins with the guarded `ziko_*` truncate). No single giant transaction.

### UUID remap depth
- **D-07:** Collision user remap (`ea0f0b65-6681-4780-8ee0-dbf20b95d4d9` → target read from `scripts/auth-merge/uuid-remap.json`, never hardcoded) covers **(a)** all FK-discovered columns referencing `auth.users` (query at run time per `03-UUID-REMAP-SPEC.md` §3), **(b)** known non-FK columns (`ziko_exercises_merge_backup.user_id`, polymorphic `ziko_coin_transactions.source_id` / `ziko_xp_transactions.source_id`), and **(c)** a **text/jsonb scan**: replace the UUID string inside every text/jsonb column in-flight. Verification asserts **zero occurrences** of the source UUID as text in any uuid/text/jsonb column of any `ziko_*` table on portfolio, and per-table counts of target-UUID rows on portfolio equal source-UUID rows on ziko (spec §6). Pre-check (spec §5): portfolio target UUID has zero rows in all `ziko_*` tables before load.

### Verification suite
- **D-08:** **Exact row-count parity on every table, no exclusion list** (DATA-03). Load is trigger-silent so no trigger-created rows exist; any mismatch fails the suite.
- **D-09:** Verification lives in `scripts/portfolio-migration/` as `.mjs` + `node:test`, modeled on `scripts/auth-merge/06-verify.mjs` (`--check <name>` / `--check all`). Checks: per-table counts source vs destination, RLS enabled on all `ziko_*` tables, `VALIDATE CONSTRAINT` + orphan query per FK, sequence reconcile + a rolled-back test insert (DATA-02), UUID-remap zero-occurrence. Output is machine-readable JSON plus a **PII-safe masked summary** (no raw emails/IDs of users in git-tracked files, per Phase 1 protocol). Re-runnable on demand (DATA-05).
- **D-10 (note: replaces the D-09 "rolled-back test insert" - nextval is non-transactional and would regress the founder rank 87 even if rolled back; sequence proof = last_value/is_called equality + no sequence-backed columns + founder_rank floor):** Sequences (non-UUID PKs) are reconciled with `setval` from ziko's live values (never hardcoded); `ziko_waitlist_founder_seq` was already set in Phase 3 (87/true) — re-read live and confirm it is not regressed by the load.

### Claude's Discretion
- Exact module layout, script names/numbering (continue `scripts/portfolio-migration/NN-*.mjs` series), batching/stream tuning, how the in-flight text/jsonb replacement is implemented (stream transform vs staging table), per-table load ordering for readability, connection-string handling and secret hygiene (follow Phase 2/3 RUNBOOK conventions).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Remap & auth state
- `.planning/workstreams/supabase-portfolio-migration/phases/03-auth-merge/03-UUID-REMAP-SPEC.md` — authoritative spec for the collision-user remap (FK discovery query, non-FK columns, uniqueness pre-check, verification, forbidden operations)
- `.planning/workstreams/supabase-portfolio-migration/phases/03-auth-merge/03-CONTEXT.md` — D-02 (portfolio UUID wins), D-06 (triggers attached post-import), D-09 (idempotent, delta re-run before Phase 6)
- `scripts/auth-merge/uuid-remap.json` — runtime source of the target UUID
- `scripts/auth-merge/06-verify.mjs` and `scripts/auth-merge/RUNBOOK.md` — verification-suite and runbook patterns to mirror

### Schema state
- `scripts/portfolio-migration/rename-map.generated.json` — table/function name mapping
- `scripts/portfolio-migration/RUNBOOK.md`, `03-run-verify.mjs`, `03-verify-post-apply.sql` — Phase 2 tooling and conventions
- `.planning/workstreams/supabase-portfolio-migration/phases/02-schema-rename-function-rls-rewrite/02-VERIFICATION.md` — state of the `ziko_*` schema on portfolio
- `.planning/workstreams/supabase-portfolio-migration/phases/02-schema-rename-function-rls-rewrite/02-CONTEXT.md` — scratch project usage (D-03), trigger deferral (D-02)

### Inventory & research
- `.planning/workstreams/supabase-portfolio-migration/phases/01-inventory-pre-flight-audit/01-INVENTORY.md` — ziko table list/sizes (99 tables, 42 MB DB), triggers (incl. push webhooks), max_connections 60, PII protocol
- `.planning/workstreams/supabase-portfolio-migration/research/PITFALLS.md` — Pitfall 4 (sequences), Pitfall 6 (orphaned FKs / delta sync)
- `.planning/workstreams/supabase-portfolio-migration/research/SUMMARY.md` — write-freeze + final delta decision
- `.planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md` — DATA-01..05
- `.planning/workstreams/supabase-portfolio-migration/ROADMAP.md` — Phase 4 goal and 5 success criteria

### Project docs
- `CLAUDE.md` — env var names, `SUPABASE_SERVICE_ROLE_KEY` restrictions, encoding gotchas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/auth-merge/lib.mjs` — shared helpers (PII masking, volatile-column handling) and its `node:test` pattern (use glob form `node --test "scripts/…/*.test.mjs"` on Node 26)
- `scripts/auth-merge/06-verify.mjs` — `--check` dispatcher/evaluator structure to mirror
- `scripts/portfolio-migration/*` — rename map, bootstrap, verify runner
- Supabase MCP `execute_sql` — read-only verification/spot checks

### Established Patterns
- Dry-run-default scripts with `--confirm-ref <project-ref>` guard and typed-phrase human checkpoints before first write to a shared project
- Rehearse on scratch → checkpoint → portfolio
- PII-safe tracked outputs; raw data only in ephemeral scratchpad
- Single-statement/guarded writes; idempotent re-runs

### Integration Points
- Depends on Phase 3 auth merge (FKs to `auth.users(id)`) and Phase 2 schema (empty `ziko_*` tables)
- Phase 6 reuses this load script for the final truncate-and-reload under write-freeze
- Phase 5 re-keys storage folders for the collision user per spec §8 (not this phase)

</code_context>

<specifics>
## Specific Ideas

- Supabase Micro compute, `max_connections` 60 on ziko: keep the load to a small fixed number of connections per side.

</specifics>

<deferred>
## Deferred Ideas

- Executing the real final delta / write-freeze — Phase 6.
- Storage object re-keying for the collision user — Phase 5.

</deferred>

---

*Phase: 4-Data Copy & Integrity Verification*
*Context gathered: 2026-10-02*
