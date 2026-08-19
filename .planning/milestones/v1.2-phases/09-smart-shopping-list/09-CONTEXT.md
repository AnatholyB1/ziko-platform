# Phase 9: Smart Shopping List - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Rule-based shopping list auto-populated from low/out-of-stock pantry items and missing recipe ingredients. Users can check off items (auto-restoring pantry quantity), add missing ingredients from RecipeDetail in one tap, and export the list as plain text via the native share sheet.

New capabilities NOT in scope: manual item addition, price tracking, store-specific lists, quantity editing on check-off.
</domain>

<decisions>
## Implementation Decisions

### Navigation & Placement
- **D-01:** 3rd tab "Courses" added to the pantry plugin in-screen tab bar (alongside "Garde-Manger" and "Recettes IA"). Consistent with existing tab bar pattern established in Phase 6.

### Screen Layout
- **D-02:** Two sections, not a flat list:
  - Section 1: "Rupture / Bas stock" — pantry items where `quantity <= low_stock_threshold`
  - Section 2: "Ingrédients manquants" — items added from RecipeDetail (no pantry match)
  - Each item shows: name, quantity+unit (if known), checkbox
  - Empty state per section when no items

### Check-off Behavior
- **D-03:** Checking off an item restores `pantry_items.quantity` to `low_stock_threshold`. Simple, no friction, no input required.
  - If `low_stock_threshold` is null (not set), restore to 1 (minimum viable quantity).
  - Checked items are removed from the list immediately (optimistic update).
  - For "missing recipe ingredients" (no pantry_item_id), check-off just removes from list — no pantry write needed.

### Adding from RecipeDetail
- **D-04:** "Ajouter à la liste" button on RecipeDetail adds ONLY missing ingredients — those without a `pantry_item_id` match (i.e., not in user's pantry). Already-owned ingredients are silently skipped.
- **D-05:** Deduplication: if an ingredient is already in the shopping list, it is not added again (check by name, case-insensitive).
- **D-06:** Button visible on RecipeDetail regardless of shopping list state — no gate needed.

### Data Storage
- **D-07:** New Supabase table `shopping_list_items` — not stored in Zustand only (needs persistence across sessions).
  - Columns: `id`, `user_id`, `name`, `quantity` (nullable), `unit` (nullable), `pantry_item_id` (nullable FK), `source` enum (`low_stock` | `recipe`), `recipe_name` (nullable), `created_at`
  - RLS: user_id = auth.uid()
  - Items checked off are deleted (not soft-deleted).

### Export
- **D-08:** Plain text, one item per line: `- {name} × {quantity} {unit}` (e.g., `- pain de mie × 1 tranche`). If quantity/unit unknown: `- {name}`. Exported via React Native `Share.share()` with a header line: `Liste de courses Ziko\n\n`.
- **D-09:** No section grouping in export — flat list, alphabetically sorted.

### Claude's Discretion
- i18n key naming convention (follow `pantry.*` pattern)
- Exact row height and checkbox style (use existing design system)
- Loading skeleton / empty state illustrations
- Whether to use a FlatList or SectionList (SectionList natural fit for 2-section layout)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing pantry plugin
- `plugins/pantry/src/screens/PantryDashboard.tsx` — tab bar pattern, item list rows, Supabase fetch pattern
- `plugins/pantry/src/screens/RecipeDetail.tsx` — where "Ajouter à la liste" CTA must be added
- `plugins/pantry/src/store.ts` — PantryItem type, existing store shape
- `plugins/pantry/src/manifest.ts` — route registration pattern
- `plugins/pantry/src/i18n/fr.ts` + `en.ts` — i18n key conventions

### Database schema
- `supabase/migrations/` — most recent migration number to use as base for new migration

### Design system
- `./CLAUDE.md` — design tokens, NativeWind, no StyleSheet, showAlert, paddingBottom: 100

</canonical_refs>

<specifics>
## Specific Ideas

- Tab label: "Courses" (FR) / "Shopping" (EN)
- Section headers styled like the rest of the pantry UI (bold, muted color, uppercase)
- Export header: `Liste de courses Ziko\n\n`
- Restore quantity on check-off: use `low_stock_threshold ?? 1`
</specifics>

<deferred>
## Deferred Ideas

- Manual item addition (user types item not from pantry or recipe) — separate phase
- Price tracking / comparaison — supplements plugin already does this
- Store aisle grouping — separate phase
- Quantity editing on check-off — SHOP-03 says restore to threshold, no input
</deferred>

---

*Phase: 09-smart-shopping-list*
*Context gathered: 2026-04-01*
