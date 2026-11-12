# Phase 18 : Stretching complet - Context

**Gathered:** 2026-11-12 (discuss w2b : scout du code réel + maquettes lot C). Req : STRE-01..06. Vague 2. UI hint oui. **Maquette : lot C C01-C09** (`04-maquettes-reference/lot-C/DESIGN-CONTRACT.md` §1/§5 ST-1..6, valide). Dépend de P4 (fait), P6 (`startPlannedSession`, `workout/session.tsx`).
Convention : `[A CONFIRMER]` = recommandation du discuss, à valider par l'utilisateur ; sans marque = déjà décidé (recap, REQUIREMENTS, maquette).

## Décisions verrouillées (recap + contrat de design)
- **D-01** Onglets `Bibliothèque / Routines / Suivi` (ordre du contrat ; l'ordre actuel du code est Routines / Bibliothèque / Suivi : à changer). Marge latérale 16 dp + indicateur inset 12 dp (XCUT-05 s'applique à `SubTabs` partagé : consommer le composant corrigé par P5, ne pas le modifier ici). `paddingBottom: 100`.
- **D-02** STRE-01/02 : filtre par zone en puces, `Mes exercices` = puce (pas un 4e onglet), badge `PERSO` sur les exercices créés. Création : nom, zone, mesure (durée OU répétitions), côtés (1/2), consigne facultative. Aucune image/vidéo (v2) : tuile icône Ionicons.
- **D-03** STRE-03/05 : routine = nom + exercices ordonnés (poignée `reorder-two` + alternative `Monter/Descendre` accessible + corbeille) + interrupteur `Routine par défaut` ; **une seule** par défaut (badge `PAR DÉFAUT`, bordure primaire). Définir une 2e retire la 1re (ST-3).
- **D-04** STRE-06 : la routine par défaut s'affiche en carte **en tête de séance** (`Ajoutée en début de séance`, `Passer` / `Modifier`), 1re position avant le 1er exercice ; **aucune carte sans routine par défaut** (C09). `Passer` la retire pour la séance en cours (état local, non persisté).
- **D-05** STRE-04 Suivi : séances de la semaine, minutes cumulées, série (jours consécutifs), dernière séance, calendrier du mois (jour avec séance = fond teinté + gras ; aujourd'hui = contour). Valeurs recalculées depuis `ziko_stretching_logs` (écart 0, ST-5). Zéros honnêtes à vide (C07).
- **D-06** Charte : Ionicons, inline styles, `showAlert`, pas d'emoji, FR. Texte orange sur clair `#B53D05`.
- **D-07** XCUT-03/05 (safe-area, onglets) corrigés au point commun par P5 : ne pas dupliquer ici.

## Gray areas (reco + `[A CONFIRMER]`)
- **G-01 Source de la bibliothèque (bloquant produit mineur).** Constat : `StretchingPlugin.tsx:101` `const library = []` et le texte "6 exercices essentiels" sont en dur : aucune table d'exercices. Reco `[A CONFIRMER]` : table `ziko_stretching_exercises` (catalogue `user_id IS NULL` seedé par la migration, ~24 exercices FR couvrant les zones des routines existantes ; exercices perso `user_id = auth.uid()`). Alternative écartée : liste statique dans le code (pas de création possible côté base, pas d'ordre/édition de routine par id).
- **G-02 Stockage des exercices d'une routine.** Reco `[A CONFIRMER]` : garder `exercises jsonb` (instantané ordonné, avec `exercise_id` optionnel) : pas de table de jointure ni de réécriture des routines existantes ; l'éditeur (`RoutineEditor.tsx`) est déjà basé sur ce jsonb.
- **G-03 Comportement de la carte de tête de séance** : voir question Q-P18 de `../w2b-OPEN-QUESTIONS.md` (tap sur la carte lance-t-il la routine ?). Reco : oui, la carte lance `StretchingSession` puis revient à la séance ; terminer écrit un `ziko_stretching_logs`.
- **G-04** La routine par défaut ne compte **jamais** comme série validée : n'interfère pas avec TRAIN-03 (séance sans série non comptée). Décision ferme (technique).
- **G-05 Série (jours)** : jours consécutifs avec au moins un log, en date **locale** (le code actuel utilise `toISOString()` = UTC, décalage près de minuit : à corriger, cf. même défaut relevé par P8). Décision technique.

