---
phase: 03-ai-classification-chat
plan: "02"
subsystem: ui
tags: [chat-rendering, i18n, next-intl, tailwind, classification, onboarding]
dependency_graph:
  requires:
    - phase: 03-01
      provides: [DocType, ChatMessage-union, chatMessages-state, handleClarification, canAdvance, classification-logic]
  provides:
    - chatMessages rendered in chat container (5 bubble kinds)
    - docType badge on file card rows
    - canAdvance-gated Continue button calling onSuccess()
    - 10 Phase 3 i18n keys in fr.json and en.json
  affects: [apps/web/src/components/coach/WizardStep4Import.tsx]
tech-stack:
  added: []
  patterns: [discriminated-union-switch-rendering, conditional-pill-removal, right-aligned-coach-bubble]
key-files:
  created: []
  modified:
    - apps/web/src/components/coach/WizardStep4Import.tsx
    - apps/web/messages/fr.json
    - apps/web/messages/en.json
key-decisions:
  - "chatMessages.map key uses fileId+index composite to be unique across multiple messages for the same file"
  - "Pill visibility driven by clarificationPending flag on FileState — pills vanish from DOM when false"
  - "Coach reply reuses step4PillTemplate/step4PillDaCoach keys rather than a separate key — per UI-SPEC"
patterns-established:
  - "Right-aligned coach bubble: flex justify-end + bg-primary/10 rounded-tr-none (no avatar)"
  - "docType badge: inline-flex with bg-surface-alt border border-border text-xs font-bold — appears only when docType is set"
requirements-completed: [PARSE-01, PARSE-02, PARSE-03]
duration: ~12min
completed: "2026-05-30"
---

# Phase 03 Plan 02: AI Classification Chat Rendering Summary

**Phase 3 visual layer complete — classification bubbles, ambiguity pills, coach reply, docType badges, and canAdvance-gated Continue CTA rendered in WizardStep4Import with 10 new i18n keys.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-30T00:00:00Z
- **Completed:** 2026-05-30T00:12:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added 10 Phase 3 i18n keys to both fr.json and en.json under the Onboarding namespace with exact values per UI-SPEC
- Rendered 5 ChatMessage discriminated union kinds in the existing `flex flex-col gap-3 mb-6` chat container after the Phase 2 opening bubble
- docType badge (`Template` / `DA coach`) appears on file card rows between StatusPill and remove button when docType is set
- `canAdvance &&` gates the "Continuer →" / "Continue →" primary CTA button, which calls `onSuccess()` when all ready files are classified

## Task Commits

1. **Task 1: Add 10 Phase 3 i18n keys to fr.json and en.json** - `d12340d` (feat)
2. **Task 2: Render chatMessages, docType badge, Continue button** - `3eb3c4c` (feat)

## Files Created/Modified

- `apps/web/messages/fr.json` — 10 new keys added under Onboarding (step4AiTemplateSummary, step4AiTemplateSummaryShort, step4AiDaCoachSummary, step4AiAmbiguous, step4PillTemplate, step4PillDaCoach, step4AiConfirmation, step4DocTypeTemplate, step4DocTypeDaCoach, step4Continue)
- `apps/web/messages/en.json` — same 10 keys with English values
- `apps/web/src/components/coach/WizardStep4Import.tsx` — Addition A: chatMessages.map with 5 kind branches; Addition B: docType badge; Addition C: canAdvance-gated Continue button

## Decisions Made

- `chatMessages.map` key uses composite `${msg.fileId}-${i}` to guarantee uniqueness across multiple messages for the same file
- Pill visibility controlled by `clarificationPending` flag read from `fileStates.find(f => f.id === msg.fileId)` — pills are absent from DOM when `isPending` is false (after clarification resolved)
- Coach reply bubble reuses the pill label keys (`step4PillTemplate` / `step4PillDaCoach`) rather than a separate key, per the UI-SPEC coaching contract

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript: 3 pre-existing errors unchanged (2 in WizardStep4Import from runPipeline hoisting, 1 in VocalReview.test.tsx from missing screen export). Zero new errors introduced.

## Known Stubs

None — all rendering uses live state from `chatMessages`, `fileStates`, and `canAdvance` derived values wired in 03-01.

## Threat Flags

None. Pill buttons only accept `DocType` union literals (`'template_programme'` | `'da_coach'`) — no free-form input, no injection risk. Filename rendered in bubbles is already visible on file cards (no additional exposure).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 3 complete: full AI classification conversation UI is live in WizardStep4Import
- PARSE-01 (type identification), PARSE-02 (summary display), PARSE-03 (clarification question) all satisfied
- Ready for Phase 4 (onboarding completion / account creation) or integration testing

---
*Phase: 03-ai-classification-chat*
*Completed: 2026-05-30*
