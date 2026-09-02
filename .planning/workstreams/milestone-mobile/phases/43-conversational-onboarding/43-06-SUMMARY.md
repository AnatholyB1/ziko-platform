---
phase: 43-conversational-onboarding
plan: 06
subsystem: ui
tags: [expo-router, react-native, reanimated, supabase, i18n, onboarding]

# Dependency graph
requires:
  - phase: 43-conversational-onboarding
    provides: "plan 43-05 — ziko-chat.tsx screen shell, SSE streaming, mid-flow resume; mission SSE payload captured in missionState"
provides:
  - "apps/mobile/app/(auth)/onboarding/ziko-chat.tsx — mission card (module-level MICRO_ACTION_MAP, MissionCard component, ListFooterComponent rendering), checkMicroActionCompleted() real-data check, useFocusEffect re-poll, CelebrationOverlay (OBReady dark palette + FadeInUp verbatim), celebration CTA exit path (refreshProfile then router.replace)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level route/i18n-key/table map (MICRO_ACTION_MAP) shared by the CTA deep-link and the completion-check query, so the two can never drift apart"
    - "useFocusEffect(useCallback(...)) real-data re-poll on screen refocus — same shape as ai/index.tsx's credit-balance refetch-on-focus precedent"
    - "Device-local YYYY-MM-DD date (getLocalDateIso helper) for date-column filters, never a UTC toISOString() slice or a created_at timestamp range"
    - "Full-screen state overlay rendered via an early component return (if (celebrated) return <CelebrationOverlay .../>) rather than an absolutely-positioned layer"

key-files:
  created: []
  modified:
    - apps/mobile/app/(auth)/onboarding/ziko-chat.tsx

key-decisions:
  - "Mission card renders via FlatList's ListFooterComponent (not a modified MessageBubble/message-item union type) — functionally reads as the final assistant turn's content without a type refactor of the existing LocalMessage/displayMessages shape from plan 43-05"
  - "Unknown/unrecognized micro_action fallback's retry button reuses handleRetry() (resend the last turn) rather than a bespoke retry path — consistent with the file's one existing retry semantic"
  - "celebrated/celebrationError are separate booleans (not a single tri-state) — keeps the D-14 grounding invariant (celebrated only ever set inside the useFocusEffect query callback) structurally obvious at the call site"

patterns-established:
  - "Pattern: a completion/celebration flow's boolean state is set exclusively from an async query callback, never from a UI event handler — the event handler only triggers navigation, never state that gates a reward moment"

requirements-completed: [ONBOARD-03, ONBOARD-04, ONBOARD-05]

# Metrics
duration: ~14min
completed: 2026-09-02
---

# Phase 43 Plan 06: Mission Card, Real-Data Completion Check, and Celebration Summary

**Mission card (module-level MICRO_ACTION_MAP + FlatList ListFooterComponent), useFocusEffect-driven real-data completion check against hydration_logs/journal_entries/body_measurements, and a full-screen OBReady-style celebration overlay gating the exit to /(app) on a fresh refreshProfile() read.**

## Performance

- **Duration:** ~14 min (Tasks 1-2 execution); Task 3 was a blocking human-verify checkpoint held open across a session boundary awaiting real device verification, not counted as execution duration
- **Started:** 2026-09-01T21:15:56+02:00
- **Completed:** 2026-09-02
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 1

