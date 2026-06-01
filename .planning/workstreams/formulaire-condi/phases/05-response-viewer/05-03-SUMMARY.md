---
phase: 05-response-viewer
plan: "03"
subsystem: backend-ai-context
tags: [ai-context, system-prompt, form-responses, user-context]
dependency_graph:
  requires: [05-01, 04-04]
  provides: [CLAUDE-01, CLAUDE-02]
  affects: [backend/api/src/context/user.ts, backend/api/src/routes/ai.ts]
tech_stack:
  added: []
  patterns: [supabase-nested-join, system-prompt-injection]
key_files:
  modified:
    - backend/api/src/context/user.ts
    - backend/api/src/routes/ai.ts
decisions:
  - "formsSection appended inside buildSystemPrompt() rather than inline at call sites — avoids duplication across streaming and non-streaming routes"
  - "athlete_id used in .eq() not user_id — per migration 055 form_responses schema"
  - "scale/yes_no formatting applied in ai.ts formsSection builder, not in user.ts — keeps UserContext data neutral"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-05-28"
  tasks_completed: 2
  files_modified: 2
---

# Phase 05 Plan 03: Claude Context Injection Summary

**One-liner:** Injected last 5 athlete form responses into Claude system prompt via recentFormResponses field in UserContext, formatted as a '## Formulaires récents' block per CLAUDE-02.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend UserContext and fetchUserContext() in user.ts | f0289e1 | backend/api/src/context/user.ts |
| 2 | Inject ## Formulaires récents block into system prompt in ai.ts | b747543 | backend/api/src/routes/ai.ts |

## What Was Built

### Task 1 — user.ts

Three additions to `fetchUserContext()`:

1. **UserContext interface** — new `recentFormResponses` field at end of interface, typed as `Array<{ form_title, submitted_at, questions, answers }>`.

2. **Promise.all extension** — 6-tuple extended to 7-tuple. 7th query:
   ```
   form_responses → form_instances!inner → coach_forms!inner(title, questions)
   .eq('athlete_id', userId).order('submitted_at', DESC).limit(5)
   ```

3. **Return object** — `recentFormResponses` mapped from `formResponsesRes.data` using nested join access: `r.form_instances?.coach_forms?.title`.

### Task 2 — ai.ts

`buildSystemPrompt()` extended with forms section after the "Active Plugins" block:

- `formBlock` — maps each response to `### {title} ({YYYY-MM-DD})` header + Q&A pairs
- Answer formatting: `scale → '{N} / 10'`, `yes_no → 'Oui'/'Non'`, text verbatim
- `formsSection` — empty string when athlete has zero submitted responses (no section appended)
- Applies to both `/ai/chat/stream` and `/ai/chat` routes via the shared `buildSystemPrompt()` function

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript: `rtk tsc --noEmit -p backend/api/tsconfig.json` → zero errors in both files
- `UserContext.recentFormResponses` array field confirmed in interface
- `formResponsesRes` confirmed as 7th element of Promise.all destructure
- `.eq('athlete_id', userId)` confirmed (not `user_id`)
- `Formulaires récents` string literal present in ai.ts at line 105
- `formsSection = ''` when `formBlock` is falsy — no section appended for athletes with zero submissions

## Known Stubs

None.

## Threat Flags

No new security surface introduced. The form_responses query uses the athlete's own JWT via `clientForUser(userToken)`, ensuring RLS policy `form_responses_athlete (auth.uid() = athlete_id)` passes automatically. No cross-athlete data exposure possible.

## Self-Check: PASSED

- [x] `backend/api/src/context/user.ts` modified and committed (f0289e1)
- [x] `backend/api/src/routes/ai.ts` modified and committed (b747543)
- [x] Both commits confirmed in `git log --oneline`
- [x] TypeScript compilation clean
- [x] `recentFormResponses` in UserContext interface and return object
- [x] `Formulaires récents` string in ai.ts buildSystemPrompt
