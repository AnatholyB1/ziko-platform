---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: Formulaires Conditionnels
status: planning
last_updated: "2026-05-25"
last_activity: 2026-05-25
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 01 — DB Schema & Backend API (context gathered)
Plan: —
Status: Context ready — awaiting /gsd:plan-phase 01 --ws formulaire-condi
Last activity: 2026-05-26 — Phase 01 context gathered (4 gray areas discussed)

## Progress

**Phases Complete:** 0/5
**Current Plan:** N/A

```
[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%
```

## Phase Summary

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 01. DB Schema & Backend API | Forms, instances, responses in DB + Hono CRUD routes | FORM-01,02,04,05,06 · TRIGGER-05 | Not started |
| 02. Trigger Engine | 4 trigger types create pending instances; duplicate guard | TRIGGER-01–05 | Not started |
| 03. Coach Form Builder (Web) | Coach builds, edits, publishes, and lists forms from CRM | FORM-01–06 | Not started |
| 04. Athlete Blocking Overlay (Mobile) | Pending forms block app; athlete submits sequentially | MOBILE-01–05 | Not started |
| 05. Response Viewer & Claude Injection | Coach reads submissions; Claude gets last 5 as context | RESPONSES-01–03 · CLAUDE-01–02 | Not started |

## Accumulated Context

### Key Decisions
- Blocking overlay is absolute — athlete cannot dismiss or skip (explicit product decision, per Out of Scope)
- Duplicate guard prevents second pending instance if one already exists for (form, athlete) pair
- Phase 01 and Phase 03 share FORM requirements; Phase 01 covers DB/API layer, Phase 03 covers observable web UI

### Architecture Notes
- DB tables needed: `coach_forms`, `form_questions`, `form_instances`, `form_responses`
- Trigger engine hooks into: invitation redemption (TRIGGER-01), session completion (TRIGGER-02), Vercel cron (TRIGGER-03), manual send route (TRIGGER-04)
- Claude injection point: `backend/api/src/context/user.ts` — `fetchUserContext()` extended with last 5 form responses
- Web UI: `apps/web/src/app/(coach)/clients/[id]/` — new "Formulaires" tab + form builder page
- Mobile: blocking overlay rendered at root layout level in `apps/mobile/app/(app)/_layout.tsx`

### Blockers
None currently.

## Session Continuity

**Stopped At:** Roadmap creation
**Resume File:** `.planning/workstreams/formulaire-condi/STATE.md`
**Next Action:** `/gsd:plan-phase 01 --ws formulaire-condi`
