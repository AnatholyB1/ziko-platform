# Research Summary — Ziko Smart Pantry Plugin (v1.1)

**Project:** Ziko Platform — `pantry` plugin
**Domain:** Pantry inventory + AI recipe suggestion + macro tracker integration + shopping list
**Researched:** 2026-03-28
**Confidence:** HIGH (stack + architecture verified against live codebase; features MEDIUM-HIGH cross-validated across pantry app competitors)

---

## Overview

Research across four areas confirms the Smart Pantry plugin is a well-scoped addition to the Ziko Platform that integrates cleanly into the existing architecture without structural changes to the host app or any existing plugin. The plugin's core value proposition — "What can I cook right now that fits my remaining macros?" — is uniquely achievable on Ziko because the Claude Sonnet agent already has live access to the user's nutrition state via `nutrition_get_today`. No standalone pantry app can replicate this without a full nutrition backend, making macro-aware recipe suggestions the unambiguous differentiator and the reason to build this plugin over a simpler ingredient tracker.

The stack research confirms two new dependencies are strictly required (`expo-camera` for barcode scanning, `@react-native-community/datetimepicker` for expiration date input), the Open Food Facts API requires no SDK or API key, and all AI features use the existing Vercel AI SDK v6 tool registration pattern. The architecture research — conducted with direct codebase inspection — defines a clean 4-phase build order with hard dependency gates between each phase, a single new Supabase table (`022_pantry_schema.sql`), and five new AI tools. No existing plugin or shared package requires modification beyond surgical additions to `PluginLoader.tsx`, `registry.ts`, and the root workspace config.

The highest-risk area is the seam between the pantry and nutrition plugins: cross-plugin writes to `nutrition_logs` can produce duplicate entries, the agent's 5-step tool-call budget is tight for multi-tool recipe suggestion flows, and the nutrition Zustand store will not auto-refresh after a backend-originated write. All three risks have clear, low-complexity mitigations documented in the pitfalls research and summarized below.

---

## Stack Additions

New dependencies only. Everything else (Expo SDK 54, React Native 0.81, NativeWind v4, Zustand v5, TanStack Query v5, MMKV v3, Supabase, Vercel AI SDK v6, Ionicons, `date-fns`) is already in the project and validated.

- **`expo-camera ~17.0.7`** — barcode scanning via `CameraView` + `barcodeScannerSettings`. The only supported path in SDK 54 (`expo-barcode-scanner` was removed in SDK 52). Install via `npx expo install expo-camera`. Requires an `app.json` plugin entry with `cameraPermission` string. Expo Go supports it natively so dev iteration works without a full EAS build.
- **`@react-native-community/datetimepicker`** (via `npx expo install`) — native date picker for expiration date input. Expo-blessed, v9.1.0 released March 2026, actively maintained. Use `mode="date"`, `minimumDate={new Date()}`, `display="compact"` on iOS.
- **`react-native-modal-datetime-picker ^18.0.0`** (conditional only) — modal wrapper if the Android inline picker causes layout problems. Evaluate at implementation time; do not add pre-emptively.
- **Open Food Facts API** — barcode-to-product lookup via plain `fetch`, no library, no API key. Single GET endpoint, 100 req/min, 4M+ products. Handle missing `nutriments` gracefully; not all products have complete macro data.

---

## Feature Table Stakes

Must be present in v1.1 for the plugin to feel complete. Missing any of these makes it feel broken or pointless.

| Feature | Notes |
|---------|-------|
| Add pantry item (name, qty, unit, category, location) | Manual entry; barcode scanning deferred to v1.2 per FEATURES.md |
| Edit and delete pantry items | Swipe-to-edit / swipe-to-delete — standard gesture pattern |
| View list grouped by location (Fridge / Freezer / Pantry) | Section headers or tabs |
| Expiration date field with green / yellow / red indicator | Red = expired or today, yellow = within 7 days, green = safe |
| "Expiring soon" items surfaced prominently | Pinned section or sort-to-top within each group |
| "What can I cook?" AI recipe suggestions | Core value; calls `pantry_suggest_recipes` which pulls `nutrition_get_today` for macro context |
| Each recipe shows macro breakdown (cal / P / C / F) before confirm | Users are macro trackers — non-negotiable |
| "I cooked this" → auto-logs macros to nutrition | Closes the pantry → recipe → nutrition loop |
| Pantry quantities decrement after cooking | Without this pantry becomes stale data within a week |
| Shopping list: low/out-of-stock items | Rule-based query, not AI-generated |
| Shopping list: check off items as purchased | Persists via MMKV until manually cleared |

