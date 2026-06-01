---
phase: 01-db-schema-backend-api
plan: "02"
subsystem: backend-api
tags: [hono, api, forms, coach, athlete, typescript]

# Dependency graph
requires:
  - "01-01 (tables coach_forms, form_instances, form_responses + RLS)"
provides:
  - "GET /forms/coach/forms — liste des formulaires du coach authentifie"
  - "POST /forms/coach/forms — creation d'un formulaire (draft)"
  - "PATCH /forms/coach/forms/:id — reecriture complete titre+questions+trigger_config"
  - "POST /forms/coach/forms/:id/publish — passage en statut active"
  - "GET /forms/athlete/forms/pending — instances pending avec join coach_forms"
  - "POST /forms/athlete/forms/:instanceId/submit — soumission avec guard 409 double-submit"
affects:
  - "Phase 03 (Form Builder web UI) — consomme les 4 routes coach"
  - "Phase 04 (Mobile Overlay) — consomme les 2 routes athlete"
  - "Phase 05 (Response Viewer) — donnees en base via submit"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hono router avec router.use('*', authMiddleware) — meme pattern que credits.ts"
    - "Supabase createClient module-scope avec SUPABASE_PUBLISHABLE_KEY"
    - "Guard 409 double-submit : verification status = submitted avant INSERT"
    - "Relation Supabase nested select avec !inner pour le JOIN form_instances -> coach_forms"
    - "Type union Array.isArray() pour normaliser la relation Supabase en objet unique"

key-files:
  created:
    - "backend/api/src/routes/forms.ts"
  modified:
    - "backend/api/src/app.ts"

key-decisions:
  - "Relation Supabase nested (`coach_forms!inner`) plutot que raw SQL JOIN — cohérent avec les autres routes coach du projet"
  - "Type union {…} | {…}[] pour coach_forms dans le map — Supabase retourne un array pour les relations, nécessite Array.isArray() pour normaliser"
  - "Guard 404 via code PGRST116 (no rows) pour PATCH et publish — evite une requete SELECT supplementaire"

# Metrics
duration: 12min
completed: 2026-05-26
---

# Phase 01 Plan 02 : Forms Hono Routes Summary

**6 routes Hono authentifiees (coach + athlete) pour le systeme de formulaires conditionnels, montees a /forms dans app.ts — TypeScript zero erreur**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-26T00:08:00Z
- **Completed:** 2026-05-26T00:20:00Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- `backend/api/src/routes/forms.ts` cree — 6 handlers couvrant coach CRUD + athlete pending/submit
- Guard 409 double-submit : verification `instance.status === 'submitted'` avant INSERT dans `form_responses`
- Guard 403/404 ownership : `WHERE coach_id = userId` sur PATCH et publish, code PGRST116 renvoie 404
- Athlete ownership : `WHERE athlete_id = userId AND id = instanceId` avant toute mutation
- `GET /athlete/forms/pending` retourne `{ instance_id, form_id, form_title, question_count, questions }` via join nested Supabase
- `backend/api/src/app.ts` mis a jour : import + `app.route('/forms', formsRouter)`
- TypeScript compile sans erreur sur l'ensemble du package backend/api

## Task Commits

1. **Tasks 1 + 2 : forms.ts + app.ts** — `fa39261` (feat)

## Files Created/Modified

- `backend/api/src/routes/forms.ts` — 6 routes Hono avec authMiddleware, try/catch, guards 400/404/409
- `backend/api/src/app.ts` — import formsRouter + app.route('/forms', formsRouter)

## Decisions Made

- **Relation nested Supabase** : `.select('id, form_id, coach_forms!inner (title, questions)')` au lieu d'un raw SQL JOIN — coherent avec les patterns existants dans le projet
- **Type union pour coach_forms** : Supabase SDK type la relation comme un array dans le retour generique — `Array.isArray()` normalise en objet unique de façon sure
- **PGRST116 pour 404** : code d'erreur Supabase "no rows returned" utilise pour detecter un row non trouve ou non possede, evite un SELECT preliminaire

## Deviations from Plan

### Deviation automatique

**1. [Rule 1 - Bug] Correction du type TypeScript pour la relation nested Supabase**
- **Found during:** Task 1 — verification tsc
- **Issue:** Le type annote `{ coach_forms: { title: string; questions: unknown[] } | null }` ne correspond pas au type effectivement retourne par Supabase SDK (`{ coach_forms: { … }[] }` — array, pas objet)
- **Fix:** Type union `{ … } | { … }[] | null` + normalisation `Array.isArray()` dans le map
- **Files modified:** backend/api/src/routes/forms.ts
- **Committed in:** fa39261 (inclus dans le commit de task 1+2)

---

**Total deviations:** 1 auto-fixe (Rule 1 — erreur TypeScript bloquante)
**Impact sur le plan:** Correction mineure de type, aucun changement de comportement ni de scope.

## Issues Encountered

Aucun probleme fonctionnel. Un seul ajustement de type TypeScript detecte et corrige immediatement par rtk tsc.

## Next Phase Readiness

- Routes `/forms/coach/*` pretes pour la Phase 03 (Form Builder web)
- Routes `/forms/athlete/*` pretes pour la Phase 04 (Mobile Overlay)
- Guard 409 double-submit confirme en code (complement du UNIQUE index partiel de 01-01)
- Toutes les routes renvoient 401 sans Authorization header (authMiddleware actif sur `*`)

## Threat Mitigations Implemented

| Threat ID | Mitigation |
|-----------|-----------|
| T-01-05 | PATCH + publish : `WHERE coach_id = userId` — 404 si non proprietaire |
| T-01-06 | Submit : fetch `WHERE athlete_id = userId AND id = instanceId` avant INSERT — 404 si mismatch |
| T-01-08 | Submit : check `instance.status === 'submitted'` — 409 si double-soumission |

## Self-Check

- [x] `backend/api/src/routes/forms.ts` existe
- [x] `backend/api/src/app.ts` contient `app.route('/forms', formsRouter)`
- [x] Commit fa39261 present dans git log
- [x] TypeScript : zero erreur

---
*Phase: 01-db-schema-backend-api*
*Completed: 2026-05-26*
