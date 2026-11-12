# Phase 7: Programmes : liste, actif unique, menu - Context

**Gathered:** 2026-11-12 (voie DISCUSS, agent w2a). Req : TRAIN-06, TRAIN-07, TRAIN-08, TRAIN-09. Vague 2 (apres P6). UI hint oui : le **contrat de design du lot A** (`04-maquettes-reference/lot-A/DESIGN-CONTRACT.md`, ecrans A01-A09) tient lieu de UI-SPEC ; la maquette gagne sur toute divergence.
**Statut :** pret pour planification ; les points `[A CONFIRMER]` portent la reponse recommandee et sont repris dans `w2a-OPEN-QUESTIONS.md` quand leur reponse change l'implementation.

<domain>
## Phase Boundary

L'utilisateur voit TOUS ses programmes (IA, coach, crees), sait lequel est actif (0 ou 1 badge `ACTIF`), active/duplique/renomme/supprime sans ambiguite, et apres l'assistant 4 etapes la seance creee est accessible avec "Definir comme programme actif". Hors perimetre : atelier IA (P23), periodisation (P24), ecran Mon coach (P22/P25), demarrage d'une seance prevue (P6 `startPlannedSession`).
</domain>

<decisions>
## Implementation Decisions

### Decides (maquette lot A + recap UAT, ne pas redemander)
- **D-01** TRAIN-06 : un ecran **Programmes** liste tous les programmes (A01) : carte hero bordee primaire + badge `ACTIF` + progression, puis "Autres programmes" en liste groupee ; filtres Tous / IA / Coach / Crees (44 dp) ; etats A03 (vide, 2 CTA), A04 (squelettes `#ECEAE4`), A05 (erreur reseau + Reessayer, **jamais de programme de secours**). Critere A-1 : exactement 0 ou 1 badge `ACTIF`.
- **D-02** TRAIN-07 : un seul programme actif a la fois ; la regle est ecrite en permanence : "Un seul programme est actif a la fois. En activer un autre met l'actuel en pause." Activer = l'actuel passe en pause, **progression conservee** (A-2 : A perd `ACTIF` dans la meme capture que B le gagne). Toast de succes `Programme actif : <nom>`.
- **D-03** TRAIN-08 : menu = feuille basse (A06/A07). Inactif : `Definir comme programme actif` (primaire, 48 dp, 1re entree) puis Dupliquer puis Supprimer (danger, separe). Actif : AUCUNE entree d'activation ; Dupliquer, Renommer, Supprimer. Titre sur 2 lignes max (ellipse), teste avec un titre de 60 caracteres (A-4). Remplace le `showAlert` actuel dont les 3 handlers sont vides (`workout/index.tsx`, `handleProgramActions`).
- **D-04** TRAIN-09 : fin de l'assistant 4 etapes = A09 : la seance/programme cree est ouvrable en 1 tap, `Definir comme programme actif` / `Plus tard` visibles sans scroll (390x844, A-5), rappel du programme remplace. Suppression = confirmation `showAlert` ("Supprimer 'xxx' ? Cette action est definitive.").
- **D-05** Microcopy FR mot pour mot : voir contrat lot A §3. Charte : Ionicons, pas d'emoji, styles inline, racine `paddingBottom: 100`, `showAlert` jamais `Alert`.

