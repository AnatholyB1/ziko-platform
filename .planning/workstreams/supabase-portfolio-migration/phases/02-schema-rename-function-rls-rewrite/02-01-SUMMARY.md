---
phase: 02-schema-rename-function-rls-rewrite
plan: 01
subsystem: database
tags: [supabase, postgres, information_schema, pg_proc, pg_trigger, rls, migration-tooling]

# Dependency graph
requires:
  - phase: 01-inventory-pre-flight-audit
    provides: "Live ziko inventory (99 tables, 37 functions, extension diff) that this plan's map generation cross-checks against"
provides:
  - "scripts/portfolio-migration/rename-map.generated.json — committed {tables, functions, types, required_extensions} map, single source of truth for every downstream plan in this phase"
  - "scripts/portfolio-migration/01-generate-rename-map.sql — live introspection queries (tables, ziko-authored functions, genuine custom types), extension-owned objects excluded"
  - "scripts/portfolio-migration/01-generate-rename-map.mjs — read-only-by-construction Node wrapper that runs those queries via the Supabase CLI and writes the JSON map"
  - "Live-evidence-backed resolution of D-04: both pg_net and unaccent confirmed required on portfolio before Plan 03's migration creates the renamed functions/triggers"
affects: [02-02-dump-and-rewrite, 02-03-verify-post-apply, 02-04-rls-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rename map generated from LIVE information_schema/pg_proc/pg_type, never from migration files (Pattern 1) — avoids resurrecting dropped objects like shopping_list_items/shopping_item_source (Pitfall 5)"
    - "Supabase CLI queries via --file <tempfile>, not inline SQL string arguments — avoids a Windows spawn EINVAL on .cmd-shimmed executables and avoids shell-injection risk from arbitrary SQL text"
    - "Sequential (not parallel) supabase CLI invocations — concurrent processes race on renaming a shared local telemetry.json temp file"

key-files:
  created:
    - scripts/portfolio-migration/01-generate-rename-map.sql
    - scripts/portfolio-migration/01-generate-rename-map.mjs
    - scripts/portfolio-migration/rename-map.generated.json
  modified: []

key-decisions:
  - "Fixed the plan's literal types query: typtype IN ('e','c') alone also matches every table's automatic composite row type; added a pg_class.relkind != 'r' exclusion so only genuine standalone enums/composites are captured (live result: 0 genuine custom types in ziko's public schema, consistent with Pitfall 5)"
  - "Fixed the plan's literal D-04 dependency-grep queries: Postgres's ~* operator treats \\b as a literal backspace escape, not a word boundary (\\y is the correct ARE word-boundary escape) — the \\b-based queries silently returned zero rows for both unaccent and pg_net until corrected, which would have produced a false 'not needed' verdict for both extensions"

patterns-established:
  - "Every downstream file in this phase must read rename-map.generated.json rather than hardcoding a duplicate table/function list (per the plan's <interfaces> contract)"

requirements-completed: [SCHEMA-01]

# Metrics
duration: ~25min
completed: 2026-09-22
---

# Phase 2 Plan 01: Generate Rename Map & Resolve D-04 Dependency Question Summary

**Live-queried ziko's information_schema/pg_proc/pg_type to produce a committed 99-table/33-function rename map, and confirmed both pg_net and unaccent are required extensions via a corrected trigger-definition + function-body grep.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-22T16:15:00+02:00 (approx.)
- **Completed:** 2026-09-22T16:42:32+02:00
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 created + 1 twice-updated)

