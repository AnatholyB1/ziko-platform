# Phase 20: Activity Earn Hooks - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Completing any of the six tracked fitness activities automatically awards AI credits with no risk of double-crediting on mobile retry. Earn hooks live in two places: inside 5 existing backend tool executors (server-side, fire-and-forget) and in 6 mobile-side locations via a new `POST /credits/earn` HTTP endpoint (for direct-Supabase write screens). Workout has no tool executor — mobile is its only earn path.

</domain>

<decisions>
## Implementation Decisions

### Habit Earn Granularity (EARN-02)
- **D-01:** Each individual habit tick fires one earn call — per habit completion, not once-per-day. The daily cap (DAILY_EARN_CAP = 4) handles overcounting. Motivates every action, consistent with how habits_log works (per-habit row).
- **D-02:** Idempotency key for habits: `habit_${habitId}_${date}` — deterministic, requires no extra SELECT, unique per habit per day. Works for both the tool executor path and the mobile screen path.

### Tool Executor Earn Placement
- **D-03:** `earnCredits()` is called **directly inside** each mutating tool executor after a successful insert — no HTTP round-trip. Pattern: `earnCredits(userId, source, idempotencyKey).catch(() => {})` (void, fire-and-forget). A DB error in earnCredits MUST NOT throw; underlying activity save must succeed regardless (SC-3).
- **D-04:** Five executors to modify: `habits_log`, `nutrition_log_meal`, `measurements_log`, `stretching_log_session`, `cardio_log_session`. Each already returns the inserted record — the record UUID becomes the idempotency key (except habits: D-02 pattern).
- **D-05:** Source strings used in `ai_credit_transactions`: `'habit'`, `'meal'`, `'measurement'`, `'stretch'`, `'cardio'`. These are the server-side sources.

### POST /credits/earn Endpoint (Mobile-Side Path)
- **D-06:** Add `POST /credits/earn` to `backend/api/src/routes/credits.ts`. Auth required (same `authMiddleware` pattern). Body: `{ source: string, idempotency_key: string }`. Response: `{ credited: boolean }` with 200 always (earn failure is silent to mobile — activity already saved).
- **D-07:** Endpoint calls `creditService.earnCredits(userId, source, idempotencyKey)` — same function used by tool executors. No new DB logic needed.
- **D-08:** Mobile-side source strings: `'workout'`, `'habit'`, `'meal'`, `'measurement'`, `'stretch'`, `'cardio'` — same values as server-side for consistent DB reads.

### Workout Earn Path (EARN-01)
- **D-09:** `workoutStore.ts:endSession()` — after the Supabase `workout_sessions` UPDATE succeeds, fire `POST /credits/earn` with `source='workout'`, `idempotency_key=currentSession.id`. The session UUID is available as `currentSession.id` before the state is cleared.
- **D-10:** The earn call is fire-and-forget from mobile: non-blocking, no UI feedback at this layer. Phase 21 handles the earn toast (EARN-08).

### Six Mobile Screens to Patch (SC-4)
- **D-11:** After each successful direct-Supabase write, call `POST /credits/earn` with the appropriate source and idempotency key:
  - `apps/mobile/src/stores/workoutStore.ts:endSession()` — source='workout', key=`currentSession.id`
  - `plugins/habits/src/screens/HabitsDashboardScreen.tsx` — source='habit', key=`habit_${habitId}_${date}`
  - `plugins/nutrition/src/screens/LogMealScreen.tsx` — source='meal', key=returned insert `id`
  - `plugins/measurements/src/screens/MeasurementsLog.tsx` — source='measurement', key=returned insert `id`
  - `plugins/stretching/src/screens/StretchingSession.tsx` — source='stretch', key=returned insert `id`
  - `plugins/cardio/src/screens/CardioTracker.tsx` — source='cardio', key=returned insert `id`

### Dual-Path Earn (Tool Executor + Mobile Screen)
- **D-12:** AI chat calling `nutrition_log_meal` creates a NEW `nutrition_logs` row → earns via executor. User logging a meal manually via `LogMealScreen` creates a DIFFERENT row → earns via mobile POST. These are genuinely separate activities with distinct record UUIDs. No double-credit — each earn is for a real, distinct data entry.

### Claude's Discretion
- Exact try/catch pattern inside tool executors for fire-and-forget earn (void vs `.catch`)
- Whether to extract a shared `callCreditsEarn(source, key)` helper on the mobile side or inline per screen
- HTTP client used from mobile for POST /credits/earn (fetch with Authorization header from current session)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Credit Service (Phase 18)
- `backend/api/src/services/creditService.ts` — `earnCredits(userId, source, idempotencyKey): Promise<{ credited: boolean }>`. Returns immediately; never throws. Full implementation including daily cap check and idempotency ON CONFLICT.
- `backend/api/src/config/credits.ts` — `EARN_AMOUNT`, `DAILY_EARN_CAP`, source type definitions.

