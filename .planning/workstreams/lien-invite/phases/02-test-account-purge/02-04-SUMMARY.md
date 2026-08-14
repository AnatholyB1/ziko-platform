---
phase: 02-test-account-purge
plan: 04
subsystem: testing
tags: [supabase, admin-api, vitest, runbook]

requires:
  - phase: 02-test-account-purge (plan 01)
    provides: lib.mjs, dry-run.mjs — criterion + Admin API enumeration + cross-link detection
  - phase: 02-test-account-purge (plan 02)
    provides: export.mjs, pitr.mjs — pre-delete row export, hashed manifest, PITR status read
  - phase: 02-test-account-purge (plan 03)
    provides: delete.mjs, verify-purge.mjs — guarded Admin API deletion, post-purge reconciliation
provides:
  - "scripts/purge-test-accounts/RUNBOOK.md — the written PURGE-01 criterion and the ordered two-person procedure"
  - "apps/web/test/purge/purge-rehearsal.test.ts — proof that all 5 purge modules compose end to end on one fixture, with zero network calls and zero env vars read"
  - "Phase 2 acceptance — user reviewed the criterion, the runbook, and the rehearsal, and approved"
affects: [06-founder-offer-go-live]

actuals:
  tokens: 12000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A rehearsal composition test proves the whole pipeline chains correctly without ever touching a real Supabase project — no fetchImpl points at a real URL, no process.env is read — which is the property that makes rehearsal fundamentally different from a dry run against production."
    - "The account-conservation check (added at the planner's own initiative in 02-03) is exercised end to end here by deleting one extra fixture account by hand and asserting the check catches it with an exact shortfall — proving the safety net actually fires on the failure mode it exists for, not just on a clean run."

key-files:
  created:
    - scripts/purge-test-accounts/RUNBOOK.md
    - apps/web/test/purge/purge-rehearsal.test.ts
  modified: []

key-decisions:
  - "Task 2's rehearsal test file was written by an executor session that was interrupted mid-run by a session usage-limit error before it could commit. The file on disk was complete and untracked (not partial/corrupt). Rather than re-generating it, the orchestrator independently re-verified it against every one of the task's acceptance criteria (module coverage, entry-point coverage, cross-link mention count, zero process.env reads, zero credential-shaped strings, assertion count, full web suite, lint) before committing it — all checks passed cleanly on first re-verification."

patterns-established: []

requirements-completed: [PURGE-01, PURGE-02, PURGE-03]

coverage:
  - id: D1
    description: "RUNBOOK.md states the exact-equality @ziko-app.com criterion, the four documented lookalikes that must never match, the ordered two-person procedure, the two-person rule itself, the recovery path via the export CSV with PITR as secondary backstop, and that the real production run is explicitly out of this phase's scope"
    requirement: "PURGE-01"
    verification:
      - kind: other
        ref: "grep -q ziko-app.com scripts/purge-test-accounts/RUNBOOK.md; manual read confirmed at the Task 3 checkpoint"
        status: pass
    human_judgment: false
  - id: D2
    description: "purge-rehearsal.test.ts chains runDryRun -> writeExport -> assertManifestIntegrity -> runDelete -> checkResidualMatches/checkAccountConservation/summarizeOrphans against an 8-account fixture (5 test-domain, 2 lookalikes, 1 real, 1 cross-link), proving the D-05 exclusion, the unconfirmed-delete no-op, the tampered-manifest abort, and the over-deletion catch"
    requirement: "PURGE-02, PURGE-03"
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-rehearsal.test.ts (1 test, 37 assertions)"
        status: pass
      - kind: other
        ref: "acceptance-criteria greps: 5/5 modules referenced, 7/7 entry points called by name, coach_client_links mentioned >=1x, 0 process.env reads, 0 credential-shaped strings"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full apps/web test suite green with the 4 purge suites included, and lint exits 0 (no errors)"
    verification:
      - kind: other
        ref: "cd apps/web && npm run test — 147 passed, 4 pre-existing skips, 0 failed; npm run lint — 0 errors, 43 pre-existing-style warnings"
        status: pass
    human_judgment: false
  - id: D4
    description: "The human reviewed the criterion, the runbook, and the rehearsal evidence, and confirmed the phase is rehearsed rather than fired"
    requirement: "PURGE-01, PURGE-02, PURGE-03"
    verification: []
    human_judgment: true
    rationale: "This is the phase's designed human checkpoint (Task 3, gate=blocking, autonomous:false) — acceptance of the criterion and the scope boundary (D-03: real production run is out of phase) is a judgment call only the user can make, not something automation confirms. User responded 'approve' at the checkpoint presented after independent re-verification of Task 2's deliverable."

duration: ~35min
completed: 2026-08-14
status: complete
---

# Phase 2 Plan 4: RUNBOOK, Rehearsal, and Phase Acceptance Summary

**RUNBOOK.md documents the locked @ziko-app.com criterion and the two-person procedure; a single rehearsal test proves all five purge modules compose end to end on a fixture with zero Supabase credentials; user approved the phase at the Task 3 checkpoint.**

