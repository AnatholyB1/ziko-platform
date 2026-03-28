# Feature Landscape — Smart Pantry Plugin (v1.1)

**Domain:** Pantry inventory management + AI recipe suggestion + macro tracker integration (mobile fitness app)
**Researched:** 2026-03-28
**Overall confidence:** MEDIUM-HIGH (cross-validated across pantry apps, recipe tools, and macro trackers; specific UX flows MEDIUM due to no direct competitor with identical architecture)

---

## Summary

The Smart Pantry plugin sits at the intersection of three established mobile domains: pantry inventory apps (CozZo, Panzy, NoWaste, KitchenPal), AI recipe suggestion tools (DishGen, ChefGPT, Portions Master), and macro-tracking nutrition apps (MyFitnessPal, Cronometer, MacroFactor). Research across these domains reveals a clear hierarchy of feature value and a sharp divide between what drives retention and what becomes abandoned-feature bloat.

The core user job-to-be-done is: **"What can I cook right now that fits my remaining macros?"** Every feature should be evaluated against whether it serves this specific goal or creates friction around it.

Key insight from competitor analysis: pantry apps that attempt too much (recipe libraries, barcode databases, meal planning calendars) consistently receive negative reviews citing non-intuitive interfaces and excessive manual data entry burden. The winning pattern is ruthless simplicity in data entry combined with smart, high-value output (recipe suggestions + shopping list) that rewards the effort of maintaining inventory.

For Ziko specifically, the pantry plugin has a structural advantage no standalone app can replicate: the Claude Sonnet agent already has tool access to the user's live daily nutrition state via `nutrition_get_today`. This means recipe suggestions can be macro-aware with zero extra infrastructure — the AI already knows the remaining protein/carb/fat budget for the day. This is the core differentiator.

---

## Table Stakes

Features users expect from any pantry + recipe plugin. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add pantry item (name, qty, unit, category) | Core inventory — without data nothing else functions | Low | Manual entry only in v1.1; barcode scanning deferred |
| Edit and delete pantry items | Quantities change, items expire, mistakes happen | Low | Swipe-to-edit / swipe-to-delete — standard gesture pattern |
| View pantry list grouped by category | At-a-glance visibility is the reason to maintain an inventory | Low | Tabs or section headers: Fridge, Freezer, Pantry, Other |
| Expiration date field with visual warning | Every successful pantry app (CozZo, NoWaste) highlights expiring items — users expect it | Low-Medium | Color-coded indicator: green (safe) / yellow (expires soon) / red (expired or today) |
| Items grouped or flagged by expiry urgency | "Expires soon" items must surface prominently — this is why people open pantry apps | Low | A dedicated section or sort-to-top for items expiring within N days |
| "What can I cook?" AI recipe suggestions | The entire reason to maintain a pantry list. Without this, it is just a grocery inventory app | Medium | Requires `pantry_get_items` + `pantry_suggest_recipes` AI tools; calls `nutrition_get_today` for macro context |
| Recipe shows macro breakdown before confirming | Every user is in a macro tracker — they must see cal/protein/carbs/fat before deciding | Low | AI must return structured macros per recipe, not just ingredients |
| "I cooked this" → auto-log macros to nutrition | Closes the pantry → recipe → nutrition log loop. Without this the plugin is a dead end | Medium | Calls existing `nutrition_log_entry` tool; no new backend logic needed |
| Pantry quantity decrements on cook | Without auto-decrement, pantry becomes stale data within a week and users stop updating it | Medium | Update `pantry_items.quantity` after recipe confirmation; set to 0, not delete |
| Shopping list: view low/out-of-stock items | Natural output of any inventory app — "what do I need to buy?" | Low-Medium | Rule-based: query items where qty = 0 or below threshold |
| Shopping list: check off items as purchased | Standard checklist behavior expected in any shopping app | Low | Local state; checkmarks persist until manually cleared |

---

## Differentiators

