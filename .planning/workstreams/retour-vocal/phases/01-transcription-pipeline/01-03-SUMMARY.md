---
phase: 01-transcription-pipeline
plan: 03
subsystem: api
tags: [whisper, openai, hono, transcription, multipart, voice]

# Dependency graph
requires:
  - phase: 01-01
    provides: proxy fix enabling /coach/voice route to reach the backend
  - phase: 01-02
    provides: openai package installed + voiceRouter skeleton with 501 stub + voice.test.ts RED stubs
provides:
  - Full POST /coach/voice/transcribe endpoint (auth → bodyLimit → parseBody → mimeType whitelist → toFile → Whisper → { transcript: string })
  - voiceRouter mounted in app.ts at /coach/voice
affects: [retour-vocal-wave2, frontend-upload, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OpenAI client at module scope — never re-instantiate per request"
    - "mimeType whitelist validation before sending to external API (T-01-04)"
    - "toFile(buffer) pattern for serverless audio upload — no fs.createReadStream"
    - "language: 'fr' hardcoded in Whisper call (D-06 — never auto-detect)"

key-files:
  created: []
  modified:
    - backend/api/src/coach/voice/service.ts
    - backend/api/src/app.ts

key-decisions:
  - "language: 'fr' hardcoded unconditionally (D-06) — Whisper auto-detect disabled"
  - "mimeType derived from body field (client-provided) and validated against whitelist before use"
  - "openai client instantiated at module scope to avoid cold-start overhead per request"
  - "toFile used instead of fs.createReadStream — Vercel serverless has no persistent FS"

patterns-established:
  - "Pattern: Whisper transcription — toFile(Buffer.from(arrayBuffer()), filename, { type })"
  - "Pattern: mimeType ext derivation — mimeType.includes('mp4') ? 'mp4' : 'webm'"

requirements-completed: [VOICE-02]

# Metrics
duration: 12min
completed: 2026-05-26
---

# Phase 01 Plan 03: Transcription Pipeline — Whisper Handler Summary

**Whisper transcription route fully wired: multipart parsing, mimeType whitelist, toFile + OpenAI Whisper-1 with language='fr', mounted at /coach/voice in app.ts — all 4 tests GREEN**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-26T10:38:15Z
- **Completed:** 2026-05-26T10:50:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced 501 Wave 0 stub with complete Whisper transcription handler
- mimeType whitelist enforcement (T-01-04): rejects non-webm/mp4 with 400
- `language: 'fr'` hardcoded in every Whisper call (D-06 compliance)
- voiceRouter mounted in app.ts — `POST /coach/voice/transcribe` now reachable in production
- All 4 voice.test.ts RED stubs turned GREEN (mocked OpenAI, no real API key needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement full Whisper handler in service.ts** - `0e99e98` (feat)
2. **Task 2: Mount voiceRouter in app.ts** - `debb58a` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `backend/api/src/coach/voice/service.ts` — Full Whisper handler replacing 501 stub; openai client at module scope; mimeType whitelist; toFile pattern; language:'fr'
- `backend/api/src/app.ts` — Import voiceRouter + app.route('/coach/voice', voiceRouter) after coachAiRouter

## Decisions Made
- `language: 'fr'` hardcoded unconditionally per D-06 (no auto-detect ever)
- `toFile(buffer, ...)` used exclusively — Vercel serverless has no persistent filesystem
- openai client at module scope (singleton) — not re-created per request
- mimeType from client body field, validated against `['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4']` before use

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — mocks in voice.test.ts were correctly pre-wired in Wave 0; all 4 tests passed immediately after implementation.

## User Setup Required
None — no external service configuration required beyond the `OPENAI_API_KEY` already documented in backend/api/.env.

## Next Phase Readiness
- `POST /coach/voice/transcribe` is production-ready — auth, bodyLimit, mimeType validation, Whisper call all in place
- Plan 01-04 (frontend AudioRecorder component) can now target this endpoint
- Plan 01-05 (integration test / E2E) has a real backend to test against

---
*Phase: 01-transcription-pipeline*
*Completed: 2026-05-26*
