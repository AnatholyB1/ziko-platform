---
phase: 23-web-turborepo-onboarding-auth-bootstrap
plan: "06"
subsystem: apps/web
tags: [phase-23, wave-5, coach-segment, smoke-route, force-dynamic, deletable-phase-24]
dependency_graph:
  requires: [23-04, 23-03]
  provides: [coach-route-group, smoke-page, server-action-layer3, layout-guard-layer2]
  affects: [apps/web/src/app]
tech_stack:
  added: []
  patterns: [Server Component layout guard, Server Action re-check, force-dynamic RSC, ARCH-05 three-layer auth]
key_files:
  created:
    - apps/web/src/app/[locale]/(coach)/coach/layout.tsx
    - apps/web/src/app/[locale]/(coach)/coach/_smoke/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/_smoke/action.ts
    - apps/web/src/app/[locale]/(coach)/coach/_smoke/SmokeButton.tsx
  modified: []
decisions:
  - "(coach) route group with literal coach/ subfolder: `[locale]/(coach)/coach/` gives URL /fr/coach/_smoke AND matches middleware regex /fr|en/coach"
  - "Hard-coded redirect('/fr/login') — no searchParams.next interpolation (T-23-06-01 Tampering mitigated)"
  - "Server Action re-calls getUser() independently — TOCTOU defense (T-23-06-02 Info Disclosure mitigated)"
  - "force-dynamic + revalidate = 0 on both layout and page — no cross-user RSC cache (T-23-06-03 mitigated)"
metrics:
  duration: "4m"
  completed_date: "2026-05-15"
  tasks_completed: 2
  files_created: 4
---

# Phase 23 Plan 06: (coach) Route Group & Smoke Deploy Summary

One-liner: Thin Phase-23 slice wiring all three ARCH-05 auth layers — middleware (layer 1, plan 04), layout guard getUser() redirect (layer 2), Server Action re-check (layer 3) — plus force-dynamic RSC cache isolation, all tagged DELETE IN PHASE 24.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | (coach) layout guard with getUser() redirect | 52d5c22 | apps/web/src/app/[locale]/(coach)/coach/layout.tsx |
| 2 | _smoke page + Server Action + SmokeButton | fe4b004 | _smoke/page.tsx, _smoke/action.ts, _smoke/SmokeButton.tsx |

## Files Created

| File | Purpose |
|------|---------|
| `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` | ARCH-05 layer 2: layout guard, getUser(), redirect('/fr/login') on null, force-dynamic |
| `apps/web/src/app/[locale]/(coach)/coach/_smoke/page.tsx` | Smoke page: renders "Signed in as <code>{user.id}</code>", includes SmokeButton |
| `apps/web/src/app/[locale]/(coach)/coach/_smoke/action.ts` | ARCH-05 layer 3: Server Action smokeReCheck() — independent getUser() re-check |
| `apps/web/src/app/[locale]/(coach)/coach/_smoke/SmokeButton.tsx` | Client component: invokes smokeReCheck(), renders JSON result |

## ARCH-05 Layer Coverage

| Layer | Where | Plan |
|-------|-------|------|
| Layer 1 — Middleware updateSession() | apps/web/src/middleware.ts | 23-04 |
| Layer 2 — Layout guard getUser() + redirect | (coach)/coach/layout.tsx | **23-06** |
| Layer 3 — Server Action re-check getUser() | (coach)/coach/_smoke/action.ts | **23-06** |

## Deletion Marker Verification

All 4 files contain `PHASE 23 SMOKE — DELETE IN PHASE 24`:
- layout.tsx: line 1
- page.tsx: line 1
- action.ts: line 1
- SmokeButton.tsx: line 1

## Deviations from Plan

None — plan executed exactly as written. The `@/` path alias was confirmed present in apps/web/tsconfig.json (`"paths": { "@/*": ["./src/*"] }`) before writing files, so `@/lib/supabase/server` import form was used throughout.

## Threat Register Coverage

| Threat | Mitigation | Verified |
|--------|------------|---------|
| T-23-06-01 Tampering: open redirect | Hard-coded `redirect('/fr/login')` — no interpolation | Yes (grep confirms no searchParams.next) |
| T-23-06-02 Info Disclosure: stale cookie TOCTOU | Server Action re-calls `getUser()` independently | Yes (smokeReCheck in action.ts) |
| T-23-06-03 Info Disclosure: cached RSC cross-user leak | `dynamic='force-dynamic'` + `revalidate=0` on layout + page | Yes (both files export these) |
| T-23-06-04 Tampering: Phase 24 forgets to delete _smoke | Header comment on all 4 files | Yes (all 4 files tagged) |

## Known Stubs

None — smoke route is intentionally minimal; user.id is live data from getUser(), not mocked.

## Threat Flags

None — no new trust boundaries beyond those modeled in the plan's threat register.

## Self-Check: PASSED

- layout.tsx: FOUND
- _smoke/page.tsx: FOUND
- _smoke/action.ts: FOUND
- _smoke/SmokeButton.tsx: FOUND
- Task 1 commit 52d5c22: FOUND
- Task 2 commit fe4b004: FOUND
