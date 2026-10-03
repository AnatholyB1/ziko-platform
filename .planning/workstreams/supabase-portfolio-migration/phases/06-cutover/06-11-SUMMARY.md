---
phase: 06-cutover
plan: 11
subsystem: infra
tags: [cutover, env-switch, local, portfolio]
requires: ["06-05", "06-10"]
provides:
  - Local env files (backend, web, mobile) pointing at portfolio
affects: [06-18]
key-files:
  modified:
    - backend/api/.env.local (gitignored, not committed)
    - apps/web/.env.local (gitignored, not committed)
    - apps/mobile/.env (gitignored, not committed)
requirements-completed: [CUTOVER-01]
completed: 2026-10-03
---

# Phase 6 Plan 11: Local env switch to portfolio Summary

The three gitignored local env files were switched to portfolio (ubxllsvanurkwkohzxau) with the audited `17-env-switch.mjs`, and backend, web and mobile bundle were each shown to run locally against it, read-only.

## Task 1: Env switch

Precondition met: 06-10-SUMMARY contains `SCRATCH CUTOVER REHEARSAL: PASS`. `git check-ignore` succeeds for all three paths and `git status` shows no env file. Plan then apply run per surface (names and fingerprints only; no values):

| Surface | Name | Fingerprint |
|---|---|---|
| api | SUPABASE_URL | a3934fcc |
| api | SUPABASE_PUBLISHABLE_KEY | e4575253 |
| api | SUPABASE_SERVICE_KEY | 0006453c |
| web | NEXT_PUBLIC_SUPABASE_URL | a3934fcc |
| web | NEXT_PUBLIC_SUPABASE_ANON_KEY | e4575253 |
| web | NEXT_PUBLIC_SUPABASE_KEY | e4575253 |
| web | SUPABASE_URL | a3934fcc |
| web | SUPABASE_SERVICE_ROLE_KEY | 0006453c |
| mobile | EXPO_PUBLIC_SUPABASE_URL | a3934fcc |
| mobile | EXPO_PUBLIC_SUPABASE_KEY | e4575253 |

URL lines equal the portfolio URL in all files; zero occurrences of the ziko ref; no RELOGIN_CUTOVER_DATE set (D-03). The plan's verify command passed.

## Task 2: Local run proofs (CUTOVER-01)

- Backend (`npm run dev`, port 8080): /health 200; unauthenticated /credits/balance 401; server stopped afterwards.
- Web: `next build` succeeded; `.next/static` inlines the portfolio URL (1 file), 0 files with the ziko ref; `next start -p 3100` served / with 200; stopped. `git status` clean for `.next`.
- Mobile: `expo export --platform android` to OS temp: portfolio URL in bundle (1 file), ziko ref 0; export directory deleted.
- Anonymous PostgREST read of `ziko_exercises` (publishable key read inside node, not printed): HTTP 200.

No write to portfolio or ziko was performed. AI-chat checks were not run (skip-ai waiver, empty Anthropic balance). A device run of the local mobile app is covered by checklist M-08 in 06-18.

## Deviations from Plan

None. No task commits were possible because the env files are gitignored by design; this SUMMARY is the only committed artifact.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
