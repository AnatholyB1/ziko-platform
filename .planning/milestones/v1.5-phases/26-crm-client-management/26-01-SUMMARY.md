---
phase: 26-crm-client-management
plan: "01"
subsystem: coach-sdk / web-deps / test-scaffolding
tags: [pre-flight, tanstack-table, recharts, zod-schemas, vitest-stubs]
dependency_graph:
  requires: []
  provides:
    - "@tanstack/react-table@8.21.3 in apps/web"
    - "recharts@3.8.1 in apps/web"
    - "ClientSummarySchema from @ziko/coach-sdk"
    - "CoachClientTagSchema from @ziko/coach-sdk"
    - "CoachClientNoteSchema from @ziko/coach-sdk"
    - "8 Vitest stub files in backend/api/test/coach/"
  affects:
    - "apps/web (new deps)"
    - "packages/coach-sdk/src/schemas/ (3 new schema files)"
    - "backend/api/test/coach/ (8 new stub files)"
tech_stack:
  added:
    - "@tanstack/react-table@^8.21.3 (apps/web)"
    - "recharts@^3.8.1 (apps/web)"
  patterns:
    - "Zod object schema with nullable fields for summary aggregates"
    - "Vitest it.todo stubs for Wave 1 Nyquist enforcement"
key_files:
  created:
    - apps/web/package.json (modified — new deps)
    - packages/coach-sdk/src/schemas/client-summary.ts
    - packages/coach-sdk/src/schemas/client-tag.ts
    - packages/coach-sdk/src/schemas/client-note.ts
    - backend/api/test/coach/clients-roster.spec.ts
    - backend/api/test/coach/clients-signals.spec.ts
    - backend/api/test/coach/clients-tabs.spec.ts
    - backend/api/test/coach/clients-summary.spec.ts
    - backend/api/test/coach/clients-tags.spec.ts
    - backend/api/test/coach/clients-notes.spec.ts
    - backend/api/test/coach/clients-compare.spec.ts
    - backend/api/test/coach/clients-revoke-coach.spec.ts
  modified:
    - packages/coach-sdk/src/schemas/index.ts (appended 6 export lines)
    - package-lock.json (root lockfile updated)
decisions:
  - "D-01: @tanstack/react-table pinned to ^8.21.3 per CONTEXT.md"
  - "D-16: recharts pinned to ^3.8.1 per CONTEXT.md"
  - "npm install run from apps/web/ — packages resolved to worktree root node_modules (npm workspace behavior)"
  - "TDD RED commit precedes GREEN commit — gate compliance preserved"
metrics:
  duration: "7m 13s"
  completed_date: "2026-05-18T09:00:42Z"
  tasks_completed: 2
  files_changed: 13
---

# Phase 26 Plan 01: Wave 0 Pre-flight — Deps + Schemas + Test Stubs Summary

**One-liner:** Installed @tanstack/react-table@8.21.3 and recharts@3.8.1 in apps/web, created 3 Zod schemas (ClientSummarySchema, CoachClientTagSchema, CoachClientNoteSchema) in packages/coach-sdk, and scaffolded 8 Vitest it.todo stub files for all CRM client management routes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @tanstack/react-table and recharts in apps/web | 0f08fe0 | apps/web/package.json, package-lock.json |
| 2 (RED) | Add 8 Vitest test stubs | 3500b4f | 8 × backend/api/test/coach/clients-*.spec.ts |
| 2 (GREEN) | Add 3 Zod schemas to coach-sdk | 4f6edcc | 3 schema files + index.ts |

## Verification

- `apps/web/package.json` contains `"@tanstack/react-table": "^8.21.3"` — PASS
- `apps/web/package.json` contains `"recharts": "^3.8.1"` — PASS
- Packages resolved in worktree root `node_modules/@tanstack/react-table` and `node_modules/recharts` — PASS
- 8 new test stub files exist in `backend/api/test/coach/` (total 11 clients-*.spec.ts) — PASS
- `vitest run` exits 0 on stub files (9 todos, 0 failures) — PASS
- `packages/coach-sdk/src/schemas/index.ts` exports ClientSummarySchema, CoachClientTagSchema, CoachClientNoteSchema — PASS
- `client-summary.ts` fields: sessions_this_week, habits_pct, last_workout_at, latest_weight_kg, mood_delta, mood_prev_avg, mood_curr_avg — PASS
- `client-tag.ts` fields: id, coach_id, client_id, tag (max 50), created_at — PASS
- `client-note.ts` fields: id, coach_id, client_id, content, updated_at — PASS

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test stubs) | 3500b4f | PASS — 8 it.todo stubs, vitest exits 0 |
| GREEN (schema implementation) | 4f6edcc | PASS — 3 schemas exported, vitest still exits 0 |

## Known Stubs

None. All stub files are intentional Wave 0 scaffolds (it.todo), not unintended stubs.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. Deps are Apache-2.0/MIT well-known packages pinned to exact versions with lockfile integrity hashes (T-26-00-01: accept disposition per plan threat model).
