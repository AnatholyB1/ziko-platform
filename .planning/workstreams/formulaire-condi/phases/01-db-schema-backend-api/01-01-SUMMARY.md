---
phase: 01-db-schema-backend-api
plan: "01"
subsystem: database
tags: [supabase, postgresql, rls, jsonb, migration]

# Dependency graph
requires: []
provides:
  - "Table coach_forms avec JSONB questions + trigger_config, statut draft/active/archived, RLS coach-only"
  - "Table form_instances liant un formulaire a un athlete avec statut pending/submitted"
  - "Table form_responses stockant les reponses JSONB par instance"
  - "RLS completes : 7 policies couvrant acces coach, acces athlete, insert coach, update athlete"
  - "Index partiel UNIQUE form_instances_no_dup_pending (guard D-09 / TRIGGER-05)"
  - "Index de performance sur athlete_id, form_id, instance_id"
affects:
  - "01-02 (routes Hono CRUD)"
  - "Phase 02 trigger engine"
  - "Phase 04 mobile overlay"
  - "Phase 05 response viewer"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration SQL avec SET LOCAL lock_timeout = '5s'"
    - "JSONB NOT NULL DEFAULT '[]'::jsonb pour arrays, '{}' cast pour objects"
    - "RLS via is_coach_of() pour acces coach transversal"
    - "Index partiel UNIQUE pour duplicate guard au niveau DB"

key-files:
  created:
    - "supabase/migrations/055_forms_schema.sql"
  modified: []

key-decisions:
  - "Migration renumerotee 055 (054 deja prise par 054_coach_branding.sql non tracke)"
  - "form_instances_insert : seul le proprietaire du formulaire (coach_id = auth.uid()) peut inserer, pas de is_coach_of() pour eviter des insertions indirectes"
  - "athlete_id denormalise dans form_responses pour RLS is_coach_of() sans join couteux"
  - "Pas de trigger updated_at sur coach_forms en v1 — le PATCH reecrit la ligne entiere (D-03)"

patterns-established:
  - "Guard duplicate : CREATE UNIQUE INDEX ... WHERE status = 'pending' (partiel, zero overhead sur les lignes submitted)"
  - "Policy FOR SELECT separee entre coach et athlete sur la meme table (deux policies SELECT non conflictuelles)"

requirements-completed:
  - FORM-01
  - FORM-02
  - FORM-04
  - TRIGGER-05

# Metrics
duration: 8min
completed: 2026-05-26
---

# Phase 01 Plan 01 : Forms Schema Summary

**Migration PostgreSQL 055 creant coach_forms, form_instances et form_responses avec RLS coach/athlete et index partiel UNIQUE pour le duplicate guard de form_instances**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-26T00:00:00Z
- **Completed:** 2026-05-26T00:08:00Z
- **Tasks:** 1/2 (Task 2 = checkpoint humain — supabase db push)
- **Files modified:** 1

## Accomplishments

- Table `coach_forms` : JSONB `questions` (array de {id, type, label, options?}) + `trigger_config` (default `{"type":"manual"}`) + lifecycle `draft/active/archived`
- Table `form_instances` : lien form_id/athlete_id, duplicate guard via index UNIQUE partiel `WHERE status = 'pending'`
- Table `form_responses` : une ligne par soumission, `answers JSONB`, `athlete_id` denormalise pour RLS performante
- 7 politiques RLS : coach_forms_own, form_instances_coach, form_instances_athlete, form_instances_insert, form_instances_athlete_update, form_responses_coach_read, form_responses_athlete
- 4 index : 1 UNIQUE partiel (guard D-09) + 3 index de performance

## Task Commits

1. **Task 1: Write migration 055 — forms schema DDL** - `342d7ec` (feat)

## Files Created/Modified

- `supabase/migrations/055_forms_schema.sql` — DDL complet : 3 tables, 7 policies RLS, 4 indexes

## Decisions Made

- **Renumerotation 055** : le plan indiquait 054 mais `054_coach_branding.sql` existait deja comme fichier non tracke ; 055 utilise sans ambiguite.
- **form_instances_insert simplifie** : la policy INSERT verifie uniquement `cf.coach_id = auth.uid()` (le coach proprietaire du formulaire), pas `is_coach_of()` — un coach ne doit inserer des instances que pour ses propres formulaires.
- **athlete_id dans form_responses** : denormalise depuis form_instances pour permettre a is_coach_of() de fonctionner directement dans la RLS SELECT sans sous-requete couteuse.

## Deviations from Plan

### Deviation automatique

**1. [Rule 2 - Missing Critical] Simplification de form_instances_insert**
- **Found during:** Task 1
- **Issue:** Le plan proposait une policy INSERT combinant ownership du formulaire OU is_coach_of() — la branche is_coach_of() permettrait a n'importe quel coach liant l'athlete d'inserer une instance pour un formulaire qu'il ne possede pas.
- **Fix:** Policy INSERT conserve uniquement la verification `cf.coach_id = auth.uid()` (le coach proprietaire du formulaire cree l'instance). Semantique correcte : seul le coach auteur du formulaire peut l'assigner.
- **Files modified:** supabase/migrations/055_forms_schema.sql
- **Committed in:** 342d7ec (Task 1 commit)

---

**Total deviations:** 1 auto-fixe (Rule 2 — securite semantique)
**Impact on plan:** Correction necessaire pour eviter une elevation de privilege. Aucun changement de scope.

## Issues Encountered

Aucun — migration ecrite directement depuis les patterns de reference (045, 012, 034).

## Next Phase Readiness

- Tables `coach_forms`, `form_instances`, `form_responses` prets pour 01-02 (routes Hono CRUD) **apres** que l'utilisateur execute `supabase db push`
- Index partiel UNIQUE garantit le duplicate guard au niveau DB (TRIGGER-05) — aucun check applicatif supplementaire requis en 01-02
- `is_coach_of()` disponible dans les RLS des trois tables — 01-02 peut ecrire les routes Hono sans gestion de permissions supplementaire

## Checkpoint Requis

**Task 2 (bloquante) :** L'utilisateur doit executer `supabase db push` depuis la racine du projet pour appliquer la migration 055 au projet Supabase distant. Les plans 01-02 et suivants dependent de l'existence des tables en base.

---
*Phase: 01-db-schema-backend-api*
*Completed: 2026-05-26*
