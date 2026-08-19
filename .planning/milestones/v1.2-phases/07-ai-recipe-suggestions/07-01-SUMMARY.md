---
phase: 07-ai-recipe-suggestions
plan: 07-01
subsystem: backend/api
tags: [ai, recipes, hono, generateObject, supabase, zod]
dependency_graph:
  requires: [06-smart-inventory]
  provides: [POST /pantry/recipes/suggest]
  affects: [backend/api/src/app.ts]
tech_stack:
  added: [zod ^4.3.6]
  patterns: [generateObject with Zod schema, parallel Supabase fetches, NoObjectGeneratedError catch]
key_files:
  created:
    - backend/api/src/routes/pantry-recipes.ts
  modified:
    - backend/api/src/app.ts
    - backend/api/package.json
decisions:
  - Used maxOutputTokens (not maxTokens) per AI SDK v6 CallSettings — maxTokens does not exist in v6
  - Typed body variable explicitly as `{ preferences?: string }` to avoid union type issue with catch fallback
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-29"
  tasks_completed: 3
  files_changed: 3
---

# Phase 7 Plan 1: AI Recipe Suggestions Backend Summary

## One-liner

Hono endpoint `POST /pantry/recipes/suggest` calls Claude via `generateObject` to produce 3 macro-aware French recipes from pantry contents using AI SDK v6 with Zod schema validation.

## What Was Built

A complete backend recipe suggestion API endpoint:

- `backend/api/src/routes/pantry-recipes.ts` — Hono router with `POST /recipes/suggest` handler
  - Auth-protected via `authMiddleware`
  - Fetches `pantry_items` and `nutrition_logs` in parallel from Supabase
  - Computes `remaining_macros` by subtracting today's consumed nutrition from daily targets (2000 kcal / 150g protein / 250g carbs / 65g fat), floored at 0
  - Calls `generateObject` with `claude-sonnet-4-20250514` and a Zod schema enforcing exactly the `RecipeSchema` shape
  - Returns `{ recipes: Recipe[], remaining_macros }` on success
  - Returns 500 with `"Impossible de générer des recettes. Veuillez réessayer."` if `NoObjectGeneratedError` is thrown
- `backend/api/src/app.ts` — mounted router at `/pantry` (`app.route('/pantry', pantryRecipesRouter)`)
- `backend/api/package.json` — added `zod ^4.3.6` to dependencies

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add zod to backend/api/package.json | c80ea85 | backend/api/package.json, package-lock.json |
| 2 | Create backend/api/src/routes/pantry-recipes.ts | d352ed9 | backend/api/src/routes/pantry-recipes.ts |
| 3 | Mount pantryRecipesRouter in backend/api/src/app.ts | 4996880 | backend/api/src/app.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed maxTokens to maxOutputTokens for AI SDK v6**
- **Found during:** Task 2
- **Issue:** The plan specified `maxTokens: 2000` but AI SDK v6 `CallSettings` uses `maxOutputTokens` — `maxTokens` does not exist in this type, causing a TypeScript error
- **Fix:** Changed to `maxOutputTokens: 2000`
- **Files modified:** `backend/api/src/routes/pantry-recipes.ts`
- **Commit:** d352ed9

**2. [Rule 1 - Bug] Explicit type annotation for body variable**
- **Found during:** Task 2
- **Issue:** `c.req.json<T>().catch(() => ({}))` returns `T | {}` union — TypeScript couldn't resolve `body.preferences` on the union type
- **Fix:** Added explicit type annotation `const body: { preferences?: string } = ...`
- **Files modified:** `backend/api/src/routes/pantry-recipes.ts`
- **Commit:** d352ed9

### Out-of-scope Issues Deferred

Pre-existing `src/tools/ai-programs.ts:70` TypeScript error (`maxTokens` instead of `maxOutputTokens`) — same bug pattern as above but in an unrelated file outside this plan's scope. Not fixed. Logged for future cleanup.

## Known Stubs

None. The endpoint is fully implemented with real Supabase queries and real AI generation. No hardcoded empty values or placeholders.

## Self-Check: PASSED

- [x] `backend/api/src/routes/pantry-recipes.ts` exists
- [x] `backend/api/src/app.ts` contains `pantryRecipesRouter` import and `app.route('/pantry', ...)`
- [x] `backend/api/package.json` contains `"zod"` in dependencies
- [x] Commits c80ea85, d352ed9, 4996880 exist in git log
- [x] TypeScript compilation: no errors in pantry-recipes.ts or app.ts (pre-existing ai-programs.ts error is out of scope)
