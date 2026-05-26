# Plan 01-05 — Vérification & Push Migration

**Phase:** 01-db-api-foundation
**Plan:** 5
**Statut:** ✅ Complet
**Date:** 2026-05-26

## Ce qui a été livré

### Tâche 1 — Type-check TypeScript
`npx tsc --noEmit -p backend/api/tsconfig.json` : **0 erreur** dans tous les fichiers Phase 01.

### Tâche 2 — Migration 056 appliquée via MCP
Migration `056_dashboard_widgets` poussée sur le projet Supabase `slkobhavpwsubnsmuhya` (ziko, eu-west-1) via `apply_migration`.

Tables confirmées dans la DB live :
- `public.dashboard_configs` ✅
- `public.coach_memory` ✅

### Tâche 3 — Critères de succès Phase 01

| Critère | Statut |
|---------|--------|
| `dashboard_configs` existe avec RLS | ✅ confirmé via SQL |
| `coach_memory` existe avec RLS | ✅ confirmé via SQL |
| Migration 056 dans la liste des migrations appliquées | ✅ version `20260526120820` |
| `tsc --noEmit` : 0 erreur dans Phase 01 | ✅ |
| Route `/coach/dashboards/memory` enregistrée avant `/:clientId` (L-05) | ✅ service.ts vérifié |
| `WidgetSchema` rejette les types inconnus (discriminatedUnion) | ✅ schemas.ts vérifié |
| `getWidgetData` gère les 7 types de widgets | ✅ db.ts vérifié |

## Note sur le numéro de migration

Migration ajustée de `054` → `056` (054 et 055 étaient déjà pris par `coach_branding`, `notification_schema`, `coach_exercises_schema`, `forms_schema`). Fichier local renommé en conséquence.

## Récapitulatif Phase 01

| Plan | Description | Commit |
|------|-------------|--------|
| 01-01 | Migration 056 — dashboard_configs + coach_memory | `0903448` |
| 01-02 | Types TypeScript + Schemas Zod (7 widget types) | `58f63e1` |
| 01-03 | db.ts (5 fonctions) + service.ts (5 routes) + app.ts mount | `37583ee` |
| 01-04 | getWidgetData — agrégation 7 types + route widget-data | `622c179` |
| 01-05 | TSC check + migration push + vérification live | ce plan |
