# Domain Pitfalls: Smart Pantry Plugin

**Domain:** Pantry inventory + AI recipes + calorie sync + shopping list added to an existing Expo SDK 54 / React Native fitness app with 17 plugins and a Supabase backend
**Researched:** 2026-03-28
**Confidence:** HIGH — based on direct codebase inspection of `plugins/nutrition/`, `backend/api/src/tools/`, `supabase/migrations/`, `apps/mobile/src/lib/PluginLoader.tsx`, and the existing plugin registration and RLS patterns

---

## Summary

The pantry plugin is a tight integration of four sub-systems that each carry distinct failure modes. The most dangerous risks are not in any single sub-system but at the seams between them.

The plugin writes to `nutrition_logs` (owned by the nutrition plugin) via an AI tool chain. This cross-plugin write is architecturally correct — `nutrition_log_meal` already exists and is callable by any registered tool — but it creates user-visible duplicate logging if the pantry UI and the AI agent both fire the write for the same recipe.

Pantry quantities live in a Zustand store. Any mutation (auto-decrement on cook, manual edit, shopping list restock) that is not immediately committed to Supabase creates a stale-state divergence the next time the app cold-starts.

The AI recipe suggestion tool must call `nutrition_get_today` to read today's remaining macros. That tool is already registered in `registry.ts` and works correctly. The trap is that this consumes one of the orchestrator agent's five allowed tool-call steps, narrowing the budget for pantry-specific tool calls.

Shopping list state is inherently ephemeral if treated only as derived AI output. Without a `shopping_list_items` table or MMKV persistence, list state is lost on process termination and cannot be shared or exported.

Plugin registration has three hard-coded touch points in this codebase: `PLUGIN_LOADERS` in `PluginLoader.tsx`, the Supabase migration file, and `registry.ts` in the backend. Missing any one of them produces a silent, difficult-to-debug failure.

---

## Pitfalls by Category

---

### Category 1: Pantry Inventory — Mobile State and Persistence

#### Pitfall 1.1 — Zustand Store Not Re-hydrated on Cold Start

**What goes wrong:** The pantry Zustand store is populated on first mount but never re-fetched on subsequent cold starts unless an explicit `loadPantryItems(supabase)` call is wired into the screen's `useEffect`. Every existing plugin that holds server state requires this manual wiring (e.g. `useNutritionStore.loadTDEEProfile` in `NutritionDashboard.tsx`). Without it, the user opens the app and sees stale or empty inventory.

**Why it happens:** Zustand has no automatic Supabase persistence. `react-native-mmkv` persists lightweight sync state but not async server state. There is no `@ziko/plugin-sdk` hook that auto-fetches plugin-specific tables.

**Prevention:**
- In `PantryDashboard.tsx`, wire `useEffect(() => { loadPantryItems(supabase); }, [user?.id])` unconditionally on mount — identical to the pattern in `NutritionDashboard.tsx`.
- Guard the UI with an `isLoading` flag in the store so the first render never shows a stale zero-state as if the pantry is empty.

**Phase:** Phase 1 (Smart Inventory foundation).

---

#### Pitfall 1.2 — Fractional Quantity Precision Drift

**What goes wrong:** Pantry quantities span grams, milliliters, and piece counts. If the `quantity` column is stored as `INTEGER` (the simpler migration path used by some existing tables), then decrementing 250g from a 500g item passes through JavaScript floating-point arithmetic and may produce `249.9999...` before the insert. Over multiple cook-and-decrement cycles, cumulative rounding error becomes user-visible (e.g. "Chicken breast: 0.0003g remaining").

**Why it happens:** The existing `nutrition_logs` migration uses `NUMERIC(6,1)` for gram values, but other tables (e.g. `habit_logs`) use `INTEGER` for counts. A developer writing the pantry migration by memory may default to `INTEGER`.

**Prevention:**
- Define `quantity NUMERIC(8,2)` in the `pantry_items` migration — not `INTEGER`. This matches kitchen measurement grain (e.g. 1.5 tbsp, 250.00 ml).
- In all decrement operations, apply `Math.round(qty * 100) / 100` before writing to the store or Supabase. Never use raw floating-point subtraction.

**Phase:** Phase 1 (Supabase migration column type decision).

---

#### Pitfall 1.3 — Optimistic UI Decrement Without Rollback on Supabase Failure

