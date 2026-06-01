---
phase: 02-action-triggered-push
plan: "03"
subsystem: backend-notifications
tags: [push-notifications, webhooks, hono, supabase, gamification, workout]
dependency_graph:
  requires:
    - notification-mobile/01-02 # notificationService.ts
    - notification-mobile/01-01 # notification_log table + idempotency
  provides:
    - POST /push-events/supabase
    - PUSH-03 workout session summary push (2-min delayed)
    - PUSH-04 level-up push (immediate, idempotent)
  affects:
    - backend/api/src/app.ts
tech_stack:
  added: []
  patterns:
    - waitUntil (Vercel Functions) for background async work after immediate 200 response
    - Active session guard after 2-min delay to suppress stale push
    - Idempotency via idempotencyKey to collapse duplicate XP events at same level
key_files:
  created:
    - backend/api/src/routes/push-events.ts
  modified:
    - backend/api/src/app.ts
decisions:
  - "PUSH-03 uses waitUntil + setTimeout(120_000) so handler returns 200 before Supabase retries"
  - "PUSH-03 active session re-query uses SUPABASE_PUBLISHABLE_KEY (not SERVICE_KEY per CLAUDE.md)"
  - "PUSH-04 level-up detection purely from webhook payload comparison (D-03 — no extra DB query)"
  - "Both branches always return c.json({ received: true }) regardless of business logic path"
metrics:
  duration: "12 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 02 Plan 03: Push-Events Webhook Router Summary

Nouveau router Hono `push-events.ts` avec deux handlers Supabase DB webhook : PUSH-03 (résumé post-séance après 2 minutes de délai) et PUSH-04 (push level-up immédiat avec collapse par idempotency).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create push-events.ts with PUSH-03 and PUSH-04 handlers | a583df4 | backend/api/src/routes/push-events.ts |
| 2 | Mount pushEventsRouter at /push-events in app.ts | a583df4 | backend/api/src/app.ts |

## What Was Built

### push-events.ts

Router Hono exposant `POST /push-events/supabase` avec :

**PUSH-03 — Résumé post-séance**
- Condition : `workout_sessions` UPDATE où `old_record.ended_at === null` ET `record.ended_at` est une string non-nulle
- Pattern : `waitUntil((async () => { await setTimeout(120_000); ...check...; send() })())`
- Garde active session : après 2 min, requête `workout_sessions WHERE user_id = athleteId AND ended_at IS NULL` — si trouvée, suppression silencieuse
- Copie FR : "Séance terminée 🔥" / "Belle performance ! Regarde ton résumé."
- Deep link : `/(app)/workout-history`
- `idempotencyKey`: `session_summary_{athleteId}_{sessionId}`

**PUSH-04 — Level-up**
- Condition : `user_xp` UPDATE où `newLevel > oldLevel` (comparaison payload seul, sans DB query)
- Pattern : `waitUntil(notificationService.send(...))`  — immédiat, pas de délai
- Copie FR : "Niveau supérieur ! 🏆" / "Tu viens de passer au niveau N. Continue comme ça !"
- Deep link : `/(app)/(plugins)/gamification/dashboard`
- `idempotencyKey`: `levelup_{userId}_{newLevel}` — collapse des multiples événements XP au même niveau

**Sécurité**
- Guard X-Webhook-Secret : retourne 401 si header absent ou incorrect
- Le handler retourne toujours 200 immédiatement — tout le travail async est dans `waitUntil`

### app.ts

Import et mount ajoutés immédiatement après `webhooksRouter` :
```ts
import { pushEventsRouter } from './routes/push-events.js';
app.route('/push-events', pushEventsRouter);
```

## Deviations from Plan

None — plan executed exactly as written.

Note : `notificationService.ts` utilise encore `SUPABASE_SERVICE_KEY` en interne (hors scope de ce plan). Le client admin de `push-events.ts` utilise correctement `SUPABASE_PUBLISHABLE_KEY` comme spécifié.

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-02-03-01 Spoofing | Mitigated — X-Webhook-Secret guard present, returns 401 |
| T-02-03-02 Tampering | Mitigated — payload fields used only as filter inputs, not for DB writes |
| T-02-03-03 PUSH-03 duplicate | Mitigated — idempotencyKey `session_summary_*` prevents double-send on Supabase retry |
| T-02-03-04 PUSH-04 collapse | Mitigated — idempotencyKey `levelup_*` collapses same-level events |
| T-02-03-05 DoS risk | Accepted — one timeout per session-end, within Vercel Pro 300s budget |
| T-02-03-06 Info disclosure | Accepted — payload exposes user_id + level, not additional PII |
| T-02-03-SC @vercel/functions | Verified — `"@vercel/functions": "^3.6.0"` already in package.json |

## Self-Check: PASSED

- [x] `backend/api/src/routes/push-events.ts` exists
- [x] `backend/api/src/app.ts` contains `pushEventsRouter` import and route mount
- [x] Commit `a583df4` exists in git log
- [x] `rtk tsc --noEmit` exits 0
- [x] All grep verifications passed (X-Webhook-Secret, setTimeout, session_summary_, levelup_, Séance terminée, Niveau supérieur, SUPABASE_PUBLISHABLE_KEY, maybeSingle)
