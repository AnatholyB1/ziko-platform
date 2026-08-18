---
phase: 35
plan: G04
subsystem: mobile/profile
tags: [credits, tanstack-query, settings, api-integration]
dependency_graph:
  requires: [35-G01]
  provides: [live-credits-balance]
  affects: [apps/mobile/app/(app)/profile/settings.tsx]
tech_stack:
  added: []
  patterns: [tanstack-query useQuery, fetch with Bearer token]
key_files:
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx
decisions:
  - Used supabase.auth.getSession() to obtain access_token, matching existing coachData query pattern
  - Shows '—' while loading to avoid flash of stale hardcoded value
metrics:
  duration: ~5min
  completed: 2026-05-23
---

# Phase 35 Plan G04: Crédits IA Real Balance from Backend Summary

Wire the Crédits IA row in Settings to the live `/credits/balance` API endpoint, replacing the hardcoded "47 / 100" with dynamic `{ ai_credits } / { daily_cap }` values fetched via TanStack Query.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add TanStack Query fetch for credit balance | 118941f | settings.tsx |
| 2 | Display real value in the Credits row | 118941f | settings.tsx |

## Implementation Details

Added `useQuery` hook in `SettingsScreen` (line ~414) querying `GET /credits/balance` with a Bearer token obtained via `supabase.auth.getSession()`. Uses `staleTime: 60_000` (1 minute cache). The STRow for "Crédits IA" now renders `credits.ai_credits / credits.daily_cap` when data is available, or `'—'` while loading.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the credits row now shows live data.

## Self-Check: PASSED

- File modified: `apps/mobile/app/(app)/profile/settings.tsx` — confirmed exists
- Commit 118941f — confirmed present in git log
- TypeScript: 6 pre-existing errors, zero new errors introduced by this plan
