---
phase: 36-web-performance-optimization
plan: 02
subsystem: web/coach-routes
tags: [performance, auth, isr, deduplication]
dependency_graph:
  requires:
    - 36-01-SUMMARY.md
  provides:
    - getCachedCoachUser() deduplication across all coach route segments
  affects:
    - apps/web/src/app/[locale]/(coach)/coach/**
tech_stack:
  added: []
  patterns:
    - React cache() deduplication for Supabase auth.getUser across nested route segments
    - ISR (revalidate=60) applied to settings page (low-churn coach profile data)
key_files:
  created: []
  modified:
    - apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/ai/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/invitations/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/programs/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/imports/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/imports/[id]/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/programs/[id]/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/compare/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/habits/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sleep/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/nutrition/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/measurements/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/cardio/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/journal/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx
decisions:
  - getCachedCoachUser() is now the single auth-resolution path for all (coach) route segments — React cache() deduplicates across layout + page within the same request
  - settings/page.tsx upgraded to ISR revalidate=60; all client data pages kept force-dynamic
  - getSession() calls preserved where JWT is needed for Hono API Authorization header
metrics:
  duration: 12m
  completed: 2026-05-22T21:20:43Z
  tasks_completed: 2
  files_modified: 20
---

# Phase 36 Plan 02: getCachedCoachUser() Route Refactor Summary

**One-liner:** Removed redundant `supabase.auth.getUser()` from 20 coach route files, replacing with React-cached `getCachedCoachUser()` that deduplicates to zero extra auth DB round-trips; settings page promoted to ISR revalidate=60.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Refactor pages to use getCachedCoachUser() and apply ISR to settings | 5141b61 | 11 files |
| 2 | Refactor client detail layout and all client tab pages | 1820071 | 9 files |

## What Was Built

**Task 1** refactored 11 coach route pages:
- `settings/page.tsx`: removed `force-dynamic`, added `revalidate = 60`, replaced inline `getUser()` with `getCachedCoachUser()`
- `dashboard/page.tsx`, `ai/page.tsx`, `clients/page.tsx`, `invitations/page.tsx`: kept `force-dynamic`, replaced `getUser()` with `getCachedCoachUser()`
- `clients/[id]/page.tsx` (redirect-only): removed the two export lines and unused createServerSupabase import
- `programs/page.tsx`, `imports/page.tsx`, `imports/[id]/page.tsx`, `programs/[id]/page.tsx`, `compare/page.tsx`: auth deduplication applied (Rule 2 expansion — these files were in the (coach) segment and needed the same fix for the success criterion to be met)

`getSession()` calls preserved in all files that use them for the Hono API JWT.

**Task 2** refactored the client detail layout and 8 tab pages:
- `clients/[id]/layout.tsx`: kept `force-dynamic`, replaced `getUser()` with `getCachedCoachUser()`, kept `createServerSupabase()` for profile/notes/tags queries
- `habits`, `sleep`, `nutrition`, `measurements`, `cardio`, `journal`: auth deduplication, all data queries unchanged
- `sessions/page.tsx`, `programs/page.tsx`: kept `getSession()` for Hono API JWT, replaced only `getUser()`

## Deviations from Plan

### Auto-added files (Rule 2 — missing auth deduplication)

**1. [Rule 2 - Missing Critical Functionality] Extended fix to 5 out-of-plan files**
- **Found during:** Task 1 verification — `grep -r "auth\.getUser"` returned matches in files not in the plan's task list
- **Files:** `imports/[id]/page.tsx`, `programs/[id]/page.tsx`, `clients/compare/page.tsx` (out-of-task but in plan frontmatter scope); also covered by success criterion "No supabase.auth.getUser() calls remain in any (coach) route file"
- **Fix:** Applied same `getCachedCoachUser()` substitution; kept `redirect` import where still used for data-guard redirects (not auth redirects)
- **Commits:** 5141b61

## Verification Results

1. TypeScript: zero errors after all refactors
2. `grep -r "auth\.getUser" apps/web/src/app/[locale]/(coach)/` — 0 matches
3. `grep "revalidate" .../settings/page.tsx` → `export const revalidate = 60;`
4. `grep "force-dynamic" .../clients/[id]/habits/page.tsx` → 1 match
5. `grep "getCachedCoachUser" .../coach/layout.tsx` → 1 match (plan 01 output confirmed)

## Known Stubs

None — this plan is a pure refactor with no new UI or data surface.

## Threat Flags

No new threat surface introduced. Threat mitigations from plan verified:
- T-36-03: settings ISR revalidate=60 is path-scoped (different coaches = different URLs, no cross-coach leak). RLS enforced at DB level.
- T-36-04: all client data pages kept force-dynamic.

## Self-Check: PASSED

All 20 modified files exist. Both commits (5141b61, 1820071) verified in git log.