### Credits Router (Phase 19 — add POST /earn here)
- `backend/api/src/routes/credits.ts` — Only `GET /balance` exists. `POST /earn` must be added in this phase.
- `backend/api/src/app.ts` — Route mounting (`app.route('/credits', creditsRouter)` already present).

### Tool Executors to Modify (Server-Side)
- `backend/api/src/tools/habits.ts` — `habits_log` function. Insert returns `{ success, habit_name, value, date }` — add earn after upsert.
- `backend/api/src/tools/nutrition.ts` — `nutrition_log_meal`. Insert returns `{ success, entry: { id, food_name, calories } }` — use `entry.id` as idempotency key.
- `backend/api/src/tools/measurements.ts` — `measurements_log`. Insert returns `{ success, measurement: { id, date, weight_kg, body_fat_pct } }` — use `measurement.id`.
- `backend/api/src/tools/stretching.ts` — `stretching_log_session`. Insert returns `{ success, session: { id, routine_name, duration_sec, date } }` — use `session.id`.
- `backend/api/src/tools/cardio.ts` — `cardio_log_session`. Insert returns `{ success, session: { id, activity_type, duration_min, distance_km, date } }` — use `session.id`.

### Mobile Screens to Modify (Client-Side)
- `apps/mobile/src/stores/workoutStore.ts` — `endSession()` at L136. Uses `currentSession.id` (session UUID) as idempotency key.
- `plugins/habits/src/screens/HabitsDashboardScreen.tsx` — Habit toggle at L403–L528. Uses `habit_${habitId}_${date}` as idempotency key.
- `plugins/nutrition/src/screens/LogMealScreen.tsx` — Insert at L102. Returns `id` from `.select('id, food_name, calories').single()`.
- `plugins/measurements/src/screens/MeasurementsLog.tsx` — Insert at L53. Returns `id` from `.select('id, date, weight_kg, body_fat_pct').single()`.
- `plugins/stretching/src/screens/StretchingSession.tsx` — Insert at L55. Returns `id` from insert.
- `plugins/cardio/src/screens/CardioTracker.tsx` — Insert at L197. Returns `id` from `.select('id, activity_type, ...')`.

### Database Foundation
- `supabase/migrations/026_ai_credits.sql` — `ai_credit_transactions` table with partial unique index on `(user_id, source, idempotency_key WHERE idempotency_key IS NOT NULL)`. ON CONFLICT returns code 23505 — creditService handles this silently.

### Requirements
- `.planning/REQUIREMENTS.md` — EARN-01 through EARN-06 (activity earn), EARN-10 (idempotency).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `creditService.earnCredits(userId, source, key)`: fully implemented, idempotent, daily-cap enforced — call it directly from tool executors, no wrapper needed.
- `authMiddleware`: already on all routes under `/credits/*` — POST /earn endpoint needs no extra auth setup.
- `clientForUser(userToken)` pattern in all tool files: tool executors already have `userId` in their signature — no userId lookup needed.

### Established Patterns
- Fire-and-forget in tool executors: same pattern as `updateConversationTitle` in `ai.ts` — start promise, don't await, swallow errors.
- Mobile API calls with auth: `LogMealScreen.tsx L175` already reads `supabase.auth.getSession()` for the token — same pattern for POST /credits/earn.
- Upsert returning ID: Supabase `.upsert(...).select('id').single()` returns the existing or new row's UUID — add `.select('id')` to the habits upsert if needed, or use the deterministic string key (D-02).

### Integration Points
- `credits.ts` router: add `router.post('/earn', ...)` after existing `router.get('/balance', ...)`.
- `workoutStore.endSession()` L136: `currentSession.id` is safe to read before `set({ currentSession: null })` clears state.
- Habit toggle in `HabitsDashboardScreen.tsx`: multiple paths at L403, L425, L447, L468, L510, L528 all upsert `habit_logs` — each must fire earn with the per-habit key.

</code_context>

<specifics>
## Specific Ideas

- "Fire-and-forget" is the canonical phrase for the earn call pattern — earn failure must never block the activity save (SC-3)
- Idempotency key convention: record UUID for most activities; `habit_${habitId}_${date}` for habits (no UUID returned from upsert without extra SELECT)
- The 402 earn hint in `creditService.getQuotaStatus()` already lists all 6 earn activities — no new hint logic needed in this phase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 20-activity-earn-hooks*
*Context gathered: 2026-04-06*