**What goes wrong:** When the user confirms a cooked recipe, the pantry screen immediately decrements quantities in the Zustand store (optimistic update), but the Supabase write then fails silently. The store shows lower quantities than the database. On the next cold start, the Supabase fetch restores the pre-decrement values and the quantities jump back up, confusing the user.

**Why it happens:** Optimistic updates ("update store, then persist") are appropriate for append operations (adding a log entry) but not for in-place mutations of existing quantity fields, where drift between local and remote state is not self-correcting.

**Prevention:**
- Await the Supabase write before updating the Zustand store for quantity mutations.
- Pattern: `const { error } = await supabase.from('pantry_items').update({ quantity: newQty }).eq('id', id).eq('user_id', userId); if (!error) store.decrementItem(id, qty);`
- Show a brief loading indicator on the confirm-cooked button so the user understands a write is in progress.

**Phase:** Phase 1 (inventory decrement on cook, reinforced in Phase 3).

---

#### Pitfall 1.4 — Expiration Date Timezone Mismatch

**What goes wrong:** Expiration dates are entered by the user in local calendar time but `new Date().toISOString().split('T')[0]` returns the UTC date. A user in UTC+2 entering "expires tomorrow" at 11pm stores today's UTC date. The expired/low-stock alert fires a calendar day early.

**Why it happens:** The existing `nutrition_logs` table uses `DEFAULT CURRENT_DATE` (server UTC), which is acceptable for meal logging. That same pattern, copied without adjustment to expiration tracking, breaks when user intent is a local calendar date.

**Prevention:**
- Derive expiration dates from local calendar using `new Date().toLocaleDateString('en-CA')`, which returns `YYYY-MM-DD` in the device's local timezone.
- For expiration comparison queries, compare `expiration_date` against the same local-date string, not a UTC timestamp.

**Phase:** Phase 1 (add-item form + migration default).

---

### Category 2: AI Recipe Suggestions — Cross-Plugin Data Access

#### Pitfall 2.1 — Tool-Call Step Budget Exhausted Before Response

**What goes wrong:** The recipe suggestion flow requires at minimum three tool calls: `pantry_get_items`, `nutrition_get_today` (to read remaining daily macros), and `pantry_suggest_recipes`. The orchestrator agent in `backend/api/src/routes/ai.ts` uses `stopWhen: stepCountIs(5)`. If a follow-up clarification or navigation tool call is also needed, the agent hits the limit and stops mid-response before confirming results to the user.

**Why it happens:** `stopWhen: stepCountIs(5)` is a global constraint shared by all tools. Recipe suggestions are inherently multi-step and consume more budget than simpler tools (habit logging, hydration logging) that were the baseline when 5 steps was chosen.

**Prevention:**
- Pre-fetch today's macro summary and inject it into the AI system prompt for the pantry context block, following the same pattern as `fetchUserContext` in `backend/api/src/context/user.ts`. This eliminates the `nutrition_get_today` call from the live agent loop, freeing one step.
- Alternatively, design `pantry_suggest_recipes` to accept optional `remaining_calories` and `remaining_protein_g` parameters, so the calling client (or a pre-call context fetch) can pass current macro state and skip the inter-tool call.
- Do not increase `stopWhen` globally — that affects all agent turns, not just pantry.

**Phase:** Phase 2 (pantry tool design in `backend/api/src/tools/pantry.ts`).

---

#### Pitfall 2.2 — AI Macro Estimates Logged With False Precision

**What goes wrong:** The AI generates a recipe with macro estimates (calories, protein_g, carbs_g, fat_g) for the `nutrition_log_meal` call. Claude's estimates for arbitrary home-cooked recipes carry ±20–30% error. The user confirms cooking, the macros are logged with false precision, and over time their nutrition tracking becomes unreliable — especially for users managing fat loss or muscle gain goals.

**Why it happens:** The AI does not have access to a food composition database. It generates plausible-sounding macro values from training data, not from measured ingredient weights.

**Prevention:**
- In the confirm-cooked screen, display macro values as editable number fields, not read-only display text. The user must be able to adjust before logging.
- Set `food_name` to something like `"[Pantry] Chicken stir-fry (est.)"` in the `nutrition_log_meal` call, so the user can identify AI-originated entries in their Nutrition dashboard and knows to review them.
- Add to `pantry` plugin's `aiSystemPromptAddition`: "When providing recipe macros, explicitly state these are estimates and encourage the user to adjust portions before confirming."

**Phase:** Phase 3 (confirm-cooked UI in Phase 3; tool prompt in Phase 2).