## Performance

- **Duration:** ~35 min (spans one interrupted executor session + orchestrator-completed verification/commit + a fresh continuation for the checkpoint presentation)
- **Tasks:** 3 (2 auto tasks + 1 blocking human-verify checkpoint)
- **Files:** 2 created

## Accomplishments
- `RUNBOOK.md` — the PURGE-01 written criterion (exact `ziko-app.com` domain equality, four named lookalikes that must never match), the ordered dry-run → review → export → PITR-check → confirmed-delete → post-verify procedure with exact commands and flags, the two-person rule, the export-then-PITR recovery path, and an explicit statement that the real production run is outside this phase (D-03)
- `purge-rehearsal.test.ts` — one composition test chaining all five purge modules against an in-memory 8-account fixture, proving: the cross-linked account is withheld from deletion (D-05); an unconfirmed `runDelete` attempts zero deletions; a tampered manifest aborts before any deletion; a confirmed delete removes exactly the reviewed set; and `checkAccountConservation` catches an over-deletion with an exact shortfall of 1 when a real account is removed by hand
- Full `apps/web` suite green (147 passed, 0 failed) including all 4 purge suites, with zero Supabase credentials present anywhere in the purge test files
- Phase 2 accepted by the user at the Task 3 checkpoint

## Task Commits

1. **Task 1: Write the criterion and the ordered two-person procedure** — `9f0f86b` (docs)
2. **Task 2: Rehearse the whole procedure end to end on a fixture dataset** — `792993c` (test)
3. **Task 3: [BLOCKING] Confirm the criterion, the rehearsal, and the "rehearsed, not fired" boundary** — **approved by the user 2026-08-14**

## Files Created/Modified
- `scripts/purge-test-accounts/RUNBOOK.md` — 187 lines, the written criterion + two-person procedure
- `apps/web/test/purge/purge-rehearsal.test.ts` — 244 lines, end-to-end composition proof, 37 assertions

## Decisions Made
- See frontmatter `key-decisions` — Task 2's file was independently re-verified against every acceptance criterion rather than re-generated, after the executor session that wrote it was interrupted by a usage-limit error before committing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Process] Executor session interrupted by API usage limit before committing Task 2**
- **Found during:** Task 2 (rehearsal test)
- **Issue:** The dispatched executor agent hit a session usage limit mid-task ("Now writing the rehearsal test file that chains all five modules end to end") and terminated before running verification or committing. Task 1's work (`RUNBOOK.md`) was already safely committed at that point; the rehearsal test file existed on disk but was untracked.
- **Fix:** Rather than re-dispatching a fresh executor (risking the same limit) or discarding the untracked work, the orchestrator read the file, ran every one of Task 2's literal acceptance-criteria checks against it directly (module/entry-point grep checks, cross-link mention count, zero-env-read check, zero-credential check, assertion count, full test suite, lint) — all passed cleanly — then committed it under the plan's task-commit discipline.
- **Files modified:** `apps/web/test/purge/purge-rehearsal.test.ts` (verified, not modified)
- **Verification:** All acceptance criteria re-run and confirmed passing before commit; full `apps/web` suite green afterward.
- **Committed in:** `792993c`

---

**Total deviations:** 1 (process recovery from an interrupted subagent session, not a plan defect)
**Impact on plan:** None on scope or correctness — the interrupted agent's partial output was verified sound rather than discarded or blindly trusted.

## Issues Encountered
An executor session hit an API usage-limit error mid-Task-2 (see Deviations above). No code defect was involved — this was a session-length/quota constraint, resolved by direct verification rather than re-execution.

## User Setup Required
None — no external service configuration required. The runbook names two credentials (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN` for the production project) that will be needed for the out-of-phase production run, but obtaining them is explicitly not part of this phase.

## Next Phase Readiness

**Phase 2 (Test-Account Purge) is accepted.** All four plans (02-01 through 02-04) build and rehearse the complete purge toolkit; no account has been deleted and no script has been run against production, per D-03.

**Carried forward, not phase-2 blocking:**
- The actual production purge run — obtaining production `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ACCESS_TOKEN`, running the dry-run against real data, human review of the real CSV, and the confirmed delete — remains a separate, explicitly human-triggered step outside this phase.
- Two of ROADMAP.md's five Phase 2 success criteria (a backup checkpoint recorded before the real deletion, and the post-deletion zero-row state) can only complete during that later run — this is a known, accepted gap recorded in CONTEXT.md D-03 and confirmed again at this phase's Task 3 checkpoint.
- `waitlist_signups` QA-row reset (Phase 1's `reset_waitlist_founder_sequence()` already provides the mechanism) — deferred to Phase 6 per CONTEXT.md.

Phase 3 (Legal — CGV & CGU) has no dependency on Phase 2 and remains available to start independently.

---
*Phase: 02-test-account-purge*
*Completed: 2026-08-14*
