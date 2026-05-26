# Phase 01: DB Schema & Backend API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 01-db-schema-backend-api
**Workstream:** formulaire-condi
**Areas discussed:** Stockage des questions, Structure des réponses, Config trigger en DB, Routes Hono

---

## Stockage des questions

| Option | Description | Selected |
|--------|-------------|----------|
| JSONB dans coach_forms | Colonne `questions JSONB[]` dans `coach_forms`. Pas de join, reordering trivial, cohérent avec `ai_generated_programs.program_data` et `timer_presets.exercises JSONB`. | ✓ |
| Table form_questions séparée | Table dédiée avec `position INT`, `question_type`, `options JSONB`. Plus relationnel, mais join systématique + RLS supplémentaire. | |

**User's choice:** JSONB dans coach_forms
**Notes:** Structure de question choisie : `{ id, type, label, options? }`. Pas de champ `required` ni `description` en v1.14.

### PATCH complet vs endpoint dédié questions

| Option | Description | Selected |
|--------|-------------|----------|
| PATCH /coach/forms/:id réécrit tout | Réécrit la ligne entière (titre + questions + trigger_config). Simple, aucun endpoint supplémentaire. | ✓ |
| Endpoint dédié PATCH /coach/forms/:id/questions | Route séparée pour mettre à jour uniquement les questions. Plus granulaire mais ajoute une route dès Phase 01. | |

---

## Structure des réponses

| Option | Description | Selected |
|--------|-------------|----------|
| Une ligne par soumission, answers JSONB | 1 row par `form_instance_id` avec `answers: [{question_id, value}]`. Un seul INSERT au submit, un seul SELECT pour Claude injection. | ✓ |
| Une ligne par question/réponse | 1 row par {form_instance_id, question_id}. Plus relationnel, prépare les agrégats futurs, mais N INSERTs et JOIN. | |

**User's choice:** Une ligne par soumission, answers JSONB

### RLS form_responses

| Option | Description | Selected |
|--------|-------------|----------|
| Coach + Athlete | Coach lit via `is_coach_of()`, athlete lit les siennes via `auth.uid() = athlete_id`. | ✓ |
| Coach uniquement | Seul le coach lit les réponses. | |

**User's choice:** Coach + Athlete

---

## Config trigger en DB

| Option | Description | Selected |
|--------|-------------|----------|
| JSONB `trigger_config` | Une colonne JSONB. Flexible, extensible, cohérent avec le reste du projet. | ✓ |
| Colonnes typées | `trigger_type TEXT` + `trigger_n INTEGER` + `trigger_date DATE`. Explicite mais nullable conditionnels. | |

**User's choice:** JSONB `trigger_config`

### Accès athlete au contenu du formulaire

| Option | Description | Selected |
|--------|-------------|----------|
| Via endpoint API qui fait le join | `GET /athlete/forms/pending` retourne form_instance + contenu. Pas de RLS supplémentaire sur `coach_forms`. | ✓ |
| RLS sur coach_forms pour les athletes | Policy SELECT pour athletes ayant une instance pending. Fetch direct Supabase. | |

**User's choice:** Via endpoint API (join côté Hono)

---

## Routes Hono

| Option | Description | Selected |
|--------|-------------|----------|
| Un fichier routes/forms.ts | Sections coach et athlete dans le même fichier. Cohérent avec le pattern existant. | ✓ |
| Deux fichiers séparés | `routes/coach-forms.ts` + `routes/athlete-forms.ts`. Plus clair par rôle. | |
| Namespace routes/coach.ts | Router `/coach` pour regrouper forms + futures routes coach. | |

**User's choice:** Un fichier routes/forms.ts

### Duplicate guard

| Option | Description | Selected |
|--------|-------------|----------|
| Index partiel UNIQUE | `CREATE UNIQUE INDEX ON form_instances(form_id, athlete_id) WHERE status = 'pending'`. Garanti au niveau DB. | ✓ |
| Check applicatif | SELECT avant INSERT dans la route handler. Race condition possible. | |

**User's choice:** Index partiel UNIQUE au niveau DB

---

## Claude's Discretion

- Numéro de la migration : `054` (prochain disponible après 053)
- Nommage des politiques RLS (ex. `coach_forms_own`, `form_instances_athlete`)
- Index supplémentaires sur `athlete_id` dans `form_instances` si jugé utile

## Deferred Ideas

- Endpoint PATCH dédié pour les questions — écarté, peut être ajouté en Phase 03 si le builder web en a besoin
- RLS SELECT sur `coach_forms` pour les athletes — approche alternative discutée, écartée au profit de l'API endpoint join
