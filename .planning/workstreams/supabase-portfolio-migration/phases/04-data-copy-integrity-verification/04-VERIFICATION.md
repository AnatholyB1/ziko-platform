---
phase: 04-data-copy-integrity-verification
verified: 2026-10-02T14:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 4: Data Copy & Integrity Verification - Verification Report

**Phase Goal:** All ziko production data exists in portfolio with verified integrity and zero loss
**Status:** passed (initial verification)

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every ziko_* table loaded via COPY with triggers disabled during load, re-enabled after | VERIFIED | portfolio-load.json: 99 tables, trigger_mode "replica" (session_replication_role, session-scoped so triggers auto-restore); 05-load-data.mjs sets and checks the role. Live re-run of `--check triggers`: 18 triggers + 2 on auth.users, 0 not in enabled-origin state. |
| 2 | Sequences reconciled via setval; subsequent insert succeeds without collision | VERIFIED (via D-10 substitution) | `--check sequence` live PASS: 1 sequence (ziko_waitlist_founder_seq 87/true) equals source, not regressed. No sequence-backed columns exist. Literal "test insert" replaced by last_value/is_called equality, recorded in 04-CONTEXT D-10 (nextval is non-transactional); equality guarantees the next nextval cannot collide. Test suite asserts no script calls nextval. |
| 3 | Row counts match exactly source vs destination for every table | VERIFIED | Load report: 99 tables, 0 with source_count != streamed_rows != target_count, 20,897 rows. Live `--check counts` against live ziko: 99/99 match (no drift). |
| 4 | All FKs validated, zero orphans | VERIFIED | Live: 144 FK constraints, 144 validated, 97 auth.users FK columns; 0 orphans across 144. |
| 5 | Verification suite committed and re-runnable | VERIFIED | `scripts/portfolio-migration/06-verify-data.mjs` + lib-verify.mjs + tests + RUNBOOK; re-ran successfully with `--check` rls/fk/orphans/triggers/sequence/counts (all exit 0). `node --test "scripts/portfolio-migration/*.test.mjs"`: 78/78 pass. Reports portfolio-verify.json passed: true (8 checks incl. remap, tenants). |

**Score:** 5/5

## Requirements Coverage

| Req | Status | Evidence |
|-----|--------|----------|
| DATA-01 | SATISFIED | Truth 1 |
| DATA-02 | SATISFIED | Truth 2 (D-10 method) |
| DATA-03 | SATISFIED | Truth 3 |
| DATA-04 | SATISFIED | Truth 4 |
| DATA-05 | SATISFIED | Truth 5 |

No orphaned requirements.

## Additional Integrity Evidence

- Remap check: source UUID absent on target; target UUID occurrence counts match source.
- Tenant check: 39 pre-existing portfolio tenant tables unchanged vs preload baseline (0 row-count deltas).
- RLS enabled on 99/99 tables.
- No TBD/FIXME/XXX markers in scripts/portfolio-migration/*.mjs.

## Anti-Patterns / Notes

- Info: DEP0190 Node deprecation warning (shell option with args) in verify script; non-blocking.
- Info: counts/remap are point-in-time; ziko writes after load would show as drift until Phase 6 final reload (planned).
- Info: 3 rows store ziko-project storage URLs (deferred to Phase 5/6 per 04-07 summary).
- Info: SC4 reports `fk` check "VALIDATE" via convalidated state of 144 constraints rather than re-issuing VALIDATE CONSTRAINT; acceptable (all validated).
- Housekeeping: user must still revoke the `ziko-data-copy-phase4` PAT in the Supabase dashboard (local token files deleted).

## Human Verification Required

None blocking.

## Gaps Summary

None.

_Verified: 2026-10-02_
_Verifier: Claude (gsd-verifier)_
