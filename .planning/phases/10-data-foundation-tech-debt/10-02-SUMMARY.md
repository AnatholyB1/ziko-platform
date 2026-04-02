---
phase: 10-data-foundation-tech-debt
plan: "02"
subsystem: pantry-plugin
tags: [shopping-list, modal, i18n, debt-01, debt-02, pantry]
dependency_graph:
  requires: []
  provides: [quantity-modal-shopping-list, shop-qty-i18n-keys]
  affects: [plugins/pantry, packages/plugin-sdk]
tech_stack:
  added: []
  patterns: [React Native Modal overlay, numeric TextInput, unified confirm dispatcher]
key_files:
  created: []
  modified:
    - plugins/pantry/src/screens/ShoppingList.tsx
    - packages/plugin-sdk/src/i18n.ts
decisions:
  - "D-05: low-stock item quantity set to purchased amount directly (not threshold+1 or existing+purchased)"
  - "D-03: recipe ingredient with pantry_item_id adds purchased to existing qty"
  - "D-04: recipe ingredient without pantry_item_id inserts new pantry_items row"
  - "D-02: cancel leaves item unchanged — no pantry update made"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-02"
  tasks_completed: 2
  files_modified: 2
---

# Phase 10 Plan 02: Shopping List Quantity Modal Summary

## One-liner

Replaced two silent shopping-list check-off handlers with a React Native Modal quantity prompt, so users specify purchased amount before pantry is updated (closes DEBT-01 and DEBT-02).

## What Was Built

### Task 1 — Quantity Modal in ShoppingList.tsx

Replaced `handleCheckOffPantry` (which silently set `quantity = threshold + 1`) and `handleCheckOffRecipe` (which only deleted the shopping item without touching pantry) with a two-phase tap-then-confirm flow:

- `handleCheckOffPantryTap` / `handleCheckOffRecipeTap` — open the Modal, set pending item state
- `confirmCheckOffPantry` — sets pantry quantity to exactly the purchased amount (D-05)
- `confirmCheckOffRecipe` — adds purchased qty to existing pantry item if `pantry_item_id` is set (D-03), or inserts a new `pantry_items` row if not (D-04)
- `handleModalCancel` — clears all pending state; item stays in list (D-02)
- `handleModalConfirm` — unified dispatcher routing to the correct confirm function
- Modal JSX: `transparent`, `animationType="fade"`, numeric `TextInput` with unit label, Cancel + Confirm buttons styled with design tokens

New state variables: `pendingPantry`, `pendingRecipe`, `qtyInput`, `modalVisible`.

New imports: `Modal`, `TextInput` from `react-native`.

### Task 2 — i18n keys for quantity Modal

Added 6 new keys to `packages/plugin-sdk/src/i18n.ts`:

| Key | FR | EN |
|-----|----|----|
| `pantry.shop_qty_title` | Combien avez-vous acheté ? | How much did you buy? |
| `pantry.shop_qty_cancel` | Annuler | Cancel |
| `pantry.shop_qty_confirm` | Confirmer | Confirm |

Keys placed immediately after `pantry.shop_from_recipe` in both FR and EN sections. Unicode escape `\u00e9` used for "acheté" to prevent encoding corruption.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e2cdb59 | feat(10-02): add quantity Modal to ShoppingList check-off handlers |
| 2 | eb06132 | feat(10-02): add i18n keys for shopping list quantity Modal |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both handlers are fully wired to Supabase. The Modal reads live state from `pendingPantry`/`pendingRecipe` and writes directly to `pantry_items`.

## Self-Check: PASSED

- `plugins/pantry/src/screens/ShoppingList.tsx` — exists and contains Modal, confirmCheckOffPantry, confirmCheckOffRecipe
- `packages/plugin-sdk/src/i18n.ts` — contains 6 new shop_qty keys (3 FR + 3 EN)
- Commits e2cdb59 and eb06132 present in git log
- Old `threshold+1` pattern removed from check-off functions (0 matches)
