---
phase: 03-mobile-injection
plan: "01"
subsystem: plugin-sdk / mobile
tags: [mmkv, theme, cold-start, zustand, react-native]
dependency_graph:
  requires: []
  provides: [coachStorage, useThemeStore-mmkv-hydration]
  affects: [packages/plugin-sdk/src/theme.ts, apps/mobile/package.json]
tech_stack:
  added: [react-native-mmkv@^3.0.0]
  patterns: [synchronous-store-hydration, mmkv-zustand-init]
key_files:
  created: []
  modified:
    - packages/plugin-sdk/src/theme.ts
    - apps/mobile/package.json
    - packages/plugin-sdk/package.json
decisions:
  - Dedicated MMKV instance (id: coach-storage) rather than shared app-level instance — cleaner isolation for coach-specific branding data
  - npm install --legacy-peer-deps required — react-native-mmkv@3.3.3 peer dep on react-native@"*" triggers npm strict resolver false conflict with ^0.81.5; --legacy-peer-deps is safe since 0.81.5 satisfies *
metrics:
  duration: "~8 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  files_changed: 4
---

# Phase 3 Plan 01: react-native-mmkv Install + useThemeStore MMKV Synchronous Hydration Summary

**One-liner:** MMKV v3 installed and wired into useThemeStore's create() initializer so coach branding color is applied synchronously before frame 1, eliminating the cold-start orange flash.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Install react-native-mmkv v3 in apps/mobile + peerDep in plugin-sdk | 720d0e4 |
| 2 | Wire coachStorage MMKV read into useThemeStore create() initializer | 720d0e4 |

## What Was Built

### react-native-mmkv installation
- `react-native-mmkv: ^3.0.0` added to `apps/mobile/package.json` dependencies
- `react-native-mmkv: ^3.0.0` added to `packages/plugin-sdk/package.json` peerDependencies
- Installed with `--legacy-peer-deps` (see deviations below)

### useThemeStore MMKV hydration (packages/plugin-sdk/src/theme.ts)
- Import `MMKV` from `react-native-mmkv` added at top of file
- `export const coachStorage = new MMKV({ id: 'coach-storage' })` created at module scope
- `create()` callback refactored from arrow-returning-object to block-body to accommodate the IIFE initializer
- IIFE computes `initialTheme`: reads `coach:branding` key synchronously, JSON.parses, checks for `primary_color`, constructs overridden palette; falls back to `DEFAULT_THEME` on any error or missing data
- `theme: initialTheme` replaces `theme: DEFAULT_THEME` in the initial state
- `coachStorage` exported for Plans 03-02 (bootstrap hook write) and 03-03 (revoke delete)

### Cold-start guarantee
- MMKV read is synchronous and happens inside Zustand `create()` — before any React render
- Tab bar renders with coach primary color on frame 1 when `coach:branding` is in MMKV
- No React lifecycle, no useEffect, no async loading state needed for theme initialization

## Decisions Made

1. **Dedicated MMKV instance** — `new MMKV({ id: 'coach-storage' })` rather than reusing any shared instance. Provides clean namespace isolation for coach branding keys.
2. **IIFE pattern for initialTheme** — computes the initial value inline inside the store's block-body callback, keeping the logic co-located and avoiding module-level side-effects beyond the MMKV instance creation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm install required --legacy-peer-deps**
- **Found during:** Task 1
- **Issue:** `npm install` failed with peer dependency conflict: `react-native-mmkv@3.3.3` declares `peerDependencies: { "react-native": "*" }` but npm's strict resolver flagged it as incompatible with the workspace's `^0.81.5` constraint.
- **Fix:** Ran `npm install --legacy-peer-deps`. This is safe — `react-native@0.81.5` satisfies `react-native@"*"`. The conflict is a false positive from npm's strict resolver behavior with monorepo workspace version ranges.
- **Files modified:** package-lock.json
- **Commit:** 720d0e4

## Known Stubs

None — this plan has no UI rendering. The MMKV key `coach:branding` is written by Plan 03-02; on cold start before 03-02 runs, the store falls back to DEFAULT_THEME as designed.

## Important Notes

**A new EAS build is required for the MMKV native module to work on device.**

`react-native-mmkv` is a native module that uses JSI (JavaScript Interface) for synchronous access. The Expo Go app and existing builds do NOT include the MMKV native binary. A fresh EAS build must be triggered for iOS and/or Android before testing on a physical device or simulator. Development builds created with `eas build --profile development` or `npx expo run:android` / `npx expo run:ios` from source will also work.

TypeScript compiles cleanly with zero errors in `packages/plugin-sdk/src/theme.ts`.

## Self-Check: PASSED

- [x] `packages/plugin-sdk/src/theme.ts` modified — MMKV import, coachStorage export, initialTheme IIFE present
- [x] `apps/mobile/package.json` — react-native-mmkv ^3.0.0 in dependencies
- [x] `packages/plugin-sdk/package.json` — react-native-mmkv ^3.0.0 in peerDependencies
- [x] `node_modules/react-native-mmkv/package.json` exists — installed
- [x] TypeScript compilation: zero errors
- [x] Commit 720d0e4 exists and contains all 4 changed files
