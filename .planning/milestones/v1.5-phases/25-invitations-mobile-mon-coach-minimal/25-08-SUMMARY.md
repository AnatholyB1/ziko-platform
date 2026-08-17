---
phase: 25-invitations-mobile-mon-coach-minimal
plan: 08
subsystem: auth
tags: [supabase, server-actions, next-js, jwt, redeem-flow]

# Dependency graph
requires:
  - phase: 25-invitations-mobile-mon-coach-minimal
    provides: RedeemStateMachine, Server Actions for preview/redeem/revoke/fetchActiveLink

provides:
  - getBearer() using getUser() first then getSession() — live JWT refresh in Server Actions
  - API_URL server-side fallback (process.env.API_URL) before NEXT_PUBLIC_API_URL
  - console.error logging in every catch block in redeem/actions.ts
  - fetchActiveLinkAction with safe JSON parse guard
  - console.warn for NETWORK errors in runPreview and runRedeem
  - Pending state '…' indicator on State A submit and State B link buttons

affects: [phase-26, phase-27, phase-28]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action JWT: getUser() forces live token refresh before getSession() returns access_token"
    - "API_URL in Server Actions: process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? fallback"
    - "Safe JSON parse: res.json().catch(() => null) with null guard before use"

key-files:
  created: []
  modified:
    - apps/web/src/lib/redeem/actions.ts
    - apps/web/src/components/coach/RedeemStateMachine.tsx

key-decisions:
  - "getBearer() calls getUser() first to force live Supabase Auth token refresh, then getSession() for access_token — getSession()-only returns stale/null in Server Action context"
  - "API_URL reads process.env.API_URL (server-only) before NEXT_PUBLIC_API_URL — allows internal routing override without exposing env var to client bundle"
  - "fr.json CoachRedeem.stateB.back already correct ('← Entrer un autre code') — no translation change needed"

patterns-established:
  - "Server Action JWT pattern: always getUser() then getSession(), never getSession() alone"

requirements-completed: [INVITE-03, INVITE-05, INVITE-06, INVITE-07]

# Metrics
duration: 4min
completed: 2026-05-17
---

# Phase 25 Plan 08: Redeem Flow Gap Closure Summary

**Server Action JWT fixed via getUser()-first pattern + verbose error logging so the broken /redeem + /r/[code] flow can succeed in production**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-17T20:56:58Z
- **Completed:** 2026-05-17T21:01:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed root cause of silent redeem failure: `getSession()` returns null in Server Actions — replaced with `getUser()` first then `getSession()` to force live token refresh
- Added `process.env.API_URL` server-side env fallback so internal backend routing can override the public URL
- Added `console.error('[redeem/actions] ...')` in every catch block across all four Server Actions
- Wrapped `fetchActiveLinkAction` `res.json()` with `.catch(() => null)` guard
- Added `console.warn('[RedeemStateMachine] Network error ...')` for NETWORK error_code in both `runPreview` and `runRedeem`
- Added `pending ? '…' : label` loading indicator on State A submit and State B link buttons

## Task Commits

Each task was committed atomically:

1. **Task 1: Diagnose and fix JWT acquisition in Server Actions** - `324f57e` (fix)
2. **Task 2: Fix RedeemStateMachine NETWORK error display + verify deep-link auto-preview** - `60c7a3f` (fix)

**Plan metadata:** (final commit below)

## Files Created/Modified
- `apps/web/src/lib/redeem/actions.ts` — getUser() JWT fix, API_URL fallback, console.error in catches, safe JSON parse in fetchActiveLinkAction
- `apps/web/src/components/coach/RedeemStateMachine.tsx` — NETWORK console.warn in runPreview + runRedeem, pending '…' on State A submit and State B link buttons

## Decisions Made
- `getBearer()` calls `getUser()` first then `getSession()`: getSession()-only returns stale or null tokens inside Server Actions because the session cookie may not be forwarded; getUser() forces a live Supabase Auth validation
- `API_URL` reads `process.env.API_URL` (server-only, never exposed to client) as first fallback — allows Vercel/Docker deployments to route to internal backend URL without changing public env
- `fr.json CoachRedeem.stateB.back` was already `"← Entrer un autre code"` — confirmed correct, no change applied

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in `test/safe-next.spec.ts` (Property 'safeNext' does not exist) — unrelated to this plan's files, out of scope, not fixed.

## Known Stubs

None — no stub values introduced. All changes are targeted fixes to existing logic.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-25-08-01 mitigated | apps/web/src/lib/redeem/actions.ts | getUser() now enforces live token validation before access_token is used as Bearer — Spoofing via stale getSession() token eliminated |

## User Setup Required

Optional: set `API_URL` (without `NEXT_PUBLIC_` prefix) in `apps/web/.env.local` or Vercel environment variables if the backend internal URL differs from the public API URL. This allows Server Actions to use the internal route while the client bundle uses `NEXT_PUBLIC_API_URL`.

## Next Phase Readiness

- Redeem flow Server Actions now use live JWT — State A → B → C → A transitions should succeed when backend is reachable with a valid auth session
- Error logging (`console.error` + `console.warn`) enables diagnosis of any remaining failures via Vercel/Next.js server logs
- Pre-existing `test/safe-next.spec.ts` TS error remains — should be addressed in a dedicated fix plan

---
*Phase: 25-invitations-mobile-mon-coach-minimal*
*Completed: 2026-05-17*
