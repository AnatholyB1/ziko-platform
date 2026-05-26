# Phase 01: DB Schema & Backend API - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Créer les 4 tables Supabase (`coach_forms`, `form_instances`, `form_responses`, et aucune table séparée pour les questions — cf. D-01), les politiques RLS, et les routes Hono CRUD pour le système de formulaires conditionnels. Le résultat attendu : un coach peut créer/lire/modifier/publier un formulaire via API, et une instance pending peut être créée et soumise via API.

**Hors scope Phase 01 :** logique de déclenchement automatique (Phase 02), UI web form builder (Phase 03), mobile overlay (Phase 04), viewer réponses + Claude injection (Phase 05).

</domain>

<decisions>
## Implementation Decisions

### Stockage des questions

- **D-01:** Les questions sont stockées en JSONB dans `coach_forms.questions` — **pas de table `form_questions` séparée**. Cohérent avec `ai_generated_programs.program_data JSONB` et `timer_presets.exercises JSONB` déjà en place.
- **D-02:** Structure de chaque question dans le tableau JSONB :
  ```json
  { "id": "<uuid-client-generated>", "type": "free_text|scale_1_10|yes_no|single_choice", "label": "Texte de la question", "options": ["opt1", "opt2"] }
  ```
  `options` est présent uniquement pour `single_choice`. Pas de champ `required` ni `description` en v1.14.
- **D-03:** `PATCH /coach/forms/:id` réécrit la ligne entière (titre + questions + trigger_config). Aucun endpoint dédié pour le reordering des questions — la Phase 03 (web builder) envoie le tableau complet réordonné.

### Structure des réponses

- **D-04:** `form_responses` = **une ligne par soumission**, colonne `answers JSONB` contenant `[{question_id, value}]`. Exemple :
  ```json
  [
    {"question_id": "abc", "value": "Je me sens bien"},
    {"question_id": "def", "value": 7},
    {"question_id": "ghi", "value": "yes"},
    {"question_id": "xyz", "value": "Option A"}
  ]
  ```
  `value` est de type JSON natif (string, number, boolean) selon le type de question.
- **D-05:** RLS sur `form_responses` : coach lit via `is_coach_of()`, athlete lit ses propres soumissions via `auth.uid() = athlete_id`.

### Config trigger en DB

- **D-06:** La config du trigger est stockée dans **`coach_forms.trigger_config JSONB NOT NULL DEFAULT '{"type":"manual"}'`**. Exemples de valeurs selon le type :
  ```json
  {"type": "first_contact"}
  {"type": "after_n_sessions", "n": 4}
  {"type": "fixed_date", "date": "2026-06-01"}
  {"type": "manual"}
  ```
  La Phase 02 (trigger engine) lit `trigger_config.type` pour switcher, et `trigger_config.n` / `trigger_config.date` pour les paramètres spécifiques.
- **D-07:** L'athlete accède au contenu du formulaire (questions) **uniquement via l'endpoint API** `GET /athlete/forms/pending` (Hono fait le join `form_instances ← coach_forms`). Pas de RLS SELECT sur `coach_forms` pour les athletes — la table reste accessible au coach uniquement en direct Supabase.

### Routes Hono

- **D-08:** Un seul fichier `backend/api/src/routes/forms.ts` monté dans `index.ts`. Sections internes :
  - Routes coach : `GET /coach/forms`, `POST /coach/forms`, `PATCH /coach/forms/:id`, `POST /coach/forms/:id/publish`
  - Routes athlete : `GET /athlete/forms/pending`, `POST /athlete/forms/:instanceId/submit`
  - Toutes les routes passent par `authMiddleware`.
- **D-09:** Duplicate guard (TRIGGER-05) = **index partiel UNIQUE au niveau DB** :
  ```sql
  CREATE UNIQUE INDEX form_instances_no_dup_pending
    ON public.form_instances(form_id, athlete_id)
    WHERE status = 'pending';
  ```
  L'INSERT échoue au niveau DB si un doublon est tenté — pas de check applicatif.

### Claude's Discretion

- Numéro de la migration : prochain disponible après 053 (donc `054`).
- Nommage des politiques RLS : suivre le pattern `{table}_{role}` (ex. `coach_forms_own`, `form_instances_athlete`).
- Index supplémentaires : ajouter `idx_form_instances_athlete` sur `athlete_id` si jugé utile pour les queries de l'overlay mobile.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/workstreams/formulaire-condi/ROADMAP.md` — Phase 01 success criteria (5 critères), liste des routes requises, couverture des requirements
- `.planning/workstreams/formulaire-condi/REQUIREMENTS.md` — FORM-01, FORM-02, FORM-04, FORM-05, FORM-06, TRIGGER-05

### RLS & Coach patterns

- `supabase/migrations/045_coaching_programs_schema.sql` — Pattern `is_coach_of()` dans les RLS (référence pour les policies coach/athlete de ce workstream)
- `supabase/migrations/034_coach_role_profiles.sql` — Structure des profils coach, `coach_client_links`

### Hono API patterns

- `backend/api/src/routes/credits.ts` — Pattern Hono route (authMiddleware, `c.get('auth').userId`, `c.json()`)
- `backend/api/src/middleware/auth.ts` — Auth middleware

### JSONB column precedents

- `supabase/migrations/012_new_plugins_schema.sql` — `ai_generated_programs.program_data JSONB`
- `supabase/migrations/020_timer_exercises_hyrox.sql` — `timer_presets.exercises JSONB`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `authMiddleware` (`backend/api/src/middleware/auth.js`) — à importer directement dans `routes/forms.ts`, même pattern que credits.ts
- `is_coach_of(coach_id, athlete_id)` — fonction PostgreSQL existante, utilisée dans les RLS policies des tables forms

### Established Patterns

- **Migration SQL** : `SET LOCAL lock_timeout = '5s'`, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `CREATE POLICY` — voir migration 045 comme modèle
- **JSONB colonnes** : `NOT NULL DEFAULT '[]'::jsonb` pour les arrays, `NOT NULL DEFAULT '{...}'::jsonb` pour les objects — voir `program_data` et `exercises`
- **Hono router** : `const router = new Hono()` + `router.use('*', authMiddleware)` + `export { router as formsRouter }` — voir credits.ts
- **Numérotation migration** : prochaine disponible = `054`

### Integration Points

- `backend/api/src/index.ts` — monter `formsRouter` depuis `./routes/forms.js`
- `supabase/migrations/` — ajouter `054_forms_schema.sql`

</code_context>

<specifics>
## Specific Ideas

- Le coach envoie le tableau de questions **complet et ordonné** au PATCH (pas de diff partiel) — la Phase 03 web builder réordonne localement avant d'envoyer.
- L'endpoint `GET /athlete/forms/pending` doit retourner : `{ instance_id, form_id, form_title, question_count, questions[] }` — le mobile Phase 04 a besoin de tout ça pour afficher l'overlay.
- `trigger_config` default = `'{"type":"manual"}'` — un formulaire créé sans configurer de trigger est "manual" par défaut et ne se déclenche pas automatiquement.

</specifics>

<deferred>
## Deferred Ideas

- **Endpoint PATCH dédié pour les questions** (`PATCH /coach/forms/:id/questions`) — identifié mais écarté au profit du PATCH complet. Peut être ajouté en Phase 03 si le builder web en a besoin.
- **RLS SELECT sur `coach_forms` pour les athletes** — approche alternative discutée, écartée au profit de l'API endpoint join. Pourrait être revisitée si le mobile bascule en accès direct Supabase.

</deferred>

---

*Phase: 01-db-schema-backend-api*
*Context gathered: 2026-05-26*
