# Phase 2: Action-triggered Push Notifications - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the four highest-value server-side push events (PUSH-01 through PUSH-04) into the `notificationService.ts` already built in Phase 1, proving the full Hono → Expo Push Service → device pipeline.

**In scope:** program assignment push, invitation-accepted push (bidirectional), post-session summary push (~2min delay), level-up/badge push (collapsed), Supabase webhook endpoint for session-end and level-up events, all four hooks integrated into existing Hono routes or new webhook handlers.

**Not in scope:** in-app notification center data (Phase 3), cron/scheduled notifications (Phase 4), preferences UI (Phase 5), local reminders (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Event Hook Points (PUSH-03 + PUSH-04)
- **D-01:** PUSH-03 (workout session end) and PUSH-04 (level-up) are triggered by **Supabase Database Webhooks → Hono**. The mobile app writes workout_sessions and user_xp directly to Supabase; Supabase fires a webhook POST to a Hono endpoint for each. Follows the existing `webhooks.ts` pattern already in the codebase.
- **D-02:** PUSH-03 webhook fires on `workout_sessions` UPDATE where `ended_at` transitions from NULL to a timestamp.
- **D-03:** PUSH-04 webhook fires on `user_xp` UPDATE. Level-up is detected by comparing `old_record.level` vs `record.level` in the Supabase webhook payload — no extra DB re-query needed. If `record.level > old_record.level`, a level-up push is sent.

### 2-Min Delay for PUSH-03
- **D-04:** Delay implemented using **`waitUntil` + `setTimeout(120_000)`** from `@vercel/functions`. The webhook handler returns 200 immediately after receiving the event; the 2-min sleep + push send run in the background via `waitUntil`. Vercel Pro max timeout is 300s — 120s fits comfortably.
- **D-05:** After the 2-min sleep, the handler **re-queries `workout_sessions`** to check if the user has an active session (`ended_at IS NULL`) before calling `notificationService.send()`. If a new session is already in progress, the push is suppressed silently. This handles the edge case of a user immediately starting a new session.

### Hook Placement for PUSH-01 + PUSH-02
- **D-06:** Both PUSH-01 (`POST /coach/programs/:id/assign`) and PUSH-02 (`POST /coach/clients/links/redeem`) use **fire-and-forget via `waitUntil`**: the route returns 200 immediately after the DB write succeeds, and `notificationService.send()` runs in the background. Push failures never block or error the API response.
- **D-07:** PUSH-02 is bidirectional — both athlete AND coach receive a push. Both sends happen in the **same `waitUntil` block**, using the link row returned by `redeemInvitation` (which contains both `user_id` for athlete and `coach_id`). No extra DB queries needed.

### Push Copy + Deep Links
- **D-08:** All push copy in **French, motivational sport tone** — short, punchy, athlete-first, with emoji where appropriate. Matches existing app voice.
- **D-09:** Deep-link paths (written to `data.url`, routed by Expo Router on tap):

  | Event | data.url |
  |-------|----------|
  | PUSH-01: Program assigned (athlete) | `/(app)/coach` |
  | PUSH-02: Invitation accepted (athlete) | `/(app)/coach` |
  | PUSH-02: Invitation accepted (coach) | `/(app)/clients` |
  | PUSH-03: Post-session summary (athlete) | `/(app)/workout-history` |
  | PUSH-04: Level-up / badge (athlete) | `/(app)/(plugins)/gamification/dashboard` |

- **D-10:** Suggested French copy per event (researcher/planner can refine wording):
  - PUSH-01: title: `"Nouveau programme 💪"`, body: `"Ton coach t'a assigné un nouveau programme. Commence maintenant !"`
  - PUSH-02 athlete: title: `"Invitation acceptée ✅"`, body: `"Tu es maintenant connecté à ton coach."`
  - PUSH-02 coach: title: `"Nouvel athlète 🎉"`, body: `"[Athlete name] a rejoint ta liste de clients."`
  - PUSH-03: title: `"Séance terminée 🔥"`, body: `"Belle performance ! Regarde ton résumé."`
  - PUSH-04: title: `"Niveau supérieur ! 🏆"`, body: `"Tu viens de passer au niveau [N]. Continue comme ça !"`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/workstreams/notification-mobile/REQUIREMENTS.md` — Phase 2 requirements: PUSH-01, PUSH-02, PUSH-03, PUSH-04
- `.planning/workstreams/notification-mobile/ROADMAP.md` — Phase 2 goal, success criteria, and dependency map

### Phase 1 Context (carry-forward decisions)
- `.planning/workstreams/notification-mobile/phases/01-infrastructure-configuration/01-CONTEXT.md` — All Phase 1 decisions locked: notificationService.ts signature, idempotency_key, admin client pattern, quiet hours, notification_log schema

### Research
- `.planning/workstreams/notification-mobile/research/SUMMARY.md` — Full research: architecture decisions, open questions (Vercel plan tier, Supabase webhook setup, active session suppression approach)

### Existing Code to Read Before Implementing
- `backend/api/src/services/notificationService.ts` — Fully implemented: `notificationService.send(payload)` and `NotificationPayload` interface. Phase 2 only calls this — no changes to it.
- `backend/api/src/routes/notifications.ts` — Existing token registration routes; new webhook/push routes added here or in a new file.
- `backend/api/src/routes/webhooks.ts` — Existing Supabase webhook endpoint pattern — extend or mirror for PUSH-03/PUSH-04 webhook handlers.
- `backend/api/src/coach/programs/service.ts` — `POST /:id/assign` route — add waitUntil push call after `assignProgram` succeeds (line ~245).
- `backend/api/src/coach/clients/service.ts` — `POST /links/redeem` route — add waitUntil push calls after `redeemInvitation` succeeds (line ~113).
- `backend/api/src/middleware/auth.ts` — Hono auth middleware pattern (for the new webhook endpoint — needs WEBHOOK_SECRET guard, not authMiddleware).

### Schema Reference
- `supabase/migrations/054_notification_schema.sql` (or check migration list) — `notification_tokens`, `notification_log`, `notification_preferences` tables. Phase 2 adds no new migrations — it uses Phase 1's schema.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/api/src/services/notificationService.ts` — The entire send pipeline is built and ready. Phase 2 is purely wiring calls to it: `notificationService.send({ recipientUserId, category, type, title, body, data: { url }, idempotencyKey })`.
- `backend/api/src/routes/webhooks.ts` — Pattern: check `X-Webhook-Secret` header, parse `{ type, table, record, old_record }`, handle by table/type. Copy for PUSH-03/PUSH-04 webhook handlers.
- `@vercel/functions` `waitUntil` — Used in the codebase already. Import `{ waitUntil }` for fire-and-forget async work.

### Established Patterns
- **waitUntil fire-and-forget** — Route returns 200 immediately, push runs async. Push failure never fails the API call.
- **WEBHOOK_SECRET header guard** — Supabase webhook endpoints are secured with `X-Webhook-Secret !== process.env.WEBHOOK_SECRET → 401`. Matches existing `webhooks.ts` guard.
- **idempotencyKey design** — Format: `{event_type}_{userId}_{entityId}` (e.g., `program_assign_{athleteId}_{programId}`, `session_summary_{userId}_{sessionId}`, `levelup_{userId}_{newLevel}`). The `notification_log` UNIQUE constraint on `idempotency_key` handles deduplication and PUSH-04 collapse (same key for same level = only one send).

### Integration Points
- `backend/api/src/coach/programs/service.ts` line ~245 (`POST /:id/assign`) — Add `waitUntil(sendProgramAssignedPush(...))` after `assignProgram` success. Must iterate over `result.assigned` client IDs (all get a push).
- `backend/api/src/coach/clients/service.ts` line ~113 (`POST /links/redeem`) — Add `waitUntil(sendInvitationAcceptedPushes(...))` after `redeemInvitation` success.
- `backend/api/src/routes/webhooks.ts` or new `routes/push-events.ts` — New handlers for `workout_sessions` UPDATE and `user_xp` UPDATE webhooks.
- Supabase Dashboard — Configure two new Database Webhooks: one on `workout_sessions` UPDATE (filter: `ended_at IS NOT NULL`), one on `user_xp` UPDATE. Both POST to Hono with WEBHOOK_SECRET.

</code_context>

<specifics>
## Specific Ideas

- **idempotency key for PUSH-04 collapse:** `levelup_{userId}_{newLevel}` — if multiple XP events fire in the same session and all trigger the same level, the second `notificationService.send()` call hits the `ON CONFLICT DO NOTHING` gate and is a no-op. Exactly one push delivered per level.
- **PUSH-03 active session guard:** After `setTimeout(120_000)`, query `workout_sessions WHERE user_id = $1 AND ended_at IS NULL LIMIT 1`. If row found → skip. Use Supabase admin client (same one used in `notificationService.ts`).
- **Webhook endpoint placement:** Can extend existing `webhooks.ts` router (add new cases) OR create a new `routes/push-events.ts`. Researcher/planner to pick the cleaner fit.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-action-triggered-push*
*Context gathered: 2026-05-27*
