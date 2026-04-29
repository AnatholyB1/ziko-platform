---
id: SEED-001
status: harvested
planted: 2026-03-28
planted_during: milestone v1.0 (post-launch, all 5 phases complete)
trigger_when: next major milestone — any milestone touching nutrition, AI coaching, or plugin expansion
scope: Large
---

# SEED-001: Smart Pantry + AI Recipe System plugin

## Why This Matters

The nutrition plugin today only tracks what you ate. This seed extends it into a complete
kitchen-intelligence layer: the app knows what food you have, suggests recipes based on
your pantry + macros + cravings, and auto-syncs the macros when you cook. This closes the
biggest gap in the nutrition workflow — the step from "what should I eat?" to "what do I
actually have at home?" — and makes the AI coach genuinely useful for meal planning, not
just logging.

It also unlocks a smart shopping list feature, which is a highly shareable, sticky feature
that differentiates Ziko from generic calorie trackers.

## When to Surface

**Trigger:** Next major milestone — especially any milestone that includes:
- Nutrition plugin enhancements or v2
- AI agent tool expansion (new plugin tools)
- Plugin catalog expansion (adding a new plugin)
- Post-launch growth / retention focus

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches
any of these conditions:
- New plugin is being designed (pantry = a new standalone plugin)
- Nutrition plugin is being extended or refactored
- AI tools registry is being expanded
- User retention / engagement milestone is being planned

## Scope Estimate

**Large** — a full milestone, significant effort across 4 sub-systems:

1. **Smart Inventory** (Medium phase)
   - New Supabase table: `pantry_items` (name, quantity, unit, expiration_date, category)
   - Plugin screens: pantry list, add/edit item, low-stock alerts
   - Auto-decrement stock when recipe is cooked

2. **AI Recipe Suggestions** (Medium phase)
   - New AI tools: `pantry_get_items`, `pantry_suggest_recipes`, `recipe_get_details`
   - AI agent reads pantry + today's remaining macros (calls `nutrition_get_today`)
   - Recipes returned include: ingredients, quantities, steps, calculated macros

3. **Calorie Tracker Sync** (Small phase)
   - When user confirms recipe cooked → calls `nutrition_log_entry` AI tool
   - AI pre-fills `meal_type` based on time of day
   - Optionally deducts used ingredients from pantry

4. **Smart Shopping List** (Small phase)
   - AI generates list from planned recipes + low-stock pantry items
   - In-app checklist UI + export (copy/share)
   - New AI tool: `shopping_list_generate`

## Breadcrumbs

Related code in the current codebase:

- `plugins/nutrition/src/store.ts` — `NutritionEntry` interface (`meal_type`, `food_name`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `serving_g`). Pantry sync must produce entries in this exact shape.
- `backend/api/src/tools/nutrition.ts` — `nutrition_get_today()`, `nutrition_log_entry()` — pantry recipe sync should call these existing tools directly.
- `backend/api/src/tools/registry.ts` — where new pantry AI tools (`pantry_get_items`, `pantry_suggest_recipes`, etc.) must be registered.
- `plugins/nutrition/src/manifest.ts` — reference for manifest structure; pantry plugin manifest should follow the same pattern (`aiTools`, `aiSkills`, `requiredPermissions`).
- `supabase/migrations/003_nutrition_schema.sql` — `nutrition_logs` table schema; new `pantry_items` migration must follow the same RLS pattern.
- `apps/mobile/src/lib/PluginLoader.tsx` — static `PLUGIN_LOADERS` map; new `pantry` plugin ID must be added here.
- `apps/mobile/app/(app)/(plugins)/` — thin route wrapper files needed for each pantry screen.

## Notes

The user described 4 concrete sub-features in detail:

1. **Smart inventory** — track items by drawer/cabinet/fridge, manage qty + units (g, ml, pieces) + expiration, auto-update on cook
2. **AI recipe suggestions** — based on pantry contents + user cravings + daily calorie goals + remaining macros
3. **Calorie tracker sync** — confirm recipe cooked → auto-add macros to nutrition logs, AI pre-fills meal_type
4. **Smart shopping list** — AI generates from planned recipes + missing/low-stock items; exportable checklist

This is a **new plugin** (plugin ID: `pantry`) rather than an extension to the existing
nutrition plugin, since it has its own data domain, screens, and AI tools — though it
integrates tightly with nutrition.