## Accomplishments
- Generated `rename-map.generated.json` from ziko's LIVE schema (not migration files): 99 tables, 33 ziko-authored functions (37 live minus the 4 extension-owned `unaccent*` rows), 0 genuine custom types — matches `01-INVENTORY.md`'s live counts exactly
- Confirmed, from live evidence spanning both `pg_proc.prosrc` and `pg_get_triggerdef()`, that `unaccent` (via `search_users_fuzzy`) and `pg_net` (via `push_user_xp_level_up`/`push_workout_session_end`'s `supabase_functions.http_request(...)` calls) are both required extensions — resolving D-04
- Found and fixed two live correctness bugs in the plan's literally-specified SQL that would otherwise have silently corrupted the rename map or produced a false "extension not needed" verdict (see Deviations)

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate the rename map from ziko's live schema, excluding extension-owned objects** - `780158c3` (feat)
2. **Task 2: Resolve D-04's pg_net/unaccent dependency question from live evidence** - `d2dad5ad` (feat)

**Plan metadata:** (this commit) `docs(02-01): complete plan`

## Files Created/Modified
- `scripts/portfolio-migration/01-generate-rename-map.sql` - Three live introspection queries: tables, ziko-authored functions (extension-owned rows excluded via `pg_depend.deptype = 'e'`), genuine custom types (extension-owned AND table-row-type exclusion)
- `scripts/portfolio-migration/01-generate-rename-map.mjs` - Read-only-by-construction Node wrapper; parses the `.sql` file's named query blocks, runs each sequentially against ziko via the Supabase CLI (`--file` transport), writes the JSON map
- `scripts/portfolio-migration/rename-map.generated.json` - Committed output: `{tables: 99 entries, functions: 33 entries, types: {} (0 entries), required_extensions: {unaccent, pg_net}}`, both extensions `required: true` with live-evidence strings

## Decisions Made
- Used the Supabase CLI (`supabase db query --linked --project-ref <ref> --file <tempfile>`) as the query transport, since no Supabase MCP tool (`mcp__claude_ai_Supabase__*`) was exposed in this execution environment — matches the plan's documented fallback path and Phase 1's own `01-01-SUMMARY.md` CLI-transport precedent
- Ran the three rename-map queries sequentially rather than via `Promise.all` after a live concurrency crash (see Issues Encountered) — the small time cost is preferable to flaky failures
- Evidence strings for `required_extensions` name the triggers/functions involved but deliberately omit the literal `X-Webhook-Secret` value embedded in the two push-trigger definitions, per `01-INVENTORY.md`'s existing redaction convention and this plan's Security Domain guidance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Types query over-matched every table's automatic composite row type**
- **Found during:** Task 1 (writing/running `01-generate-rename-map.sql`)
- **Issue:** The plan's literal query (`t.typtype IN ('e','c')` + extension exclusion only) returned 99 rows — one per table — because Postgres implicitly creates a `pg_type` row with `typtype = 'c'` for every ordinary table's row type. A naive filter cannot distinguish a genuine standalone composite/enum type from this automatic byproduct.
- **Fix:** Added a `LEFT JOIN pg_class c ON c.oid = t.typrelid` and a `(c.relkind IS DISTINCT FROM 'r' OR t.typrelid = 0)` clause, which keeps real enums (`typrelid = 0`) and genuine standalone composite types (`typrelid` → `pg_class.relkind = 'c'`) while excluding every table's automatic row type (`relkind = 'r'`).
- **Verification:** Re-ran live against ziko — corrected query returns 0 rows, consistent with Pitfall 5 (the one historical enum, `shopping_item_source`, was already dropped from live ziko and correctly does not reappear).
- **Files modified:** `scripts/portfolio-migration/01-generate-rename-map.sql`
- **Committed in:** `780158c3` (Task 1 commit)

**2. [Rule 1 - Bug] `\b` is not a word-boundary escape in Postgres's `~*` regex operator**
- **Found during:** Task 2 (running the D-04 function-body and trigger-definition greps)
- **Issue:** The plan's literal D-04 queries (copied verbatim from `02-RESEARCH.md`'s own "D-04 Dependency Grep" code block) use `\bnet\.` / `\bunaccent\s*\(` / `\ynet\.`-style patterns with `\b`. Postgres's Advanced Regular Expression (ARE) dialect treats `\b` as a literal backspace character escape, not a word boundary — confirmed live: `'unaccent(lower(p.name))' ~* '\bunaccent\s*\('` evaluates to `false`. Running the queries as literally specified would have returned zero rows for both function-body and trigger-definition greps, producing a false "neither extension needed" conclusion — exactly the silent-miss failure mode `02-RESEARCH.md` Pitfall 2 warns about, except caused by a regex-escape bug rather than query scope.
- **Fix:** Replaced `\b` with `\y` (Postgres's actual ARE word-boundary escape, already used correctly elsewhere in the same research document's SCHEMA-04 post-apply grep example) in both the function-body grep and the trigger-definition grep.
- **Verification:** Re-ran both corrected queries live: function-body grep returns 1 row (`search_users_fuzzy`, body contains `unaccent(lower(...))` three times); trigger-definition grep returns 2 rows (`push_user_xp_level_up`, `push_workout_session_end`, both call `supabase_functions.http_request(...)`). Confirmed `'unaccent(lower(p.name))' ~* '\yunaccent\s*\('` evaluates to `true`.
- **Files modified:** `scripts/portfolio-migration/rename-map.generated.json` (`required_extensions` evidence)
- **Committed in:** `d2dad5ad` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs — Rule 1)
**Impact on plan:** Both fixes were necessary for correctness — without them, the committed rename map would have silently carried 99 bogus "type" entries, and `required_extensions` would have falsely recorded both `unaccent` and `pg_net` as not needed, which Plan 03's migration file would then have trusted when deciding whether to emit `CREATE EXTENSION IF NOT EXISTS`. No scope creep — both fixes stayed within Task 1/Task 2's own file surface.

