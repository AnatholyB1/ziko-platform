---
phase: 35-profile-settings-redesign
plan: 13
subsystem: mobile/profile
tags: [bug-fix, navigation, subscription, settings]
dependency_graph:
  requires: [35-12]
  provides: [PROF-02, SET-01]
  affects: [apps/mobile/app/(app)/profile/settings.tsx]
tech_stack:
  added: []
  patterns: [expo-router push navigation, direct column read]
key_files:
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx
decisions:
  - Replace showAlert stub with router.push to unblock Informations personnelles navigation (Decision 4)
  - Read subscription_tier from direct column (migration 051) instead of settings JSONB
metrics:
  duration: "3m"
  completed: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 35 Plan 13: Settings Bug Fixes Summary

Two-line bug fix: navigation stub replaced with real route push, subscription_tier moved from JSONB to direct column read.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Corriger navigation Informations personnelles | 9ed62c9 | apps/mobile/app/(app)/profile/settings.tsx |
| 2 | Corriger subscription_tier colonne directe | 9ed62c9 | apps/mobile/app/(app)/profile/settings.tsx |

## Changes Made

### Task 1 — Navigation fix (line 488)

**Before:** `onPress={() => showAlert('Bientôt', 'Cette section arrive dans la prochaine version.')}`

**After:** `onPress={() => router.push('/(app)/profile/edit' as any)}`

The STRow "Informations personnelles" was showing a "coming soon" alert. It now navigates to the edit screen introduced in earlier plans of this phase.

### Task 2 — subscription_tier fix (line 387)

**Before:** `const tier = (profile as any)?.settings?.subscription_tier ?? 'free';`

**After:** `const tier = (profile as any)?.subscription_tier ?? 'free';`

Migration 051 (plan 35-12) added `subscription_tier` as a direct column on `user_profiles`. Removing `.settings` from the path ensures the value is read from the correct location.

## Verification Results

- `grep -c "router.push.*profile/edit"` → 1 (pass)
- `grep -c "Bientôt.*Cette section"` → 0 (pass)
- `grep -c "settings?.subscription_tier"` → 0 (pass)
- TypeScript errors in settings.tsx from this plan: 0 (pre-existing errors in unrelated files are out of scope)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None introduced by this plan.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- File exists: apps/mobile/app/(app)/profile/settings.tsx — FOUND
- Commit 9ed62c9 — FOUND
