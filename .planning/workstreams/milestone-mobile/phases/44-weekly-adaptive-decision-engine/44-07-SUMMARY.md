---
phase: 44-weekly-adaptive-decision-engine
plan: 07
subsystem: ui
tags: [expo, react-native, i18n, tanstack-query, reanimated, weekly-review]

# Dependency graph
requires:
  - phase: 44-weekly-adaptive-decision-engine (plan 44-05)
    provides: "GET /coaching-engine/review-check backend route, bare auth, { ok: true } immediate response, background review run"
provides:
  - "coach.weeklyReview.headline/body/cta i18n namespace (fr + en)"
  - "WeeklyReviewRevealOverlay component: fire-once dark reveal Modal reusing Phase 43's CelebrationOverlay tokens"
  - "useCoachingEngineBootstrap(): app-open lazy trigger for the weekly review due-check, mounted in apps/mobile/app/(app)/_layout.tsx"
affects: [44-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling bootstrap hook pattern: useCoachingEngineBootstrap copies useBrandingBootstrap's useQuery shape 1:1 (staleTime 30_000, enabled on userId, no useEffect, result unused) for lazy on-app-open triggers with no client-side loading/retry semantics"
    - "Modal-based full-screen overlay mounted as a Tabs sibling in (app)/_layout.tsx, following the PendingFormsOverlay precedent, so it renders above the tab bar from any tab"

key-files:
  created:
    - apps/mobile/src/components/WeeklyReviewRevealOverlay.tsx
  modified:
    - packages/plugin-sdk/src/i18n.ts
    - apps/mobile/app/(app)/_layout.tsx

key-decisions:
  - "Followed the plan's appStorage marker approach exactly, even though the plan's read_first note calls it an MMKV instance — the actual apps/mobile/src/lib/storage.ts appStorage wraps AsyncStorage, not react-native-mmkv. Used the real module (appStorage from ../lib/storage) since it is the exact object useAIDailyTip already uses for its per-key cache idiom; behavior (async get/set persisted marker) matches the plan's intent."
  - "Seen-marker state loads asynchronously on mount; isVisible only evaluates true once the marker read resolves (seenMarker !== undefined), avoiding a flash-render of the overlay before the stored marker is known"

requirements-completed: [D-01, D-03]

duration: ~35min
completed: 2026-09-03
---

# Phase 44 Plan 07: Weekly Review App-Open Trigger + In-App Reveal Summary

**Lazy `GET /coaching-engine/review-check` fired on every authenticated app open via a `useBrandingBootstrap`-shaped hook, paired with a fire-once dark `Modal` reveal overlay (Ionicons `sparkles` badge, Phase 43 `CelebrationOverlay` tokens reused verbatim) announcing the athlete's new weekly focus.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-03T21:43:18Z
- **Tasks:** 2/2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `coach.weeklyReview.headline` / `.body` / `.cta` added to both `fr` and `en` dictionaries in `packages/plugin-sdk/src/i18n.ts`, exact strings from 44-UI-SPEC.md's Copywriting Contract, using the existing `t(key, params)` `{token}` interpolation mechanism
- `WeeklyReviewRevealOverlay.tsx`: a `Modal` (`presentationStyle="fullScreen"`, `statusBarTranslucent`, `onRequestClose` bound to the CTA's dismiss handler) reproducing `CelebrationOverlay`'s dark-exception visual treatment token-for-token — `#1C1A17` background, `rgba(255,92,26,0.25)` radial glow, `FadeInUp.springify().damping(12)` badge (76×76, `#FF5C1A`, `sparkles` glyph instead of `checkmark`), `#FFFAF6` headline, `rgba(255,250,246,0.70)` subcopy, `#FF5C1A`/white CTA — gated by a fire-once `appStorage` marker (`weekly_review_seen`) compared against `athlete_state.last_review_at`, visible only when `last_review_at` is non-null, `current_focus_summary` is non-empty, and the marker differs (Grounding rule — no render on pending/failed review data)
- `useCoachingEngineBootstrap()` added to `apps/mobile/app/(app)/_layout.tsx`, copying `useBrandingBootstrap`'s shape: `useQuery` keyed `['coaching-engine-review-check', userId]`, `staleTime: 30_000`, `enabled: !!userId`, fetching `GET /coaching-engine/review-check` with a bearer token and consuming no result — D-01's "every app open" trigger, including foreground-after-backgrounding
- `WeeklyReviewRevealOverlay` mounted as a `Tabs` sibling immediately after `<PendingFormsOverlay />`, outside `<Tabs>`, so the reveal can fire from any tab

## Task Commits

1. **Task 1: coach.weeklyReview i18n keys + WeeklyReviewRevealOverlay component** - `8de951a2` (feat)
2. **Task 2: useCoachingEngineBootstrap lazy trigger + overlay mount in the app layout** - `32218442` (feat)

**Plan metadata:** (this SUMMARY.md commit, see below)

## Files Created/Modified

- `apps/mobile/src/components/WeeklyReviewRevealOverlay.tsx` - New fire-once dark reveal `Modal` overlay for the completed weekly review, reusing Phase 43's `CelebrationOverlay` composition
- `packages/plugin-sdk/src/i18n.ts` - Added `coach.weeklyReview.headline`/`.body`/`.cta` to both `fr` and `en` dictionaries
- `apps/mobile/app/(app)/_layout.tsx` - Added `useCoachingEngineBootstrap()` hook (definition + call site) and mounted `<WeeklyReviewRevealOverlay />` as a `Tabs` sibling

## Decisions Made

- Used the real `appStorage` (AsyncStorage-backed, from `apps/mobile/src/lib/storage.ts`) for the fire-once marker rather than a literal MMKV instance, since that is the actual module `useAIDailyTip` uses for its per-key cache idiom that the plan pointed to as precedent — the plan's own read_first reference resolves to this file, so this is a naming inaccuracy in the plan text, not a deviation in behavior.
- Query `athlete_state` filtered on `.eq('user_id', userId)` — confirmed against `supabase/migrations/20260831120000_athlete_state.sql`, whose primary key column is `user_id` and whose only RLS policy is `athlete_state_select_own` (`auth.uid() = user_id`, SELECT-only).

## Deviations from Plan

None - plan executed exactly as written. (The `appStorage`-vs-MMKV note above is a documentation clarification, not a functional deviation — the plan's own interfaces block pointed at the exact file used.)

## Issues Encountered

None. `npx tsc --noEmit -p apps/mobile/tsconfig.json` reports zero errors mentioning either touched/created file; the six pre-existing errors in the workspace (`app/(app)/profile/settings.tsx`, `src/hooks/useNotificationSetup.ts`, both about `NotificationPermissionsStatus` typing) are unrelated to this plan's files and out of scope per the deviation rules' scope boundary. `npm run lint` in `apps/mobile` is a no-op (`echo 'lint: no eslint config, skipped'`) — no eslint config exists for this workspace, so lint verification could not surface anything beyond the tsc check.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Structural/type verification is complete for both the overlay component and the layout wiring: all acceptance-criteria greps from the plan (i18n key count, `presentationStyle`, `statusBarTranslucent`, `onRequestClose`, `sparkles`/no `checkmark`, exact hex/rgba tokens, no `StyleSheet.create`, no `paddingBottom: 100`, no `useThemeStore`, no trajectory-branch copy, no `Alert.alert`, hook call-site count, `staleTime` count, overlay mount position relative to `<PendingFormsOverlay />` and outside `<Tabs>`) pass.
- **Device verification is explicitly deferred to plan 44-08's human checkpoint** — this environment has no simulator/device to confirm the overlay renders and animates as expected on-device, that the app-open trigger actually fires the backend route end-to-end, or that the fire-once gate behaves correctly across real app-open/backgrounding cycles. Plan 44-08 should include this as part of its checkpoint verification steps.
- No blockers for 44-08.

---
*Phase: 44-weekly-adaptive-decision-engine*
*Completed: 2026-09-03*