## Accomplishments
- `MICRO_ACTION_MAP` — single module-level constant mapping all three curated `micro_action` pool values (`hydration_log`, `journal_mood`, `measurements_weight`) to their route, i18n CTA key, and completion table — used by both the mission card's deep-link and the Task 2 completion check, so the two can never drift apart (T-43-28: route paths are hardcoded constants, never taken from the server-supplied mission payload)
- `MissionCard` renders via `FlatList`'s `ListFooterComponent` once the `mission` SSE event populates state — the server's raw `mission_title` verbatim (never templated), a static i18n'd CTA keyed off `micro_action`, and a defensive no-CTA/error-retry fallback for an unrecognized value. CTA uses `router.push` (never `replace`/`navigate`) so the chat stays mounted and regains focus on return
- `checkMicroActionCompleted(microAction, userId)` queries the mapped table with `.eq('date', todayIso)` where `todayIso` is the device's local calendar date (`getLocalDateIso()`, not a UTC `toISOString()` slice and never a `created_at` range) — grounds the celebration in a real logged row (D-14)
- `useFocusEffect(useCallback(...))` re-poll mirrors `ai/index.tsx`'s credit-balance refetch-on-focus precedent: runs only when a mission exists and the celebration hasn't fired, and sets `celebrated` exclusively from the query result — never from the CTA press handler. Tapping the CTA and returning without logging leaves the mission card visible with the CTA still tappable
- `CelebrationOverlay` reuses `OBReady`'s exact dark hex palette (`#1C1A17` background, `rgba(255,92,26,0.25)` glow, `#FF5C1A` 76×76 badge) and `FadeInUp.springify().damping(12)` entrance verbatim (D-15), rendered full-screen via an early `if (celebrated) return <CelebrationOverlay ... />`
- Celebration CTA exit path awaits `refreshProfile()` before `router.replace('/(app)')` — required because the `(auth)/_layout.tsx` gate checks `athleteOnboardingComplete`, and navigating first would bounce the athlete back into onboarding. If the flag is still false after the refresh, no navigation occurs and the shared `error.stream`/`error.retry` copy renders inline in the overlay instead
- Every `fontSize` in the file confirmed to remain one of 13/15/18/28 (the phase's locked typography scale)
- `npx tsc --noEmit` across the mobile workspace shows only the pre-existing, unrelated `NotificationPermissionsStatus` errors (present before any edit in this plan, per plan 43-05's summary) — zero new errors from `ziko-chat.tsx`
- Task 3 (blocking human-verify checkpoint): developer ran all 9 numbered verification steps against a live device/backend (brand-new account through steps 1-7, force-kill/relaunch resume, mission card, CTA-without-logging (no celebration), CTA-with-logging (celebration fires), celebration CTA to home tab with no re-entry into onboarding, English-locale repeat, and the `athlete_state`/`athlete_decisions` Supabase row check) and explicitly approved — all four acceptance criteria met

## Task Commits

Each task was committed atomically:

1. **Task 1: Render the mission card as the final assistant turn** - `1fa6e021` (feat)
2. **Task 2: Real-data completion check and full-screen celebration overlay** - `7b4f7053` (feat)
3. **Task 3: Human verification of the end-to-end Ziko flow** - checkpoint (gate="blocking"); developer ran all 9 steps live and approved; no code change, no commit for this task itself

## Files Created/Modified
- `apps/mobile/app/(auth)/onboarding/ziko-chat.tsx` - Added `MICRO_ACTION_MAP`, `MissionCard`, `getLocalDateIso`/`checkMicroActionCompleted`, `CelebrationOverlay`, `celebrated`/`celebrationError` state, the `useFocusEffect` completion re-poll, `handleMissionCta`, and `handleCelebrationCta`; wired the mission card into the `FlatList` via `ListFooterComponent` and the celebration overlay via an early return

## Decisions Made
- Mission card renders through `FlatList`'s `ListFooterComponent` rather than refactoring `LocalMessage`/`displayMessages` into a discriminated-union render item — achieves "final assistant turn's content" functionally (appears immediately after the last real bubble in the same scrollable list) without touching plan 43-05's existing message-list types
- Unknown-`micro_action` fallback's retry button reuses the file's existing `handleRetry()` (resend the last turn) rather than introducing a second retry code path
- `celebrated` and `celebrationError` kept as two separate booleans (not a tri-state enum) so the D-14 invariant — `celebrated` is set only inside the `useFocusEffect` query callback, never inside `handleCelebrationCta` — stays structurally obvious at each call site

## Deviations from Plan

None - plan executed exactly as written. All i18n keys (`missionEyebrow`, `mission.hydration/journal/measurements`, `celebrationHeadline/Body/Cta`, `error.stream/retry`), the three plugin routes, and the `date DATE NOT NULL DEFAULT CURRENT_DATE` column on all three target tables referenced by the plan already existed live in the codebase at this worktree's base commit.

## Issues Encountered
- Worktree HEAD was found behind the plan's required base commit (`ca1ad64e`, "docs(phase-43): update tracking after wave 3") at session start — corrected via `git reset --hard` to the required base per the worktree safety protocol before any task work began.
- `cd backend/api && npm run test` (the plan's overall phase-gate verification item) fails immediately in this worktree with `Missing required env var: SUPABASE_URL` — an environment-configuration gap (no `.env.test` populated in this isolated worktree), not a regression from this plan's changes, since no backend files were touched. Flagged to the developer at the Task 3 checkpoint rather than treated as a pass; not independently re-verified after approval since the developer's approval covered the live device flow, not this backend suite.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 43 (Conversational Onboarding) is functionally complete end-to-end: mandatory Ziko chat → AI-generated ≤4-question conversation → `assess_profile` write to `athlete_state` → mission card → real-data-verified celebration → release to `/(app)`, all human-verified live against a real device and backend.
- `MICRO_ACTION_MAP`'s three-entry shape (route + i18n key + completion table) is the established pattern for any future curated-action-pool feature that needs a deep-link-to-log-screen-then-verify flow.
- No blockers identified. The one open item is confirming `backend/api`'s test suite is green wherever `.env.test` is actually populated (not verifiable in this worktree) — flagged, not blocking, since it is a pre-existing environment gap unrelated to this plan's file.

---
*Phase: 43-conversational-onboarding*
*Completed: 2026-09-02*
