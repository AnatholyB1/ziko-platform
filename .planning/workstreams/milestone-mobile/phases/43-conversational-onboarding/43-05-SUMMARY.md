---
phase: 43-conversational-onboarding
plan: 05
subsystem: ui
tags: [expo-router, react-native, sse, xhr, supabase, i18n, onboarding]

# Dependency graph
requires:
  - phase: 43-conversational-onboarding
    provides: "plan 43-02 — coach.onboarding.* i18n keys (fr+en), useI18nStore/useTranslation"
  - phase: 43-conversational-onboarding
    provides: "plan 43-03 — POST /ai/onboarding/stream (meta/chunk/mission/cap_reached/error/[DONE] SSE contract), getOrCreateConversation's plugin_context tagging"
provides:
  - "apps/mobile/app/(auth)/onboarding/ziko-chat.tsx — the Ziko chat screen: header, FlatList bubble list, input row, SSE streaming, mid-flow resume"
  - "ziko-chat registered in the gesture-disabled onboarding Stack (_layout.tsx)"
  - "step-7.tsx's handleFinish now routes to /(auth)/onboarding/ziko-chat instead of /(app)"
affects: [43-06-mission-card-and-celebration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local XHR + onprogress SSE reader duplicated per-screen (not AIBridge, which hardcodes /chat/stream) for a route with a different, uncredited contract"
    - "conversationId tracked in a ref (not React state) since it drives network calls, never a re-render"
    - "mountedRef guard around every state-setting XHR callback, paired with xhr.abort() in the unmount cleanup"

key-files:
  created:
    - apps/mobile/app/(auth)/onboarding/ziko-chat.tsx
  modified:
    - apps/mobile/app/(auth)/onboarding/_layout.tsx
    - apps/mobile/app/(auth)/onboarding/step-7.tsx

key-decisions:
  - "renderMarkdown's heading branch trimmed from ai/index.tsx's 3-size (18/16/15) precedent to 2 sizes (18/15) — the mid-tier 16px has no row in 43-UI-SPEC.md's locked 13/15/18/28 typography scale"
  - "Mission-card UI is explicitly NOT rendered in this plan — Task 3 only stores the mission payload in state and hides the input row, per the plan's own scope line ('mission card... deliberately out of scope here'); the visual card is plan 43-06"
  - "Resume-on-mount kicks off the opening turn only when loaded history is empty; any non-empty history (regardless of last message's role) is rendered as-is and the screen waits for the athlete — literal reading of the plan's point 3/4 wording, since the plan does not specify a 'last message is user' edge case"
  - "cap_reached's force-finish instruction text is a small hardcoded fr/en string (not a t() key) sent as the athlete's next chat turn — it is conversational content sent to the model, not static UI chrome, so it does not belong in the coach.onboarding.* i18n namespace alongside the button label it's triggered from"

patterns-established:
  - "Pattern: a screen with its own narrow SSE contract implements its own local XHR reader rather than extending a shared bridge class scoped to a different route"

requirements-completed: [ONBOARD-01, ONBOARD-02]

# Metrics
duration: ~35min
completed: 2026-09-01
---

# Phase 43 Plan 05: Ziko Chat Screen Summary

**New mandatory Ziko chat screen wired between step-7 and /(app): locked UI-SPEC header/bubble/input shell, local XHR+SSE reader against /ai/onboarding/stream, and resume-on-mount against the athlete's existing ziko_onboarding conversation.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `_layout.tsx` registers `ziko-chat` inside the existing gesture-disabled onboarding `Stack` (no back-swipe escape, T-43-21); `step-7.tsx`'s `handleFinish` now routes to `/(auth)/onboarding/ziko-chat` instead of `/(app)`, with the `onboarding_done` upsert, `preloadMandatory()` call, and `refreshProfile()` await left untouched
- New `ziko-chat.tsx` implements 43-UI-SPEC.md's locked contract: 36×36 `happy-outline` avatar header (D-08, visually distinct from the ongoing coach's `sparkles` icon), assistant/user bubble styling reused from `ai/index.tsx` (D-05) with heading sizes trimmed to the phase's 13/15/18/28 typography scale, and an uncredited input row (no `CREDIT_COSTS`, no community/friends affordances)
- Local XHR + `onprogress` SSE reader (mirroring `packages/ai-client/src/AIBridge.ts`'s buffer/split/`data: ` parse loop, not extending it) posts to `/ai/onboarding/stream` with the live Supabase bearer token, `X-Conversation-Id`, and the resolved fr/en locale from `useI18nStore` on every turn
- Resume-on-mount (D-04): queries `ai_conversations` for the athlete's most recent `plugin_context->>type = 'ziko_onboarding'` row, hydrates `ai_messages` when found (waits for the athlete's answer, never re-issues an opening turn), or kicks off the opening turn with `messages: []` when history is empty
- All six SSE event forms handled: `meta` (conversation id tracked in a ref for subsequent turns/relaunch resume), `chunk` (streaming bubble), `mission` (stored in state, input hidden — card UI is 43-06), `cap_reached` (capReached copy + force-finish resend), `error` (stream copy + retry resending the exact last turn), and non-2xx/403 responses (same error state, never a blank screen, T-43-23/D-14 preserved — no client-side auto-navigation to `/(app)` on any of these paths)
- Guards against double-send while `isStreaming`, aborts any in-flight XHR on unmount via a `mountedRef` + `xhrRef.current?.abort()` pair
- `npx tsc --noEmit` across the mobile workspace shows only the pre-existing, unrelated `NotificationPermissionsStatus` errors in `settings.tsx`/`useNotificationSetup.ts` (confirmed present before any edit in this plan) — zero new errors from any of the three touched files

