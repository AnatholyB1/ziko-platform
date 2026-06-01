---
phase: 46
plan: "01"
subsystem: backend/api
tags: [hono, supabase, annotations, video-feedback, push-notifications, tdd, vitest]
dependency_graph:
  requires:
    - "Phase 45 backend/api/src/coach/videos/ (service.ts, db.ts, types.ts)"
    - "backend/api/src/services/notificationService.ts"
    - "Supabase tables: coach_client_videos, coach_video_annotations, user_profiles"
  provides:
    - "7 new Hono routes for annotation CRUD + signed-url + send-feedback"
    - "7 new DB query functions for Phase 46 annotation + video reads"
    - "AnnotationRow, VideoRow, CreateAnnotationBody, UpdateAnnotationBody types"
  affects:
    - "46-02-PLAN.md (web video list page — depends on GET /coach/clients/:clientId/videos)"
    - "46-03-PLAN.md (web player — depends on all annotation routes + signed-url)"
    - "46-04-PLAN.md (mobile review — depends on GET annotations + GET signed-url)"
tech_stack:
  added: []
  patterns:
    - "TDD: RED (failing tests) → GREEN (implementation) → no refactor needed"
    - "Double-column ownership guard on annotation/status writes (annotId + coachId)"
    - "Dual-role read access: coach_id OR athlete_id checked inline (not RLS)"
    - "Idempotency resend guard: check video.status !== annotated before updating"
key_files:
  created: []
  modified:
    - "backend/api/src/coach/videos/db.ts"
    - "backend/api/src/coach/videos/service.ts"
    - "backend/api/src/coach/videos/types.ts"
    - "backend/api/src/coach/videos/service.test.ts"
    - "backend/api/vitest.config.ts"
decisions:
  - "vitest.config.ts include extended to cover src/**/*.test.ts (Rule 3 fix — config blocked test discovery for src/coach/ unit tests)"
  - "send-feedback coach name degrades gracefully if user_profiles query fails (non-fatal try/catch)"
  - "GET /signed-url uses createSignedUrl(storagePath, 900) not createSignedUploadUrl — correct read vs write distinction"
  - "All 7 route handlers append to service.ts after existing /:videoId/complete (plan decision)"
metrics:
  duration: "16 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  files_modified: 5
---

# Phase 46 Plan 01: Annotation Routes + DB Functions Summary

**One-liner:** Hono annotation CRUD (7 routes) + Supabase DB helpers with double-column ownership guards and TDD coverage (29/29 tests green).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests + types | 70cb2c2 | types.ts, service.test.ts, vitest.config.ts |
| 1 (GREEN) | DB query functions | 11d4b40 | db.ts |
| 2 (GREEN) | 7 route handlers | 160e4c1 | service.ts |

## What Was Built

### DB Functions (`backend/api/src/coach/videos/db.ts`)

7 new exports added after `insertVideoRecord`:

- `getVideosForClient(clientId, coachId)` — filters coach_client_videos by both columns, ORDER BY created_at DESC
- `getVideoById(videoId)` — maybeSingle() for full video row, returns null if not found
- `getAnnotationsForVideo(videoId)` — returns coach_video_annotations ordered by timestamp_s ASC
- `insertAnnotation({ id, videoId, coachId, timestampS, content })` — inserts type='text' row
- `updateAnnotation(annotId, coachId, content)` — double-column guard: .eq('id').eq('coach_id')
- `deleteAnnotation(annotId, coachId)` — double-column guard: .eq('id').eq('coach_id')
- `updateVideoStatus(videoId, coachId, status)` — double-column guard: .eq('id').eq('coach_id')

### Route Handlers (`backend/api/src/coach/videos/service.ts`)

7 new routes appended after `/:videoId/complete`:

| Route | Auth Guard | Key Validation |
|-------|-----------|----------------|
| `GET /clients/:clientId/videos` | caller === coach (via DB filter) | — |
| `GET /:videoId/annotations` | caller is coach OR athlete (dual-role) | 404 if video not found |
| `POST /:videoId/annotations` | caller === video.coach_id | content<=2000, timestamp_s>=0 |
| `PATCH /:videoId/annotations/:annotId` | caller === video.coach_id | content<=2000 |
| `DELETE /:videoId/annotations/:annotId` | caller === video.coach_id | — |
| `GET /:videoId/signed-url` | caller is coach OR athlete (IDOR guard) | never exposes storage_path |
| `POST /:videoId/send-feedback` | caller === video.coach_id | annotations.length>=1, status!=='annotated' |

### Types (`backend/api/src/coach/videos/types.ts`)

4 new exports added (existing types kept):
- `VideoRow` — full coach_client_videos row shape
- `AnnotationRow` — full coach_video_annotations row shape
- `CreateAnnotationBody` — `{ timestamp_s: number; content: string }`
- `UpdateAnnotationBody` — `{ content: string }`

### Tests (`backend/api/src/coach/videos/service.test.ts`)

29 total tests (5 Phase 45 + 5 DB unit + 19 route tests), all green:
- 5 DB unit tests covering return shapes + error throw + guard call signatures
- 19 route tests covering 200/201/400/403/404 cases for all 7 routes
- Auth guard tested on each group (401 via existing middleware mock)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts `include` did not cover `src/**/*.test.ts`**
- **Found during:** Task 1 verification (plan verify command would have exited non-zero)
- **Issue:** `vitest.config.ts` only included `test/**/*.{spec,test}.ts`, which excluded the existing `src/coach/videos/service.test.ts` file that was already in the codebase
- **Fix:** Added `'src/**/*.test.ts'` to the `include` array in `vitest.config.ts`
- **Files modified:** `backend/api/vitest.config.ts`
- **Commit:** 70cb2c2

## TDD Gate Compliance

- RED gate: commit 70cb2c2 (`test(46-01): add failing tests...`) — 17 new tests failing, 12 passing
- GREEN gate: commits 11d4b40 + 160e4c1 — DB functions + route handlers implemented, 29/29 passing
- REFACTOR gate: No cleanup required

## Known Stubs

None — all routes are fully implemented and call real DB functions. The `coachName` degradation in `send-feedback` is intentional (non-fatal, documented).

## Threat Surface Scan

No new network endpoints beyond those specified in the plan's `<threat_model>`. All 4 trust boundaries covered:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-46-01 | `coachId !== video.coach_id` check in POST/PATCH/DELETE/send-feedback |
| T-46-02 | Same coach_id guard — athlete_id from JWT cannot match coach_id |
| T-46-IDOR | `callerId !== video.coach_id && callerId !== video.athlete_id` → 403 in GET /annotations and GET /signed-url |
| T-46-03 | `video.status === 'annotated'` → 400 in POST /send-feedback |
| T-46-04 | `content.length > 2000` → 400; `timestamp_s < 0 || typeof !== 'number'` → 400 |

## Self-Check: PASSED

Files exist:
- `backend/api/src/coach/videos/db.ts` — FOUND
- `backend/api/src/coach/videos/service.ts` — FOUND
- `backend/api/src/coach/videos/types.ts` — FOUND
- `backend/api/src/coach/videos/service.test.ts` — FOUND

Commits exist:
- 70cb2c2 — FOUND (test RED)
- 11d4b40 — FOUND (feat DB functions)
- 160e4c1 — FOUND (feat route handlers)

vitest exits 0 with 29/29 tests passing.
