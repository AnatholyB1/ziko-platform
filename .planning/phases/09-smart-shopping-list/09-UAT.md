---
status: complete
phase: 09-smart-shopping-list
source:
  - 09-01-SUMMARY.md
  - 09-02-SUMMARY.md
  - 09-03-SUMMARY.md
started: "2026-04-01T11:20:00.000Z"
updated: "2026-04-01T11:22:00.000Z"
---

## Current Test

[testing complete]

## Tests

### 1. Courses Tab Navigation
expected: |
  Open Pantry plugin. A 3rd tab "Courses" with a cart icon appears in the
  in-screen tab bar. Tapping it opens the Shopping List screen with title
  "Liste de courses".
result: pass

### 2. Auto-populated Low-stock Items
expected: |
  With at least one pantry item where quantity ≤ low_stock_threshold, opening
  the Courses tab shows it under "Rupture / Bas stock" automatically — no
  manual add required.
result: pass

### 3. Check-off Restores Pantry Quantity
expected: |
  Tapping a row removes it immediately. Navigating back to Garde-Manger shows
  the item's quantity updated to its low_stock_threshold (or 1 if none set).
result: pass

### 4. Add from Recipe
expected: |
  From RecipeDetail, an "Ajouter à la liste" outline button is visible. Tapping
  it adds missing ingredients to the Courses tab under "Ingrédients manquants"
  with the recipe name shown below each ingredient.
result: pass

### 5. Plain-text Export
expected: |
  With ≥2 items in the list, tapping the share icon opens the native share
  sheet. Copied text starts with "Liste de courses Ziko" and lists items
  alphabetically in the format "- name × qty unit".
result: pass

### 6. Empty State
expected: |
  With all items checked off (or a fresh pantry), the screen shows the cart
  icon, "Votre liste est vide" heading, and the descriptive body text.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
