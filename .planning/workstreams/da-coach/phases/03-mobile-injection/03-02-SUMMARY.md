---
phase: 03-mobile-injection
plan: "02"
subsystem: mobile-layout
tags: [mobile, theme, mmkv, tanstack-query, branding, bootstrap]
dependency_graph:
  requires: [03-01]
  provides: [useBrandingBootstrap-hook, coach-branding-mmkv-sync]
  affects: [apps/mobile/app/(app)/_layout.tsx, apps/mobile/src/stores/themeStore.ts]
tech_stack:
  added: []
  patterns: [useQuery-deduplication, useEffect-data-watch, mmkv-sync-write]
key_files:
  modified:
    - apps/mobile/app/(app)/_layout.tsx
    - apps/mobile/src/stores/themeStore.ts
decisions:
  - "coachStorage imported via themeStore re-export (single import path for mobile consumers)"
  - "data === undefined guard prevents clearCoachTheme from firing during loading state"
  - "queryKey ['coach-link', userId] matches CoachScreen exactly for TanStack deduplication"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-27T19:54:31Z"
  tasks_completed: 1
  files_modified: 2
---

# Phase 03 Plan 02: useBrandingBootstrap Hook Summary

**One-liner:** Bootstrap hook in root authenticated layout fetches coach branding on startup and keeps mobile theme + MMKV cache bidirectionally in sync.

## What Was Built

Added `useBrandingBootstrap()` hook to `apps/mobile/app/(app)/_layout.tsx`. The hook:

- Runs on every authenticated app open via `useQuery` with `queryKey: ['coach-link', userId]`
- Identical query key to `CoachScreen` ensures TanStack Query deduplicates — CoachScreen gets cached data for free on first visit with zero additional network requests
- `useEffect` watching `data?.branding`:
  - `data === undefined` (loading) → no-op, preserves existing MMKV-seeded theme
  - `data.branding` set → `setCustomTheme({ primary: branding.primary_color })` + writes full branding object to MMKV key `coach:branding`
  - `data.branding` null → `clearCoachTheme()` + deletes MMKV `coach:branding` (handles cross-device revocation)
- Fetch errors thrown in `queryFn` are handled silently by TanStack Query retry — never block app render

Also added `coachStorage` to the `themeStore.ts` re-export list so mobile-layer files can import it from a single path.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add useBrandingBootstrap hook and wire into AppLayout | b7f0896 | apps/mobile/app/(app)/_layout.tsx, apps/mobile/src/stores/themeStore.ts |

## Deviations from Plan

None — plan executed exactly as written. `coachStorage` was not yet re-exported from `themeStore.ts`, which the plan anticipated and provided the fix for.

## Verification

- `grep -n "useBrandingBootstrap"` shows definition at line 49 and call at line 83 in `_layout.tsx`
- `grep -n "coach:branding\|setCustomTheme\|clearCoachTheme"` shows MMKV ops at lines 73-77 and dependency array at line 79
- `rtk tsc` — zero errors in `_layout.tsx` and `themeStore.ts` (pre-existing 240 TS2307 errors are all in `apps/web` from missing components in other phases)

## Self-Check: PASSED

- [x] `apps/mobile/app/(app)/_layout.tsx` — exists with hook defined and called
- [x] `apps/mobile/src/stores/themeStore.ts` — `coachStorage` added to re-export
- [x] Commit `b7f0896` — confirmed in git log
