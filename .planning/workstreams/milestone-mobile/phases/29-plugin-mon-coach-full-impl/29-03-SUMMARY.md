---
phase: 29-plugin-mon-coach-full-impl
plan: 03
subsystem: ui
tags: [react-native, tanstack-query, supabase, date-fns, coach-plugin, expo-router]

requires:
  - phase: 29-01
    provides: CoachScreen stub, i18n keys, manifest, plugin-sdk types

provides:
  - Full 3-state CoachScreen implementation (State A: code entry, State B: preview, State C: linked)
  - ConfirmRevocationModal with typed COACH confirmation gate
  - TanStack Query integration for link status + parallel stats queries
  - Pull-to-refresh, loading spinner, inline error states

affects:
  - 29-04 (settings.tsx coach section — reads link status from same query key)
  - Any phase that tests coach UX flows

tech-stack:
  added: []
  patterns:
    - TanStack Query useQuery in plugin screens (first usage in plugin layer)
    - Parallel stats queries enabled only when link is active
    - Custom Modal + controlled TextInput for destructive confirmation (not showAlert)
    - staleTime: 30_000 on queries with signed URLs (5-min TTL safety)

key-files:
  created: []
  modified:
    - plugins/coach/src/screens/CoachScreen.tsx
    - plugins/coach/tsconfig.json

key-decisions:
  - "Single t('coach.state_a.error') key for ALL /preview error codes — no branching on error_code (T-29-05 mitigated)"
  - "ConfirmRevocationModal uses custom Modal+TextInput (not showAlert) — only way to collect typed confirmation"
  - "staleTime: 30_000 on all 3 queries to keep signed avatar URL fresh within 5-min TTL"
  - "tsconfig include paths added for authStore.ts + supabase.ts — required for cross-workspace type resolution"
  - "Parallel stats queries (sessions + habits%) are best-effort: show '--' on null/error, never throw"

patterns-established:
  - "Plugin screen with TanStack Query: import from @tanstack/react-query, not from plugin-sdk"
  - "Auth token pattern: const { data: { session } } = await supabase.auth.getSession(); headers: Authorization: Bearer token"
  - "useAuthStore from relative path ../../../../apps/mobile/src/stores/authStore"
  - "Inline style objects only — no StyleSheet.create"

requirements-completed:
  - COACH-06
  - COACH-07
  - COACH-08
  - COACH-09
  - COACH-12
  - COACH-14

duration: 15min
completed: 2026-05-20
---

# Phase 29 Plan 03: CoachScreen Full Implementation Summary

**Full 3-state athlete-side coach screen: code entry with charset filter, preview card with KYC badge, linked card with date-fns stats row, and typed-confirmation revocation modal — all via TanStack Query with 30s staleTime**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-20T00:00:00Z
- **Completed:** 2026-05-20T00:15:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Replaced the 13-line Wave 0 stub with a 650-line production implementation
- State A: TextInput filtered to `[A-Z2-9]` only, submit CTA disabled below 6 chars, single i18n error key for all error codes
- State B: Coach preview card with avatar (Image or Ionicons fallback), display_name, specialties chips, bio, KYC badge (verified only), confirm/cancel CTAs
- State C: Linked coach card with date-fns formatted link date, parallel sessions count + habits% stats queries (both `'--'` on null/error), revoke trigger
- ConfirmRevocationModal: centered Modal, controlled TextInput, confirm enabled ONLY when `revokeInput.trim() === 'COACH'`, DELETE on confirm
- All 3 TanStack Query calls with `staleTime: 30_000` (signed URL TTL safety — T-29-08 mitigated)
- Pull-to-refresh wired to `refetch()`, `paddingBottom: 100` on ScrollView, all icons via Ionicons
- Zero `Alert.react-native` usage, zero `StyleSheet.create` usage

## Task Commits

1. **Task 1: Full CoachScreen implementation — 3 states, modal, stats** - `d147d26` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `plugins/coach/src/screens/CoachScreen.tsx` — Full production implementation replacing Wave 0 stub (650 lines)
- `plugins/coach/tsconfig.json` — Added `authStore.ts` and `supabase.ts` to include paths for cross-workspace type resolution

## Decisions Made

- Single `t('coach.state_a.error')` key for ALL `/preview` error codes — no branching on `error_code` or HTTP status (T-29-05 mitigated per threat model)
- `ConfirmRevocationModal` uses custom `Modal` + controlled `TextInput` instead of `showAlert` — `showAlert` does not support text input collection
- `staleTime: 30_000` on all 3 queries — keeps signed `photo_signed_url` fresh within 5-min TTL window (T-29-08 mitigated)
- Stats queries are best-effort: parallel `useQuery` calls, both show `'--'` on null/error, never propagate errors to UI

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsconfig include paths added for cross-workspace imports**
- **Found during:** Task 1, TypeScript type-check run
- **Issue:** `plugins/coach/tsconfig.json` only had `"include": ["src"]` — importing `authStore.ts` from `../../../../apps/mobile/src/stores/authStore` caused TS6307 errors because those files were outside the listed include paths
- **Fix:** Added `../../apps/mobile/src/stores/authStore.ts` and `../../apps/mobile/src/lib/supabase.ts` to the `include` array, matching the pattern used in `plugins/habits/tsconfig.json` (which includes `creditStore.ts`)
- **Files modified:** `plugins/coach/tsconfig.json`
- **Verification:** `@ziko/plugin-coach:type-check` passes; pre-existing `mobile:type-check` failure in `chat.tsx` confirmed pre-existing (existed without my changes)
- **Committed in:** `d147d26` (same task commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking tsconfig issue)
**Impact on plan:** Essential fix for TypeScript compilation. No scope creep.

## Issues Encountered

- Pre-existing TypeScript error in `apps/mobile/app/(app)/ai/chat.tsx:357` (`textAlign` on ViewStyle) — confirmed pre-existing via stash test, not caused by this plan's changes.

## Known Stubs

None — CoachScreen is fully wired. All 3 states render real data from the API and Supabase direct queries. No placeholder text, no hardcoded empty values in data paths.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced beyond what the threat model already covers.

## Self-Check

**Files exist:**
- `plugins/coach/src/screens/CoachScreen.tsx` — FOUND (650 lines)
- `plugins/coach/tsconfig.json` — FOUND (updated)

**Commits exist:**
- `d147d26` — FOUND (feat(29-03): implement full 3-state CoachScreen with revocation modal)

**Acceptance criteria:**
- `Alert.alert` matches: 0 — PASS
- `StyleSheet` matches: 0 — PASS
- `paddingBottom: 100` matches: 1 — PASS
- `staleTime: 30_000` matches: 3 (one per query) — PASS
- `coach.state_a.error` matches: 1 — PASS
- `revokeInput.trim() === 'COACH'` matches: 2 (disabled check + color logic) — PASS
- `/coach/clients/links/me` matches: 1 — PASS
- `/coach/clients/links/preview` matches: 1 — PASS
- `/coach/clients/links/redeem` matches: 1 — PASS
- `DELETE` matches: 1 — PASS
- Min lines (200): 650 — PASS

## Self-Check: PASSED

## Next Phase Readiness

- CoachScreen fully implemented — ready for Phase 29-04 (settings.tsx coach section integration)
- TanStack query key `['coach-link', user?.id]` established — settings.tsx can use a parallel query with key `['coach-link-settings', profile?.id]`
- All COACH-06/07/08/09/12/14 requirements satisfied

---
*Phase: 29-plugin-mon-coach-full-impl*
*Completed: 2026-05-20*
