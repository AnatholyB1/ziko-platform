---
phase: 01-foundation
plan: 03
subsystem: api
tags: [hono, supabase, branding, pro-gate, rls, tier-check]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: coach_branding table (migration 054) in live Supabase DB
provides:
  - PATCH /coach/branding — Pro-gated upsert of coach branding config (hex color, logo, tone)
  - GET /coach/clients/links/me — now returns branding: BrandingRow | null at top level
  - backend/api/src/coach/branding/db.ts — upsertBranding + getBranding DB functions
  - backend/api/src/coach/branding/service.ts — brandingRouter with Pro gate + body validation
affects: [da-coach/01-04, any plan that consumes GET /coach/clients/links/me response shape]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pro gate pattern: service-key client reads user_profiles.tier before any DB write; user_profiles PK is 'id' (not 'user_id')"
    - "Branding upsert pattern: coach_id from auth.userId (not request body) — prevents T-03-04 elevation"
    - "Module-level service client in service.ts for tier check (same pattern as creditGate.ts)"

key-files:
  created:
    - backend/api/src/coach/branding/db.ts
    - backend/api/src/coach/branding/service.ts
  modified:
    - backend/api/src/coach/clients/db.ts
    - backend/api/src/app.ts

key-decisions:
  - "user_profiles PK column is 'id' (migration 001) — branding Pro gate uses .eq('id', userId), not .eq('user_id', userId) as creditGate.ts does"
  - "coachId in upsertBranding comes exclusively from c.get('auth').userId (JWT) — request body cannot influence coach_id"
  - "getBranding uses athlete's user-scoped JWT so RLS athlete-read policy applies automatically"

patterns-established:
  - "Pro gate: service-key reads user_profiles.tier before write, user-JWT for subsequent upsert (RLS enforces coach_id = auth.uid())"
  - "createUserClient() reused from clients/db.ts — no copy of factory"

requirements-completed: [FOUND-01, FOUND-02, FOUND-03]

# Metrics
duration: 15min
completed: 2026-05-26
---

# Phase 01 Plan 03: Branding Module Summary

**PATCH /coach/branding Pro-gated upsert with hex/tone validation + GET /links/me augmented to return branding: BrandingRow | null**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-26T00:00:00Z
- **Completed:** 2026-05-26T00:15:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Created `backend/api/src/coach/branding/db.ts` with `BrandingRow` interface, `upsertBranding()` (upsert on conflict coach_id), and `getBranding()` (maybeSingle, returns null if no row)
- Created `backend/api/src/coach/branding/service.ts` with `brandingRouter`: Pro gate (service-key tier check), JSON body validation (hex color regex `/^#[0-9A-Fa-f]{6}$/`, tone allowlist), and upsert semantics
- Augmented `getActiveLink()` in `clients/db.ts` to fetch branding via `getBranding(jwt, linkRow.coach_id)` and return it at top level; early `!linkRow` return now includes `branding: null`
- Mounted `brandingRouter` at `/coach/branding` in `app.ts`
- TypeScript compilation: zero errors

## Task Commits

1. **Tasks 1+2: branding module + app.ts mount** - `8531353` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `backend/api/src/coach/branding/db.ts` — BrandingRow interface, upsertBranding, getBranding
- `backend/api/src/coach/branding/service.ts` — brandingRouter with PATCH / handler, Pro gate, validation
- `backend/api/src/coach/clients/db.ts` — import BrandingRow+getBranding; augmented getActiveLink() return type, early return, final return
- `backend/api/src/app.ts` — import brandingRouter, mount at /coach/branding

## Decisions Made
- `user_profiles.id` (not `user_id`) is the PK — confirmed from migration 001 schema. `creditGate.ts` uses `.eq('user_id', userId)` which appears to be a pre-existing inconsistency; branding Pro gate correctly uses `.eq('id', userId)`.
- Tasks 1 and 2 committed in a single commit since they are atomic: `service.ts` imports from `db.ts`, and the augmented `clients/db.ts` imports from the new `branding/db.ts` — splitting would produce a broken intermediate state.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The `coach_branding` table was already live (migration 054 applied per plan precondition).

## Next Phase Readiness
- PATCH /coach/branding is live and protected by Pro gate
- GET /coach/clients/links/me returns `branding` field — consumer (mobile DA widget) can now read coach branding without an extra request
- FOUND-01, FOUND-02, FOUND-03 requirements closed
- Ready for Plan 01-04 (mobile DA widget surfaces the branding data)

## Self-Check: PASSED

- `backend/api/src/coach/branding/db.ts` — FOUND
- `backend/api/src/coach/branding/service.ts` — FOUND
- `01-03-SUMMARY.md` — FOUND
- Commit `8531353` — FOUND (feat: branding module + clients/db augmentation + app.ts mount)
- TypeScript compilation: zero errors

---
*Phase: 01-foundation*
*Completed: 2026-05-26*