## Issues Encountered
- **Windows `spawn EINVAL` on `.cmd`-shimmed executables:** Node's `child_process.execFile` cannot spawn `npx.cmd`/`supabase.cmd` directly on this Windows environment without `shell: true`. Resolved by writing each query to a short-lived local temp file and invoking the CLI with `--file <path>` plus `shell: true` (safe here since every argv entry is either a fixed flag or a script-generated path, never externally-influenced text) rather than passing raw SQL inline on the command line.
- **Concurrent Supabase CLI invocations race on a shared telemetry file:** An initial `Promise.all`-based implementation of the three Task 1 queries crashed with `EPERM: operation not permitted, rename 'telemetry.json.tmp...' -> 'telemetry.json'` when two `supabase` CLI child processes ran at the same instant. Resolved by running the three queries sequentially instead — no further crashes across multiple re-runs.
- **Live evidence for the `pg_net` requirement contains a real secret value** (`X-Webhook-Secret` header, embedded as a literal trigger argument in both push triggers' definitions, per `01-INVENTORY.md`'s prior finding). This value was visible in this session's live query output but was never written to `rename-map.generated.json` or any other file — the committed evidence strings name only the trigger/function identifiers involved. Verified post-commit via `grep -i "webhook|secret|<secret-prefix>"` against the committed JSON: no match.

## User Setup Required
None - no external service configuration required. This plan is read-only introspection against the live `ziko` project; it wrote no data anywhere except the local `rename-map.generated.json` file.

## Next Phase Readiness
- `rename-map.generated.json` is committed and ready to be consumed directly (`require()`/`JSON.parse()`) by Plan 02 (dump-and-rewrite), Plan 03 (verify-post-apply), and Plan 04 (RLS smoke test) — no further generation step needed unless ziko's live schema changes before those plans run
- `required_extensions.unaccent.required` and `required_extensions.pg_net.required` are both `true` with live evidence — per D-04's pre-authorization, Plan 02's migration file may proceed directly to `CREATE EXTENSION IF NOT EXISTS pg_net;` / `CREATE EXTENSION IF NOT EXISTS unaccent;` without a separate checkpoint
- No blockers. One process note for the next plan's executor: prefer the `--file`-based Supabase CLI invocation pattern established here (see `runQuery` in `01-generate-rename-map.mjs`) over inline SQL string arguments if Plan 02/03/04 also shell out to the Supabase CLI on Windows

---
*Phase: 02-schema-rename-function-rls-rewrite*
*Completed: 2026-09-22*
