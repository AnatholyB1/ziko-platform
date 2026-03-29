---
phase: 06-smart-inventory
plan: "03"
subsystem: pantry-ai-tools
tags: [backend, ai-tools, supabase, registry]
dependency_graph:
  requires: [pantry_items_table, pantry_plugin_package]
  provides: [pantry_ai_tools, pantry_navigation_screens]
  affects: [backend/api/src/tools]
tech_stack:
  added: []
  patterns: [tool-executor-pattern, clientForUser, name-ilike-fallback, upsert-on-create]
key_files:
  created:
    - backend/api/src/tools/pantry.ts
  modified:
    - backend/api/src/tools/registry.ts
    - backend/api/src/tools/navigation.ts
decisions:
  - "pantry_update_item doubles as add-or-update (D-10) — creates new item when name lookup finds no match, avoiding a separate pantry_add_item tool"
  - "name lookup uses ILIKE with % wildcards for case-insensitive partial match — matches 'chicken breast' from 'I have 500g chicken breast'"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
---

# Phase 06 Plan 03: Pantry AI Tools Backend Summary

**One-liner:** pantry.ts executor with clientForUser + ILIKE name fallback + create-if-not-found, wired into registry.ts schemas/executors and navigation.ts pantry screens.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create pantry tool executor | ae4d9cd | backend/api/src/tools/pantry.ts |
| 2 | Wire pantry tools into registry.ts and navigation.ts | 0a63608 | backend/api/src/tools/registry.ts, backend/api/src/tools/navigation.ts |

## What Was Built

### pantry.ts — Tool Executor Functions

Two exported async functions following the nutrition.ts pattern:

**`pantry_get_items`:**
- Queries `pantry_items` table with `clientForUser(userToken)` (RLS-aware)
- Orders by name ascending
- Accepts optional `storage_location` filter (fridge / freezer / pantry)
- Returns `{ items: PantryItem[], count: number }`

**`pantry_update_item`:**
- Primary lookup: by `item_id` if provided
- Fallback lookup: ILIKE `%name%` on `pantry_items` for the user (case-insensitive partial match)
- Create path: if no match found by name, inserts a new item with sensible defaults (`storage_location: 'fridge'`, `food_category: 'other'`, `low_stock_threshold: 1`)
- Update path: sets `updated_at` timestamp + `quantity` / `unit` / `name` (name only updated when targeting by ID to avoid renaming on fuzzy matches)
- Returns `{ action: 'created' | 'updated', item: PantryItem }`

### registry.ts — 4 Changes

1. `import * as PantryTools from './pantry.js'` added after WearablesTools
2. `pantryToolSchemas` array with full parameter definitions for both tools
3. Executor entries: `pantry_get_items` and `pantry_update_item` mapped to PantryTools functions
4. `...pantryToolSchemas` spread into `allToolSchemas` (before navigationToolSchemas)
5. `app_navigate` description updated to list `pantry_dashboard, pantry_add` in available screens

### navigation.ts — Pantry Screens Registered

```
pantry_dashboard: { label: 'Garde-Manger' }
pantry_add: { label: 'Ajouter article' }
```

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all functions are fully implemented. The tools query real `pantry_items` table rows and return live data.

## Self-Check: PASSED

Files verified:
- FOUND: backend/api/src/tools/pantry.ts
- FOUND: backend/api/src/tools/registry.ts (pantry entries confirmed)
- FOUND: backend/api/src/tools/navigation.ts (pantry screens confirmed)

Commits verified:
- FOUND: ae4d9cd (Task 1 — pantry.ts)
- FOUND: 0a63608 (Task 2 — registry.ts + navigation.ts)
