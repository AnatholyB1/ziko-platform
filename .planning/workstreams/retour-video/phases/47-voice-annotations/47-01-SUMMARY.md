---
phase: 47-voice-annotations
plan: "01"
subsystem: backend/api
tags: [whisper, voice-annotations, hono, supabase-storage, claude-cleaning]
requires:
  - "Phase 46 videos/service.ts, db.ts, types.ts (coach_video_annotations table)"
  - "coach/voice/service.ts v1.9 (DRY refactor source)"
provides:
  - "lib/whisper.ts — shared Whisper utility (ALLOWED_MIME_TYPES, validateMimeType, transcribeAudio)"
  - "POST /coach/videos/annotations/transcribe — upload + Whisper + Claude pipeline"
  - "GET /coach/videos/annotations/:annotationId/audio-url — signed audio URL"
affects:
  - "backend/api/src/coach/voice/service.ts (imports refactored to lib/whisper)"
  - "backend/api/src/coach/videos/db.ts (getAnnotationById, insertVoiceAnnotation added)"
  - "backend/api/src/coach/videos/types.ts (AnnotationRow extended)"
tech-stack:
  added: []
  patterns:
    - "Shared utility module (lib/whisper.ts) imported by two bounded contexts"
    - "generateText for simple string output (Claude cleaning prompt)"
    - "Hono bodyLimit + multipart parseBody for audio upload"
    - "Supabase storage upload + createSignedUrl (15 min) for audio blobs"
key-files:
  created:
    - backend/api/src/lib/whisper.ts
  modified:
    - backend/api/src/coach/voice/service.ts
    - backend/api/src/coach/videos/types.ts
    - backend/api/src/coach/videos/db.ts
    - backend/api/src/coach/videos/service.ts
key-decisions:
  - "lib/whisper.ts initialized OpenAI client at module scope (singleton) — not inside function — to avoid re-instantiation per request"
  - "POST /annotations/transcribe registered before GET /annotations/:annotationId/audio-url in Hono router to prevent 'transcribe' being captured as annotationId param"
  - "generateText used for Claude cleaning (not generateObject) — 1-2 sentence string output does not require JSON schema"
  - "Storage path server-side constructed as ${athlete_id}/annotations/${uuid}.ext — zero client-controlled segments (T-47-05)"
  - "getAnnotationById and insertVoiceAnnotation added to db.ts using existing createServiceClient() pattern — no new Supabase clients"
requirements-completed:
  - VOICE-02
  - VOICE-03
metrics:
  duration: "12 min"
  completed: "2026-05-27"
  tasks: 3
  files: 5
---

# Phase 47 Plan 01: Whisper Utility + Voice Annotation Routes Summary

Shared Whisper utility extracted from voice/service.ts into lib/whisper.ts, voice/service.ts DRY-refactored (v1.9 API byte-identical), and two new voice annotation routes added to videosRouter: POST /annotations/transcribe (upload + Whisper + Claude cleaning) and GET /annotations/:annotationId/audio-url (signed 15-min read URL).

**Duration:** 12 min | **Start:** 2026-05-27T20:10:00Z | **End:** 2026-05-27T20:22:16Z
**Tasks:** 3/3 completed | **Files:** 5 created/modified

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create lib/whisper.ts — shared Whisper utility module | 66df6be | backend/api/src/lib/whisper.ts |
| 2 | Refactor voice/service.ts to import from lib/whisper.ts | c30642d | backend/api/src/coach/voice/service.ts |
| 3 | Types + DB helpers + two new routes in videosRouter | d379c33 | types.ts, db.ts, service.ts |

## What Was Built

### lib/whisper.ts (new)
Pure utility module — no Hono imports. Exports:
- `ALLOWED_MIME_TYPES: string[]` — `['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4']`
- `validateMimeType(mimeType: string): boolean` — whitelist check
- `transcribeAudio(buffer: Buffer, mimeType: string): Promise<string>` — Whisper-1 call, `language: 'fr'` hardcoded

### voice/service.ts (refactored)
DRY refactor only — removed inline `new OpenAI(...)` and `ALLOWED_MIME_TYPES`, replaced with imports from `lib/whisper.js`. Route `/transcribe` now calls `validateMimeType()` and `transcribeAudio()`. Routes `/structure` and `/save` untouched. `maxDuration = 60` preserved.

### videos/types.ts (extended)
- `AnnotationRow` gains optional `type?: 'text' | 'voice'` and `audio_path?: string | null`
- New `VoiceTranscribeBody` interface: `{ videoId: string; timestamp_s: number }`
- `CreateAnnotationBody` gains optional `type?` and `audio_path?`

### videos/db.ts (extended)
- `getAnnotationsForVideo` select now includes `type, audio_path`
- `getAnnotationById(annotationId)` — queries by ID, returns `AnnotationRow | null`
- `insertVoiceAnnotation(params)` — inserts with `type: 'voice'` and `audio_path`

### videos/service.ts (two new routes)
- `export const maxDuration = 60` added
- `POST /annotations/transcribe` — multipart, 20 MB limit, mimeType whitelist, coach guard, storage upload, Whisper + Claude cleaning pipeline, returns `{ transcript, audioPath, annotationId }`
- `GET /annotations/:annotationId/audio-url` — coach or athlete access, returns `{ signedUrl }` with 900s expiry

## Verification Results

All plan verification commands pass:

```
tsc --noEmit                                     PASS (zero errors)
grep import.*lib/whisper voice/service.ts        PASS
grep export const maxDuration videos/service.ts  PASS (= 60)
grep annotations/transcribe videos/service.ts    PASS (route handler present)
grep audio-url videos/service.ts                 PASS (route handler present)
grep "type, audio_path" videos/db.ts             PASS (two selects updated)
```

## STRIDE Threat Mitigations

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-47-01 — mimeType tampering | `validateMimeType()` whitelist, 400 on violation | Mitigated |
| T-47-02 — coach ownership | `getVideoById` + `coachId !== video.coach_id` → 403 | Mitigated |
| T-47-03 — IDOR audio-url | Caller must be `video.coach_id` or `video.athlete_id` | Mitigated |
| T-47-04 — DoS blob size | `bodyLimit({ maxSize: 20MB })` same as v1.9 voice route | Mitigated |
| T-47-05 — path traversal | Storage path: `${athlete_id}/annotations/${uuid}.ext` — zero client segments | Mitigated |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — no stubs or placeholder values introduced.

## Threat Flags

None — all new surface areas are covered by the plan's threat model.

## Self-Check: PASSED

- `backend/api/src/lib/whisper.ts` exists on disk: FOUND
- `backend/api/src/coach/voice/service.ts` imports lib/whisper: FOUND
- `export const maxDuration = 60` in videos/service.ts: FOUND
- Route `POST /annotations/transcribe` registered: FOUND
- Route `GET /annotations/:annotationId/audio-url` registered: FOUND
- `type, audio_path` in db.ts selects: FOUND
- Commits 66df6be, c30642d, d379c33 exist in git log: FOUND

**Next:** Ready for 47-02 — VoiceComposer web component (AnnotationPanel mode toggle + VoiceComposer child)
