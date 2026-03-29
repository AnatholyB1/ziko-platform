---
status: partial
phase: 07-ai-recipe-suggestions
source: [07-VERIFICATION.md]
started: 2026-03-29T00:00:00Z
updated: 2026-03-29T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. AI Recipe Generation Live Test
expected: With a valid authenticated session and 3–5 pantry items, tap "Suggérer des recettes" — loading skeleton appears for 3–8 seconds, then 3 recipe cards render with distinct names, prep times, descriptions, and calories. The macro budget banner shows 4 non-zero values.
result: [pending]

### 2. Serving Stepper Macro Recalculation
expected: Navigate to a recipe detail screen. At base_servings, note calorie value. Tap + to 2× base_servings — all macro values should approximately double. At 1 serving on a 2-serving base, values should halve.
result: [pending]

### 3. 'Recettes IA' Tab Visibility in Pantry Plugin
expected: Open the pantry plugin. The bottom tab bar shows two tabs: "Garde-Manger" (storefront icon) and "Recettes IA" (restaurant/fork icon).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
