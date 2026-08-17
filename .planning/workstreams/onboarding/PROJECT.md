# Project: Coach Onboarding — Import IA

**Workstream:** onboarding  
**Surface:** Web CRM — `apps/web`  
**Last updated:** 2026-08-13 after v1.0 milestone

---

## What This Is

An AI-driven import step added to the existing 3-step coach onboarding wizard on the Ziko web CRM. New coaches, after completing KYC (Step 3), land on a conversational Step 4 where they drop their existing docs (PDFs, Excel sheets, Word files) and the AI classifies, parses, and commits them into the platform in under 15 minutes.

**Core value:** A coach onboards in 15 min by uploading 3–4 existing docs — no manual re-entry. Validated in v1.0 — shipped as designed, no scope change.

---

## Current State

**v1.0 — Import IA: ✅ SHIPPED 2026-08-13**

WizardStep4Import ships as a 4th step in the coach onboarding wizard: KYC success redirects to `?step=4`, coaches drop up to 4 PDF/Excel/Word files, the Phase 28 pipeline (create → upload → status → parse) runs per file automatically, an AI chat layer classifies each doc (DA coach / template programme, with clarification pills for ambiguous cases), and a consolidated review screen lets the coach correct any label before committing `coach_template` docs and redirecting to the dashboard. Skip is available at any point.

Archive: `.planning/workstreams/onboarding/milestones/v1.0-ROADMAP.md` · `.planning/workstreams/onboarding/milestones/v1.0-REQUIREMENTS.md`

**Next milestone:** Not yet planned. Candidates from Future Requirements below (client_data import, re-import from dashboard, >4 files, skip reminder) — run `/gsd:new-milestone --ws onboarding` when ready.

---

## Context

### Existing wizard (not touched)
- Step 1: Role (`WizardStep1Role`)
- Step 2: Profile (`WizardStep2Profile`)
- Step 3: KYC (`WizardStep3Kyc`) — `onSuccess` actuellement → dashboard, doit devenir → step=4

### Phase 28 Import IA (already shipped, `backend/api/src/coach/imports/`)
- `POST /coach/imports` → signed upload URL
- `PUT /:id/status` → confirm upload complete
- `POST /:id/parse` → async parse (returns 202)
- `GET /:id` → poll parsed_data
- `PUT /:id/commit` → commit to workout_programs
- Modes: `'athlete' | 'coach_template'`
- Formats: PDF, PNG, JPEG, Excel, Word (max 25 MB each)
- Credit cost: 1 crédit/doc (PDF: min(page_count, 10))

### Coach web CRM structure
- Route: `apps/web/src/app/[locale]/coach/onboarding/`
- Existing: `OnboardingWizard.tsx`, `WizardProgress`, `WizardStep1Role`, `WizardStep2Profile`, `WizardStep3Kyc`
- Dashboard: `/(coach)/coach/dashboard`

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Step 4 est optionnel (skip possible) | Pas un bloquant pour accéder au dashboard | ✓ Good — shipped, COMPLETE-01 |
| Classifieur IA tourne côté client | Appel Claude via l'API coach/ai existante | ✓ Good |
| Seuls les docs `coach_template` vont dans `PUT /:id/commit` → workout_programs | Scope réduit au strict nécessaire v1.0 | ✓ Good |
| Docs `da_coach` stockés comme contexte, pas de commit workout_programs | Cohérent avec le modèle Phase 28 | ✓ Good |
| Docs `client_data` hors scope v1.0 | Pas de table cible propre encore | ✓ Good — moved to Future Requirements |
| Confidence >= 0.6 = template_programme (auto), < 0.4 or null = da_coach (auto), 0.4-0.6 = ambiguous with clarification pills | Réduit les frictions coach tout en gardant un filet de sécurité | ✓ Good |
| sessions count uses null sentinel (not 0) when unavailable | Enables rendering plan short fallback i18n key | ✓ Good |
| Phase 04 completion effect split into two effects | Original single effect canceled its own just-scheduled 1500ms redirect timer via a dependency-triggered re-run | ✓ Good — bug fixed in 04-04 |

---

## Requirements

### Validated (v1.0)

- ✓ WIZARD-01, WIZARD-02, WIZARD-03 — 4-step wizard shell, KYC→Step4 redirect, skip→dashboard — v1.0
- ✓ UPLOAD-01, UPLOAD-02, UPLOAD-03 — drop UI + Phase 28 pipeline orchestration — v1.0
- ✓ PARSE-01, PARSE-02, PARSE-03 — AI doc classification, summary, clarification — v1.0
- ✓ REVIEW-01, REVIEW-02, REVIEW-03 — consolidated review, type correction, commit — v1.0
- ✓ COMPLETE-01, COMPLETE-02 — skip gate, post-commit redirect — v1.0

### Active

(None — next milestone not yet planned)

### Out of Scope

- **Parsing de données client** — pas de table de destination propre pour les docs `client_data`. Still deferred, reasoning unchanged.
- **Backend changes** — Phase 28 utilisée telle quelle, aucune modification backend dans v1.0. Reasoning still valid; revisit if v1.1 needs new doc types.
- **Mobile** — Step 4 web uniquement, onboarding mobile athlete (7 steps) non touché. Still valid — different flow, different surface.
- **Nouveau type de doc hors PDF/Excel/Word** — formats limités à ceux de Phase 28. Still valid.

### Future Requirements (candidates for next milestone)

- Intégration des docs `client_data` (nécessite une table cible)
- Re-import depuis le dashboard (hors onboarding)
- Upload de plus de 4 fichiers en une session
- Relance de Step 4 si le coach a skipé (reminder email / dashboard banner)

---

## Context

**Shipped:** v1.0, 2026-08-13. 4 phases, 10 plans, ~13 files touched in the core surface (`WizardStep4Import.tsx` + i18n), +1280/-27 lines.
**Tech stack:** Next.js 15 web CRM (`apps/web`), next-intl v4, Phase 28 backend API (unchanged), Claude classification inline in chat.
**Known tech debt:** None carried forward — Phase 4's redirect-timer bug was fixed within the milestone (see Key Decisions), not deferred.

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