Features that set this plugin apart from standalone pantry or recipe apps. Not expected on first launch, but create real retention and word-of-mouth value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Macro-aware recipe filtering | AI suggests recipes that fit remaining macros for the day, not just what ingredients are available. Unique because the agent already calls `nutrition_get_today` — zero extra infrastructure | Medium | Core differentiator. No standalone pantry app can do this without a full nutrition backend |
| Craving input before recipe request | "I want something high protein / light / quick / comfort food" — combines mood + pantry + macros for hyper-personalized suggestions | Low (prompt addition only) | Free text field or chip selection (3-4 chips). Adds no backend complexity |
| AI pre-fills meal_type from time of day | When logging a cooked recipe, AI selects breakfast/lunch/dinner/snack based on current time. Reduces a tap in the confirmation flow | Low | Pattern used by Cronometer and Fitia. Simple time-of-day conditional in the tool call |
| Add missing recipe ingredients to shopping list in one tap | When a recipe requires 1-2 items the user lacks, a single tap adds them to the shopping list | Medium | Requires diff between recipe ingredients and current pantry state |
| Expiry-first recipe suggestions | "Your chicken expires tomorrow — here's what to make with it." Turns food waste prevention into a high-value feature | Low | Sort pantry items by soonest expiry in `pantry_suggest_recipes` prompt context |
| Export shopping list via native share sheet | Users go to the grocery store on their phone. Copy as text or send via WhatsApp/Messages — 2 lines of React Native code | Low | `Share` API from React Native; already used in other patterns in the ecosystem |
| Per-serving portion adjustment on confirm | User cooked for 1 vs 2 vs 4 people — macros scale accordingly before logging | Medium | Multiply macro values by serving multiplier; update pantry deduction accordingly |

---

## Anti-Features (skip for v1.1)

Features that appear to add value but create disproportionate complexity, maintenance burden, or scope drift at this stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Barcode scanner for adding items | Requires Open Food Facts / USDA API integration, camera permission handling, product database calls, fallback for unknown products — high complexity for marginal entry speed gain over a text field | Manual name entry + category chips. Barcode is a strong v1.2+ candidate once core inventory is validated |
| Full recipe library / saved recipe history | Adds a content management problem. Users expect to edit, favorite, share, and rate saved recipes — scope expands fast. Recipe generation on demand is sufficient | AI generates fresh suggestions each session; no recipe persistence needed in v1.1 |
| Meal planning calendar ("plan this for Tuesday") | Entirely separate domain — calendar UI, recurring meals, plan vs. actual gap tracking. None of the pantry data model supports this and it requires a new screen paradigm | The AI suggestion flow handles "what should I eat now" without scheduling |
| AI-generated shopping list | User explicitly decided: shopping list is rule-based. AI shopping lists introduce hallucination risk (suggesting items not in pantry, wrong quantities) and latency. Rule-based is instant and deterministic | Rule-based logic: threshold on `pantry_items.quantity` + missing ingredient diff from recipe confirmation |
| Photo recognition of fridge/pantry contents | Requires image AI pipeline (vision model API call), unreliable accuracy on cluttered shelves, extra API cost per scan — poor ROI in v1.1 | Manual add with good category autocomplete. Photo recognition is v2+ if vision AI improves |
| Price comparison across grocery stores | Entirely different domain (grocery commerce). Already have a supplements price comparator — avoid diluting both | Out of scope entirely for pantry plugin |
| Nutrition grading / Nutri-Score per ingredient | Adds opinionated food quality judgments. Ziko's nutrition plugin is macro-neutral — do not break that contract | Log macros, do not judge food choices. Nutri-Score adds legal complexity in French market too |
| Multi-user / household pantry sync | Real-time conflict resolution, shared mutations, family account model — 5x the complexity of a single-user pantry | Single-user only in v1.1. Household sync is social plugin territory |
| Detailed cooking mode (step timer, screen wake lock, voice) | A full "cook mode" with timers per step, voice narration, and screen kept awake is a separate product feature. Adds significant native API complexity | AI returns recipe steps as readable text in a standard scroll view. No special cooking mode UI |
| Ingredient substitution suggestions | Intellectually interesting but rare in practice. When an ingredient is missing, substituting it makes the macro calculation approximate and unreliable | Show missing ingredients clearly; let user add them to shopping list. Do not substitute |
| Custom low-stock threshold per item | Each item having its own minimum-quantity threshold is a settings management problem. Users will not configure this for 30+ pantry items | A single global threshold (e.g., qty < 10% of original or qty = 0) is sufficient. Simple rule, zero configuration |

---

## UX Patterns

### Pantry List Screen

- Primary grouping by storage location: Fridge / Freezer / Pantry / Other — section headers or top tabs (CozZo, Panzy both use this pattern)
- Each row: item name + quantity + unit + expiry indicator dot (green/yellow/red)
- "Expiring soon" section pinned at the top or sorted first within each group — this is the highest-value daily interaction
- FAB (Floating Action Button) to add item — consistent with habits, journal, measurements plugins in Ziko
- Swipe-to-edit and swipe-to-delete — standard React Native pattern consistent with other Ziko plugins
- Empty state with actionable message: "Add your first item to unlock AI recipe suggestions" — explains the value proposition before the user has data

### Add / Edit Item Flow

