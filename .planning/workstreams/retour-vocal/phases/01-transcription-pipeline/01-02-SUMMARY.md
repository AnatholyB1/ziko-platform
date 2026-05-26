---
phase: 01-transcription-pipeline
plan: 02
subsystem: api
tags: [openai, whisper, hono, vitest, voice, transcription, tdd]

# Dependency graph
requires:
  - phase: 01-transcription-pipeline/01-01
    provides: retour-vocal workstream scaffolding, CONTEXT.md, RESEARCH.md

provides:
  - openai@6.39.0 installed in backend/api
  - OPENAI_API_KEY documented in backend/api/.env.example
  - voiceRouter skeleton (Hono) with authMiddleware + 20MB bodyLimit on POST /transcribe
  - maxDuration = 60 exported (Vercel timeout)
  - voice.test.ts with 4 RED stubs (Wave 0) — unblocks Wave 1 TDD

affects:
  - 01-03-PLAN (Wave 1 — wires Whisper into the 501 stub)
  - backend/api/src/app.ts (will mount voiceRouter on /coach/voice)

# Tech tracking
tech-stack:
  added:
    - openai@6.39.0 (OpenAI official SDK, Whisper-1 transcription)
  patterns:
    - voiceRouter follows exact Hono pattern of coachAiRouter (new Hono(), use('*', authMiddleware))
    - maxDuration = 60 at module top-level (Vercel serverless timeout)
    - bodyLimit middleware inline in route handler (20 MB cap, 413 onError)
    - Tests mock authMiddleware and OpenAI client — no real API calls during unit tests

key-files:
  created:
    - backend/api/src/coach/voice/service.ts
    - backend/api/test/voice.test.ts
  modified:
    - backend/api/package.json (openai@6.39.0 dependency)
    - backend/api/.env.example (OPENAI_API_KEY placeholder)

key-decisions:
  - "Wave 0 skeleton returns 501 — Wave 1 (01-03) replaces with real Whisper call, no back-and-forth"
  - "authMiddleware mocked in tests — unit tests run without Supabase network calls"
  - "bodyLimit from hono/body-limit confirmed available at runtime before use"

patterns-established:
  - "Voice route file: backend/api/src/coach/voice/service.ts — exports voiceRouter + maxDuration"
  - "Test stubs: mock authMiddleware via vi.mock('../src/middleware/auth.js', ...) with userId injection"

requirements-completed:
  - VOICE-02

# Metrics
duration: 18min
completed: 2026-05-26
---

# Phase 01-02: Retour Vocal — voiceRouter Skeleton + RED Tests Summary

**openai@6.39.0 installed, Hono voiceRouter skeleton with JWT auth + 20MB bodyLimit, 4 RED vitest stubs blocking Wave 1 (plan 01-03)**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-26T12:10:00Z
- **Completed:** 2026-05-26T12:29:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Installed `openai@6.39.0` in backend/api — official OpenAI SDK, confirmed importable (`typeof OpenAI === 'function'`)
- Created `backend/api/src/coach/voice/service.ts` — exports `voiceRouter` and `maxDuration = 60`; `authMiddleware` guards all routes; `POST /transcribe` returns 501 (Wave 0 stub)
- Created `backend/api/test/voice.test.ts` with 4 test cases — Test 1 (401) PASSES, Tests 2/3/4 are RED (501 stub) — ready for Wave 1 to turn GREEN
- Documented `OPENAI_API_KEY` in `backend/api/.env.example` with clear comment

## Task Commits

1. **Task 1: Install openai + document OPENAI_API_KEY** — `dbc1845` (feat)
2. **Task 2: voiceRouter skeleton + RED test stubs** — `37583ee` (feat)

**Plan metadata:** see final docs commit below

## Files Created/Modified

- `backend/api/src/coach/voice/service.ts` — Hono router with authMiddleware, bodyLimit(20MB), 501 stub for Wave 1
- `backend/api/test/voice.test.ts` — 4 RED vitest stubs (401/400/413/200 shapes)
- `backend/api/package.json` — openai@6.39.0 added to dependencies
- `backend/api/.env.example` — OPENAI_API_KEY placeholder documented

## Decisions Made

- Wave 0 returns 501 to keep the skeleton minimal and unblock plan 01-03 without partial logic
- `authMiddleware` mocked in tests via `vi.mock` — avoids Supabase network dependency in unit tests, consistent with threat model (T-01-02 mitigated structurally)
- `hono/body-limit` sub-import confirmed available before use (`node -e "require('hono/body-limit')"` → no error)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — `hono/body-limit` was available, TypeScript compiled without errors, vitest ran the stubs correctly.

## User Setup Required

**ACTION REQUIRED — OPENAI_API_KEY missing from backend/api/.env.local**

`OPENAI_API_KEY` was NOT found in `backend/api/.env.local`. Wave 1 (plan 01-03) will call OpenAI Whisper at runtime and in integration tests.

Before running Wave 1:
```bash
echo "OPENAI_API_KEY=sk-<your-key>" >> C:/ziko-platform/backend/api/.env.local
```

Get your key at: https://platform.openai.com/api-keys

Unit tests in `voice.test.ts` do NOT require the key (OpenAI is mocked). Only Wave 1 real-path tests and production runtime need it.

## Next Phase Readiness

- Wave 1 (plan 01-03) is fully unblocked: `voiceRouter` is importable, test file exists, test shapes are defined
- `OPENAI_API_KEY` must be added to `.env.local` before Wave 1 integration tests run
- `voiceRouter` must be mounted in `backend/api/src/app.ts` on path `/coach/voice` — this step is in plan 01-03

---

*Phase: 01-transcription-pipeline*
*Completed: 2026-05-26*
