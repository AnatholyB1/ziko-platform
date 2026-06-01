---
phase: 01-db-api-foundation
plan: 2
subsystem: backend/coach/dashboards
tags: [types, zod, schemas, widgets, dashboard]
dependency_graph:
  requires: []
  provides: [widget-types, dashboard-schemas]
  affects: [backend/api/src/coach/dashboards]
tech_stack:
  added: []
  patterns: [discriminated-union, zod-strict, type-only-file]
key_files:
  created:
    - backend/api/src/coach/dashboards/types.ts
    - backend/api/src/coach/dashboards/schemas.ts
decisions:
  - "Zod .strict() on every widget variant et son config objet pour rejeter les champs inconnus"
  - "schema_version: z.literal(1) pour permettre une migration future sans casser la validation"
  - "randomUUID() importé depuis node:crypto pour générer des IDs stables au démarrage serveur dans DEFAULT_WIDGETS"
metrics:
  duration: 5 min
  completed: 2026-05-26
---

# Phase 01 Plan 02: Dashboard Widget Zod Schemas and TypeScript Types Summary

**One-liner:** Discriminated union de 7 variantes de widgets avec schemas Zod strict et interfaces TypeScript type-only pour le système de dashboards custom-widget.

## Ce qui a été construit

Deux fichiers créés dans le nouveau répertoire `backend/api/src/coach/dashboards/` :

**`types.ts`** — fichier type-only sans code runtime :
- `WidgetType` : union littérale de 7 strings
- `WidgetPeriod` : `'7d' | '30d' | '90d' | 'all'`
- `GridPos` : interface position/taille sur grille
- `WidgetBase` : champs partagés par tous les widgets
- 7 interfaces config (`LineChartConfig`, `BarChartConfig`, etc.)
- 7 interfaces widget discriminées (`LineChartWidget`, etc.)
- `Widget` : union discriminée des 7 variantes
- `DashboardConfig` : root config avec `schema_version: 1` (literal)
- `DashboardConfigRow`, `CoachMemoryRow` : shapes des rows DB

**`schemas.ts`** — schemas Zod runtime :
- `GridPosSchema`, `PeriodEnum`
- 7 schemas widget individuels, tous `.strict()`
- `WidgetSchema` : `z.discriminatedUnion('type', [...])` avec 7 membres
- `DashboardConfigSchema` : `schema_version: z.literal(1)` + `widgets.max(12)`
- `DEFAULT_WIDGETS` : 4 widgets de départ (2 kpi_tile, 1 line_chart, 1 bar_chart)
- Types utilitaires : `WidgetInput`, `PutDashboardBody`

## Critères d'acceptation atteints

- `types.ts` sans aucun `import` de valeur runtime — type-only
- Exports requis présents : `WidgetType`, `WidgetPeriod`, `GridPos`, `Widget`, `DashboardConfig`, `DashboardConfigRow`, `CoachMemoryRow`
- `Widget` est une union de 7 interfaces nommées
- `DashboardConfig.schema_version` est de type `1` (literal, non `number`)
- `WidgetSchema` est un `z.discriminatedUnion` avec exactement 7 membres
- `DashboardConfigSchema` inclut `schema_version: z.literal(1)`
- Chaque variante widget utilise `.strict()` (17 occurrences >= 8 requis)
- `DEFAULT_WIDGETS` contient 4 widgets
- `npx tsc --noEmit -p backend/api/tsconfig.json` : aucune erreur

## Déviations

Aucune — plan exécuté exactement comme écrit.

## Commit

`58f63e1` — feat(01-02): add dashboard Widget Zod schemas and TypeScript types

## Self-Check: PASSED

- `backend/api/src/coach/dashboards/types.ts` : FOUND
- `backend/api/src/coach/dashboards/schemas.ts` : FOUND
- Commit `58f63e1` : FOUND
