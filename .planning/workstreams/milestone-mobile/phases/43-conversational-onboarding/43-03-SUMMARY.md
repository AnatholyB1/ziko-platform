---
phase: 43-conversational-onboarding
plan: 03
subsystem: api
tags: [hono, ai-sdk-v6, sse, supabase, onboarding, vitest]

# Dependency graph
requires:
  - phase: 43-conversational-onboarding
    provides: "plan 43-01 — assessProfileSchema, assess_profile executor, MICRO_ACTION_POOL, ONBOARDING_MAX_STEPS, getToolExecutor('assess_profile') registration outside allToolSchemas"
provides:
  - "POST /ai/onboarding/stream — uncredited, single-tool, locale-aware onboarding turn, mounted under /ai in app.ts"
  - "getOrCreateConversation() extended with a 4th optional pluginContext parameter and a widened return shape (pluginContext, userId) in both the create and load-existing branches"
  - "buildOnboardingSystemPrompt(locale) — fixed Ziko identity/voice, 3 required signal categories, curated micro-action constraint"
  - "Ownership + plugin_context tag gate (T-43-10) rejecting a foreign or untagged conversation_id with 403 conversation_forbidden before any model call"
  - "SSE mission/cap_reached/error event contract for the onboarding turn"
affects: [43-04-retroactive-path, 43-05-mobile-ziko-chat-screen, 43-06-mission-card]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Narrowed one-tool streamText surface built inline in the route (not buildSDKTools/allToolSchemas) — only assess_profile is ever exposed to this turn"
    - "Conversation record as locale source of truth: plugin_context.locale set once at creation, read back on every subsequent turn instead of trusting a per-request body field"
    - "assessProfileObserved boolean tracks whether the terminal tool-result (success or failure shape) was ever seen on the stream, gating a cap_reached SSE event so a step-cap timeout is never silently treated as a completed onboarding"

key-files:
  created:
    - backend/api/src/routes/onboarding.ts
    - backend/api/test/routes/onboarding.spec.ts
  modified:
    - backend/api/src/context/conversation.ts
    - backend/api/src/app.ts

key-decisions:
  - "getOrCreateConversation's 4th parameter and widened return shape are strictly additive — no reordering, no new required parameter, no changed create-branch default — so all 4 existing routes/ai.ts call sites and the 1 coach/dashboards/service.ts call site continue to type-check and behave unchanged"
  - "The onboarding route builds its own inline single-key tools object and its own local token-usage logger, deliberately never importing buildSDKTools/allToolSchemas/creditCheck/creditDeduct from routes/ai.ts — the omission of the credit-gating pair is commented at the router declaration as deliberate and load-bearing, not an oversight"
  - "Ownership + tag gate runs only when a conversation_id was actually supplied by the client; a fresh conversation (no conversation_id) skips the gate since the just-created row is trivially owned and tagged by construction"

patterns-established:
  - "Pattern: for a mandatory, no-skip system flow with a per-user AI cost, mount it as a dedicated route file with its own narrowed tool surface, never as a conditional branch inside an existing credit-gated route"

requirements-completed: [ONBOARD-01, ONBOARD-02, ONBOARD-03]

# Metrics
duration: ~40min
completed: 2026-09-01
---

# Phase 43 Plan 03: Onboarding Stream Route Summary

**POST /ai/onboarding/stream — a credit-exempt, single-tool, locale-locked-to-the-conversation-record onboarding turn, wired through an ownership+tag gate on getOrCreateConversation's newly widened return shape.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `getOrCreateConversation` gained a 4th optional `pluginContext` parameter and now returns `pluginContext`/`userId` in both branches, reading the parent `ai_conversations` row in parallel with messages on load and throwing a `conversation_not_found`-labeled error when it's missing — strictly additive, verified against every existing call site
- `POST /ai/onboarding/stream` created and mounted under `/ai` in `app.ts`: no credit middleware (commented as deliberate), a narrowed one-tool (`assess_profile`) surface, a 403 `conversation_forbidden` ownership+tag gate before any model call, and an SSE contract emitting `meta`/`chunk`/`mission`/`cap_reached`/`error`/`[DONE]`
- `buildOnboardingSystemPrompt(locale)` fixes Ziko's identity (separate from the persona plugin), voice (playful, tutoiement, no emoji/slang), the three required signal categories, the terminal `assess_profile` condition, and the 3-item curated micro-action constraint
- 13-test route-level spec (`test/routes/onboarding.spec.ts`) covers credit exemption, the auth gate, both ownership/tag-mismatch 403 cases, the exact `['assess_profile']` tools key set, the `stopWhen` array shape, the English/French + 3-category + no-emoji system-prompt contract, and the mission/error/cap_reached SSE paths — no live DB, no real Anthropic call, no conditional skip guard
- Regression-verified: plan 43-01's `test/tools/onboarding.spec.ts` (9 tests) still passes unchanged; `npx tsc --noEmit` exits 0 across the whole backend workspace

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend getOrCreateConversation with plugin_context tagging and readback** - `a8ec9fdb` (feat)
2. **Task 2: Create the uncredited onboarding stream route** - `c559e3c0` (feat)
3. **Task 3: Route-level spec for credit exemption, tool scoping, and the ownership gate** - `cfd686d7` (test)

