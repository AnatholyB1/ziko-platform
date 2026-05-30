---
phase: 03-ai-classification-chat
plan: "01"
subsystem: coach-onboarding
tags: [classification, state, polling, chat-messages]
dependency_graph:
  requires: [02-upload-ux-pipeline]
  provides: [DocType, extended-FileState, ChatMessage-union, chatMessages-state, classification-logic, handleClarification, canAdvance]
  affects: [apps/web/src/components/coach/WizardStep4Import.tsx]
tech_stack:
  added: []
  patterns: [discriminated-union, functional-state-updater, confidence-threshold-branching]
key_files:
  created: []
  modified:
    - apps/web/src/components/coach/WizardStep4Import.tsx
decisions:
  - Classification derived client-side from overall_confidence in parsed_data — no AI API call
  - confidence >= 0.6 = template_programme (auto), < 0.4 or null = da_coach (auto), 0.4-0.6 = ambiguous (clarificationPending)
  - sessions count uses null sentinel (not 0) when unavailable, enabling rendering plan to use short fallback i18n key
metrics:
  duration: ~15min
  completed: "2026-05-30"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 03 Plan 01: Classification Types & Logic Summary

**One-liner:** Confidence-threshold classification wired into WizardStep4Import polling callback with DocType union, ChatMessage discriminated union, handleClarification handler, and canAdvance gate.

## What Was Built

Task 1 established the type layer: `DocType = 'da_coach' | 'template_programme'`, `FileState` extended with `docType?` and `clarificationPending?`, and `ChatMessage` discriminated union with 5 variants (ia-template-summary, ia-da-coach-summary, ia-ambiguous, coach-reply, ia-confirmation). `chatMessages` state initialized with `useState<ChatMessage[]>([])`.

Task 2 wired the logic: polling GET response type extended with `parsed_data`; `startPolling` receives a third `filename` parameter (passed as `fileState.file.name` from `runPipeline`); the `ready` branch reads `overall_confidence` and branches on three confidence zones, updating `FileState` and appending the correct `ChatMessage` variant; `handleClarification` resolves ambiguity by setting `docType`, clearing `clarificationPending`, and appending `coach-reply` + `ia-confirmation` messages; `canAdvance` derived from `fileStates` using `.some` + `.filter.every` pattern.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b0e4f67 | feat(03-01): add DocType, extend FileState, ChatMessage union, chatMessages state |
| 2 | cc0f198 | feat(03-01): extend polling, add classification logic, handleClarification, canAdvance |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None. All API-sourced `parsed_data` access uses `as any` with optional chaining; worst case is null/undefined → fallback to da_coach (safe default). No new network endpoints or auth paths introduced.

## Self-Check

- [x] `apps/web/src/components/coach/WizardStep4Import.tsx` exists and modified
- [x] Commit b0e4f67 exists
- [x] Commit cc0f198 exists
- [x] `grep -c "type DocType"` = 1
- [x] `grep -c "ChatMessage"` = 6 (>= 4 required)
- [x] `grep -c "canAdvance"` = 1
- [x] `grep -c "handleClarification"` = 1
- [x] tsc: 0 new errors (3 pre-existing: 2 in WizardStep4Import.tsx from runPipeline hoisting, 1 in VocalReview.test.tsx)

## Self-Check: PASSED
