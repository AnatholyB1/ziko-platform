# Phase 6: Smart Inventory - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can fully manage their pantry through the app — adding, editing, and deleting items via a full-screen form with optional barcode scan, viewing items grouped by storage location with expiry color indicators and low-stock flags. The plugin is registered in the Ziko ecosystem with a live Supabase table and AI tools.

New capabilities NOT in scope: recipe suggestions, calorie sync, shopping list — those are Phases 7–9.

</domain>

<decisions>
## Implementation Decisions

### Data Schema
- **D-01:** Pantry items have TWO classification fields:
  - `storage_location` (enum): `fridge`, `freezer`, `pantry` — used for list grouping
  - `food_category` (enum): `fruits`, `vegetables`, `meat`, `fish_seafood`, `dairy`, `eggs`, `grains_pasta`, `snacks`, `drinks`, `other`
- **D-02:** Units (8 total): `g`, `kg`, `ml`, `L`, `pieces`, `can`, `box`, `bag`
- **D-03:** Other pantry item fields: `name` (text), `quantity` (number), `unit` (enum), `expiration_date` (date, optional), `low_stock_threshold` (number, optional)

### Add / Edit Interface
- **D-04:** Full-screen form — navigated to (not a bottom sheet, not inline row expansion). Used for both Add and Edit. The barcode scan button lives on this form.
- **D-05:** Barcode scan opens a camera modal overlay (not a separate screen). On scan success: auto-fills the `name` field. On product not found in Open Food Facts: shows a toast notification ("Product not found — fill in manually"), name field stays empty and focused.
- **D-06:** New `expo-camera` dependency required — not currently installed. Use `CameraView` with `onBarcodeScanned` callback inside a `Modal`.

### List & Visual Presentation
- **D-07:** Items grouped by `storage_location` (fridge / freezer / pantry) in the dashboard.
- **D-08:** Expiry color indicators: red = expired or expiring today, yellow = within 7 days, green = more than 7 days away, none = no expiration date set.
- **D-09:** Low-stock items visually flagged (per ROADMAP success criterion 3).

### AI Tools
- **D-10:** Register two AI tools for Phase 6: `pantry_get_items` and `pantry_update_item`. Follow existing pattern in `backend/api/src/tools/registry.ts`. No `pantry_add_item` or `pantry_delete_item` in Phase 6 — update covers quantity changes which is the primary AI use case ("Add 500g chicken breast").

### Plugin Registration (Three Mandatory Touch Points)
- **D-11:** Must register in ALL three places atomically (STATE.md blocker):
  1. `apps/mobile/src/lib/PluginLoader.tsx` — static import map
  2. `backend/api/src/tools/registry.ts` — AI tools
  3. Supabase migration `022_pantry_schema.sql`

### Claude's Discretion
- Low-stock threshold default value (suggested: 1 unit — effectively "flag when out of stock")
- Exact layout density and spacing of the item list rows
- Whether the full-screen form uses a `KeyboardAvoidingView` and how fields are ordered
- i18n key naming convention (follow existing plugin patterns)
- How the expiry date picker is implemented (DateTimePicker or text input)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plugin System
- `apps/mobile/src/lib/PluginLoader.tsx` — plugin registration map; pantry must be added here
- `plugins/nutrition/src/manifest.ts` — canonical manifest example (default export, correct field names)
- `plugins/hydration/src/screens/HydrationDashboard.tsx` — reference for Supabase query pattern, Modal usage, store integration

### Backend AI Tools
- `backend/api/src/tools/registry.ts` — where all tool schemas and executors are registered; pantry tools go here
- `backend/api/src/tools/nutrition.ts` — reference implementation for a plugin tool executor

### Database
- `supabase/migrations/003_nutrition_schema.sql` — reference migration for a nutrition-style table with RLS
- `supabase/migrations/012_new_plugins_schema.sql` — reference for multi-table plugin migration pattern
- Next migration number: `022_pantry_schema.sql`

### Requirements
- `.planning/REQUIREMENTS.md` — PANTRY-01 through PANTRY-06 acceptance criteria
- `.planning/ROADMAP.md` — Phase 6 success criteria (5 items, including AI tool verification)

### Design System
- `CLAUDE.md` — full design token reference, Ionicons convention, NativeWind, showAlert, paddingBottom: 100

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useThemeStore` from `@ziko/plugin-sdk` — theme access in all plugin screens
- `showAlert` from `@ziko/plugin-sdk` — use for delete confirmation (PANTRY-03)
- `useTranslation()` from `@ziko/plugin-sdk` — all user-facing strings
- `Ionicons` from `@expo/vector-icons` — all icons; manifest `icon` field must be an Ionicons name string

### Established Patterns
- Plugin store: Zustand with `create<State>()`, Supabase calls inside actions, not in components
- Supabase queries: `supabase.from('table').select('*').eq('user_id', user.id)` — RLS enforced
- Screen receives `supabase` as a prop from the Expo Router wrapper file
- Every screen uses `paddingBottom: 100` for tab bar clearance
- Modal add/edit pattern (HydrationDashboard) — reference for camera modal too

### Integration Points
- `apps/mobile/app/(app)/(plugins)/pantry/` — Expo Router wrapper files go here (dashboard.tsx, add.tsx, edit.tsx)
- `apps/mobile/app/(app)/(plugins)/_layout.tsx` — plugin layout (no changes needed)
- Backend context: `backend/api/src/context/user.ts` `fetchUserContext()` — may need pantry summary injected for Phase 7 (out of scope for Phase 6)

</code_context>

<specifics>
## Specific Ideas

- Storage location (fridge/freezer/pantry) is the primary grouping axis — food category is a secondary attribute shown as a tag or label on the item row
- Barcode scan is a convenience shortcut on the add form — manual entry is always the primary flow
- "Inline edit" in PANTRY-02 means: tapping an item navigates to the same full-screen form pre-filled — not in-place row editing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-smart-inventory*
*Context gathered: 2026-03-28*
