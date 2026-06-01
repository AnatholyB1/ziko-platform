---
phase: "04"
plan: "04-01"
subsystem: "formulaire-condi / mobile overlay"
tags: ["mobile", "forms", "overlay", "tanstack-query", "animated"]
dependency_graph:
  requires: []
  provides:
    - "PendingFormsOverlay component (shell with fetch gate + fade animations)"
    - "forms/types.ts shared type definitions"
    - "_layout.tsx extended with AppState pending-forms invalidation"
  affects:
    - "apps/mobile/app/(app)/_layout.tsx"
tech_stack:
  added: []
  patterns:
    - "useQuery with staleTime: 0 for always-fresh blocking gate"
    - "Animated.spring fade-in (tension:60/friction:9) + Animated.timing 300ms fade-out"
    - "Modal animationType='none' — opacity controlled by Animated.View, not Modal"
key_files:
  created:
    - "apps/mobile/src/components/forms/types.ts"
    - "apps/mobile/src/components/PendingFormsOverlay.tsx"
  modified:
    - "apps/mobile/app/(app)/_layout.tsx"
decisions:
  - "useThemeStore imported from '../stores/themeStore' (local re-export of @ziko/plugin-sdk) — consistent with _layout.tsx pattern"
  - "fadeAnim initialized at 0 (starts invisible) — spring fires when localForms.length > 0"
  - "dismissOverlay resets fadeAnim.setValue(0) after timing completes to allow re-entry"
  - "FormAnswer type imported but not yet used in this plan — exported for Plan 04-02 consumption"
metrics:
  duration: "~15 min"
  completed: "2026-05-28"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 04 Plan 01: PendingFormsOverlay Shell + Layout Integration Summary

**One-liner:** Full-screen blocking overlay shell with TanStack Query fetch gate (staleTime:0), Animated.spring fade-in, and AppState foreground invalidation wired into root layout.

## What Was Implemented

### Task 1: forms/types.ts + PendingFormsOverlay.tsx

Created `apps/mobile/src/components/forms/types.ts` with three exported interfaces:
- `PendingForm` — instance_id, form_id, form_title, question_count, questions
- `FormQuestion` — id, type ('text'|'scale'|'yes_no'|'choice'), label, choices?
- `FormAnswer` — question_id, value (string|number)

Created `apps/mobile/src/components/PendingFormsOverlay.tsx` — named export `PendingFormsOverlay`:
- `useQuery` with `queryKey: ['pending-forms', userId]`, `staleTime: 0`, `enabled: !!userId` — fetches `/athlete/forms/pending` with Bearer token from `supabase.auth.getSession()`
- `useEffect` on `data?.forms` — populates `localForms` when forms > 0 and overlay not yet showing (D-01 optimistic rendering)
- Fade-in: `Animated.spring(fadeAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true })` fires when `localForms.length > 0`
- `dismissOverlay`: `Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true })` + callback clears state and resets `fadeAnim` to 0
- `Modal`: `animationType="none"`, `presentationStyle="fullScreen"`, `statusBarTranslucent`
- Root `Animated.View`: `opacity: fadeAnim`, `backgroundColor: theme.background`
- Orange accent strip: `height: 4`, `backgroundColor: theme.primary`
- Placeholder: centered `Text "Formulaire {currentFormIndex + 1} / {localForms.length}"` — replaced in Plan 04-02/04-03
- Zero `StyleSheet` usage — inline style objects throughout

### Task 2: _layout.tsx integration

Three targeted edits to `apps/mobile/app/(app)/_layout.tsx`:
1. Import `PendingFormsOverlay` from `../../src/components/PendingFormsOverlay`
2. AppState `'active'` handler extended: `queryClient.invalidateQueries({ queryKey: ['pending-forms', userId] })` after existing `syncUnreadCount` call (D-02)
3. JSX fragment: `<PendingFormsOverlay />` added after `<NotificationPermissionModal ... />`

## Verification Results

TypeScript check (`rtk tsc --noEmit --project apps/mobile/tsconfig.json`):
- 0 errors in `PendingFormsOverlay.tsx`
- 0 errors in `_layout.tsx`
- 11 pre-existing errors in plugin dashboard files (unrelated — missing plugin module declarations, pre-date this plan)

Additional checks:
- `grep "StyleSheet" PendingFormsOverlay.tsx` → NOT FOUND (correct — no StyleSheet)
- `grep "PendingFormsOverlay" _layout.tsx` → import line 17 + JSX line 234 (both present)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- Placeholder `Text "Formulaire {N} / {total}"` in PendingFormsOverlay — intentional. Plan 04-02 replaces this with the actual question renderer (entry header + question views per formView state machine).
- `FormAnswer` type exported but not consumed in this plan — intentional. Plan 04-02 wires answer state.
- `dismissOverlay` function defined but not called from any UI element — intentional. Plan 04-03 calls it after last form submit.
- `formView` state ('header'|'questions') declared but not used to branch rendering — intentional. Plan 04-02 implements the branch.

## Threat Flags

None — no new network endpoints or auth paths beyond what the plan specified (single GET fetch with existing Bearer token pattern).

## Self-Check: PASSED

- `apps/mobile/src/components/forms/types.ts` — EXISTS
- `apps/mobile/src/components/PendingFormsOverlay.tsx` — EXISTS
- `apps/mobile/app/(app)/_layout.tsx` — MODIFIED (import + AppState + JSX)
- Commit `32446e4` — contains all 3 files (verified via `git show HEAD --name-only`)