---

#### Pitfall 2.3 — `pantry_suggest_recipes` Blurs "Have" vs. "Need" Ingredients

**What goes wrong:** The AI is instructed to suggest recipes based on available pantry items, but it also returns recipes that require 1–2 additional ingredients the user does not have. Without an explicit output schema enforcing the distinction, the AI conflates "you have most of what you need" with "you can make this," and the user starts cooking only to discover a missing key ingredient.

**Why it happens:** The AI treats the pantry as a suggestion set, not a hard constraint. Without a schema field that forces the AI to enumerate missing ingredients separately, it will blend them into the ingredient list or omit them silently.

**Prevention:**
- Define the `pantry_suggest_recipes` tool output schema to include `{ recipe_name, available_ingredients[], missing_ingredients[], estimated_macros }`. The AI must populate `missing_ingredients[]` explicitly — even an empty array is informative.
- In the recipe suggestion UI, show a "missing ingredients" badge on each recipe card. This also feeds directly into the shopping list without an additional AI call.

**Phase:** Phase 2 (tool output schema); Phase 4 (shopping list integration).

---

#### Pitfall 2.4 — Pantry AI Tool Registered in Schema But Missing From `executors` Map

**What goes wrong:** New pantry tools (`pantry_get_items`, `pantry_suggest_recipes`, `pantry_update_quantity`, `shopping_list_generate`) are implemented in `backend/api/src/tools/pantry.ts` and added to `allToolSchemas` in `registry.ts`. But one or more entries are omitted from the `executors` record. The AI schema advertises the tool to Claude, but `getToolExecutor(name)` returns `undefined`. The agent silently fails on that tool call with no visible error in the UI.

**Why it happens:** `registry.ts` requires three coordinated changes per tool: an `import *` statement, an entry in `allToolSchemas`, and an entry in `executors`. Adding to the schema list (which is more readable) while forgetting `executors` (which is a flat key-value record) is an easy miss. There is no TypeScript exhaustiveness check on `executors`.

**Prevention:**
- After adding any tool to `pantry.ts`, verify it appears in all three locations in `registry.ts`: import, `executors`, `allToolSchemas`.
- Validate at the HTTP level before end-to-end testing: call `GET /ai/tools` and confirm every `pantry_*` name is listed; then call `POST /ai/tools/execute` with each tool directly to confirm execution succeeds.

**Phase:** Phase 2 (AI tool registration); must be verified before Phase 3 begins, since Phase 3 depends on `nutrition_log_meal` being callable from the pantry flow.

---

### Category 3: Calorie Tracker Sync — Duplicate Logging and Cross-Plugin State

#### Pitfall 3.1 — Double Log: AI Tool Write + Manual UI Write for Same Recipe

**What goes wrong:** The user asks the AI coach "I made the chicken recipe, log it for me." The AI calls `nutrition_log_meal` successfully. The user then opens the Nutrition dashboard, does not see the entry (because `useNutritionStore.todayLogs` has not refreshed), and manually logs the same meal. The `nutrition_logs` table has no uniqueness constraint on `(user_id, date, food_name)`, so both inserts succeed. The user's daily total is now doubled.

**Why it happens:** The AI-initiated log and the manual UI log are independent write paths with no deduplication guard. The Zustand store is not subscribed to real-time Supabase changes — it is fetched once on mount and does not update when a backend write occurs.

**Prevention:**
- After `nutrition_log_meal` is called in the pantry confirm-cooked flow, immediately call the `app_navigate` tool with `screen: "nutrition_dashboard"` in the same agent response. Navigating the user to the Nutrition dashboard triggers its mount `useEffect` re-fetch, which will show the pantry-logged entry, preventing a double manual log.
- Do not add a uniqueness constraint on `nutrition_logs` — the existing plugin intentionally allows multiple entries of the same food name on the same day (e.g. chicken breast for lunch and dinner).

**Phase:** Phase 3 (confirm-cooked flow design; `app_navigate` is already in `registry.ts` and costs one tool-call step).

---

#### Pitfall 3.2 — Nutrition Plugin Zustand Store Not Refreshed After Pantry Backend Write

**What goes wrong:** When pantry triggers `nutrition_log_meal` via the backend AI tool, the entry is written to Supabase. The nutrition plugin's `useNutritionStore.todayLogs` array on the mobile client does not know about it. The Nutrition dashboard still shows the old macro totals until the user navigates away and back.