---

## Differentiators

Features that set this plugin apart from standalone pantry apps. Not required at launch but drive retention and word-of-mouth.

| Feature | Why It Matters |
|---------|----------------|
| **Macro-aware recipe filtering** | AI suggests recipes that fit the user's *remaining* daily macro budget — zero extra infrastructure since `nutrition_get_today` already exists. No standalone pantry app has this. |
| **Expiry-first recipe suggestions** | "Your chicken expires tomorrow — here's what to make." Turns food waste prevention into daily engagement. Low cost: sort pantry items by soonest expiry in the prompt context. |
| **Craving input before recipe request** | Free text or 3-4 chips (High protein / Light / Quick / Comfort food). No backend complexity — a prompt parameter addition only. |
| **AI pre-fills meal_type from time of day** | Breakfast before 10am, lunch 10am–3pm, dinner 3pm–9pm, snack otherwise. Saves a tap in the confirm flow. Same pattern used by Cronometer and Fitia. |
| **Add missing recipe ingredients to shopping list in one tap** | Diff between recipe ingredients and current pantry state surfaced at confirm time; one-tap add. |
| **Export shopping list via native Share API** | 2 lines of React Native code. Users go to the grocery store on their phone — they need the list there. |
| **Per-serving portion adjustment on confirm** | Macros scale before logging; pantry deductions scale accordingly. |

---

## Architecture Highlights

The pantry plugin is the 18th plugin in the monorepo and follows the established pattern exactly: a package under `plugins/pantry/`, thin route wrappers under `apps/mobile/app/(app)/(plugins)/pantry/`, one Supabase migration (`022_pantry_schema.sql`), and five AI tools in `backend/api/src/tools/pantry.ts` registered in `registry.ts`.

**Build order is strictly sequential through 4 phases.** Database + scaffold must exist before inventory CRUD, which must exist before recipe suggestions, which must exist before calorie sync. Shopping list depends only on Phase 1 data and can be parallelised with Phase 3.

**Key integration points and schema decisions:**

- **Single new Supabase table** — `pantry_items` with `NUMERIC(8,2)` quantities (critical: not `INTEGER`), nullable `expiration_date`, nullable per-item `low_stock_threshold` column (add in Phase 1 migration at zero UI cost; used in Phase 4 alert logic), `location` enum (`pantry`/`fridge`/`freezer`), and standard `auth.uid() = user_id` RLS policy. Migration number: `022_pantry_schema.sql`.
- **No `recipes` or `shopping_lists` tables** — recipes are generated on demand and returned as structured JSON in the AI message thread, never persisted. Shopping list is computed from `pantry_items.quantity <= low_stock_threshold` on demand. This is intentional and correct for v1.1.
- **`pantry_suggest_recipes` is a data-gathering tool, not an AI call** — it collects pantry contents and remaining macros (via direct function import from `./nutrition.ts`, no HTTP round-trip) and returns a context object for the agent's next language model step.
- **`pantry_log_recipe_cooked` is the combined write tool** — imports and calls `nutrition_log_meal` from `./nutrition.ts` directly, then issues `pantry_items` quantity decrements. Nutrition plugin code and schema are untouched.
- **Three mandatory touch points for plugin registration** — `PluginLoader.tsx` (Metro static import), `registry.ts` (tool schemas + executors), and `supabase/migrations/`. Missing any one produces a silent failure with no error message.

**5 new AI tools:**