### Zones grises : reponse recommandee retenue `[A CONFIRMER]`
- **D-06 [A CONFIRMER] Modele de donnees : deux tables, une seule regle.** Les programmes vivent dans deux tables : `ziko_workout_programs` (crees + assignes par le coach : `created_by_coach_id`, `assigned_to_user_id`, `user_id` NULL pour un programme assigne) et `ziko_ai_generated_programs` (IA + assistant 4 etapes). Chacune a son `is_active`, donc **rien n'empeche aujourd'hui 2 actifs**, et l'ecran `workout/index.tsx` affiche le plus recent (`order created_at desc limit 1`), pas l'actif. Recommandation : (a) fonction SQL `SECURITY DEFINER` `ziko_set_active_program(p_kind text, p_program_id uuid)` (kind = `workout` | `ai`) qui, dans une seule transaction, met `is_active=false` sur toutes les lignes de l'appelant dans les 2 tables (y compris les lignes `assigned_to_user_id = auth.uid()`) puis `true` sur la cible, en verifiant la propriete ; (b) la fonction est le SEUL chemin d'ecriture de `is_active` cote client (le store `setActiveProgram` et le "Reactiver" d'`AIProgramsPlugin` l'appellent) ; (c) index uniques partiels `ON ziko_workout_programs (user_id) WHERE is_active` et `ON ziko_ai_generated_programs (user_id) WHERE is_active` (filet par table ; l'unicite inter-tables = la fonction). Raison du `SECURITY DEFINER` : un athlete n'a que `SELECT` sur un programme assigne par son coach (policy `workout_programs_assigned_athlete_read`, pas d'UPDATE) donc il ne peut pas l'activer/desactiver cote client. Alternative ecartee : table pointeur `ziko_active_program` (un join de plus partout, la maquette n'en a pas besoin).
- **D-07 [A CONFIRMER] Regle de conflit IA / coach (question Q2).** Recommandation (lot A, critique Q2) : activer un programme perso/IA alors que le programme du coach est actif est **permis avec confirmation ecrite** (A08, deux boutons explicites dont `Garder le programme du coach`) ; le coach voit le changement cote CRM (lecture de `is_active`). Sans cela l'atelier (P23) serait inutilisable pour un athlete coache.
- **D-08 [A CONFIRMER] Menu d'un programme assigne par le coach** : `Supprimer` masque (l'athlete n'a pas le droit RLS de supprimer ; garde le principe "le coach possede son programme") ; `Dupliquer` cree une **copie perso inactive** (`user_id = moi`, sans `created_by_coach_id`) ; `Renommer` masque. Un programme assigne affiche le badge `COACH`.
- **D-09 [A CONFIRMER] Supprimer le programme actif** : autorise apres confirmation ; il ne reste alors **aucun** programme actif (pas d'auto-activation d'un autre) et l'ecran propose d'en activer un. Dupliquer = copie inactive nommee `<nom> (copie)` incluant ses seances/exercices (`ziko_program_workouts` / `ziko_program_exercises` pour les programmes de `ziko_workout_programs`, `program_data` jsonb pour les IA).
- **D-10 Bug a verifier d'abord (TRAIN-09)** : `workout/program-builder.tsx` insere dans `ziko_ai_generated_programs` uniquement `user_id`, `goal`, `program_data`, alors que le schema (`supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql`) impose `name`, `split_type`, `days_per_week` en `NOT NULL`. Si la prod a le meme schema, l'insertion echoue ou n'enregistre pas : cause probable de "seances creees par l'assistant introuvables". Verification attendue : lecture du schema reel (lecture seule) ou test de contrat ; correction dans cette phase (renseigner name/split_type/days_per_week, `is_active=false`).
- **D-11 Source de l'ecran "actif"** : `workout/index.tsx` doit lire le programme actif via D-06 (plus `limit 1` le plus recent). P6 fournit `startPlannedSession(programId, dayIndex)` ; P7 l'utilise, ne le recree pas.
- **D-12 Emplacement** : nouvel ecran `apps/mobile/app/(app)/workout/programs.tsx` (liste) + feuilles ; entree depuis l'en-tete de `workout/index.tsx`. L'onglet "Reactiver" d'`AIProgramsPlugin.tsx` (liste IA seule) appelle la meme fonction D-06 ; pas de seconde logique d'activation.
</decisions>

<specifics>
## Specific Ideas
Criteres A-1 a A-5 du contrat (arbre d'accessibilite, 2 captures pour A-2, titre 60 caracteres pour A-4). Seed UAT : un compte avec 1 programme IA actif, 1 programme coach assigne, 1 programme cree, pour A-2/A08.
</specifics>

<canonical_refs>
## Canonical References
- `.planning/workstreams/uat-mobile/phases/04-maquettes-reference/lot-A/DESIGN-CONTRACT.md` (decisions §1, ecrans A01-A09, microcopy §3, criteres A-1..A-5) ; `lot-A/01-programmes.html`, `lot-A/CRITIQUE.md` (Q2 ecrasement coach) ; `../shared/DESIGN-SYSTEM.md` (G1-G9)
- `.planning/workstreams/uat-mobile/REQUIREMENTS.md` TRAIN-06..09 ; `ROADMAP.md` Phase 7 ; `MILESTONE-RECAP-2026-11-12.md` §3
- `phases/06-seance-entrainement-fiable/06-CONTEXT.md` D-01 (`startPlannedSession`), D-06 (P6 proprietaire de `workout/*`, P7 apres)
- `supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql` (tables `ziko_workout_programs`, `ziko_ai_generated_programs`) ; `20261001101853_portfolio_ziko_functions.sql` (policies `own_programs`, `workout_programs_assigned_athlete_read`, `workout_programs_coach_*`) ; `20261107170000_ziko_revoke_client_dml.sql` (regles de grants des nouvelles fonctions/tables)
</canonical_refs>

<code_context>
## Existing Code Insights
- `apps/mobile/app/(app)/workout/index.tsx` (892 l.) : programme affiche = dernier `ziko_ai_generated_programs` ; `handleProgramActions` = `showAlert` avec handlers vides.
- `apps/mobile/app/(app)/workout/[id].tsx` (1587 l.) : detail d'un `ziko_workout_programs` ; `handleSetActive` -> `useWorkoutStore.setActiveProgram` (2 updates non atomiques, uniquement `ziko_workout_programs`).
- `apps/mobile/src/stores/workoutStore.ts` : `setActiveProgram`, `loadPrograms`.
- `plugins/ai-programs/src/screens/AIProgramsPlugin.tsx` (680 l.) : `reactivateMutation` (2 updates non atomiques sur `ziko_ai_generated_programs`), `ai_program_active`, `ai_programs` ; `plugins/ai-programs/src/store.ts`.
- `backend/api/src/coach/ai/tools.ts` l.314 : programme assigne = `ziko_workout_programs` avec `assigned_to_user_id`, `created_by_coach_id`, `weeks_data` ; `backend/api/src/coach/clients/db.ts` l.729+ (lecture cote coach).
- `backend/api/src/tools/ai-programs.ts` : outils IA sur `ziko_ai_generated_programs` (a verifier si `is_active` y est ecrit).
### Integration Points
Fichiers partages (carte de propriete) : `workout/*` apres P6 ; `packages/plugin-sdk/src/i18n.ts` (ajouter un namespace `programs.*` a la fin, pas de reecriture) ; pas de toucher `registry.ts`.
### Migrations (bloc `supabase/migrations/20261201 0701-0709`, fichiers seulement)
- `202612010701_active_program_rpc.sql` : `ziko_set_active_program` (SECURITY DEFINER, `SET search_path = public`, `REVOKE ALL ... FROM PUBLIC, anon` puis `GRANT EXECUTE ... TO authenticated`) + index uniques partiels D-06.
- `202612010702_dedupe_active_programs.sql` (seulement si la prod a deja des doublons actifs : verification lecture seule a faire par l'orchestrateur avant application ; sinon omis).
- Tout nouvel objet `ziko_*` suit la regle du README `supabase/migrations/README-v1.20.md` et la note de `20261107170000_ziko_revoke_client_dml.sql` (REVOKE explicites).
</code_context>

<deferred>
## Deferred Ideas
Historique des programmes passes / suite ordonnee = P24. Partage de programme (`ziko_shared_programs`) hors perimetre. Edition fine des seances depuis la liste = reste dans `[id].tsx`. Image de couverture de programme : non.
</deferred>

---
*Phase: 07-programmes-liste-actif-unique*
*Context gathered: 2026-11-12*