**Why it happens:** The nutrition Zustand store is not backed by a real-time Supabase subscription. There is no cross-plugin event bus in `@ziko/plugin-sdk`. Plugin stores are intentionally isolated — `usePantryStore` cannot call `useNutritionStore.addLog()`.

**Prevention:**
- Do not attempt to update the nutrition store from pantry. Instead, use the `app_navigate` approach from Pitfall 3.1. The `NutritionDashboard` mount `useEffect` handles the re-fetch automatically.
- If cross-plugin state refresh becomes a recurring need across the platform, file it as a future `@ziko/plugin-sdk` enhancement (event bus or query invalidation hook). Do not build a bespoke solution in Phase 3.

**Phase:** Phase 3.

---

#### Pitfall 3.3 — Nutrition Plugin Not Installed, Calorie Sync Silently Fails

**What goes wrong:** The pantry plugin calls `nutrition_log_meal` through the AI agent. If the user has not installed the nutrition plugin, `nutrition_log_meal` is not in the agent's registered tool list (tools are loaded conditionally by `aiBridge.registerPlugin` in `PluginLoader.tsx`). The agent attempts the call, the tool is not found, and the recipe cooked event is not logged. The user sees no error — the AI simply continues without the log.

**Why it happens:** `aiBridge.registerPlugin` registers each plugin's `aiTools` array. A plugin that depends on another plugin's tools has no mechanism to declare or enforce that dependency. There is no `requiredPlugins` field in `PluginManifest`.

**Prevention:**
- In the confirm-cooked screen, check whether the nutrition plugin is installed before showing the "Auto-log macros" option. A reliable heuristic: attempt to read `useNutritionStore.calorieGoal` — if it is the store default (2400) and `tdeeProfile` is null, the plugin is likely not configured. Show a prompt: "Install the Nutrition Tracker to auto-log macros from recipes."
- Add `requiredPermissions: ['read_nutrition', 'write_nutrition']` to the pantry manifest and document the dependency in the plugin description shown in the plugin catalog.
- On the backend, if `nutrition_log_meal` is not registered and the pantry tool sequence attempts it, the agent will skip the call. Design `pantry_suggest_recipes` to return `{ ..., calorie_sync_available: boolean }` based on whether `nutrition_log_meal` is in the active tool registry, so the client can gate the confirm-cooked UI appropriately.

**Phase:** Phase 3 (defensive UX in confirm-cooked screen).

---

### Category 4: Shopping List — Stale Data and Persistence

#### Pitfall 4.1 — Shopping List Lost on Process Termination

**What goes wrong:** The AI generates a shopping list and it is displayed to the user. If the app is backgrounded and the React Native process is killed (common when switching apps at the grocery store), the list is gone. The user returns to the app to find an empty shopping list.

**Why it happens:** If the list is held only in a Zustand store without Supabase or MMKV persistence, it does not survive process termination. Unlike the nutrition or sleep stores — which are re-fetchable from Supabase on mount — the shopping list is AI-generated output and cannot be trivially re-fetched without burning additional AI credits and producing a slightly different list.

**Prevention:**
- Persist the shopping list to MMKV (`react-native-mmkv`) on every item change. MMKV survives process termination and is synchronous. This is the minimum viable persistence for Phase 4.
- If the list needs to sync across devices or be shareable, add a `shopping_list_items` Supabase table: `(id, user_id, item_name, quantity, unit, checked, source ['recipe'|'low_stock'], pantry_item_id, created_at)`. This is a larger scope addition; evaluate against Phase 4 timeline.
- Do not rely on re-generating the list from the AI as the recovery path. Each generation produces different ordering and phrasing, which is confusing if the user has already mentally processed the previous list.

**Phase:** Phase 4 (persistence decision made before writing any list UI).

---

#### Pitfall 4.2 — Global Low-Stock Threshold Fires for Wrong Items

**What goes wrong:** A single `low_stock_threshold` config value (e.g. "alert when quantity is below 20% of original") is applied uniformly to all pantry items. This fires an alert for salt at 50g (plenty) while missing the fact that 50g of chicken breast is critically low. Alerts become noise and users disable them.

**Why it happens:** The path of least resistance is a single plugin-settings threshold value. Per-item thresholds require a DB column and additional form UI.

