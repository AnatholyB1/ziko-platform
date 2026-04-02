---
phase: 11-barcode-ui-score-display
plan: "03"
subsystem: nutrition-plugin
tags: [score-badges, nutriscore, ecoscore, nutrition-dashboard, journal-rows]
dependency_graph:
  requires: ["11-01"]
  provides: ["SCORE-02", "SCORE-03"]
  affects: ["plugins/nutrition/src/screens/NutritionDashboard.tsx"]
tech_stack:
  added: []
  patterns:
    - ScoreBadge inline badge pills on journal rows (size sm, conditional on grade presence)
    - Daily average Nutri-Score widget with grade-to-number mapping and round-trip conversion
    - null-guard pattern: scoredMeals.length > 0 ensures widget completely hidden when no barcode meals
key_files:
  created: []
  modified:
    - plugins/nutrition/src/screens/NutritionDashboard.tsx
decisions:
  - "Widget positioned after macros row and before TDEE Calculator link per UI-SPEC"
  - "Badge container on journal rows conditionally renders only when nutriscore_grade OR ecoscore_grade is present — null-safe via ScoreBadge returning null for null input"
  - "gradeToNum maps a-plus as 1 (same as a) so it counts as A for average computation"
  - "numToGrade maps 1..5 to a..e — a-plus cannot appear as average output, only a"
  - "{count} interpolation via .replace() since t() does not support named interpolation in this codebase"
metrics:
  duration: "1m 11s"
  completed_date: "2026-04-02"
  tasks_completed: 1
  files_modified: 1
---

# Phase 11 Plan 03: Score Badges on Journal Rows + Daily Average Widget Summary

Nutri-Score and Eco-Score badge pills added to nutrition journal entry rows, and a conditional daily average Nutri-Score widget added to the dashboard — both backed by the ScoreBadge component from Plan 01.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add score badges to journal entry rows + daily average widget | a2c0434 | plugins/nutrition/src/screens/NutritionDashboard.tsx |

## What Was Built

**Journal row badges (SCORE-02):**
- Each journal entry row in the meal sections now renders a badge container between the food name `View` and the calories `Text`
- Container only mounts when `log.nutriscore_grade || log.ecoscore_grade` is truthy
- Renders `<ScoreBadge grade={...} type="nutriscore" size="sm" />` and `<ScoreBadge grade={...} type="ecoscore" size="sm" />` side by side with `gap: 4`
- `ScoreBadge` internally returns `null` for null/undefined grades — ecoscore badge simply disappears if not set
- Manual log entries (null grades) are completely unaffected — no visual change

**Daily average widget (SCORE-03):**
- `VALID_GRADES = ['a', 'b', 'c', 'd', 'e', 'a-plus']` filters todayLogs to only barcode-scanned meals
- `gradeToNum` maps letter grades to 1-5 (`a-plus` and `a` both map to 1)
- `numToGrade` maps 1-5 back to 'a'-'e'
- Average = `Math.round(sum / count)` → looked up in `numToGrade` → fallback 'c' if undefined
- Widget renders `<ScoreBadge grade={avgNutriscore} type="nutriscore" size="md" />` with title and meal count subtitle
- Completely hidden via `scoredMeals.length > 0 && avgNutriscore &&` guard — no zero-state rendered
- Positioned after macros row (`flexDirection: 'row', gap: 10, marginBottom: 16`) and before TDEE Calculator link

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `plugins/nutrition/src/screens/NutritionDashboard.tsx` — FOUND: modified with all required changes
- Commit a2c0434 — FOUND in git log
- All acceptance criteria met:
  - [x] `import ScoreBadge from '../components/ScoreBadge'` present
  - [x] `const VALID_GRADES = ['a', 'b', 'c', 'd', 'e', 'a-plus']` present
  - [x] `const scoredMeals = todayLogs.filter` with nutriscore_grade check
  - [x] `gradeToNum` mapping with `'a-plus': 1`
  - [x] `numToGrade` mapping with `1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e'`
  - [x] `scoredMeals.length > 0` guard before widget render
  - [x] `t('nutrition.avgNutriscore')` in widget
  - [x] `t('nutrition.avgNutriscoreCount')` in widget
  - [x] `<ScoreBadge grade={avgNutriscore} type="nutriscore" size="md" />` in widget
  - [x] journal rows contain `<ScoreBadge grade={log.nutriscore_grade` with size="sm"
  - [x] journal rows contain `<ScoreBadge grade={log.ecoscore_grade` with size="sm"
  - [x] badge container has `marginHorizontal: 6`
  - [x] badge container only renders when `log.nutriscore_grade || log.ecoscore_grade`
  - [x] no `StyleSheet.create`
  - [x] widget after macros row and before TDEE link
  - [x] TypeScript compiles clean