- Bottom sheet modal (not full-screen navigation) — adding a pantry item is a micro-action, not a workflow navigation event. This is the pattern used in journal, hydration, and timer plugins
- Fields: name (text input with autocomplete from previously-used items), quantity (numeric), unit (chips: g / ml / pcs), category (chips: Fridge / Freezer / Pantry / Drinks / Other), expiration date (date picker, optional but prompted)
- Save on confirm — no multi-step wizard. One screen per item
- If expiration date omitted, show a subtle "No expiry set" indicator rather than requiring it

### Recipe Suggestion Entry Point

- Primary entry: a prominent card or button on the pantry dashboard — "What can I cook today?" — pre-fills AI context automatically (pantry items + remaining macros injected via tool calls)
- Secondary entry: natural language via the main AI chat (existing pattern). The AI agent will call pantry tools when the user types "suggest a recipe" or "what can I make"
- Optional craving input before submitting: 3-4 chips (High protein / Light / Quick 30min / Comfort food) plus a free text field
- AI returns 2-3 recipe suggestions maximum — not 10. Research on recipe apps shows cognitive overload beyond 3 options reduces selection rate
- Each suggestion card shows: recipe name, total cal + P/C/F summary, ingredients from pantry (checked), missing ingredients (if any, shown with a "+" icon), estimated cook time

### Recipe Confirmation Flow (Cook This)

Modeled on Cronometer's "log to diary" pattern — the best-studied confirmation UX in macro tracking:

1. User taps "Cook this" on a recipe card
2. Confirmation modal (bottom sheet):
   - Recipe name
   - Serving count selector: 1 / 2 / 4 (chips)
   - Macro breakdown for selected servings: cal / protein / carbs / fat
   - Meal type: pre-filled (breakfast before 10am, lunch 10am-3pm, dinner 3pm-9pm, snack otherwise), editable via chips
   - Missing ingredients list with checkboxes: "Add to shopping list"
3. Confirm button → executes in sequence:
   a. `nutrition_log_entry` called with scaled macros
   b. Pantry quantities decremented for used ingredients
   c. Missing ingredients added to shopping list if checked
4. Success toast: "Logged to nutrition · Pantry updated"

This is a 3-tap flow: select recipe → adjust servings/meal type → confirm. More than 3 taps breaks conversion based on nutrition logging UX research.

### Shopping List Screen

- Two sections with clear visual separation:
  - "Need to restock" — rule-based from pantry items at or near zero qty (generated automatically)
  - "For your recipes" — manually added during recipe confirmation (missing ingredients)
- Each row: checkbox + item name + optional quantity hint
- Checkmarks persist across app sessions until "Clear completed" is tapped
- "Share list" button at the top → native `Share` API (copy as text, send via any installed app)
- No AI involvement in list generation — deterministic rule-based output only

---

## Integration with Macro Tracker (Nutrition Plugin)

The nutrition plugin (`plugins/nutrition`) is the integration anchor. All macro logging flows through its existing tools and data model with no changes to the nutrition plugin required.

### Dependency Map

```
pantry_items (new Supabase table)
    └── pantry_get_items (new AI tool — reads pantry_items for current user)
          └── pantry_suggest_recipes (new AI tool)
                ├── reads: pantry_get_items (available ingredients)
                └── reads: nutrition_get_today (EXISTING tool — remaining macros)
                      └── recipe confirmed by user
                            ├── nutrition_log_entry (EXISTING tool — no changes needed)
                            └── pantry qty update (direct Supabase call — not an AI tool)
                                  └── shopping list rule query (threshold on pantry_items.quantity)
```

### Key Integration Contracts

- `nutrition_log_entry` accepts `{ meal_type, food_name, calories, protein_g, carbs_g, fat_g, serving_g }` — this is `NutritionEntry` from `plugins/nutrition/src/store.ts`. Recipe logging must produce this exact shape.
- `meal_type` must match the enum used in `nutrition_logs` table — confirm exact values from `supabase/migrations/003_nutrition_schema.sql` before implementing
- `nutrition_get_today` returns today's logs + totals — `pantry_suggest_recipes` uses `target - logged = remaining` for each macro dimension
- No changes are needed to the nutrition plugin itself — this is a one-way dependency (pantry calls nutrition tools, nutrition knows nothing about pantry)

### What "Remaining Macros" Means in Context

The AI tool call chain for a recipe suggestion session:
1. `pantry_get_items` — fetch non-zero-qty, non-expired items from current user's pantry
2. `nutrition_get_today` — fetch today's logged totals and daily targets
3. Compute: `remaining = target - logged` for calories, protein, carbs, fat
4. Claude selects recipes using pantry items that fit within the remaining macro budget

This is the same pattern used by Fitia and Eat This Much for macro-aware meal planning. Ziko's version is structurally stronger because it uses the user's actual kitchen inventory rather than a generic food database.