**Prevention:**
- Add `low_stock_threshold NUMERIC(8,2)` as a nullable column in `pantry_items` in the Phase 1 migration. When null, fall back to the plugin-level global default. This allows the common case (most items use defaults) while supporting exceptions.
- In the add/edit item form (Phase 1), expose an optional "Alert me when below [amount] [unit]" field. Pre-fill it with the global default for discoverability.
- The column costs nothing to add in Phase 1 and makes the Phase 4 alert logic trivially correct.

**Phase:** Phase 1 (migration column, nullable — zero UI cost); Phase 4 (alert logic uses the column).

---

#### Pitfall 4.3 — Shopping List Contains Items Already Restocked

**What goes wrong:** The user generates a shopping list on Tuesday (oats are low). On Wednesday they buy oats and update the pantry quantity. On Thursday the AI generates a new list — oats still appear because the AI tool reads pantry state fresh at generation time and oats are no longer low-stock. However, if the shopping list is persisted (Pitfall 4.1 fix), the old list entry for oats is not automatically removed when the pantry quantity is updated.

**Why it happens:** The persisted shopping list is a snapshot. There is no live linkage between `pantry_items.quantity` and a stored `shopping_list_items.checked` field.

**Prevention:**
- When generating a new shopping list, always clear or replace the previous list rather than appending to it. The list should be regenerated from current pantry state, not accumulated over time.
- If using a `shopping_list_items` table, include a `pantry_item_id` foreign key (nullable) for low-stock-sourced items. When `pantry_items.quantity` for that ID rises above threshold, auto-mark the shopping list item as checked (via a Supabase function or app-level query on list screen mount).
- For recipe-sourced items (no pantry link), leave `pantry_item_id` null and rely on manual checking.

**Phase:** Phase 4.

---

### Category 5: Plugin Integration — Registration and Routing

#### Pitfall 5.1 — Metro Bundler Requires Static Import String in `PluginLoader.tsx`

**What goes wrong:** The developer adds `pantry` to `plugins_registry` and `user_plugins` in Supabase but forgets to add it to `PLUGIN_LOADERS` in `apps/mobile/src/lib/PluginLoader.tsx`. The plugin never loads — no manifest, no tab bar entry, no AI tools registered in `aiBridge`. There is no error message. The plugin is silently absent for all users.

**Why it happens:** Metro bundler (Expo) cannot analyze dynamic `import(variable)` expressions at build time. `PLUGIN_LOADERS` uses string literals for every plugin path. This is documented with the comment "Metro bundler requires statically-analyzable imports" at the top of the file. Adding a Supabase row is necessary but not sufficient.

**Prevention:**
- Add the `pantry` entry to `PLUGIN_LOADERS` as part of the same task that creates the plugin package. Treat it as a compile-time requirement, not runtime configuration.
- Entry to add: `pantry: () => import('@ziko/plugin-pantry/manifest') as any`
- Verify after starting Expo dev server that the plugin tab appears for a test user who has `pantry` in `user_plugins`.

**Phase:** Phase 1 (plugin scaffolding); cannot be deferred — the plugin is invisible without it.

---

#### Pitfall 5.2 — Missing Route Wrapper Files Cause Runtime 404

**What goes wrong:** The pantry manifest declares routes (e.g. `/(plugins)/pantry/dashboard`, `/(plugins)/pantry/inventory`, `/(plugins)/pantry/shopping-list`). Without corresponding files at `apps/mobile/app/(app)/(plugins)/pantry/dashboard.tsx` (and so on), Expo Router throws a 404 at runtime when the tab bar link is tapped. There is no build-time error.

**Why it happens:** Expo Router v4 uses file-system routing. The manifest declares the route path, but the actual file must exist. Every existing plugin has thin 8-line wrappers (e.g. `nutrition/dashboard.tsx`: import screen, pass supabase, render).

**Prevention:**
- Create one route wrapper file per manifest route entry as part of the same task that defines the manifest routes. The pattern is identical for every plugin.
- Do not declare a route in the manifest until its screen component and wrapper file both exist. Partial registration (manifest with routes, but no files) is a broken state.

**Phase:** Phase 1 (plugin scaffolding).

---

#### Pitfall 5.3 — Package Name Omits `plugin-` Prefix, Breaking PluginLoader Import

**What goes wrong:** The pantry package is named `@ziko/pantry` instead of `@ziko/plugin-pantry` in `plugins/pantry/package.json`. `PluginLoader.tsx` imports `@ziko/plugin-pantry/manifest`, which resolves to nothing. TypeScript does not catch this because the import is `as any`. The app silently fails to load the plugin.

