---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Security + Cloud Infrastructure
status: ready
stopped_at: Roadmap created — ready for Phase 12
last_updated: "2026-04-02T00:00:00.000Z"
last_activity: 2026-04-02
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-02)

**Core value:** A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and now shows them exactly what's in their food.
**Current focus:** v1.3 Security + Cloud Infrastructure — start with `/gsd:plan-phase 12`

## Current Position

Phase: 12 — Infra + Rate Limiting (not started)
Plan: —
Status: Roadmap approved — ready to plan Phase 12
Last activity: 2026-04-02 — v1.3 roadmap created (Phases 12–15)

Progress: [░░░░░░░░░░] 0% (v1.3 milestone — 0/4 phases)

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.3)
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 06 P01 | 3 | 2 tasks | 13 files |
| Phase 06 P03 | 4 | 2 tasks | 3 files |
| Phase 06 P02 | 4 | 2 tasks | 6 files |
| Phase 06 P04 | 5 | 2 tasks | 3 files |
| Phase 07-ai-recipe-suggestions P07-01 | 2m | 3 tasks | 3 files |
| Phase 07-ai-recipe-suggestions P07-02 | 3 | 4 tasks | 4 files |
| Phase 07-ai-recipe-suggestions P07-03 | 8 | 4 tasks | 9 files |
| Phase 07 P04 | 2m | 1 tasks | 3 files |
| Phase 08-calorie-tracker-sync P08-01 | 1m 18s | 1 tasks | 1 files |
| Phase 08-calorie-tracker-sync P02 | 8 | 2 tasks | 4 files |
| Phase 08 P03 | 5 | 2 tasks | 3 files |
| Phase 08-calorie-tracker-sync P03 | 5 | 3 tasks | 3 files |
| Phase 09-smart-shopping-list P09-01 | 2 | 2 tasks | 3 files |
| Phase 09-smart-shopping-list P09-02 | 3 | 2 tasks | 5 files |
| Phase 10-data-foundation-tech-debt P10-01 | 10 | 2 tasks | 2 files |
| Phase 10-data-foundation-tech-debt P10-02 | 5m | 2 tasks | 2 files |
| Phase 10-data-foundation-tech-debt P10-03 | 5m | 3 tasks | 5 files |
| Phase 11-barcode-ui-score-display P01 | 1m 43s | 2 tasks | 4 files |
| Phase 11-barcode-ui-score-display P11-02 | 15min | 1 tasks | 1 files |
| Phase 11-barcode-ui-score-display P11-03 | 1m 11s | 1 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 4-phase structure (Phases 6-9) derived from feature dependency tree — inventory gates recipes, recipes gate calorie sync, shopping list depends only on inventory
- Roadmap: Phase 9 (Shopping List) depends only on Phase 6 data — can be parallelised with Phase 8 if bandwidth allows
- Architecture: No `recipes` or `shopping_lists` tables — recipes generated on-demand by AI, shopping list computed from `pantry_items` — intentional for v1.1
- Architecture: `pantry_log_recipe_cooked` imports `nutrition_log_meal` directly from `./nutrition.js` — no HTTP round-trip, nutrition plugin untouched
- Architecture: Three mandatory registration touch points in Phase 6 — `PluginLoader.tsx`, `registry.ts`, and Supabase migration 022; missing any one produces silent failure
- [Phase 06]: Used storefront-outline Ionicons icon for pantry plugin (not emoji — manifest.icon passed directly to Ionicons component)
- [Phase 06]: PantryItemForm serves both add and edit routes via mode prop — single screen component for both create and update flows
- [Phase 06]: pantry_update_item doubles as add-or-update (D-10) — creates new item when name lookup finds no match, avoiding a separate pantry_add_item tool
- [Phase 06]: EXPIRY_COLORS uses hex alpha suffix for row background tints — avoids opacity affecting child text
- [Phase 06]: BarcodeScanner uses scannedRef (useRef) not useState for scan guard — prevents re-render race before async lookup resolves
- [Phase 06]: PantryItemForm uses inline DateTimePicker (display=default) — native calendar modal on both iOS and Android
- [Phase 06]: Pantry i18n reference copies in plugins/pantry/src/i18n/ serve as documentation only; runtime translations are in central plugin-sdk/src/i18n.ts
- [Phase 07-ai-recipe-suggestions]: AI SDK v6 uses maxOutputTokens (not maxTokens) in CallSettings — plan had wrong parameter name
- [Phase 07-ai-recipe-suggestions]: PantryRecipes reads recipes from Zustand store so state persists across navigation
- [Phase 07-ai-recipe-suggestions]: RecipeDetail uses useLocalSearchParams JSON param — no global store needed for single-item detail views
- [Phase 07-ai-recipe-suggestions]: Serving ratio (servings / base_servings) is pure client-side — no extra API call for macro scaling
- [Phase 07-03]: Expo Router wrapper files use thin-wrapper pattern from dashboard.tsx — imports screen + supabase, no additional logic
- [Phase 07-03]: declarations.d.ts module declaration for datetimepicker placed in apps/mobile/src/types/ — avoids tsconfig restructuring
- [Phase 07]: pantry.recipes_retry_btn mirrors pantry.recipes_retry value for semantic distinction between error state label and button label
- [Phase 07]: pantry.recipe_detail_back uses standard navigation labels (Retour/Back) consistent with existing back-navigation patterns
- [Phase 08]: RecipeConfirm is a navigated screen (not modal) receiving recipe+servings as JSON route params — same pattern as RecipeDetail
- [Phase 08]: calories column is INTEGER — use parseInt(caloriesStr, 10); protein_g/carbs_g/fat_g are NUMERIC(6,1) — use parseFloat
- [Phase 08]: Pantry decrement uses per-ingredient try/catch — nutrition insert failure does NOT block navigation, each ingredient failure is independent
- [Phase 08]: useEffect nutrition plugin gate uses .maybeSingle() not .single() — .single() throws PGRST116 when user_plugins row absent
- [Phase 08]: router.replace('/(app)/(plugins)/nutrition/dashboard') — full path required for cross-plugin navigation; confirm screen must not be in back-stack
- [Phase 08-calorie-tracker-sync]: calories uses parseInt(str, 10) — nutrition_logs.calories is INTEGER, not NUMERIC; pantry decrement is per-ingredient try/catch — non-blocking; router.replace ensures confirm screen not in back-stack
- [Phase 08-calorie-tracker-sync]: Use .maybeSingle() not .single() for nutrition plugin gate — .single() throws PGRST116 when row absent, logging errors for users without nutrition plugin
- [Phase 08-calorie-tracker-sync]: CTA hidden not disabled when nutritionInstalled is null/false — prevents flash, clean UX
- [Phase 08-calorie-tracker-sync]: Added missing ./screens/RecipeConfirm export to plugins/pantry/package.json (Rule 3 auto-fix from Plan 02)
- [Phase 08]: pantry.confirm_back and pantry.confirm_success intentionally omitted — screens use standard nav and showAlert without t() calls
- [Phase 08]: pantry.confirm_back and pantry.confirm_success intentionally omitted — screens use standard nav and showAlert respectively, with no t() call for these strings
- [Phase 09-smart-shopping-list]: shopping_list_items uses source enum ('low_stock' | 'recipe') matching context D-07; pantry_item_id nullable FK with ON DELETE SET NULL for recipe ingredients without pantry match
- [Phase 09-smart-shopping-list]: PantryTabBar extracted to shared component in components/ — both PantryDashboard and ShoppingList import from ../components/PantryTabBar
- [Phase 09-smart-shopping-list]: ShoppingList auto-populates low-stock pantry items on every mount — dedup by pantry_item_id presence in existing list
- [v1.2 Roadmap]: food_products is a shared catalogue (no user_id) — RLS must use auth.role() = 'authenticated', NOT the standard auth.uid() = user_id pattern; copying any existing migration will silently block all reads
- [v1.2 Roadmap]: nutrition_logs FK (food_product_id) must be nullable — barcode scan is optional; manual log entries must continue to work unchanged
- [v1.2 Roadmap]: offApi.ts must use world.openfoodfacts.org (production) — pantry barcode.ts uses .net (staging); these two utilities are intentionally independent and must not be merged
- [v1.2 Roadmap]: ecoscore_grade returns 'a-plus' and 'not-applicable' — ScoreBadge must handle both before render (map 'a-plus' to green "A+", hide badge for 'not-applicable' and unknown values)
- [v1.2 Roadmap]: serving_size is free text in OFF API — extract grams via regex /([\d.]+)\s*g/i, default to 100 on failure; never let NaN reach macro calculation or log insert
- [v1.2 Roadmap]: pantry_log_recipe_cooked AI tool requires three coordinated edits in registry.ts (import + executors record + allToolSchemas array); remove direct Supabase call from RecipeConfirm.tsx in the same task — never have both active simultaneously
- [v1.2 Roadmap]: DEBT-04 (Nyquist VALIDATION.md) is documentation-only — read each phase plan and cross-check against live app state before writing; no code changes
- [Phase 10-data-foundation-tech-debt]: D-05: low-stock shopping list item sets quantity = purchased amount directly (not threshold+1)
- [Phase 10-data-foundation-tech-debt]: D-03/D-04: recipe ingredient check-off adds to existing pantry qty if matched, inserts new item if unmatched
- [Phase 10-data-foundation-tech-debt]: pantry_log_recipe_cooked imports nutrition_log_meal directly — no HTTP round-trip (D-06)
- [Phase 10-data-foundation-tech-debt]: RecipeConfirm.tsx uses tool_name + parameters fields (not tool + params) — verified from ai.ts routes inspection
- [Phase 10-data-foundation-tech-debt]: food_products uses auth.role() = 'authenticated' RLS — shared catalogue has no user_id column
- [Phase 11-barcode-ui-score-display]: ScoreBadge uses module-level GRADE_COLORS/GRADE_LABELS constants — semantic colors, no theme dependency; returns null for null or unrecognized grades
- [Phase 11-barcode-ui-score-display]: NutritionEntry grade fields optional (string | null) — matches Supabase select('*') where columns absent in older rows
- [Phase 11-02]: Tab font size reduced from 14 to 12 for 4-tab LogMealScreen layout to prevent overflow
- [Phase 11-02]: Barcode tab camera is inline in tab content area (not modal) — consistent with AI scan tab pattern (D-08)
- [Phase 11-02]: IIFE used for scaled macros row computation — avoids extra state variables for derived values
- [Phase 11-02]: scannedRef uses useRef (not useState) for scan guard in LogMealScreen barcode tab — prevents re-render race before async lookup resolves
- [Phase 11-03]: Widget positioned after macros row and before TDEE Calculator link per UI-SPEC
- [Phase 11-03]: gradeToNum maps a-plus as 1 (same as a) — avgNutriscore output is always a single letter a-e, never a-plus
- [v1.3 Roadmap]: Rate limiting requires Upstash Redis (HTTP-based) — in-memory MemoryStore is silently useless on Vercel serverless (isolated per cold start); INFRA-01 must be provisioned before any middleware code is written
- [v1.3 Roadmap]: Middleware order is fixed — logger → cors → ipRateLimiter → [route mount] → authMiddleware → userRateLimiter → zValidator → handler; CORS must be first (preflight OPTIONS must never hit auth middleware)
- [v1.3 Roadmap]: Rate limiting key selection — userId (authenticated) > x-real-ip (Vercel-set) > x-forwarded-for (last resort); never use x-forwarded-for as primary (Vercel overwrites with egress proxy IPs, collapsing all users into one bucket)
- [v1.3 Roadmap]: Storage uploads use signed URL pattern (NOT backend proxy) — Vercel hard limit is 4.5 MB applied before handler runs; signed URL: POST /storage/upload-url (tiny JSON) → mobile uploads directly to Supabase Storage
- [v1.3 Roadmap]: Storage RLS uses path-prefix pattern — (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub'); NEVER copy from existing migrations (auth.uid() = user_id does not work on storage.objects which has no user_id column)
- [v1.3 Roadmap]: All three storage buckets are private — profile-photos (5 MB, images), scan-photos (10 MB, images, 90-day retention), exports (25 MB, PDF/CSV, 7-day retention)
- [v1.3 Roadmap]: React Native upload uses decode(base64) from base64-arraybuffer → ArrayBuffer with explicit contentType; no File objects, no raw base64, no global Content-Type: application/json on Supabase client
- [v1.3 Roadmap]: Signed URL expiry set to 300 seconds (not default 60) — generate at confirm step, not when photo picker opens; retry on expiry by fetching fresh token
- [v1.3 Roadmap]: Lifecycle cleanup via Vercel cron (POST /storage/cron/cleanup) — uses supabase.storage.from(bucket).remove([paths]) not raw SQL DELETE (which orphans objects); reuses cron pattern from supplement scraper
- [v1.3 Roadmap]: INFRA-02 (lifecycle cron) depends on storage buckets existing — Phase 15 must come after Phase 14
- [v1.3 Roadmap]: SEC-01/02/03 (CORS, headers, Zod validation) are independent of rate limiting and storage — placed in Phase 13 between rate limiting and storage

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 12: INFRA-01 Upstash provisioning is a manual step (Vercel dashboard) — must be done before any rate limiting code is written; MemoryStore default silently passes all local tests but provides zero protection on Vercel
- Phase 12: x-forwarded-for collapses all users to Vercel egress IPs — always use x-real-ip for unauthenticated IP key; userId for all authenticated routes
- Phase 13: CORS wildcard *.vercel.app is a live security flaw — active until Phase 13 ships; do not delay Phase 13 after Phase 12
- Phase 14: Storage RLS pattern diverges from all 24 existing migrations — write from scratch, never copy from any existing migration file
- Phase 14: SUPABASE_SERVICE_KEY availability in Vercel env must be confirmed before Phase 14 execution — storageClient.ts needs it to bypass Storage RLS for backend operations
- Phase 14: React Native upload produces 0-byte files with File object on iOS — always use base64-arraybuffer decode pattern
- Phase 15: Vercel cron endpoint must be authenticated via CRON_SECRET header — same pattern as existing supplement scraper cron

## Session Continuity

Last session: 2026-04-02T00:00:00.000Z
Stopped at: v1.3 roadmap created — Phases 12–15 defined, ready to plan Phase 12
Resume file: None