| Tool | Purpose |
|------|---------|
| `pantry_get_items` | Read inventory with optional `low_stock_only` filter |
| `pantry_update_item` | Unified create / update / decrement / delete |
| `pantry_suggest_recipes` | Data-gathering: collects pantry + remaining macros for Claude's next language model step |
| `pantry_log_recipe_cooked` | Combined nutrition log + pantry quantity decrement on cook confirm |
| `pantry_get_shopping_list` | Rule-based low-stock query; optional recipe ingredient augmentation |

**Modified files (surgical, minimal):**

| File | Change |
|------|--------|
| `apps/mobile/src/lib/PluginLoader.tsx` | Add 1 entry: `pantry: () => import('@ziko/plugin-pantry/manifest') as any` |
| `backend/api/src/tools/registry.ts` | Import `pantry.ts`; add 5 tool schemas to `allToolSchemas`; add 5 entries to `executors`; append 4 screen names to `app_navigate` description |
| Root `package.json` workspaces | Add `"plugins/pantry"` |

---

## Watch Out For

Top pitfalls with one-line prevention strategy each.

1. **Tool-call step budget exhausted before recipe response completes** — inject pantry macro context into the system prompt via `fetchUserContext` (following the existing `context/user.ts` pattern) so `nutrition_get_today` is not a live agent step; the 5-step budget is preserved for pantry-specific tool calls.

2. **Duplicate nutrition log: AI tool write + user re-logs manually** — always call `app_navigate(nutrition_dashboard)` immediately after `pantry_log_recipe_cooked` succeeds; this triggers the Nutrition screen's mount re-fetch so the user sees the entry has already been logged.

3. **Optimistic Zustand decrement without rollback on Supabase failure** — await the Supabase write before updating the store for any quantity mutation; show a brief loading indicator on the confirm button so the user knows a write is in progress.

4. **AI macro estimates logged with false precision** — display macro values as editable fields (not read-only text) in the confirm-cooked screen; prefix `food_name` with `"[Pantry] ... (est.)"` so AI-originated nutrition entries are identifiable in the Nutrition dashboard.

5. **Plugin invisible due to missing `PluginLoader.tsx` entry** — add `pantry: () => import('@ziko/plugin-pantry/manifest') as any` to `PLUGIN_LOADERS` in the same task that creates the package; Metro bundler requires static import strings and silently omits the plugin if this entry is missing.

---

## Implications for Roadmap

Four phases with a hard dependency gate between each. Phase sequence matches both the feature dependency tree (FEATURES.md) and the build order defined by codebase architecture (ARCHITECTURE.md).

### Phase 1 — Database + Plugin Scaffold + Smart Inventory

**Rationale:** Everything downstream depends on `pantry_items` data existing. All foundational decisions (column types, RLS, package name, route wrappers) are made here and are expensive to change later. Three registration touch points must all be wired before any screen or AI tool can function.

**Delivers:** User can add, edit, delete, and view pantry items grouped by location with expiry color indicators. AI can also manage pantry via `pantry_get_items` and `pantry_update_item`.

**Addresses:** All table stakes except recipe suggestion, calorie sync, and shopping list.

**Must avoid:** Integer column type for quantity (use `NUMERIC(8,2)`), missing RLS policy, wrong package name (`@ziko/pantry` instead of `@ziko/plugin-pantry`), missing `PluginLoader.tsx` entry, route wrappers not created at same time as manifest route declarations, expiry date using UTC date string instead of local calendar date.

**Research flag:** No deeper research needed — established patterns from nutrition/sleep/measurements plugins.

---

### Phase 2 — AI Recipe Suggestion Tools + Recipe UI

**Rationale:** Recipe suggestion is the feature that makes users understand why they are maintaining an inventory. Without it the plugin is a grocery tracker with no payoff. Must come before calorie sync since calorie sync depends on a recipe existing in conversation context.

**Delivers:** AI responds to "What can I cook?" with 3 macro-aware recipe suggestions showing available ingredients, missing ingredients (explicit `missing_ingredients[]` field in tool output), estimated macros, and cook time. Expiring-soon items are prioritized in suggestion context. Craving chips available in `PantryRecipes.tsx`.

