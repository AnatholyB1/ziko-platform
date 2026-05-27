# Phase 2: Action-triggered Push Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 2-action-triggered-push
**Areas discussed:** Event hook points, 2-min delay strategy, Hook placement for PUSH-01/02, Push copy + deep links

---

## Event Hook Points

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase DB webhook → Hono | Supabase fires POST to Hono when workout_sessions updated with ended_at, or user_xp updated. Follows existing webhooks.ts pattern. | ✓ |
| Mobile explicitly calls Hono | Mobile POSTs to a Hono endpoint after writing to Supabase. Simpler but adds a second network round-trip and relies on client to fire. | |

**User's choice:** Supabase DB webhook → Hono

---

| Option | Description | Selected |
|--------|-------------|----------|
| user_xp table (level-up trigger) | Fire on UPDATE to user_xp when new level > old level. Threshold check in Hono handler. | ✓ |
| Researcher confirms table | Let researcher find the exact gamification table. | |

**User's choice:** user_xp table

---

| Option | Description | Selected |
|--------|-------------|----------|
| Compare old vs new level in webhook payload | Check if record.level > old_record.level. No extra DB query. | ✓ |
| Handler re-queries user_xp | Extra DB roundtrip but safer if webhook payload format changes. | |

**User's choice:** Compare old vs new level in webhook payload

---

## 2-Min Delay Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| waitUntil + setTimeout(120s) | Hono returns 200 immediately; waitUntil keeps function alive for 2-min sleep. Requires Vercel Pro (300s max — 120s fits). No extra schema or cron. | ✓ |
| Scheduled notification_log row + micro-cron | Insert scheduled row; new 1-min cron fires it. More robust but adds schema change + new cron. | |
| Mobile-side delayed POST | Mobile waits 2 min client-side then calls Hono. Relies on app staying foreground. | |

**User's choice:** waitUntil + setTimeout(120s)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Re-query workout_sessions at send time | After 2-min sleep, check if active session exists (ended_at IS NULL) before sending. Handles edge case of immediate new session. | ✓ |
| Trust the webhook payload only | If webhook fired with ended_at set, assume session is done. Skip re-query. Misses edge case. | |

**User's choice:** Re-query workout_sessions at send time

---

## Hook Placement for PUSH-01/02

| Option | Description | Selected |
|--------|-------------|----------|
| Fire-and-forget with waitUntil | Route returns 200 after DB write; send runs in background. Push failure never blocks API response. Consistent with 2-min delay approach. | ✓ |
| Await inline | Await notificationService.send() before returning. Simpler but adds ~200-500ms latency; push errors propagate. | |
| You decide | Planner picks the pattern. | |

**User's choice:** Fire-and-forget with waitUntil

---

| Option | Description | Selected |
|--------|-------------|----------|
| Both sends in same waitUntil | One waitUntil block fires both athlete + coach sends using link row from redeemInvitation. No extra DB queries. | ✓ |
| Researcher confirms returned shape | Let researcher verify coach_id is in the redeemInvitation payload. | |

**User's choice:** Both sends in same waitUntil

---

## Push Copy + Deep Links

| Option | Description | Selected |
|--------|-------------|----------|
| French, motivational sport tone | Short, punchy, emoji. Matches app voice. | ✓ |
| French, neutral informational | Clear and factual, no emoji. | |

**User's choice:** French, motivational sport tone

---

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmed deep-link paths | PUSH-01/02 athlete → /(app)/coach; PUSH-02 coach → /(app)/clients; PUSH-03 → /(app)/workout-history; PUSH-04 → /(app)/(plugins)/gamification/dashboard | ✓ |
| Different paths | Custom deep-link targets. | |

**User's choice:** Confirmed paths as proposed

---

## Claude's Discretion

None — all gray areas had explicit user choices.

## Deferred Ideas

None — discussion stayed within phase scope.