## Task Commits

Each task was committed atomically:

1. **Task 1: Register ziko-chat in the mandatory stack and redirect step-7** - `35bba4b0` (feat)
2. **Task 2: Build the Ziko chat screen shell — header, bubble list, input row** - `0f3abe8e` (feat)
3. **Task 3: Wire SSE streaming and mid-flow resume** - `1665d254` (feat)

## Files Created/Modified
- `apps/mobile/app/(auth)/onboarding/_layout.tsx` - Added `<Stack.Screen name="ziko-chat" />` after `step-7`; `screenOptions.gestureEnabled: false` untouched
- `apps/mobile/app/(auth)/onboarding/step-7.tsx` - `handleFinish`'s final navigation changed from `router.replace('/(app)')` to `router.replace('/(auth)/onboarding/ziko-chat')`, with an explanatory comment
- `apps/mobile/app/(auth)/onboarding/ziko-chat.tsx` - New: the full Ziko chat screen (header, `MarkdownText`/`renderMarkdown`/`MessageBubble` reused from `ai/index.tsx`, input row, local SSE network layer, resume-on-mount)

## Decisions Made
- Trimmed `renderMarkdown`'s heading sizing from `ai/index.tsx`'s original 3-tier (18/16/15) to 2-tier (18/15) — the 16px mid-tier has no row in the locked typography scale, and this plan's acceptance criteria explicitly gate on every `fontSize` in the file being one of 13/15/18/28
- Kept `conversationId` in a `useRef` rather than `useState` — it is read only inside network-layer closures (request headers, resume checks) and never rendered, so a ref avoids an unnecessary re-render on every `meta` event
- Did not render any mission-card UI in this plan (storing the payload and hiding the input row is explicitly sufficient per the plan's task text and the phase objective's "mission card... is plan 43-06" scope line)
- Wrote the cap-reached "force finish" turn as a small hardcoded fr/en instruction string rather than adding a new i18n key — it is content sent as the athlete's own next chat message (conversational content, not static UI chrome), so it does not belong in the `coach.onboarding.*` static-chrome namespace per D-11's boundary

## Deviations from Plan

None - plan executed exactly as written. All i18n keys, the SSE route, and the resume query shape referenced by the plan already existed live in the codebase from plans 43-02/43-03/43-04 at this worktree's base commit.

## Issues Encountered
- Worktree HEAD was found behind the wave's required base commit (`fb5b0591`, "docs(phase-43): update tracking after wave 2") at session start — corrected via `git reset --hard` to the required base per the worktree safety protocol before any task work began.
- Task 2's automated i18n-key-count check (`grep -c` over 5 required `coach.onboarding.*` patterns) initially returned 4 instead of 5 because the streaming/idle status line's `thinking`/`online` keys shared one source line — reformatted the ternary onto separate lines so each key's line is independently matched; no behavior change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ziko-chat.tsx` is live and reachable from step-7's completion CTA; the `mission` SSE event is captured in `missionState` and the input row hides itself once a mission arrives, ready for plan 43-06 to render the actual mission card and the full-screen celebration overlay from that same state.
- `conversationIdRef`/resume-on-mount already establish the pattern 43-06 will build on for its own `useFocusEffect` re-poll against the target log table (D-14).
- No blockers identified for 43-06.

---
*Phase: 43-conversational-onboarding*
*Completed: 2026-09-01*