**Why it happens:** All 17 existing plugins use the `@ziko/plugin-{id}` naming convention. When creating a new package, the `plugin-` prefix is easy to omit because the plugin ID itself (used in Supabase, route paths, and Zustand stores) is just `pantry`.

**Prevention:**
- Set `"name": "@ziko/plugin-pantry"` in `plugins/pantry/package.json` before writing any other code.
- Verify the `exports` field includes `"./manifest": "./src/manifest.ts"` — this is the specific subpath that `PluginLoader.tsx` imports.
- Cross-check `plugins/nutrition/package.json` as the reference template.

**Phase:** Phase 1 (package scaffolding, first file created).

---

#### Pitfall 5.4 — RLS Policy Missing on `pantry_items` (and `shopping_list_items`)

**What goes wrong:** The migration creates the table but omits `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` or the `CREATE POLICY` statement. The Supabase publishable key (used in `backend/api`) has no service-level access. Without RLS policies, the publishable key returns an empty result set or a permission error on all reads and writes. The pantry screen shows no items, with no useful error.

**Why it happens:** The backend uses `SUPABASE_PUBLISHABLE_KEY` — not a service role key. This is consistent with every other table in the codebase; all rely on the same `auth.uid() = user_id` RLS pattern. Forgetting the three-line RLS block when writing a new migration is a common omission.

**Prevention:**
- Copy the RLS block from `supabase/migrations/003_nutrition_schema.sql` verbatim for both `pantry_items` and `shopping_list_items`. The block is identical for every user-owned table.
- Immediately after applying the migration, run a SELECT from the authenticated mobile client and verify rows are returned.

**Phase:** Phase 1 (migration); Phase 4 if `shopping_list_items` is added as a separate table.

---

#### Pitfall 5.5 — Migration Number Conflict With Existing Sequence

**What goes wrong:** The last migration is `021_cardio_gps.sql`. The developer creates `022_pantry_schema.sql`. If a parallel branch has already used `022_*`, Supabase's lexicographic migration ordering runs the wrong file first, or the migration history conflicts. One migration silently overwrites or skips the other.

**Why it happens:** Supabase CLI uses sequential numeric prefixes. In a collaborative or multi-branch workflow, two developers can independently claim the same number.

**Prevention:**
- Check the current highest migration number in `supabase/migrations/` immediately before creating a new file: `ls supabase/migrations/ | sort | tail -1`.
- For this milestone (single developer, single branch), `022_pantry_schema.sql` is safe. Document the number as reserved in the PR description.

**Phase:** Phase 1.

---

## Phase Assignments

| Phase | Pitfalls Addressed | Key Actions |
|-------|--------------------|-------------|
| Phase 1: Smart Inventory | 1.1, 1.2, 1.3, 1.4, 4.2 (column), 5.1, 5.2, 5.3, 5.4, 5.5 | Full plugin scaffolding: package name, PluginLoader entry, route wrappers, migration with `NUMERIC(8,2)` quantities, nullable `low_stock_threshold` column, RLS policy, sequential migration number. Store persistence pattern (await-then-update) established as convention from the first store action. |
| Phase 2: AI Recipe Tools | 2.1, 2.2 (prompt), 2.3, 2.4 | Tool design in `backend/api/src/tools/pantry.ts`: inject macro context into system prompt to save a step (2.1); output schema includes `missing_ingredients[]` (2.3); verify all tools appear in `executors` and `allToolSchemas` before any end-to-end test (2.4). |
| Phase 3: Calorie Tracker Sync | 3.1, 3.2, 3.3, 2.2 (UI) | Confirm-cooked flow: editable macro fields displayed as estimates (2.2), `app_navigate` to nutrition dashboard called after log (3.1/3.2), defensive check for nutrition plugin installation state (3.3). |
| Phase 4: Shopping List | 4.1, 4.2 (logic), 4.3 | Persistence decision made before writing list UI (4.1: MMKV minimum, Supabase table if cross-device is needed). Alert logic uses per-item threshold column added in Phase 1 (4.2). List replacement strategy on regeneration prevents stale items (4.3). |

**Cross-phase dependencies to verify explicitly:**
- End of Phase 2: call `POST /ai/tools/execute` for every `pantry_*` tool before Phase 3 begins. Phase 3 depends on `nutrition_log_meal` being reachable from the pantry agent flow.
- End of Phase 3: test the confirm-cooked flow with a test account where pantry is installed but nutrition is disabled. Confirm graceful degradation rather than silent failure.
