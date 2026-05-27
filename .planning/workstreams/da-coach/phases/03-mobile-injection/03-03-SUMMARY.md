---
phase: 03-mobile-injection
plan: "03"
subsystem: mobile-coach-screen
tags: [branding, logo, theme, mmkv, revoke]
dependency_graph:
  requires: [03-01]
  provides: [branding-logo-in-state-c, theme-primary-from-store, revoke-cleanup]
  affects: [plugins/coach/src/screens/CoachScreen.tsx]
tech_stack:
  added: []
  patterns: [conditional-image-source, zustand-selector, mmkv-delete-on-revoke]
key_files:
  modified:
    - plugins/coach/src/screens/CoachScreen.tsx
decisions:
  - coachStorage imported from @ziko/plugin-sdk (not relative themeStore.ts path) since plugin-sdk already exports it via export * from './theme'
  - clearCoachTheme and coachStorage.delete placed before queryClient.invalidateQueries in revoke success block for immediate UI feedback
metrics:
  duration: "10m"
  completed: "2026-05-27"
  tasks_completed: 5
  files_modified: 1
---

# Phase 3 Plan 03: CoachScreen Branding Wiring Summary

**One-liner:** CoachScreen wired to show coach brand logo in State C avatar, uses theme.primary for all orange accents, and clears coach theme + MMKV cache immediately on revoke success.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update LinkStatusResponse type to include branding | fd785e7 | CoachScreen.tsx |
| 2 | Update CoachAvatar to support branding logo | fd785e7 | CoachScreen.tsx |
| 3 | Replace hardcoded #FF5C1A with theme.primary | fd785e7 | CoachScreen.tsx |
| 4 | Add clearCoachTheme + MMKV delete in handleRevoke | fd785e7 | CoachScreen.tsx |
| 5 | TypeScript verification pass | fd785e7 | CoachScreen.tsx |

## What Was Built

### Task 1 — Type Updates
Added `BrandingPayload` interface with `primary_color`, `logo_url`, `tone` fields. Extended `LinkStatusResponse` to include `branding: BrandingPayload | null`.

### Task 2 — CoachAvatar Branding Logo
Updated `CoachAvatar` from a simple function component to a block-body component that:
- Accepts optional `logoUrl?: string | null` prop
- When `logoUrl` is truthy: constructs public URL via `supabase.storage.from('coach-logos').getPublicUrl(logoUrl).data.publicUrl`
- Falls back to `photoUrl` when `logoUrl` is falsy (existing behavior preserved)
- State C now passes `logoUrl={data.branding?.logo_url ?? null}` to CoachAvatar
- State B call unchanged (no logoUrl prop)

### Task 3 — theme.primary Replacement
All 5 occurrences of `#FF5C1A` replaced with `theme.primary` (already read from `useThemeStore` at component top). Semantic colors (error reds, neutral backgrounds, borders) untouched.

### Task 4 — Revoke Cleanup
- `coachStorage` imported from `@ziko/plugin-sdk` (not relative path — it re-exports from `packages/plugin-sdk/src/theme.ts`)
- `clearCoachTheme` added as Zustand selector
- In `handleRevoke` `if (res.ok)` block: `clearCoachTheme()` + `coachStorage.delete('coach:branding')` called before UI state resets
- `clearCoachTheme` added to `useCallback` dependency array

### Task 5 — TypeScript Check
One pre-existing error found: `Cannot find module 'expo-notifications'` at line 14. This error existed before this plan (the import was already in the file). Zero new TypeScript errors introduced by this plan's changes.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes
- `coachStorage` import path: the plan suggested either `@ziko/plugin-sdk` or relative path. Used `@ziko/plugin-sdk` since `export * from './theme'` in plugin-sdk's index already exports it — cleaner than a cross-package relative import.

## Known Stubs

None — all functionality fully wired.

## Threat Flags

None — no new network endpoints or auth paths introduced. Logo URL constructed from server-validated `branding.logo_url` path via Supabase public bucket (T-03-03-01 accepted per threat model). theme.primary from server hex-validated in Phase 1 backend (T-03-03-02 accepted).

## Self-Check: PASSED

- [x] `plugins/coach/src/screens/CoachScreen.tsx` exists and modified
- [x] Commit fd785e7 exists
- [x] Zero occurrences of `#FF5C1A` in CoachScreen.tsx
- [x] `BrandingPayload` interface present
- [x] `clearCoachTheme` called in `handleRevoke` success block
- [x] `coachStorage.delete('coach:branding')` called in `handleRevoke` success block