**Addresses:** Core differentiator (macro-aware filtering), expiry-first suggestions, craving input.

**Must avoid:** Tool in `allToolSchemas` but missing from `executors` record (validate with `POST /ai/tools/execute` before Phase 3); `pantry_suggest_recipes` output schema must include explicit `missing_ingredients[]`; inject macro summary into system prompt to protect 5-step tool budget.

**Research flag:** No deeper research needed — tool registration pattern is established from `habits.ts` and `nutrition.ts`. Prompt engineering is straightforward.

---

### Phase 3 — Calorie Tracker Sync (Confirm-Cooked Flow)

**Rationale:** Closes the pantry → recipe → nutrition loop. Without this the plugin has no write-back to the nutrition tracker and the core value proposition is incomplete.

**Delivers:** User confirms a cooked recipe with editable macro fields, serving count selector, and meal type chips. `pantry_log_recipe_cooked` writes to `nutrition_logs` and decrements pantry quantities. `app_navigate` to Nutrition dashboard follows automatically to prevent duplicate logging.

**Addresses:** "I cooked this → auto-log macros" table stake; pantry quantity auto-decrement table stake; per-serving portion adjustment differentiator; AI meal_type pre-fill differentiator.

**Must avoid:** Double nutrition logging (use `app_navigate` after log); nutrition Zustand store staleness (navigation re-fetch handles this — do not build a bespoke event bus); silent failure when nutrition plugin is not installed (gate "Auto-log macros" UI on nutrition plugin installation check).

**Validation required before starting:** Confirm exact `meal_type` enum values in `supabase/migrations/003_nutrition_schema.sql` before implementing `pantry_log_recipe_cooked`.

**Research flag:** No deeper research needed — `nutrition_log_meal` is an existing function; import and call pattern is established.

---

### Phase 4 — Smart Shopping List

**Rationale:** Low complexity, high practical value. Depends only on `pantry_items` (Phase 1). Can be parallelised with Phase 3 if bandwidth allows.

**Delivers:** Two-section computed checklist — "Need to restock" (rule-based from `quantity <= low_stock_threshold`) and "For your recipes" (missing ingredients added during Phase 3 confirm flow). Items are checkable, persist via MMKV across process termination, and exportable via native Share API.

**Addresses:** Shopping list table stakes; export via Share API differentiator.

**Must avoid:** Shopping list lost on process kill (persist via MMKV on every item change — minimum; evaluate Supabase `shopping_list_items` table if cross-device sync is needed); stale items from prior generation (replace list on regeneration, do not accumulate); low-stock alert logic uses per-item `low_stock_threshold` column added in Phase 1 migration.

**Research flag:** No deeper research needed — rule-based query + MMKV persistence are standard patterns.

---

### Phase Ordering Rationale

- Phase 1 is mandatory first because three independent systems (mobile plugin registration, database, backend tools) must all be wired before any feature can be tested end-to-end.
- Phase 2 before Phase 3 because calorie sync is triggered from a recipe confirmation; recipes must exist in conversation context first.
- Phase 4 is parallelisable with Phase 3 because it depends only on Phase 1 data, but benefits from the `missing_ingredients[]` output defined in Phase 2 to populate the "For your recipes" shopping list section.
- Each phase ends with a validation gate that must pass before the next phase begins.

### Research Flags

No phases require a dedicated `research-phase` pass during planning. All patterns are established within the existing codebase:

- **Phase 1:** Plugin scaffold is identical to 17 existing plugins. Migration follows `003_nutrition_schema.sql` exactly. No novel decisions.
- **Phase 2:** AI tool registration follows `habits.ts` and `nutrition.ts` patterns exactly.
- **Phase 3:** `nutrition_log_meal` is an existing exported function; integration is a direct import.
- **Phase 4:** Rule-based Supabase query + MMKV write are well-established patterns in this codebase.

