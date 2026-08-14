# Phase 6: Smart Inventory - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 06-smart-inventory
**Areas discussed:** Category vs Storage Location, Add/Edit Interface, Barcode Scan Flow, Units

---

## Category vs Storage Location

| Option | Description | Selected |
|--------|-------------|----------|
| A — Single field = storage location | fridge / freezer / pantry; simple schema | |
| B — Single field = food category | dairy / meat / vegetables / etc.; no location tracking | |
| C — Two fields: storage location + food category | Both fields on item; grouped by location, category as attribute | ✓ |

**User's choice:** C — two fields
**Notes:** Follow-up confirmed Standard (10) food categories: Fruits, Vegetables, Meat, Fish & Seafood, Dairy, Eggs, Grains & Pasta, Snacks, Drinks, Other

---

## Add / Edit Interface

| Option | Description | Selected |
|--------|-------------|----------|
| A — Bottom sheet modal | Slides up, scrollable fields; established codebase pattern | |
| B — Full-screen form | Navigate to dedicated screen; more room for 7 fields | ✓ |
| C — Inline row expansion | Row expands in-place; complex with date pickers and 7 fields | |

**User's choice:** B — full-screen form
**Notes:** Same form used for both add and edit. Barcode scan button lives on this form.

---

## Barcode Scan Flow

| Option | Description | Selected |
|--------|-------------|----------|
| A — Camera modal overlay | CameraView opens as modal on top of add form; closes on scan; name auto-filled | ✓ |
| B — Camera page (navigate away) | Navigate to /pantry/scan, return with pre-filled data via route params | |

**User's choice:** A — modal overlay
**Notes:** Product-not-found fallback: toast notification ("Product not found — fill in manually"), name field stays empty and focused. expo-camera not yet installed — new dependency.

---

## Units

| Option | Description | Selected |
|--------|-------------|----------|
| A — Strict (3) | g, ml, pieces | |
| B — Practical (8) | g, kg, ml, L, pieces, can, box, bag | ✓ |
| C — Full (12) | B + tsp, tbsp, cup, bottle | |

**User's choice:** B — 8 units
**Notes:** Cooking units (tsp/tbsp/cup) are for recipes, not pantry storage — deferred to recipe phase if needed.

---

## Claude's Discretion

- Low-stock threshold default value
- Item list row layout and density
- Form field ordering and KeyboardAvoidingView usage
- i18n key naming
- Expiry date picker implementation

## Deferred Ideas

None.
