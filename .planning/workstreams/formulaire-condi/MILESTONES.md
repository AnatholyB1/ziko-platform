# Milestones

## v1.14 Formulaires Conditionnels (Shipped: 2026-05-30)

**Phases completed:** 6 phases (01-05.1), 20 plans, 22 tasks

**Key accomplishments:**

- PostgreSQL migration 055: coach_forms, form_instances, form_responses tables with full RLS + UNIQUE partial index duplicate guard
- 6 Hono routes (coach CRUD + athlete pending/submit) mounted at /forms — TypeScript zero errors
- SECURITY DEFINER trigger engine (create_form_instances_for_trigger) — all 4 trigger types (first contact, after-N-sessions, fixed date, manual send)
- Daily Vercel cron at 6am UTC scans active fixed-date forms and creates pending instances per linked athlete
- Inline form builder: 4 question types + conditional TriggerConfig, GSAP entrance, save/publish flow, PublishModal + ArchiveModal
- Full-screen mobile blocking overlay (PendingFormsOverlay) with sequential multi-form flow and all 4 native question renderers
- GET /coach/clients/:clientId/forms + ClientFormsContent accordion — coach reads submitted Q+A per athlete
- Claude AI context injection: last 5 form responses in system prompt as Formulaires recents block
- Phase 05.1: closed 5 integration blockers (URL prefix, answer field name, yes_no type mismatch, n_sessions JSONB key)

**Known deferred items at close:** 2 (Phase 05.1 UAT 6 pending tests; Phase 05 VERIFICATION.md human_needed checks)

---
