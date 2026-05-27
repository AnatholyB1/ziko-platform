---
phase: "02"
plan: "02"
subsystem: backend/api/src/coach/voice
tags: [generateObject, anthropicSchema, structured-output, supabase-rls, hono]
dependency_graph:
  requires: [01-03-SUMMARY.md]
  provides: [POST /coach/voice/structure]
  affects: [voiceRouter, backend/api/src/coach/voice/service.ts]
tech_stack:
  added: []
  patterns: [generateObject + anthropicSchema wrapper, Promise.all athlete context assembly, createUserClient(jwt) RLS pattern]
key_files:
  modified: [backend/api/src/coach/voice/service.ts]
decisions:
  - "Used anthropicSchema() wrapper (copy from imports/parse/claude.ts) — never zodSchema() directly — to strip Anthropic-rejected JSON Schema keywords"
  - "Athlete context assembled server-side inside route handler using coach JWT via createUserClient(jwt)"
  - "session_sets queried via .in('session_id', sessionIds) — no user_id column exists on that table"
  - "coach_client_notes queried via .eq('client_id', athlete_id) — RLS enforces coach_id = auth.uid() automatically"
  - "vocal_history stubbed as [] — Phase 03 will populate from coach_vocal_feedbacks table"
metrics:
  duration: "8 minutes"
  completed: "2026-05-27"
  tasks_completed: 1
  files_changed: 1
---

# Phase 02 Plan 02: POST /coach/voice/structure — Summary

## One-liner

`POST /coach/voice/structure` with `generateObject` + `anthropicSchema` wrapper, full athlete context assembly (sessions/sets/measurements/sleep/notes) via coach JWT RLS, returning validated 5-section StructuredCard JSON.

## What Was Built

Appended `voiceRouter.post('/structure', ...)` to `backend/api/src/coach/voice/service.ts` (196 lines added, no existing code modified).

### Components added

| Component | Description |
|-----------|-------------|
| `ANTHROPIC_BANNED_KEYWORDS` | Set of JSON Schema keywords rejected by Anthropic structured output — copied verbatim from `imports/parse/claude.ts` |
| `stripUnsupportedKeywords()` | Recursive sanitizer function — copied verbatim from `imports/parse/claude.ts` |
| `anthropicSchema<T>()` | Wrapper combining `zodSchema()` + `stripUnsupportedKeywords()` + `jsonSchema()` — copied verbatim |
| `StructuredCardZod` | Zod schema: `context`, `strengths`, `corrections`, `next_steps`, `tags` (enum array) |
| `CARD_SCHEMA` | `anthropicSchema<z.infer<typeof StructuredCardZod>>(StructuredCardZod)` |
| `STRUCTURING_SYSTEM_PROMPT` | French system prompt defining the 5-section card contract |
| `buildStructuringPrompt()` | Formats transcript + athlete context into Claude prompt; caps sets to 8 per session |
| `MAX_TRANSCRIPT_LENGTH` | `10_000` constant for DoS guard (T-02-02-03) |
| `voiceRouter.post('/structure')` | Main handler: extract JWT, parse body, guard checks, context assembly, `generateObject`, error handling |

### Athlete context assembly

1. Sessions: `workout_sessions` last 10 ordered by `started_at DESC`
2. `Promise.all` for:
   - Sets: `session_sets` via `.in('session_id', sessionIds)` (skipped if no sessions)
   - Measurements: `body_measurements` last 5 ordered by `created_at DESC`
   - Sleep: `sleep_logs` last 14 rows ordered by `date DESC`
   - Notes: `coach_client_notes` via `.eq('client_id', athlete_id).maybeSingle()`

### Error handling

| Condition | HTTP code | Message |
|-----------|-----------|---------|
| Missing `athlete_id` or `transcript` | 400 | `athlete_id and transcript are required` |
| Transcript > 10 000 chars | 400 | `Transcript too long (max 10 000 characters)` |
| `NoObjectGeneratedError` | 502 | French error message |
| Generic error | 500 | `err.message` |

## TypeScript Check Result

```
cd C:/ziko-platform/backend/api && rtk tsc --noEmit
→ TypeScript compilation completed (0 errors)
```

Zero errors in `coach/voice/service.ts` and no regressions in the rest of the backend.

## Acceptance Criteria — All Passed

| Criterion | Result |
|-----------|--------|
| `grep "voiceRouter.post.*structure"` | Match found |
| `grep -c "anthropicSchema"` | 2 matches (definition + usage) |
| `grep -c "NoObjectGeneratedError"` | 3 matches (import + instanceof check + log) |
| `grep "coach_client_notes" \| grep "client_id"` | `.eq('client_id', athlete_id)` confirmed |
| `grep -c "maxDuration"` | 1 match (pre-existing `export const maxDuration = 60`) |
| `.in('session_id', sessionIds)` present | Confirmed |
| `MAX_TRANSCRIPT_LENGTH` guard | `const MAX_TRANSCRIPT_LENGTH = 10_000` + runtime check |
| TypeScript 0 errors in voice/service | Confirmed |

## Files Changed

| File | Change |
|------|--------|
| `backend/api/src/coach/voice/service.ts` | +196 lines appended after `/transcribe` handler |

## Commit

`30d671b` — `feat(02-02): add POST /coach/voice/structure — Claude generateObject with athlete context`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `vocal_history: []` | `backend/api/src/coach/voice/service.ts` | ~248 | Phase 02 intentional stub; Phase 03 will populate from `coach_vocal_feedbacks` table |

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` already covers.

## Self-Check: PASSED

- `backend/api/src/coach/voice/service.ts` exists and contains `voiceRouter.post('/structure'`
- Commit `30d671b` present in git log
- TypeScript 0 errors confirmed