_No TDD test→feat split commits: Task 3's spec was written and verified in one commit per plan convention for this task type (`tdd="true"` in the plan applied to writing the spec against the already-built route, not a red/green cycle)._

## Files Created/Modified
- `backend/api/src/context/conversation.ts` - Added the optional 4th `pluginContext` parameter; widened both branches' return shape to include `pluginContext`/`userId`; parallel parent-row read + `conversation_not_found` guard on load
- `backend/api/src/routes/onboarding.ts` - New: `onboardingRouter`, `buildOnboardingSystemPrompt`, the ownership+tag gate, the narrowed one-tool `streamText` call, the SSE loop with `mission`/`cap_reached`/`error` events, and a local token-usage logger
- `backend/api/src/app.ts` - Imported `onboardingRouter` and mounted it via `app.route('/ai', onboardingRouter)` immediately after the existing `aiRouter` mount
- `backend/api/test/routes/onboarding.spec.ts` - New: 13-test unit spec, mocks `context/conversation.js`, `middleware/auth.js`, `ai`, and `@supabase/supabase-js`

## Decisions Made
- Reused the exact `clientForUser`/service-key `createClient` pattern from `routes/ai.ts` for the local `ai_cost_log` writer in `onboarding.ts`, rather than importing `routes/ai.ts`'s private (unexported) `logTokenUsage` — kept the two routes fully decoupled per the research's "dedicated route, not a conditional branch" recommendation.
- The ownership+tag gate is skipped entirely when no `conversation_id` is supplied (fresh conversation) — the newly-created row is owned and tagged by construction in that path, so re-checking it would be redundant, not defense-in-depth.
- Created a local, gitignored `backend/api/.env.test` with dummy placeholder values (this worktree started from a clean base commit that predates plan 43-01's local, uncommitted copy) so `test/setup.ts`'s env-presence check passes without live Supabase credentials — no test in this plan touches a real database.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `isStepCount` does not exist in the installed `ai` package — used `stepCountIs` instead**
- **Found during:** Task 2 (creating the onboarding route) — `npx tsc --noEmit` failed with `error TS2724: '"ai"' has no exported member named 'isStepCount'. Did you mean 'stepCountIs'?`
- **Issue:** The plan's action text and the research/patterns docs both referenced `isStepCount` from the `ai` v6 SDK, but the actually-installed package (confirmed via direct read of `node_modules/ai/dist/index.d.ts`) exports the same composable stop-condition under the name `stepCountIs` — the exact function `/ai/chat/stream` already imports and uses in `routes/ai.ts` (`stopWhen: stepCountIs(5)`).
- **Fix:** Imported and used `stepCountIs(ONBOARDING_MAX_STEPS)` in place of the plan's `isStepCount(ONBOARDING_MAX_STEPS)`. Identical composable `stopWhen` behavior — an array of `[stepCountIs(ONBOARDING_MAX_STEPS), hasToolCall('assess_profile')]` — no functional change to the intended cap/terminal-tool-call semantics.
- **Files modified:** `backend/api/src/routes/onboarding.ts`
- **Verification:** `npx tsc --noEmit` exits 0; the Task 3 spec directly asserts the `stopWhen` array shape (mocking `stepCountIs`/`hasToolCall` with identifiable markers) and passes.
- **Committed in:** `c559e3c0` (Task 2 commit) and `cfd686d7` (Task 3 spec asserting the corrected name)

---

**Total deviations:** 1 auto-fixed (1 blocking — incorrect import name)
**Impact on plan:** Naming-only correction against the actually-installed SDK; the composable `stopWhen` cap-and-terminal-tool-call semantics the plan specified are unchanged. No scope creep.

## Issues Encountered
- Worktree HEAD was found one commit behind the wave's required base (`4dff4d4f`, "docs(phase-43): update tracking after wave 1") at session start — corrected via `git reset --hard` to the required base per the worktree safety protocol before any task work began.
- This worktree's `backend/api/.env.test` (a local, gitignored file plan 43-01's summary notes it created) was absent after the base reset — recreated with the same dummy-placeholder pattern documented in that summary so `npx vitest run` could execute without live Supabase credentials.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `POST /ai/onboarding/stream` is live and mountable-tested; plan 43-05 (mobile Ziko chat screen) can point its SSE client at this endpoint and expect the documented `meta`/`chunk`/`mission`/`cap_reached`/`error`/`[DONE]` event contract.
- `getOrCreateConversation`'s widened return shape (`pluginContext`, `userId`) is available to any future caller needing conversation ownership/tag metadata without a second query.
- No blockers identified for 43-04 (retroactive path) or 43-06 (mission card) — both consume shapes already locked by plan 43-01 and unchanged by this plan.

---
*Phase: 43-conversational-onboarding*
*Completed: 2026-09-01*
