---
gsd_state_version: 1.0
phase: 27
phase_name: Coaching Programs & Mobile "Mon coach" Full
status: complete_web_only
branch: gsd/phase-22-schema-foundation-rls-keystone
last_updated: "2026-05-21"
progress:
  total_plans: 8
  completed_plans: 8
  all_summaries: true
  verification: complete_web (10/13 — mobile Track B deferred, web fully complete)
---

# Phase 27 State — Stopped at Verification

## All Plans Complete

| Plan | Status | Commit |
|------|--------|--------|
| 27-00 (TDD stubs) | ✅ | c13f262 |
| 27-01 (Zod schemas) | ✅ | 631e3d0 / bdec2ca |
| 27-02 (DB migration 045) | ✅ | 89b4dc9 |
| 27-03 (Seeds migration 046) | ✅ | cbd9817 / 1a12f5a |
| 27-04 (Backend programs router) | ✅ | 54af0a8 / a7eb777 |
| 27-05 (Backend clients enrichment) | ✅ | 318f94a |
| 27-06 (Web programs list + new form) | ✅ | cfcb1d4 |
| 27-07 (Web editor + assignment + client tab) | ✅ | 32c3960 |

## Verification Result: complete_web (10/13)

Full report at `27-VERIFICATION.md`.

### Track A (web) — COMPLETE ✅

All web deliverables solid:
- `coach_program_folders` table + 7 schema changes + 2 RLS policies
- 5 seed templates (PPL, 5/3/1, Hyrox, Body Recomp, Débutant) 
- ProgramExercise/Session/Week Zod schemas in coach-sdk
- 11 backend routes (programs CRUD, folders, exercises, assign, duplicate)
- Web program builder (list, new form, week accordion editor, slide-over, typeahead, assignment modal)
- Client programs tab with compliance bar + shared note
- CoachSidebar Programmes enabled
- `ProgramsClient.tsx` `handleDelete` + `handleDuplicate` wired to API (fixed 2026-05-21)

### Track B (mobile State C enrichment) — DEFERRED (out of scope, web-only workstream)

5 mobile features were in `27-CONTEXT.md` scope but deferred by user decision (web-only phase). Logged as known gaps:

## Files to Know

- Backend: `backend/api/src/coach/programs/service.ts` (11 routes)
- Backend: `backend/api/src/coach/clients/service.ts` (added GET /:id/programs, PUT /:clientId/shared-note)
- Mobile: `plugins/coach/src/screens/CoachScreen.tsx` (State C = lines 478-561, needs enrichment)
- Mobile endpoint: `GET /coach/clients/links/me` → currently returns id/coach_id/client_id/created_at only (no shared_note, no program)
- Web: `apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx` (stub fix needed)
