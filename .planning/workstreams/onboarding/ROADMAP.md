# Roadmap: Coach Onboarding — Import IA (v1.0)

## Overview

A conversational Step 4 is added to the existing 3-step coach onboarding wizard. Coaches drop their existing docs (PDFs, Excel, Word) and an AI pipeline classifies, parses, summarises, and commits them — without manual re-entry — in under 15 minutes. Work is pure frontend; Phase 28 backend is already shipped.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Wizard Integration** - Wire Step 4 into the existing 3-step wizard shell
- [x] **Phase 2: Upload UX & Pipeline** - File drop UI + Phase 28 orchestration per file (completed 2026-05-30)
- [ ] **Phase 3: AI Classification & Chat** - Conversational IA layer (classify, summarise, clarify)
- [ ] **Phase 4: Review & Commit** - Consolidated review, type correction, commit, and exit flows

## Phase Details

### Phase 1: Wizard Integration
**Goal**: The wizard shell shows 4 steps and coaches land on Step 4 after KYC
**Depends on**: Nothing (first phase)
**Requirements**: WIZARD-01, WIZARD-02, WIZARD-03
**Success Criteria** (what must be TRUE):
  1. `WizardProgress` renders 4 step indicators instead of 3
  2. Completing KYC (Step 3) navigates to `?step=4` instead of the dashboard
  3. `OnboardingWizard` renders `WizardStep4Import` when `step === 4`
  4. Step 4 is visually reachable and does not break the existing Step 1-3 flow
**Plans**: TBD
**UI hint**: yes

### Phase 2: Upload UX & Pipeline
**Goal**: Coaches can drop up to 4 files and the Phase 28 pipeline runs automatically per file
**Depends on**: Phase 1
**Requirements**: UPLOAD-01, UPLOAD-02, UPLOAD-03
**Success Criteria** (what must be TRUE):
  1. An IA opening message ("Envoie-moi tes docs...") greets the coach on Step 4 load
  2. Coach can select up to 4 PDF / Excel / Word files via drag-and-drop or file picker
  3. Each file automatically triggers create -> upload -> status -> parse without manual action
  4. A per-file progress indicator shows upload and parse state (loading, done, error)
**Plans:** 2/2 plans complete
Plans:
- [x] 02-01-PLAN.md -- Chat bubble, drop zone UI, file cards, i18n keys
- [x] 02-02-PLAN.md -- Pipeline orchestration (create -> upload -> status -> parse -> poll)
**UI hint**: yes

### Phase 3: AI Classification & Chat
**Goal**: The AI identifies each doc type, summarises what it understood, and asks for clarification when ambiguous
**Depends on**: Phase 2
**Requirements**: PARSE-01, PARSE-02, PARSE-03
**Success Criteria** (what must be TRUE):
  1. Each parsed doc is labelled as DA coach or template programme (données client deferred — no target table in v1.0, per CONTEXT.md D-02)
  2. The IA chat displays a plain-language summary of what it extracted from each doc
  3. When doc type is ambiguous, the IA sends a clarification question before proceeding
  4. Coach can reply in the chat to resolve ambiguity and see the label update
**Plans:** 2 plans
Plans:
- [x] 03-01-PLAN.md -- Logic layer: DocType, ChatMessage union, classification in startPolling, handleClarification, canAdvance (completed 2026-05-30)
- [ ] 03-02-PLAN.md -- Rendering layer: chat message UI, docType badge, Continue button, i18n keys
**UI hint**: yes

### Phase 4: Review & Commit
**Goal**: Coaches confirm a consolidated review, correct any label, commit coach_template docs, and reach the dashboard
**Depends on**: Phase 3
**Requirements**: REVIEW-01, REVIEW-02, REVIEW-03, COMPLETE-01, COMPLETE-02
**Success Criteria** (what must be TRUE):
  1. A consolidated summary card lists every parsed doc with its detected type before any write action
  2. Coach can change the type of any doc directly in the review UI before confirming
  3. Confirming triggers `PUT /coach/imports/:id/commit` for all docs typed `coach_template`
  4. "Ignorer pour l'instant" skips import entirely and redirects to `/coach/dashboard`
  5. After successful commit, coach is redirected to `/coach/dashboard`
**Plans:** 2/4 plans executed
Plans:
- [x] 04-01-PLAN.md -- Repair RTL test infra (@testing-library/dom missing) + 9 Phase 4 i18n keys (fr/en)
- [x] 04-02-PLAN.md -- Wave 0 test file: 6 RED tests covering REVIEW-01/02/03, COMPLETE-01/02, D-09 retry isolation
- [ ] 04-03-PLAN.md -- Logic layer: parsedData persistence (D-11), view/reviewPhase state, commitDoc/handleConfirm/retryCommit, 1500ms completion effect
- [ ] 04-04-PLAN.md -- Rendering layer: review editing/committing/done views, pill toggles, live count, scoped retry, success state
**UI hint**: yes

## Progress

**Execution Order:** 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Wizard Integration | 2/2 | Complete | 2026-05-29 |
| 2. Upload UX & Pipeline | 2/2 | Complete    | 2026-05-30 |
| 3. AI Classification & Chat | 1/2 | In progress | - |
| 4. Review & Commit | 2/4 | In Progress|  |
