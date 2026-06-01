---
phase: 01-db-api-foundation
plan: 1
subsystem: database
tags: [migration, supabase, rls, dashboard, coach-memory]
dependency_graph:
  requires: []
  provides: [dashboard_configs table, coach_memory table]
  affects: [custom-widget workstream plans 2-5]
tech_stack:
  added: []
  patterns: [RLS own-row policy, JSONB default columns, composite unique constraint, IF NOT EXISTS index]
key_files:
  created:
    - supabase/migrations/056_dashboard_widgets.sql
  modified: []
decisions:
  - Numéro de migration ajusté de 054 à 056 (054 et 055 déjà pris par coach_branding et notification_schema)
  - Pas de trigger updated_at — l'API le définit explicitement lors de l'upsert
  - Pas de validation pg_jsonschema — maintien de la simplicité de la migration
metrics:
  duration: "< 5 min"
  completed: "2026-05-26"
  tasks_completed: 1
  files_created: 1
---

# Phase 01 Plan 1 : Migration 056 — dashboard_configs + coach_memory

## Ce qui a été construit

Migration Supabase `056_dashboard_widgets.sql` créant deux tables pour le workstream custom-widget :

- **`dashboard_configs`** — stocke la configuration de widgets par paire (coach_id, client_id). Contient une colonne `widgets JSONB NOT NULL DEFAULT '[]'` et une contrainte `UNIQUE (coach_id, client_id)`. Politique RLS `dashboard_configs_own` : le coach accède uniquement à ses propres configurations.

- **`coach_memory`** — stocke les templates réutilisables et préférences UI par coach (un row par coach via `UNIQUE` sur `coach_id`). Colonne `memory JSONB NOT NULL DEFAULT '{"templates":[],"preferences":{}}'`. Politique RLS `coach_memory_own` : accès uniquement à sa propre ligne.

## Décisions clés

1. **Numéro de migration 056 au lieu de 054** — Les migrations 054 (`054_coach_branding.sql`) et 055 (`055_coach_exercises_schema.sql`, `055_forms_schema.sql`) étaient déjà réservées. Le numéro 056 est le prochain disponible.
2. **Pas de trigger `updated_at`** — L'API (plans 2–3) le définit explicitement lors de chaque `upsert`, conformément au commentaire dans la spec.
3. **Pas de `pg_jsonschema`** — Validation JSON non requise à ce stade ; la validation se fait côté API.

## Critères d'acceptation — tous satisfaits

- [x] Fichier `supabase/migrations/056_dashboard_widgets.sql` créé
- [x] Première ligne : `SET LOCAL lock_timeout = '5s';`
- [x] `CREATE TABLE IF NOT EXISTS public.dashboard_configs`
- [x] `CREATE TABLE IF NOT EXISTS public.coach_memory`
- [x] `ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;`
- [x] `ALTER TABLE public.coach_memory ENABLE ROW LEVEL SECURITY;`
- [x] Politique `"dashboard_configs_own"` FOR ALL USING (auth.uid() = coach_id)
- [x] Politique `"coach_memory_own"` FOR ALL USING (auth.uid() = coach_id)
- [x] `CONSTRAINT dashboard_configs_unique UNIQUE (coach_id, client_id)`
- [x] `widgets JSONB NOT NULL DEFAULT '[]'::jsonb`
- [x] `memory JSONB NOT NULL DEFAULT '{"templates":[],"preferences":{}}'::jsonb`
- [x] Index `idx_dashboard_configs_lookup` avec IF NOT EXISTS
- [x] Index `idx_coach_memory_coach` avec IF NOT EXISTS
- [x] Aucun appel `pg_jsonschema`
- [x] Aucun trigger `updated_at`

## Commit

`0903448` — `feat(01-01): add migration 056 — dashboard_configs + coach_memory tables`

## Self-Check: PASSED

- Fichier vérifié présent : `supabase/migrations/056_dashboard_widgets.sql` ✓
- Commit `0903448` vérifié dans `git log` ✓
- 2 politiques RLS (grep -c retourne 2) ✓
- Tous les champs clés confirmés par grep ✓
