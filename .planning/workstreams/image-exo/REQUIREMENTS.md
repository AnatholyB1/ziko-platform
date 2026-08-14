# Requirements: Ziko Platform — v1.16 Exercise Library Import

**Defined:** 2026-08-14
**Core Value:** Coaches et athlètes disposent d'une bibliothèque d'exercices fiable et complète — données riches, GIFs et thumbnails réels et self-hébergés, sans dépendance à un CDN tiers cassé.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### Import Pipeline

- [ ] **IMPORT-01**: Script récupère le dataset (exercises.json + images/ + videos/) depuis `hasaneyldrm/exercises-dataset` via `git clone --depth 1`, vérifié contre le manifest de fichiers attendu
- [ ] **IMPORT-02**: Phase de match à blanc (dry-run) produit un rapport revu par un humain (matché / non-matché-ancien / non-matché-nouveau / ambigu) via un matcher précision-first à 3 niveaux, zéro écriture DB, exclut explicitement `is_custom=true` et la table `coach_exercises`
- [ ] **IMPORT-03**: Le merge ne s'exécute que sur un rapport approuvé — UPDATE des exercices matchés en place (préserve l'UUID pour la sécurité des FK `program_exercises`/`session_sets`), INSERT des exercices non-matchés nouveaux, jamais de DELETE
- [ ] **IMPORT-04**: Le merge est idempotent/reprenable via une table `exercise_import_log` — un run tué ou relancé ne retraite ni ne corrompt les lignes déjà migrées
- [ ] **IMPORT-05**: Les anciens exercices sans match confiant mais référencés par de l'historique réel (`program_exercises`/`session_sets`) sont laissés intacts et signalés pour revue manuelle — jamais auto-mergés, jamais supprimés

### Média & Storage

- [x] **MEDIA-01**: Colonne `image` (chemin thumbnail) ajoutée à `public.exercises` via une migration datée
- [x] **MEDIA-02**: GIFs + thumbnails uploadés vers un nouveau bucket Supabase Storage public `exercise-media` — écriture service-role uniquement, aucune policy d'écriture client
- [ ] **MEDIA-03**: Média stocké et servi à sa résolution native 180×180, jamais upscalé — contrainte imposée dès l'étape d'upload
- [ ] **MEDIA-04**: Snapshot de sauvegarde des lignes écrasées (table `exercises_merge_backup`) créé avant chaque UPDATE, pour réversibilité

### Mobile

- [ ] **MOBILE-01**: Écran détail exercice (`[exerciseId].tsx`) affiche le vrai GIF + thumbnail, remplaçant le faux placeholder vidéo (`Démo · 0:42`, badge `HD`) actuellement affiché sans asset réel
- [ ] **MOBILE-02**: Liste `ExercisePicker` affiche les thumbnails des exercices (au lieu du texte seul actuel)
- [ ] **MOBILE-03**: Chaque surface d'affichage de média montre l'attribution obligatoire "© Gym visual — https://gymvisual.com/" via un composant partagé `<AttributedMedia>` (`packages/ui/`) qui impose structurellement le badge + le cap 180×180
- [ ] **MOBILE-04**: `instruction_steps` (tableau structuré du dataset) câblé dans l'UI d'étapes numérotées existante, remplaçant le fallback fragile `JSON.parse`/`.split('\n')`
- [ ] **MOBILE-05**: Nom + instructions bilingues FR/EN sourcés depuis le dataset, cohérent avec la convention `name_fr` existante
- [ ] **MOBILE-06**: Clé TanStack Query versionnée (ex. `['exercises', 'v2']`) pour éviter qu'un client déjà installé affiche un mélange de médias anciens (exercisedb.io) et nouveaux (Storage) après le rollout

## v2 Requirements

Deferred to a future milestone. Tracked but not in this roadmap.

### Discovery

- **DISC-01**: Chips de filtre (body_part/equipment) pilotées par la DB importée avec labels FR, remplaçant le tableau `FILTER_CHIPS` hardcodé

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Upscaling média au-delà de 180×180 | Interdit par la licence Gym visual (NOTICE.md) — non-négociable, pas juste reporté |
| Workflow de resync automatique / UI admin | Un script relançable manuellement suffit pour v1 — aucune surface produit nécessaire |
| Langues additionnelles du dataset au-delà de FR/EN | Aucune demande utilisateur actuelle (dataset couvre 10 langues, app FR/EN uniquement) |
| Modification de `is_custom=true` / table `coach_exercises` | Système séparé déjà livré dans le workstream `custom-coach` (migration 055) — ne pas conflater |
| Nouvelle route backend Hono `GET /exercises` | Le mobile continue de lire `exercises` directement via le client Supabase (pattern existant) — le fichier JSON de 17 Mo dépasse de toute façon la limite Vercel de 4.5 Mo documentée en v1.3 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MEDIA-01 | Phase 1 | Complete |
| MEDIA-02 | Phase 1 | Complete |
| IMPORT-01 | Phase 2 | Pending |
| IMPORT-02 | Phase 2 | Pending |
| IMPORT-03 | Phase 3 | Pending |
| IMPORT-04 | Phase 3 | Pending |
| IMPORT-05 | Phase 3 | Pending |
| MEDIA-03 | Phase 3 | Pending |
| MEDIA-04 | Phase 3 | Pending |
| MOBILE-01 | Phase 4 | Pending |
| MOBILE-02 | Phase 4 | Pending |
| MOBILE-03 | Phase 4 | Pending |
| MOBILE-04 | Phase 4 | Pending |
| MOBILE-05 | Phase 4 | Pending |
| MOBILE-06 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-14*
*Last updated: 2026-08-14 after initial definition*
