---
phase: 02-trigger-engine
plan: "03"
subsystem: backend/webhooks
tags: [webhook, trigger, after_n_sessions, workout_sessions, forms]
dependency_graph:
  requires:
    - 02-01  # create_form_instances_for_trigger SECURITY DEFINER function (migration 058)
    - 02-02  # after_program_assigned trigger handler
  provides:
    - after_n_sessions trigger fires on workout_sessions INSERT via Supabase webhook
  affects:
    - backend/api/src/routes/webhooks.ts
tech_stack:
  added: []
  patterns:
    - Supabase webhook handler branch for table-specific INSERT events
    - Coach resolution via coach_client_links before RPC call
    - Idempotent trigger via ON CONFLICT DO NOTHING in SECURITY DEFINER function
key_files:
  modified:
    - backend/api/src/routes/webhooks.ts
decisions:
  - Session count includes current INSERT (count at trigger time = post-insert count); matches trigger_config.n intent
  - programId null case counts all sessions for athlete across all programs (free sessions still count)
  - On missing coach link, handler returns immediately with { received: true } — no error, no retry
metrics:
  duration: "10 min"
  completed: "2026-05-26"
  tasks_completed: 1
  files_modified: 1
---

# Phase 02 Plan 03: workout_sessions INSERT Webhook for after-N-sessions Trigger Summary

**One-liner:** Supabase webhook handler extended to fire `after_n_sessions` form trigger when an athlete logs a new workout session, resolving their coach via `coach_client_links` and counting sessions before calling the `create_form_instances_for_trigger` RPC.

## What Was Built

Extended the existing `POST /webhooks/supabase` handler in `backend/api/src/routes/webhooks.ts` with a new `else if` branch for `table === 'workout_sessions' && type === 'INSERT'`.

### Handler Logic

1. Extract `athleteId` (`record.user_id`) and `programId` (`record.program_id`) from the webhook payload
2. Guard: if `athleteId` is null, log a warning and return `{ received: true }` immediately
3. Query `coach_client_links` to find the athlete's active coach (`revoked_at IS NULL`, `.maybeSingle()`)
4. If no active coach link, return `{ received: true }` — no trigger applicable
5. Count total `workout_sessions` rows for the athlete, filtered by `program_id` if non-null
6. Call `adminClient.rpc('create_form_instances_for_trigger', { p_trigger_type: 'after_n_sessions', p_athlete_id, p_coach_id, p_n_sessions: sessionCount })`
7. Log RPC result or warn on error; never throw
8. Entire branch wrapped in try/catch; handler always returns `{ received: true }` — Supabase never retries on a 200

## Verification Results

- `grep -n "after_n_sessions" backend/api/src/routes/webhooks.ts` — 4 matches (comment, p_trigger_type, two console lines)
- `grep -n "workout_sessions" backend/api/src/routes/webhooks.ts` — 5 matches (branch condition, warn, from(), countErr warn, catch)
- `tsc --noEmit -p backend/api/tsconfig.json` — zero errors
- Existing `user_profiles` INSERT branch unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-02-08 | Mitigated | X-Webhook-Secret enforced by existing middleware; `user_id` validated non-null before any DB call |
| T-02-09 | Mitigated | ON CONFLICT DO NOTHING in SECURITY DEFINER function prevents duplicate pending instances on webhook retry |
| T-02-10 | Mitigated | All error paths return `{ received: true }` — no non-200 response ever sent to Supabase |

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | workout_sessions INSERT webhook branch | `4417f27` |

## Self-Check: PASSED

- `backend/api/src/routes/webhooks.ts` — exists and contains both `after_n_sessions` and `workout_sessions` patterns
- Commit `4417f27` confirmed in git log
