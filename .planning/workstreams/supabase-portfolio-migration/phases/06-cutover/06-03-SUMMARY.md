---
phase: 06-cutover
plan: 03
subsystem: cutover-tooling
tags: [smoke, signup-isolation, supabase, temp-users]
requires: []
provides:
  - lib-cutover.mjs (authorization gate, temp-user lifecycle, PII-safe reports)
  - 14-signup-isolation.mjs (CUTOVER-04)
  - 15-smoke-core-flows.mjs (CUTOVER-03)
affects: [06-12, 06-15, 06-16, 06-18]
tech-stack:
  added: []
  patterns: [typed-authorization-file gate, finally cleanup with leftover assertion]
key-files:
  created:
    - scripts/portfolio-migration/lib-cutover.mjs
    - scripts/portfolio-migration/lib-cutover.test.mjs
    - scripts/portfolio-migration/14-signup-isolation.mjs
    - scripts/portfolio-migration/15-smoke-core-flows.mjs
    - scripts/portfolio-migration/15-smoke-core-flows.test.mjs
key-decisions:
  - "Coach temp user is made a coach via ziko_user_profiles.role = 'coach' (the column coach/identity reads), single UPDATE restricted to the temp id"
  - "Write case uses ziko_habits (own-row RLS policy habits_own)"
  - "Welcome credit amount (5) mirrored from the gate functions SQL"
metrics:
  tasks: 2
  completed: 2026-10-03
---

# Phase 6 Plan 03: Cutover smoke tools Summary

Signup-isolation proof and core-flow smoke, both gated (ziko refused, confirm-ref, exact typed authorization line on portfolio), self-cleaning and PII-safe.

## Commits
- 26ecaa6c: lib-cutover + 14-signup-isolation (Task 1)
- e4fc9aff: 15-smoke-core-flows (Task 2)

## Verification
- Offline tests: 9/9 pass (L1-L4, S1-S5).
- Both scripts targeting ziko exit 1 before any network call; 14 on portfolio without authorization file exits 1.
- Acceptance greps: no key/JWT literals; `/credits/balance`, `/ai/chat`, `/coach/clients`, `x-vercel-protection-bypass` all referenced.

## Deviations from Plan
None in behavior. Live runs against scratch/portfolio were not executed here (need CLI login/PAT and, for portfolio, user authorization); the SQL helpers (query_to_xml counting, DO-block cleanup) are untested against a live database and should be exercised on scratch first.

## Known Stubs
None.

## Self-Check: PASSED
