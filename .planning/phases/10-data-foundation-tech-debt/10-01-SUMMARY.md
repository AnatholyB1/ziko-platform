---
phase: 10-data-foundation-tech-debt
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, open-food-facts, typescript, caching]

# Dependency graph
requires:
  - phase: 03-nutrition-schema
    provides: nutrition_logs table that gets extended with FK columns
provides:
  - food_products Supabase shared-catalogue table with barcode index
  - nutrition_logs extended with nullable food_product_id FK, nutriscore_grade, ecoscore_grade
  - getOrFetchProduct caching utility in plugins/nutrition/src/utils/offApi.ts
  - FoodProduct TypeScript interface
affects: [11-barcode-ui-score-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared-catalogue RLS: auth.role() = 'authenticated' for tables with no user_id column (diverges from all 23 prior migrations)"
    - "Get-or-fetch cache pattern: Supabase cache check first, then OFF API, then upsert with onConflict: barcode"
    - "upsert with onConflict guard prevents duplicate inserts under concurrent scan race conditions"

key-files:
  created:
    - supabase/migrations/024_food_products.sql
    - plugins/nutrition/src/utils/offApi.ts
  modified: []

key-decisions:
  - "food_products uses auth.role() = 'authenticated' RLS (not auth.uid() = user_id) — shared catalogue has no user_id column"
  - "offApi.ts points to world.openfoodfacts.org (production), not world.openfoodfacts.net (staging) — intentionally separate from pantry barcode.ts"
  - "serving_size parsed via /([\d.]+)\\s*g/i regex with default 100 — NaN-safe DB inserts"
  - "ecoscore 'not-applicable' and 'unknown' mapped to null — 'a-plus' stored as-is"
  - "upsert used instead of insert to handle concurrent scan race conditions"

patterns-established:
  - "Pattern: Shared catalogue tables use auth.role() = 'authenticated' for RLS, not per-user uid"
  - "Pattern: OFF API utilities take supabase client as parameter (standard plugin convention)"

requirements-completed: [SCAN-01, SCAN-03]

# Metrics
duration: 10min
completed: 2026-04-02
---

# Phase 10 Plan 01: Data Foundation Summary

**food_products shared-catalogue Supabase table + offApi.ts get-or-fetch caching utility for barcode-enriched nutrition logs**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-02T00:00:00Z
- **Completed:** 2026-04-02T00:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created migration 024 with `food_products` shared-catalogue table (barcode UNIQUE, macros per 100g, nutriscore_grade, ecoscore_grade, serving_size_g)
- Extended `nutrition_logs` with nullable `food_product_id` FK, `nutriscore_grade`, and `ecoscore_grade` columns — existing manual entries unaffected
- Created `offApi.ts` with `FoodProduct` interface and `getOrFetchProduct` cache-first function using Open Food Facts production API

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 024 — food_products table + nutrition_logs extension** - `bca04a1` (feat)
2. **Task 2: Create offApi.ts — get-or-fetch product caching utility** - `208792c` (feat)

## Files Created/Modified
- `supabase/migrations/024_food_products.sql` - food_products table with shared-catalogue RLS + nutrition_logs ALTER TABLE extension
- `plugins/nutrition/src/utils/offApi.ts` - FoodProduct interface + getOrFetchProduct cache-first utility

## Decisions Made
- RLS for `food_products` uses `auth.role() = 'authenticated'` (not `auth.uid() = user_id`) — shared catalogue has no `user_id` column; all 23 prior migrations use user-scoped RLS, this is the only exception
- `offApi.ts` uses production URL `world.openfoodfacts.org`, not staging `.net` used by pantry's `barcode.ts` — intentionally separate utilities, do not merge
- `upsert` with `onConflict: 'barcode'` handles race condition where two users scan the same product simultaneously
- Comment in migration changed to avoid mentioning `auth.uid()` even in comments (acceptance criteria: no `auth.uid()` anywhere in the file)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Migration 024 needs to be applied to Supabase; this is handled via the standard migration workflow.

## Next Phase Readiness
- Phase 11 (barcode-ui-score-display) can now call `getOrFetchProduct(barcode, supabase)` to retrieve cached product data
- `nutrition_logs` accepts `food_product_id`, `nutriscore_grade`, `ecoscore_grade` — score data can be stored on log entries
- `FoodProduct` type is importable from `@ziko/plugin-nutrition/utils/offApi` for UI rendering

---
*Phase: 10-data-foundation-tech-debt*
*Completed: 2026-04-02*
