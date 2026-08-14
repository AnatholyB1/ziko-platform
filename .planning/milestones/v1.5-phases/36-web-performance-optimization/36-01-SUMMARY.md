---
phase: 36-web-performance-optimization
plan: "01"
subsystem: web-coach
tags: [performance, react-cache, auth, server-components]
dependency_graph:
  requires: []
  provides: [getCachedCoachUser, getCachedAlertCount]
  affects: [apps/web/src/app/[locale]/(coach)/coach/layout.tsx]
tech_stack:
  added: []
  patterns: [react-cache-deduplication, server-only-guard]
key_files:
  created:
    - apps/web/src/lib/coach/auth.ts
  modified:
    - apps/web/src/app/[locale]/(coach)/coach/layout.tsx
decisions:
  - "React cache() chosen over unstable_cache — auth data must not persist across requests (T-36-01)"
  - "Promise.all([getCachedCoachUser(), getCachedAlertCount()]) in layout — parallel resolution with deduplication"
  - "void user used to acknowledge user variable without removing the destructuring (lint safety)"
metrics:
  duration: ~5 minutes
  completed_date: "2026-05-22T21:04:21Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
requirements:
  - PERF-01
  - PERF-02
---

# Phase 36 Plan 01: React cache() deduplication for coach auth helpers Summary

**One-liner:** Request-scoped React cache() wraps getUser + role + alert-count so the coach layout pays one DB round-trip per request regardless of how many server components call the helpers.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create getCachedCoachUser and getCachedAlertCount helpers | e6232a8 | apps/web/src/lib/coach/auth.ts (new) |
| 2 | Refactor coach layout to consume cached auth helpers | 3fa53ba | apps/web/src/app/[locale]/(coach)/coach/layout.tsx |

## What Was Built

### `apps/web/src/lib/coach/auth.ts`

New server-only module with two React `cache()`-wrapped helpers:

- **`getCachedCoachUser()`** — calls `createServerSupabase()`, runs `getUser()`, checks `user_profiles.role`, redirects unauthenticated/non-coach users, returns `{ user, role }`.
- **`getCachedAlertCount()`** — calls `getCachedCoachUser()` (free — same request cache hit), then queries `coach_alerts` for unread count, returns `number`.

Both use `cache` from `'react'` (request-scoped). The `'server-only'` guard prevents accidental import in client components.

### `apps/web/src/app/[locale]/(coach)/coach/layout.tsx`

Reduced from 47 lines to 24 lines. All inline supabase calls removed. Layout now:
1. Calls `Promise.all([getCachedCoachUser(), getCachedAlertCount()])`.
2. Passes `unreadAlertCount` to `<CoachSidebar>`.
3. Keeps `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` — auth must remain per-request.

## Deviations from Plan

None — plan executed exactly as written.

## Security Notes

- **T-36-01 mitigated:** `cache()` from React is request-scoped only. Each request gets a fresh auth check. `unstable_cache` (cross-request) was explicitly avoided.
- **T-36-02 mitigated:** Role guard lives inside `getCachedCoachUser()`. `getCachedAlertCount()` calls `getCachedCoachUser()` internally — the auth + role check cannot be bypassed.
- **`cache: 'no-store'`** in `createServerSupabase()`'s global fetch config is untouched — prevents HTTP-level cross-user Supabase cache sharing (ARCH-06).

## Verification

All checks passed:

| Check | Result |
|-------|--------|
| `grep -c "supabase\." layout.tsx` | 0 |
| `grep -c "server-only" auth.ts` | 1 |
| `grep -c "from 'react'" auth.ts` | 1 |
| `tsc --noEmit` | 0 errors |
| File exists: `apps/web/src/lib/coach/auth.ts` | OK |

## Self-Check: PASSED

- `apps/web/src/lib/coach/auth.ts` — file exists, verified
- Commit `e6232a8` — verified in git log
- Commit `3fa53ba` — verified in git log
- Zero TypeScript errors — verified