Single item requiring validation before Phase 3 (not a research gap, a code-read task): confirm exact `meal_type` enum values in `003_nutrition_schema.sql`.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `expo-camera` EAN support confirmed in official Expo SDK 54 docs; `expo-barcode-scanner` removal confirmed in multiple sources; datetimepicker v9.1.0 March 2026 release confirmed; OFF API endpoint and rate limits confirmed from official docs |
| Features | MEDIUM-HIGH | Table stakes and UX patterns cross-validated across CozZo, NoWaste, Cronometer (HIGH confidence official sources). Competitor feature comparisons sourced partially from industry blogs (MEDIUM/LOW confidence) but core patterns are consistent |
| Architecture | HIGH | All integration points verified by direct codebase inspection of `nutrition.ts`, `registry.ts`, `PluginLoader.tsx`, existing migrations, and `routes/ai.ts` |
| Pitfalls | HIGH | All top pitfalls derived from direct codebase inspection of existing patterns and known failure modes in the registered plugin ecosystem |

**Overall confidence: HIGH**

---

## Open Questions

Unresolved at research time. Requirements and roadmap planning should address these explicitly.

- **Recipe persistence scope** — Recipes are not stored in v1.1. If "save a recipe for re-use" is wanted, a `saved_recipes` table is needed. Requirements should confirm whether this is in v1.1 scope or definitively deferred.
- **Barcode scanning scope** — STACK.md researched `expo-camera` as a first-class dependency (ready to use). FEATURES.md marks barcode scanning as a v1.2+ anti-feature. These are consistent but requirements should confirm: is barcode scanning in v1.1 or definitively deferred to v1.2?
- **Unit mismatch on pantry decrement** — If a recipe calls for "200g chicken" but the pantry item is stored in `pcs`, the AI must estimate the conversion. No programmatic unit conversion table is planned — this is an AI judgment call. The pantry manifest's `aiSystemPromptAddition` should include guidance on unit handling; prompt engineering details should be defined during Phase 2 planning.
- **Offline write behavior** — No offline write queue is planned. MMKV caches reads; writes require connectivity. Confirm this is acceptable before Phase 1 ships.
- **`app_navigate` route mapping** — The navigation tool's description string in `registry.ts` maps human-readable identifiers to Expo Router paths. Verify the route resolver handles `pantry_dashboard`, `pantry_editor`, `pantry_recipes`, `pantry_shopping` before Phase 3 (which calls `app_navigate` after logging).

---

## Sources

### Primary (HIGH confidence)
- [Expo Camera docs — barcode types, CameraView, permissions](https://docs.expo.dev/versions/latest/sdk/camera/)
- [expo/fyi — barcode-scanner-to-expo-camera migration guide](https://github.com/expo/fyi/blob/main/barcode-scanner-to-expo-camera.md)
- [@react-native-community/datetimepicker Expo docs — v9.1.0](https://docs.expo.dev/versions/latest/sdk/date-time-picker/)
- [Open Food Facts API official docs — endpoint, rate limits, response fields](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- Codebase direct inspection: `backend/api/src/tools/nutrition.ts`, `backend/api/src/tools/registry.ts`, `apps/mobile/src/lib/PluginLoader.tsx`, `supabase/migrations/003_nutrition_schema.sql`, `supabase/migrations/021_cardio_gps.sql`
- [Cronometer official docs — confirm-to-log UX pattern, custom recipe flow](https://support.cronometer.com/hc/en-us/articles/360019870111)

### Secondary (MEDIUM confidence)
- CozZo, Panzy pantry apps — grouping and expiry UX patterns
- Fitia macro-aware meal planning — pantry + macro context integration patterns
- expo/expo GitHub issue #28741 — iOS EAN-13 `result.type` normalization caveat

### Tertiary (LOW confidence)
- NoWaste App Store listing — expiry urgency UX patterns
- Nutrola competitor blog — recipe app feature landscape 2026
- Perpetio agency blog — AI cooking app architecture patterns

---

*Research completed: 2026-03-28*
*Ready for roadmap: yes*
