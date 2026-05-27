---
phase: 02-action-triggered-push
plan: "02"
subsystem: backend/notifications
tags: [push-notifications, coach, invitation, bidirectional, waitUntil]
dependency_graph:
  requires:
    - 02-01-SUMMARY.md (notificationService.send() infrastructure)
  provides:
    - PUSH-02: bidirectional invitation-accepted push (athlete + coach)
  affects:
    - backend/api/src/coach/clients/service.ts
tech_stack:
  added: []
  patterns:
    - waitUntil fire-and-forget (Vercel Functions)
    - Promise.allSettled for concurrent dual push sends
    - user_profiles name lookup with fallback
key_files:
  modified:
    - backend/api/src/coach/clients/service.ts
decisions:
  - D-06: fire-and-forget via waitUntil — route returns 200 after DB write, push runs in background
  - D-07: bidirectional — athlete AND coach both receive a push in a single waitUntil block
  - D-08: French copy, motivational sport tone
  - D-09: athlete deep link /(app)/coach; coach deep link /(app)/clients
  - D-10: athlete title "Invitation acceptée ✅"; coach title "Nouvel athlète 🎉"
metrics:
  duration: "10 minutes"
  completed_date: "2026-05-27"
  tasks_completed: 1
  files_modified: 1
---

# Phase 02 Plan 02: PUSH-02 Bidirectional Invitation Accepted Push Summary

Bidirectional push notification wired into POST /coach/clients/links/redeem — athlete and coach both notified when an invitation is redeemed, using a single waitUntil block with athlete name resolved from user_profiles.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PUSH-02 bidirectional waitUntil block | ac2c4ae | backend/api/src/coach/clients/service.ts |

## What Was Built

### PUSH-02 Bidirectional Push (backend/api/src/coach/clients/service.ts)

Added inside the `if (result.ok === true)` block of the POST `/coach/clients/links/redeem` handler:

- Import `waitUntil` from `@vercel/functions`
- Import `notificationService` from `../../services/notificationService.js`
- A `waitUntil` block that:
  1. Queries `user_profiles.name` via `adminClient` (existing instance, no second client) to resolve the athlete's display name — fallback to `'Un athlète'` if null
  2. Calls `Promise.allSettled([...])` with two concurrent `notificationService.send()` calls:
     - **Athlete push**: `invitation_accepted`, title "Invitation acceptée ✅", body "Tu es maintenant connecté à ton coach.", deep link `/(app)/coach`, idempotency key `invitation_accepted_athlete_{athleteId}_{linkId}`
     - **Coach push**: `invitation_accepted_coach`, title "Nouvel athlète 🎉", body `{athleteName} a rejoint ta liste de clients.`, deep link `/(app)/clients`, idempotency key `invitation_accepted_coach_{coachId}_{linkId}`

The `return c.json(result)` remains outside the `if` block — route returns 200 immediately, push fires in the background.

## Deviations from Plan

None — plan executed exactly as written.

The plan correctly anticipated that `LinkRow` does not contain an athlete name field (confirmed: `LinkRow = { id, coach_id, client_id, created_at }`), so a single `adminClient` query to `user_profiles` was added as specified.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-02-02-01 | athleteId = `c.get('auth').userId` (JWT-sourced, not from request body); coachId = `result.link.coach_id` (DB record) |
| T-02-02-02 | Two distinct idempotency keys scoped to linkId prevent duplicate sends |

## Self-Check: PASSED

- [x] `backend/api/src/coach/clients/service.ts` exists and contains all required changes
- [x] Commit `ac2c4ae` exists: `feat(notifications): PUSH-02 invitation accepted bidirectional push`
- [x] `import { waitUntil } from '@vercel/functions'` present
- [x] `import { notificationService } from '../../services/notificationService.js'` present
- [x] `waitUntil(...)` call present inside `if (result.ok === true)` block
- [x] `return c.json(result)` outside the `if` block (line 173)
- [x] `rtk tsc --noEmit` exits 0
