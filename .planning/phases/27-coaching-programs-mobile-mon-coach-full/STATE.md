---
gsd_state_version: 1.0
phase: 27
phase_name: Coaching Programs & Mobile "Mon coach" Full
status: verification_gaps_found
branch: gsd/phase-22-schema-foundation-rls-keystone
last_updated: "2026-05-21"
progress:
  total_plans: 8
  completed_plans: 8
  all_summaries: true
  verification: gaps_found (9/13 must-haves)
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

## Verification Result: gaps_found (9/13)

Ran `/gsd-verifier` — full report at `27-VERIFICATION.md`.

### Track A (web) — COMPLETE ✅

All web deliverables solid:
- `coach_program_folders` table + 7 schema changes + 2 RLS policies
- 5 seed templates (PPL, 5/3/1, Hyrox, Body Recomp, Débutant) 
- ProgramExercise/Session/Week Zod schemas in coach-sdk
- 11 backend routes (programs CRUD, folders, exercises, assign, duplicate)
- Web program builder (list, new form, week accordion editor, slide-over, typeahead, assignment modal)
- Client programs tab with compliance bar + shared note
- CoachSidebar Programmes enabled

**1 minor gap (Track A):**  
`ProgramsClient.tsx` `handleDelete` + `handleDuplicate` are `console.log` stubs. Quick fix (~10 min).

### Track B (mobile State C enrichment) — NOT IMPLEMENTED ❌

5 mobile features were in `27-CONTEXT.md` scope but **no execution plans were created for them** during plan-phase. None of the 8 plans touch mobile. These are genuine missing plans, not regressions.

Missing:
1. **Today's prescribed session preview** in CoachScreen State C + "Commencer" deep-link
2. **Weekly compliance widget** in State C (needs athlete-facing endpoint)
3. **Coach's shared note display** in State C (+ `shared_note` in `/coach/clients/links/me` SELECT)
4. **Contact coach CTA** (mailto: with coach email)
5. **"Prescrit par [coach]" badge** in `workout/session.tsx`

## Decision Needed on Resume

Choose one:
- **Option A** — Quick-fix ProgramsClient stubs (10 min) + defer Track B to a new phase (27B or 28)
- **Option B** — Create gap-closure plans for all 6 gaps (Track B is ~1 session of work) and complete Phase 27 fully

## Files to Know

- Backend: `backend/api/src/coach/programs/service.ts` (11 routes)
- Backend: `backend/api/src/coach/clients/service.ts` (added GET /:id/programs, PUT /:clientId/shared-note)
- Mobile: `plugins/coach/src/screens/CoachScreen.tsx` (State C = lines 478-561, needs enrichment)
- Mobile endpoint: `GET /coach/clients/links/me` → currently returns id/coach_id/client_id/created_at only (no shared_note, no program)
- Web: `apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx` (stub fix needed)
