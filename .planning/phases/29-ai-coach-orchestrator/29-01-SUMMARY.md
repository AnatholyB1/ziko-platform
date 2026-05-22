---
plan: 29-01
phase: 29-ai-coach-orchestrator
status: checkpoint_pending
completed_tasks: [Task 1, Task 1b]
pending_tasks: [Task 2 — human: supabase db push]
subsystem: backend/supabase
tags: [migration, rls, test-stubs, coach-ai]
key-files:
  created:
    - supabase/migrations/050_coach_ai_schema.sql
    - backend/api/test/coach/ai/db.spec.ts
    - backend/api/test/coach/ai/service.spec.ts
    - backend/api/test/coach/ai/tools.spec.ts
    - backend/api/test/coach/ai/alerts.spec.ts
    - backend/api/test/coach/ai/cron.spec.ts
    - backend/api/test/coach/ai/audit.spec.ts
    - packages/email/src/templates/WeeklyDigest.spec.tsx
decisions:
  - "Spec files placed in backend/api/test/coach/ai/ (not src/coach/ai/) to match vitest.config.ts include pattern test/**/*.{spec,test}.ts"
  - "packages/email directory created from scratch — did not exist in monorepo yet"
---

# Plan 29-01 Summary — Migration 050 + Test Stubs

## One-liner

Supabase migration creating `coach_alerts` and `ai_tool_audit` tables with RLS and indexes, plus 7 Wave-0 `it.todo` stub specs for the coach AI orchestrator.

## What was done

- Created `supabase/migrations/050_coach_ai_schema.sql` with:
  - `coach_alerts` table (4 alert types, 3 severity levels, is_read flag, coach_id + client_id FKs)
  - `ai_tool_audit` table (tool_name, args_hash, result_status, conversation_id FK)
  - RLS enabled on both tables with `coach_id` ownership policies
  - 3 indexes: `idx_coach_alerts_coach_unread` (partial), `idx_coach_alerts_created`, `idx_ai_tool_audit_coach_date`
- Created 6 `it.todo` stub spec files under `backend/api/test/coach/ai/`
- Created `packages/email/src/templates/WeeklyDigest.spec.tsx` stub (new package directory initialized)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Spec file paths corrected to match vitest config**
- **Found during:** Task 1b
- **Issue:** Plan specified `backend/api/src/coach/ai/*.spec.ts` but `vitest.config.ts` only includes `test/**/*.{spec,test}.ts` — files in `src/` are never discovered
- **Fix:** Placed all 6 backend API spec stubs in `backend/api/test/coach/ai/` matching the established project convention (all existing coach specs live in `test/coach/`)
- **Files modified:** All 6 backend spec files

## Blocking checkpoint

Human must run `supabase db push` from the repo root to apply migration 050 to the remote project.

Expected: migration 050 applied, no errors. Verify with `supabase db diff --linked` (should show no diff).

## Self-Check

- `supabase/migrations/050_coach_ai_schema.sql` — FOUND (verified via grep: 1 coach_alerts table, 1 ai_tool_audit table, 2 RLS enables, 3 indexes)
- `backend/api/test/coach/ai/db.spec.ts` — FOUND
- `backend/api/test/coach/ai/service.spec.ts` — FOUND
- `backend/api/test/coach/ai/tools.spec.ts` — FOUND
- `backend/api/test/coach/ai/alerts.spec.ts` — FOUND
- `backend/api/test/coach/ai/cron.spec.ts` — FOUND
- `backend/api/test/coach/ai/audit.spec.ts` — FOUND
- `packages/email/src/templates/WeeklyDigest.spec.tsx` — FOUND
- Commit `c1fc7b1` — FOUND

## Self-Check: PASSED
