# Phase 20 : Timer, presets éditables - Context

**Gathered:** 2026-11-12 (discuss w2b : scout du code réel + maquettes lot C). Req : TIMR-01..03. Vague 2. UI hint oui. **Maquette : lot C C19-C23** (contrat §1 Timer, §5 TI-1..3, valide). Dépend de P4 (fait). Plugin isolé.
`[A CONFIRMER]` = recommandation du discuss à valider ; sans marque = déjà décidé.

## Décisions verrouillées (recap + contrat de design)
- **D-01** TIMR-01 : 3 onglets `Séance / Tabata / Intervalle`, chacun avec une liste `Mes presets`. Ligne = nom + résumé chiffré ; menu `...` (feuille) = Modifier, Dupliquer, Supprimer ; suppression avec confirmation écrite (`Supprimer ce preset ? Cette action est définitive.`, `showAlert`).
- **D-02** TIMR-02 : éditeur = nom, échauffement, effort, repos, séries par round, rounds, repos entre rounds (steppers 44 dp, appui long = répétition accélérée) + **durée totale calculée en direct**. Onglet Séance : l'éditeur n'expose que repos + séries (champs non pertinents absents, pas désactivés).
- **D-03** Formule de durée (vérifiée sur la maquette C22 : 5 + 3x6x(1:30+1:00) + 2x2:00 = 54 min) : `échauffement + rounds x séries x (effort + repos) + (rounds - 1) x repos entre rounds`. Le contrat l'écrit sans le `- 1` : **la maquette (54 min) fait foi**. Test unitaire sur ce cas (écart 0 s, TI-3).
- **D-04** TIMR-03 : plus **aucun** preset d'exemple/par défaut ; état vide C21 (`Aucun preset d'intervalle`, `Nouveau preset`).
- **D-05** Charte : Ionicons (`timer`, `flash`), inline styles, pas d'emoji, `paddingBottom: 100`, FR.

## Gray areas (reco + `[A CONFIRMER]`)
- **G-01 Cause de "Exemple" (constat).** La chaîne `Exemple` n'existe **nulle part** dans le code. `TimerPlugin.tsx` l.91-98 injecte pourtant 4 presets codés en dur (`Force`, `Hypertrophie`, `Endurance`, `Cardio HIIT`) dès qu'aucun preset en base n'existe, et la ligne "Exemple" vue en UAT est donc très probablement une **ligne utilisateur** de `ziko_timer_presets`. Correction code : supprimer `builtinPresets` et le repli. Traitement de la donnée : voir question Q-P20a (ne pas supprimer par migration sur le nom).
- **G-02 Où vont les types existants.** Contrainte actuelle `type IN (tabata, hiit, emom, rest, custom, hyrox, functional)` (`020_timer_exercises_hyrox.sql`). Reco `[A CONFIRMER]` : Séance = `custom` ; Tabata = `tabata` ; Intervalle = tout le reste (`hiit`, `emom`, `hyrox`, `functional`, `rest`) afin qu'aucun preset existant disparaisse. Voir Q-P20b.
- **G-03 Colonnes manquantes.** Modèle actuel : `work_sec`, `rest_sec`, `rounds`, `exercises jsonb`. Il manque échauffement, séries par round, repos entre rounds. Reco : 3 colonnes ajoutées avec défauts (0 / 1 / 0) : les presets existants restent valides et se lisent comme `1 série`.
- **G-04 Stepper 11 appuis pour 54 min** (CRITIQUE mineur 1, non traité en maquette) : reco `[A CONFIRMER]` = appui long accélère (contrat §4) + **saisie numérique en feuille au tap sur la valeur** ; coût faible, gain d'efficacité réel. À trancher au plan, sans dépendance externe.
- **G-05 Deux écrans de gestion existants** (`TimerManager.tsx` 170 l. route `timer/manager`, `TimerEditor.tsx` 440 l. route `timer/editor`) : reco = les réutiliser comme base de l'éditeur/feuille et **retirer l'entrée séparée "Gérer les chronos"** du manifest (la gestion vit dans chaque onglet, contrat C19-C23). Si on la garde, deux chemins pour la même chose (risque de divergence).
- **G-06 Lecture du preset** : `selectPreset`/boucle d'exécution doivent honorer échauffement, séries, rounds et repos entre rounds (aujourd'hui `total = work_seconds ?? 90`, boucle simple). Hors du seul CRUD : sans cela un preset édité n'aurait pas d'effet à l'exécution. Décision ferme (nécessaire à TIMR-02 de bout en bout) ; le plan chiffre l'effort, périmètre = moteur de décompte du plugin timer uniquement.

## Code context (scouté)
- `plugins/timer/src/screens/TimerPlugin.tsx` (655 l.) : onglets l.19, requête `ziko_timer_presets` l.65-88 (mapping `work_sec -> work_seconds`), repli builtin l.91-98, onglets Tabata (l.471) et Intervalle (l.527) avec **configurations codées en dur** (`tabataPreset`, `intervalPreset`), sauvegarde d'une séance dans `ziko_workout_sessions` (l.108).
- `TimerEditor.tsx` (insert/update `ziko_timer_presets`, types hiit/tabata/emom/custom/hyrox/functional, liste d'exercices), `TimerManager.tsx`, `store.ts` (`TimerPreset`, `customPresets`, `is_builtin`).
- Table prod `ziko_timer_presets(id, user_id, name, type, work_sec, rest_sec, rounds, exercises jsonb, created_at)` ; RLS `timer_presets_own` (FOR ALL) ; DML `authenticated` conservé.
- Backend : `backend/api/src/tools/timer.ts` (`timer_get_presets`, `timer_create_preset` : ajouter les nouveaux champs en option, sans casser les appels existants ; pas de modification de `registry.ts`).
- Persistance de l'exécution/notification fin de timer : hors périmètre (inchangé).

## Migrations (bloc `20261201200100`-`202612012009`, fichiers seulement)
- `20261201200100_timer_preset_fields.sql` : `ALTER TABLE ziko_timer_presets ADD COLUMN warmup_sec int NOT NULL DEFAULT 0, ADD COLUMN sets int NOT NULL DEFAULT 1, ADD COLUMN round_rest_sec int NOT NULL DEFAULT 0` + CHECK de bornes (>= 0, `sets >= 1`, `rounds >= 1`). Aucune suppression de ligne, aucune modification de migration existante, pas de nouvelle table (donc pas de REVOKE à ajouter).

## Références canoniques
`lot-C/DESIGN-CONTRACT.md` (§1 Timer, §2 C19-C23, §3, §4 steppers, §5 TI-1..TI-3) ; `lot-C/03-timer.html` (valeurs de C22) ; `lot-C/CRITIQUE.md` (mineur 1) ; `.planning/MILESTONE-RECAP-2026-11-12.md` §12.

## Vérification (rappel)
Tests unitaires : `totalDuration` (cas C22 = 54 min, `rounds = 1`, `round_rest = 0`), validation des bornes, mapping type -> onglet. UAT émulateur en file : TI-1 (CRUD x3 avec confirmation), TI-2 (compte neuf = 0 preset + état vide), TI-3 (6 champs modifiables, durée affichée = formule).

## Deferred
Sons/vibration par phase, preset partagé entre amis, import de presets, intégration au programme (séance guidée).
