---
phase: 11-barcode-ui-score-display
plan: "01"
subsystem: nutrition-plugin
tags: [nutrition, barcode, score-badge, i18n, permissions]
dependency_graph:
  requires: []
  provides: [ScoreBadge component, NutritionEntry grade fields, barcode i18n keys, Android CAMERA permission]
  affects: [plugins/nutrition, packages/plugin-sdk, apps/mobile/app.json]
tech_stack:
  added: []
  patterns: [inline style objects, null guard pattern, semantic grade colors]
key_files:
  created:
    - plugins/nutrition/src/components/ScoreBadge.tsx
  modified:
    - plugins/nutrition/src/store.ts
    - packages/plugin-sdk/src/i18n.ts
    - apps/mobile/app.json
decisions:
  - ScoreBadge uses module-level constant maps (GRADE_COLORS, GRADE_LABELS, SIZE_STYLES) — no runtime computation or theme dependency; grade colors are semantic
  - ScoreBadge returns null for null grade AND for any unrecognized grade value — handles 'not-applicable', 'unknown', and any future unexpected API values
  - NutritionEntry grade fields are optional (?) with union type string | null — matches Supabase select('*') behavior where columns may be absent in older rows
  - Android CAMERA permission inserted as first entry before health permissions — logical grouping by permission type
metrics:
  duration: "1m 43s"
  completed: "2026-04-02"
  tasks_completed: 2
  files_changed: 4
---

# Phase 11 Plan 01: ScoreBadge + Foundation Artifacts Summary

ScoreBadge colored pill component with grade-to-color lookup, extended NutritionEntry type, 13 barcode i18n keys (FR+EN), and Android CAMERA permission — all foundation artifacts for Plans 02 and 03.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create ScoreBadge component + extend NutritionEntry type | b340135 | plugins/nutrition/src/components/ScoreBadge.tsx, plugins/nutrition/src/store.ts |
| 2 | Add i18n keys + Android CAMERA permission | 2317709 | packages/plugin-sdk/src/i18n.ts, apps/mobile/app.json |

## What Was Built

### ScoreBadge Component (`plugins/nutrition/src/components/ScoreBadge.tsx`)

A stateless React Native component that renders a colored pill badge for NutriScore and EcoScore grades.

- Props: `grade: string | null`, `type: 'nutriscore' | 'ecoscore'`, `size: 'sm' | 'md' | 'lg'`
- Returns `null` for null/undefined grade (no badge rendered)
- Returns `null` for unrecognized grades ('not-applicable', 'unknown', any future values)
- Grade colors: A/A+ = `#1A7F37`, B = `#78B346`, C = `#F5A623`, D = `#E3692B`, E = `#CC1F24`
- Prefix label: "NS" for nutriscore, "ES" for ecoscore
- Size variants: sm (h:20, px:4), md (h:24, px:8), lg (h:28, px:8) — all use fontSize:12
- No StyleSheet, no dark mode, no theme dependency — semantic color only

### NutritionEntry Type Extension (`plugins/nutrition/src/store.ts`)

Three new optional fields added after `serving_g`:
- `food_product_id?: string | null`
- `nutriscore_grade?: string | null`
- `ecoscore_grade?: string | null`

No changes to Zustand store actions or state shape.

### i18n Keys (`packages/plugin-sdk/src/i18n.ts`)

13 new `nutrition.*` keys added to both FR and EN locales:
- `nutrition.barcode`, `nutrition.barcodeAlign`, `nutrition.barcodeNotFound`, `nutrition.barcodeNotFoundHint`
- `nutrition.logThisMeal`, `nutrition.enterManually`, `nutrition.scanAgain`, `nutrition.cameraPermDenied`
- `nutrition.avgNutriscore`, `nutrition.avgNutriscoreCount`
- `nutrition.per100g`, `nutrition.servingSize`, `nutrition.grams`

### Android CAMERA Permission (`apps/mobile/app.json`)

`"android.permission.CAMERA"` added as first entry in `expo.android.permissions` array.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan creates pure foundation artifacts (type definitions, a stateless component, config entries). No data flow, no UI wiring — nothing that could be a stub.

## Self-Check: PASSED

- `plugins/nutrition/src/components/ScoreBadge.tsx` — FOUND
- `plugins/nutrition/src/store.ts` — FOUND (nutriscore_grade field verified)
- `packages/plugin-sdk/src/i18n.ts` — FOUND (13 keys in FR + EN verified)
- `apps/mobile/app.json` — FOUND (android.permission.CAMERA verified)
- Commit b340135 — FOUND
- Commit 2317709 — FOUND
- TypeScript `npx tsc --noEmit` — PASSED (0 errors)
