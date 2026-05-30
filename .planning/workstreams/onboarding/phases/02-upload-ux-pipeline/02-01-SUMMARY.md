---
phase: 02-upload-ux-pipeline
plan: "01"
subsystem: web/coach-onboarding
tags: [ui, i18n, upload, drag-and-drop, react]
dependency_graph:
  requires: []
  provides: [WizardStep4Import-ui, upload-i18n-keys]
  affects: [apps/web/src/components/coach/WizardStep4Import.tsx, apps/web/messages/fr.json, apps/web/messages/en.json]
tech_stack:
  added: [react-icons/io5]
  patterns: [useState, useRef, FileState type, StatusPill sub-component, drag-and-drop handlers]
key_files:
  created: []
  modified:
    - apps/web/src/components/coach/WizardStep4Import.tsx
    - apps/web/messages/fr.json
    - apps/web/messages/en.json
decisions:
  - Used React.ReactElement instead of JSX.Element for getFileIcon return type (JSX namespace not available without explicit import in this tsconfig target)
  - Passed t function as prop to StatusPill sub-component to avoid hook rule violations (hooks can only be called at top level)
metrics:
  duration: "~10 minutes"
  completed: "2026-05-30"
  tasks_completed: 2
  files_modified: 3
---

# Phase 02 Plan 01: Upload UX — i18n Keys and UI Layer Summary

**One-liner:** Conversational upload UI for Step 4 with IA chat bubble, drag-and-drop zone, file card list with status pills, and 9 i18n keys in FR/EN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Phase 2 i18n keys to fr.json and en.json | 34c6175 | apps/web/messages/fr.json, apps/web/messages/en.json |
| 2 | Build chat bubble, drop zone, and file card UI in WizardStep4Import | 2c48ae5 | apps/web/src/components/coach/WizardStep4Import.tsx |

## What Was Built

### Task 1: i18n Keys (34c6175)
Added 9 new keys to both `fr.json` and `en.json` under the `Onboarding` namespace, inserted immediately after `step4Skip`:
- `step4AiGreeting` — IA greeting message
- `step4DropZoneLabel` — drop zone instruction text
- `step4BrowseFiles` — browse button label
- `step4CapReached` — 4-file cap message
- `step4FileUploading` — uploading status pill label
- `step4FileParsing` — parsing status pill label
- `step4FileReady` — ready status pill label
- `step4FileFailed` — failed status pill label
- `step4RemoveFile` — aria-label for remove button

### Task 2: WizardStep4Import UI (2c48ae5)
Replaced the `{/* Phase 2: upload UI goes here */}` placeholder with the full upload interface:

**Types:** `FileStatus` union and `FileState` object type defined at module level.

**State & refs:** `fileStates` (FileState[]), `isDragOver` (boolean), `inputRef` (HTMLInputElement), `intervalsRef` (Map for interval cleanup — wired for Plan 02 pipeline).

**Helpers:**
- `formatBytes` — returns French units (o / Ko / Mo)
- `getFileIcon` — returns react-icons icon per extension (.pdf, .xlsx/.xls, .docx, fallback)
- `handleFiles` — enforces 4-file cap, creates FileState entries with crypto.randomUUID()
- `removeFile` — clears interval from intervalsRef, filters from state
- Drag event handlers: `handleDragOver`, `handleDragLeave`, `handleDrop`

**JSX sections:**
1. IA chat bubble with orange `bg-primary` avatar ("IA") and `bg-surface-alt` speech bubble
2. Drag-and-drop zone with conditional `border-primary bg-primary/5` on drag-over, `opacity-50 pointer-events-none` when cap hit; hidden file input accepting `.pdf,.xlsx,.xls,.docx`
3. File card list (renders when fileStates.length > 0): icon, filename (truncated), file size, inline error text for failed status (truncated at 80 chars), StatusPill, remove button

**StatusPill sub-component:** Renders colored pill with optional spinner animation. Color mapping: uploading=blue, parsing=orange, ready=green, failed=red.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSX.Element return type replaced with React.ReactElement**
- **Found during:** Task 2 TypeScript check
- **Issue:** `JSX.Element` caused `Cannot find namespace 'JSX'` error in this tsconfig configuration
- **Fix:** Changed `getFileIcon` return type to `React.ReactElement`, added `import React` to imports
- **Files modified:** apps/web/src/components/coach/WizardStep4Import.tsx
- **Commit:** 2c48ae5

**2. [Rule 2 - Design] StatusPill receives t as prop instead of calling useTranslations internally**
- **Found during:** Task 2 implementation
- **Issue:** StatusPill is a function defined at module level before the component; calling `useTranslations` inside it would violate React hooks rules (hooks must be called inside a component or custom hook)
- **Fix:** Passed `t` function as a prop to StatusPill — same result, correct hook usage
- **Files modified:** apps/web/src/components/coach/WizardStep4Import.tsx
- **Commit:** 2c48ae5

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| (none) | — | No new network endpoints or auth paths introduced — this is pure UI with no API calls (wired in Plan 02) |

The `accept` attribute on the hidden file input is advisory client-side only; server enforces MIME allowlist (T-02-01 accepted per threat model). The 4-file cap is enforced via `isCapHit` state check (T-02-02 mitigated).

## Known Stubs

- `intervalsRef` is declared and wired into `removeFile` but no intervals are set yet — Plan 02 will start/clear intervals as it drives status transitions via the upload pipeline.
- `apiUrl`, `userId`, `jwt` props are accepted but not used — Plan 02 will use them for API calls.
- `onSuccess` is accepted as prop but never called — Plan 02 will call it when all files reach `ready` status per D-17.

These stubs are intentional: this plan delivers the visual layer only. Plan 02 wires the pipeline.

## Self-Check: PASSED

- [x] apps/web/src/components/coach/WizardStep4Import.tsx modified and committed (2c48ae5)
- [x] apps/web/messages/fr.json contains 9 new keys (34c6175)
- [x] apps/web/messages/en.json contains 9 new keys (34c6175)
- [x] No TypeScript errors in WizardStep4Import.tsx
- [x] `{/* Phase 2: upload UI goes here */}` comment removed
- [x] No call to onSuccess in component body
- [x] Named export `export function WizardStep4Import(` maintained
- [x] `intervalsRef` declared as `useRef<Map<string, ReturnType<typeof setInterval>>>`
