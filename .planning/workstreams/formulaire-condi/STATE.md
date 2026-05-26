---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: Formulaires Conditionnels
status: in_progress
last_updated: "2026-05-26"
last_activity: 2026-05-26
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 6
  completed_plans: 2
  percent: 20
---

# Project State

## Current Position

Phase: 02 — Trigger Engine
Plan: —
Status: Phase 02 planned — ready to execute
Last activity: 2026-05-26 — Phase 02 planned (4 plans in 2 waves)

## Progress

**Phases Complete:** 1/5
**Current Plan:** N/A

```
[██████░░░░░░░░░░░░░░░░░░░░░░░░] 20%
```

## Phase Summary

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 01. DB Schema & Backend API | Forms, instances, responses in DB + Hono CRUD routes | FORM-01,02,04,05,06 · TRIGGER-05 | ✅ Complete |
| 02. Trigger Engine | 4 trigger types create pending instances; duplicate guard | TRIGGER-01–05 | 🗂 Planned (4 plans) |
| 03. Coach Form Builder (Web) | Coach builds, edits, publishes, and lists forms from CRM | FORM-01–06 | Not started |
| 04. Athlete Blocking Overlay (Mobile) | Pending forms block app; athlete submits sequentially | MOBILE-01–05 | Not started |
| 05. Response Viewer & Claude Injection | Coach reads submissions; Claude gets last 5 as context | RESPONSES-01–03 · CLAUDE-01–02 | Not started |

## Accumulated Context

### Key Decisions
- Blocking overlay is absolute — athlete cannot dismiss or skip (explicit product decision, per Out of Scope)
- Duplicate guard prevents second pending instance if one already exists for (form, athlete) pair
- Phase 01 and Phase 03 share FORM requirements; Phase 01 covers DB/API layer, Phase 03 covers observable web UI

### Architecture Notes
- DB tables: `coach_forms` (JSONB questions + trigger_config), `form_instances` (pending/submitted), `form_responses` (answers JSONB) — no separate form_questions table
- Trigger engine: SECURITY DEFINER Postgres function `create_form_instances_for_trigger` (migration 058) — called via `supabase.rpc()` from all 4 hooks; ON CONFLICT DO NOTHING handles duplicate guard
- TRIGGER-01 hook: `backend/api/src/coach/clients/service.ts` POST /links/redeem → after redeemInvitation succeeds
- TRIGGER-02 hook: `backend/api/src/routes/webhooks.ts` → workout_sessions INSERT event
- TRIGGER-03 hook: Vercel cron `/forms/cron/trigger-fixed-date` (daily 6am) added to vercel.json
- TRIGGER-04: `POST /forms/coach/forms/:id/send` route in forms.ts
- Claude injection point: `backend/api/src/context/user.ts` — `fetchUserContext()` extended with last 5 form responses
- Web UI: `apps/web/src/app/(coach)/clients/[id]/` — new "Formulaires" tab + form builder page
- Mobile: blocking overlay rendered at root layout level in `apps/mobile/app/(app)/_layout.tsx`

### Blockers
None currently.

## Session Continuity

**Stopped At:** Phase 02 planning complete
**Resume File:** `.planning/workstreams/formulaire-condi/STATE.md`
**Next Action:** `/gsd:execute-phase 02 --ws formulaire-condi`