### Macro Logging on Recipe Confirmation

When user confirms "I cooked this" for N servings:
- `food_name` = recipe name (e.g. "Chicken stir-fry — AI suggestion")
- `calories`, `protein_g`, `carbs_g`, `fat_g` = recipe totals multiplied by N servings
- `serving_g` = estimated total weight (sum of ingredient quantities in grams where unit = g; approximate for non-gram units)
- `meal_type` = pre-filled from time of day, user-editable in confirmation modal

### Pantry Quantity Decrement on Cook

After `nutrition_log_entry` succeeds (not before — avoid decrementing on failed log):
- For each ingredient in the recipe: `pantry_items.quantity -= ingredient_used_quantity`
- If resulting quantity <= 0: set `quantity = 0` (do not delete the row — zero-qty items feed the shopping list)
- This is a direct Supabase update call, not an AI tool call

### Shopping List Rule Logic (Non-AI)

```
Low-stock threshold: quantity = 0 (out of stock)
                     OR quantity <= [user-global-threshold, default: 0]

shopping_list = UNION of:
  1. SELECT * FROM pantry_items WHERE user_id = $uid AND quantity = 0
  2. recipe_missing_ingredients (added during recipe confirmation, stored locally)
```

A single global threshold is sufficient for v1.1. Per-item thresholds are an anti-feature at this stage.

---

## Feature Dependencies

```
Pantry CRUD (Add / Edit / Delete items)
    └── REQUIRED BY: everything below. Build this first.
          └── pantry_get_items AI tool
                └── pantry_suggest_recipes AI tool
                      ├── REQUIRES: nutrition_get_today (EXISTING — no changes)
                      └── Recipe confirmation modal
                            ├── nutrition_log_entry (EXISTING — no changes)
                            ├── pantry qty decrement (new Supabase logic)
                            └── Add missing ingredients → shopping list
                                  └── Shopping list screen
                                        └── Export via Share API
```

---

## MVP Recommendation

Build in this priority order — each phase depends on the one before it:

1. **Pantry CRUD** — database table, add/edit/delete screens, list with expiry indicators. No AI yet. Without inventory data, nothing else functions.
2. **AI recipe suggestion** — `pantry_get_items` + `pantry_suggest_recipes` tools, recipe card UI. This is the feature that makes users understand why they're maintaining the list.
3. **Recipe confirmation + nutrition log** — "Cook this" modal, serving adjustment, `nutrition_log_entry` call, pantry decrement. Closes the loop.
4. **Shopping list** — low-stock query, missing-ingredients section, share button. Low complexity, high practical value.

**Defer to v1.2:**
- Barcode scanner
- Saved/favorited recipe history
- Per-item low-stock thresholds
- Push notifications for expiring items
- Portion weight auto-calculation beyond simple serving multiplier

---

## Sources

- [Portions Master: Best Pantry Inventory App and Fridge Management Tool](https://portionsmaster.com/blog/best-pantry-inventory-app-and-fridge-management-tool/) — MEDIUM confidence, industry analysis blog
- [CozZo Smart Kitchen App](https://cozzo.app/) — MEDIUM confidence, product site
- [NoWaste Food Inventory App Store listing](https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004) — LOW confidence, App Store description only
- [Fitia: Top App Features for Fast Recipe Ideas That Fit Your Macros](https://fitia.app/learn/article/top-nutrition-tracker-features-macro-friendly-recipes/) — MEDIUM confidence (blocked during fetch, sourced from search snippet)
- [Cronometer: Mobile - Create a Custom Recipe](https://support.cronometer.com/hc/en-us/articles/360019870111-Mobile-Create-a-Custom-Recipe) — HIGH confidence, official documentation
- [Cronometer Blog: Log Food Fast](https://cronometer.com/blog/log-food-fast/) — HIGH confidence, official blog
- [mise Blog: 7 Best Pantry Inventory Apps for 2025](https://trymise.app/blog/pantry-inventory-app) — MEDIUM confidence (blocked during fetch, sourced from search snippet)
- [mise Blog: Generate Recipes Based on Ingredients](https://trymise.app/blog/generate-recipes-based-on-ingredients) — LOW confidence, single source
- [Nutrola: Best Recipe Apps for Calorie Counting and Macro Tracking 2026](https://www.nutrola.app/en/blog/best-recipe-apps-calorie-counting-macro-tracking-2026) — LOW confidence, competitor blog
- [Perpetio: Developing an AI-based Recipe and Nutrition App](https://perpet.io/blog/how-to-make-an-ai-powered-cooking-app/) — LOW confidence, agency blog post

---
*Feature research for: Ziko Smart Pantry Plugin (v1.1 milestone)*
*Researched: 2026-03-28*
