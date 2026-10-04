---
phase: 07-monitoring-decommission
plan: 01
subsystem: infra
tags: [decommission, guards, gate-file, authorization, tdd]
requires: []
provides:
  - "18-decom-guard.mjs: ref guards, gate file I/O, D-15 and generic authorization checkers, committed-content safety, CLI"
  - "baseline/decom-gates.json: 10 gates, all false"
  - "07-AUTHORIZATIONS.md: append-only Phase 7 log with DECOM-01 waiver block"
affects: [07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10, 07-11, 07-12, 07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]
tech-stack:
  added: []
  patterns: ["fail-closed gate file with sha256-bound evidence", "exact-line authorization blocks", "synchronous injectable file deps"]
key-files:
  created:
    - scripts/portfolio-migration/18-decom-guard.mjs
    - scripts/portfolio-migration/18-decom-guard.test.mjs
    - scripts/portfolio-migration/baseline/decom-gates.json
    - .planning/workstreams/supabase-portfolio-migration/phases/07-monitoring-decommission/07-AUTHORIZATIONS.md
  modified:
    - .gitignore
key-decisions:
  - "Gate and auth-log paths are exported as absolute paths; all file deps (readText, readBytes, writeText, fileExists) are synchronous so consumers can call recordGate/verifyGates/readGates directly."
  - "Gate file is a flat object keyed by the 10 gate names; each entry holds passed, at, evidence, sha256, auth_block, required_line."
  - "checkConfirmation requires exactly one block; checkAuthBlock accepts any block under the heading that satisfies all three conditions (append-only corrections allowed)."
  - "The DECOM-01 waiver block uses a Source line instead of a Reply line (given in discuss-phase, no verbatim reply fabricated)."
requirements-completed: [DECOM-04, DECOM-05]
duration: 25min
completed: 2026-10-04
---

# Phase 7 Plan 01: Decommission guard foundation Summary

Fail-closed decommission foundation: ref guards (only the ziko ref can pass the ziko delete guard, portfolio refused everywhere), a 10-gate evidence-bound gate file, D-15 plain-yes confirmation checker, and a committed-content safety check, all under 36 unit tests.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (RED) | Failing guard tests | b1df62f5 |
| 1 (GREEN) | Guard library plus CLI | 55b1981a |
| 2 | Gate file, auth log, .gitignore | aa383666 |

## Verification

- `node --test scripts/portfolio-migration/18-decom-guard.test.mjs`: 36 pass.
- Full `scripts/portfolio-migration/*.test.mjs` plus `scripts/auth-merge/*.test.mjs`: 352 pass, 0 fail.
- No literal project ref in production code (grep prints 0).
- `--status` exits 0, `--status --require ziko` exits 1 on the fresh gate file.
- `git check-ignore` succeeds for `.tmp-decom-*` and `*.tar.gpg` paths.

## Deviations from Plan

### Auto-fixed / noted

**1. [Scope] CLI implemented in the Task 1 GREEN commit**
- The CLI and its tests were written together with the library (tests were in the RED commit), so Task 2 only produced the gate file, log and .gitignore. No functional difference.

**2. Pre-cutover auth baseline NOT committed (per plan instruction)**
- `scripts/auth-merge/baseline/portfolio-baseline-precutover.json` contains 136 lines matching full UUIDs (0 emails, 0 JWTs), so the plan's PII grep gate failed and the file was left untracked. Plan 07-13 must pass this file path explicitly from disk.

**3. `node --test <dir>` form fails on this Node version**
- Used the glob form `"scripts/portfolio-migration/*.test.mjs"` for the full-suite check.

## Known Stubs

None.

## Threat Flags

None. T-07-01..04 mitigations implemented and tested.

## Self-Check: PASSED

Files and commits b1df62f5, 55b1981a, aa383666 verified present.
