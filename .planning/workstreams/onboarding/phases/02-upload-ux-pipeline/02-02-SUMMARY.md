---
phase: 02-upload-ux-pipeline
plan: "02"
subsystem: web/coach-onboarding
tags: [pipeline, upload, polling, useEffect, react]
dependency_graph:
  requires: [02-01]
  provides: [WizardStep4Import-pipeline]
  affects: [apps/web/src/components/coach/WizardStep4Import.tsx]
tech_stack:
  added: []
  patterns: [useEffect, async pipeline, setInterval polling, pipelineStartedRef deduplication]
key_files:
  created: []
  modified:
    - apps/web/src/components/coach/WizardStep4Import.tsx
decisions:
  - runPipeline defined as named async function inside component (not arrow) — avoids stale closure issues with apiUrl/jwt props
  - eslint-disable comment added for react-hooks/exhaustive-deps on pipeline trigger useEffect — intentional fire-and-forget pattern, adding runPipeline to deps would cause infinite loop
  - All state updates inside runPipeline use functional updater pattern (prev => ...) to avoid stale closures
metrics:
  duration: "~15 minutes"
  completed: "2026-05-30"
  tasks_completed: 1
  files_modified: 1
---

# Phase 02 Plan 02: Pipeline Orchestration Summary

**One-liner:** Automatic 5-step upload pipeline (POST create → PUT signed URL → PUT status → POST parse → poll GET every 3s) wired into WizardStep4Import via useEffect orchestration with full cleanup.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire pipeline orchestration useEffect and cleanup | 915606c | apps/web/src/components/coach/WizardStep4Import.tsx |

## What Was Built

### Task 1: Pipeline Orchestration (915606c)

Added full pipeline orchestration to `WizardStep4Import.tsx`. No JSX changes — the visual layer from Plan 01 is unchanged.

**New ref:**
- `pipelineStartedRef: useRef<Set<string>>(new Set())` — deduplication guard preventing double-pipeline on re-renders (RESEARCH.md Pitfall 4)

**New functions:**
- `runPipeline(fileState: FileState): Promise<void>` — sequential 5-step pipeline for a single file
- `startPolling(importId: string, fileId: string): void` — 3-second `setInterval` that polls `GET /coach/imports/:id`, clears on `ready`/`failed`

**New useEffect hooks:**
1. **Cleanup effect** `[]: void` — iterates `intervalsRef.current` and calls `clearInterval` on all active handles on unmount
2. **Pipeline trigger effect** `[fileStates]` — forEach on fileStates, fires `runPipeline` for any entry where `status === 'uploading'` and no `importId` and not already in `pipelineStartedRef`

**Updated `removeFile`:**
- Added `pipelineStartedRef.current.delete(id)` so removed files can be re-added and get a fresh pipeline

**Pipeline sequence per file (D-13):**
1. `POST ${apiUrl}/coach/imports` — body: `{ filename, mime_type, size_bytes, mode: 'coach_template' }`, Authorization header; extracts `import_id` + `signed_upload_url`
2. `PUT ${signed_upload_url}` — body: file bytes, `Content-Type: file.type`, NO Authorization (self-authenticating signed URL, RESEARCH Pitfall 2)
3. `PUT ${apiUrl}/coach/imports/${importId}/status` — body: `{ status: 'uploaded' }`, Authorization header
4. `POST ${apiUrl}/coach/imports/${importId}/parse` — Authorization header; on 202, immediately sets local status to `'parsing'` (RESEARCH Pitfall 5)
5. `startPolling(importId, fileId)` — sets 3s interval handle in `intervalsRef`

**Error handling:** Each step catches network errors and API non-OK responses, sets `status: 'failed'` with `errorMessage` from response text, returns early. Polling transient errors are silently ignored (keep polling).

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

All API calls to Hono use `Authorization: Bearer ${jwt}` (T-02-04 mitigated). Signed URL PUT has no Authorization header (T-02-05 per design). Polling cleanup on unmount, removal, and terminal status (T-02-07 mitigated). No new network endpoints introduced.

## Known Stubs

- `onSuccess` prop is accepted but not called — per D-17, Phase 3 decides when to advance. This is intentional.
- `userId` prop is accepted but not used in Phase 2 pipeline calls (user auth flows via JWT, not userId in path).

## Self-Check: PASSED

- [x] apps/web/src/components/coach/WizardStep4Import.tsx modified and committed (915606c)
- [x] TypeScript compiles with no new errors (pre-existing VocalReview.test.tsx error unrelated to this plan)
- [x] useEffect with [fileStates] dependency calls runPipeline for uploading files
- [x] pipelineStartedRef is useRef<Set<string>> used as deduplication guard
- [x] runPipeline performs exactly 5 sequential steps
- [x] POST /coach/imports body includes filename, mime_type, size_bytes, mode: 'coach_template'
- [x] Signed URL PUT does NOT include Authorization header
- [x] After POST parse returns, local status immediately set to 'parsing'
- [x] startPolling uses setInterval(3000) and stores handle in intervalsRef.current
- [x] Polling clears interval on ready or failed status
- [x] Cleanup useEffect clears all intervals on unmount
- [x] removeFile clears interval AND removes from pipelineStartedRef
- [x] onSuccess is not called anywhere in the file
- [x] All API calls to Hono use Authorization: Bearer ${jwt} header
