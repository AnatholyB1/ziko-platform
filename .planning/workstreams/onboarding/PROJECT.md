# Project: Coach Onboarding — Import IA

**Workstream:** onboarding  
**Surface:** Web CRM — `apps/web`  
**Last updated:** 2026-05-29

---

## What This Is

An AI-driven import step added to the existing 3-step coach onboarding wizard on the Ziko web CRM. New coaches, after completing KYC (Step 3), land on a conversational Step 4 where they drop their existing docs (PDFs, Excel sheets, Word files) and the AI classifies, parses, and commits them into the platform in under 15 minutes.

**Core value:** A coach onboards in 15 min by uploading 3–4 existing docs — no manual re-entry.

---

## Current Milestone: v1.0 — Import IA

**Goal:** Ajouter une WizardStep4Import au wizard coach existant, guidée par une conversation IA qui analyse les docs uploadés et construit la base du coach.

**Target features:**
- WizardProgress 3 → 4 steps + Step 3 redirige vers Step 4
- UI conversationnelle avec file drop (chat + upload)
- Classifieur IA : type de chaque doc (DA coach / template programme / données client)
- Orchestration Phase 28 : create → upload → parse → poll → commit
- Résumé consolidé + confirmation avant commit
- Gate de skip "Plus tard" → dashboard

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

- Step 4 est optionnel (skip possible) — pas un bloquant pour accéder au dashboard
- Le classifieur IA tourne côté client (appel Claude via l'API coach/ai existante) ou inline dans le chat — à décider en phase plan
- Seuls les docs type `coach_template` vont dans `PUT /:id/commit` → workout_programs
- Les docs type `da_coach` sont stockés comme contexte (parsed_data conservé en base, pas de commit workout_programs)
- Les docs type `client_data` : hors scope v1.0 (pas de table cible propre encore)

---

## Active Requirements

See: `REQUIREMENTS.md`

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