## Code context (scouté)
- `plugins/stretching/src/screens/StretchingPlugin.tsx` (399 l.) : 3 onglets, `MiniBars`, lit `ziko_stretching_routines` et `ziko_stretching_logs` ; `RoutineEditor.tsx` (297 l.), `RoutineManager.tsx` (163 l.), `StretchingSession.tsx` (151 l.) existent mais **aucune entrée de création de routine** depuis l'écran principal (retour UAT "pas de création").
- `plugins/stretching/src/store.ts` : `StretchExercise` (muscle_group, duration_seconds, instructions, image_url), `StretchRoutine` ; le log local utilise `duration_seconds`/`routine_id` alors que la table a `duration_sec` et **pas de colonne `routine_id`** (écart à corriger).
- Tables prod `ziko_stretching_routines` (id text, user_id, name, type, muscle_groups, duration_minutes, exercises jsonb) et `ziko_stretching_logs` (routine_name, duration_sec, exercises jsonb, date) ; RLS `*_own` ; DML client conservé pour `authenticated` (`20261107170000_ziko_revoke_client_dml.sql`).
- Point d'insertion séance : `apps/mobile/app/(app)/workout/session.tsx` ~l.257 (`hasStretching`) et ~l.977 (lien "Échauffement stretching" existant, à remplacer par la carte quand une routine par défaut existe) ; propriétaire P6, P18 additif (hook/composant `DefaultStretchingCard`), merge après P6/P7.
- Backend : `backend/api/src/tools/stretching.ts` (outils `stretching_get_routines` basé sur les logs ; adapter si colonnes ajoutées, ne pas toucher `registry.ts`).
- Notification/AI : le manifest/aiSkills de `stretching` reste inchangé.

## Migrations (bloc `202612011801`-`202612011809`, fichiers seulement)
- `202612011801_stretching_exercises.sql` : `ziko_stretching_exercises` (id uuid, user_id uuid null = catalogue, name, muscle_group, measure `duration|reps`, duration_seconds, reps, sides 1|2, instructions, created_at) ; RLS : SELECT `user_id IS NULL OR auth.uid() = user_id` ; INSERT/UPDATE/DELETE seulement `auth.uid() = user_id` ; seed du catalogue (user_id NULL, aucun accès client en écriture) ; **REVOKE explicite** TRUNCATE/REFERENCES/TRIGGER/MAINTAIN de anon/authenticated (règle imposée à toute nouvelle table `ziko_*`, cf. en-tête de `20261107170000`).
- `202612011802_stretching_default_routine.sql` : `ziko_stretching_routines.is_default boolean NOT NULL DEFAULT false` + index unique partiel `(user_id) WHERE is_default` (garantit ST-3) ; `ziko_stretching_logs.routine_id text null`.
- Aucune migration ne modifie une migration existante.

## Références canoniques
`04-maquettes-reference/lot-C/DESIGN-CONTRACT.md` (§1 Stretching, §2 C01-C09, §3 microcopy, §4 a11y, §5 ST-1..ST-6, §6) ; `lot-C/01-stretching.html` ; `lot-C/CRITIQUE.md` ; `shared/DESIGN-SYSTEM.md` (G1-G9) ; `ORCHESTRATION-v1.20` carte des fichiers (workout/*, i18n.ts, WSHeader) ; `.planning/MILESTONE-RECAP-2026-11-12.md` §10.

## Vérification (rappel)
Tests unitaires : calcul série/minutes/semaine (fuseau local), unicité routine par défaut, tri/ordre d'une routine, absence de carte sans défaut ; test RLS d'écriture du catalogue (un client ne peut pas écrire `user_id NULL`). UAT émulateur en file : ST-1..ST-6 (captures), relance de l'app après création (ST-2).

## Deferred
Images/vidéos d'exercices (v2). Suggestion IA de routine. Partage de routines entre amis.
