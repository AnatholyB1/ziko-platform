# Phase 20 : Timer, presets editables : SUMMARY

Branche `phase/20-timer` (base `milestone/v1.20`). Mobile only + 1 fichier migration + 1 outil backend (champs optionnels).

## Livre
- `plugins/timer/src/presets.ts` : logique pure (type -> onglet, formule de duree, resume, bornes/validation, steppers, normalisation, payload DB, sequence de phases `buildPhases`/`phaseAt`).
- `TimerPlugin.tsx` reecrit : 3 onglets Séance/Tabata/Intervalle, liste `Mes presets` filtree par onglet, ligne = nom + resume + duree, menu `...` (Modifier/Dupliquer/Supprimer avec confirmation ecrite dans la feuille, maquette C23), etat vide C21, FAB `Nouveau preset`, bouton plein `getActionPrimary` (#CF4509). `builtinPresets` et tout repli supprimes (TIMR-03, Q-P20a). Erreur reseau = `ErrorScreen` (la requete leve desormais l'erreur au lieu de l'avaler).
- `TimerEditor.tsx` reecrit (creation + edition via `presetId`) : nom + 6 steppers 44 dp (appui long acceleree x1/x5/x10, tap valeur = saisie numerique en feuille, `adjustable` + actions a11y), duree totale en direct, Séance = repos + séries uniquement.
- Moteur de decompte (G-06) : echauffement, effort, repos, séries, rounds, repos entre rounds ; base sur l'horloge murale (robuste arriere-plan), +/-15 s, sons/vibration par phase, sauvegarde comme séance conservee.
- Migration (fichier, NON appliquee) `202612012001_timer_preset_fields.sql` : 3 colonnes (0/1/0) + CHECK. Aucune suppression de donnee.
- Backend `timer_create_preset` : `warmup_seconds`, `sets`, `round_rest_seconds` optionnels (+ manifest). `registry.ts` inchange.
- Retire : `TimerManager.tsx`, `store.ts` (BUILTIN_PRESETS), entree manifest `Gérer les chronos`. La route `timer/manager` redirige vers le dashboard (deep link IA `timer_manager`).
- Q-P20b : Séance=`custom`, Tabata=`tabata`, Intervalle=autres types ; nouveaux presets : custom / tabata / hiit.

## Exigences
- TIMR-01 : PARTIAL (code + logique testee ; CRUD reel = UAT TI-1, non execute).
- TIMR-02 : PARTIAL (6 champs + duree ; formule prouvee par test = 54 min ; rendu = UAT TI-3).
- TIMR-03 : PARTIAL (repli supprime, etat vide code ; ligne `Exemple` en base = donnee utilisateur, non supprimee par migration ; TI-2 depend du reset du compte).

## Verifie
- `npx vitest run` racine : 36 fichiers / 685 tests verts (dont 25 nouveaux `plugins/timer/src/presets.test.ts` : C22 = 54 min ecart 0 s, rounds=1, mapping type -> onglet, defauts anciennes lignes, bornes, steppers, phases = duree totale, positions).
- tsc `plugins/timer` : 1 erreur preexistante hors zone (`react-native-svg` introuvable dans `packages/ui`). tsc `apps/mobile` : 28 erreurs toutes preexistantes (modules natifs non installes : react-native-svg, reanimated, expo-updates...), 0 dans le Timer. Backend `tsc` : 0 erreur timer.

## NON prouve
- Aucun rendu emulateur : mise en page, steppers (appui long reel), feuilles/clavier, a11y TalkBack non testes (UAT en file).
- Migration jamais executee : CHECK/DEFAULT non verifies contre Postgres ; l'app necessite la migration appliquee avant tout enregistrement.
- Aucun test des ecrans ni d'integration Supabase (CRUD non teste hors logique pure).
- Moteur : sons/vibration non testes ; ecran verrouille : pas de notification de fin (hors perimetre).

## Deviations / decisions
- Confirmation de suppression dans la feuille (maquette C23) et non via `showAlert` (D-01) : la maquette gagne.
- `exercises` (hyrox/functional) non editable dans le nouvel editeur ; conserve intact a l'edition/duplication (liste d'exercices hors perimetre maquette).
- Un ancien preset de type `rest` avec effort 0 devra recevoir un effort >= 5 s pour etre re-enregistre via l'onglet Intervalle (borne de l'editeur).
- Outil IA `timer_get_presets` renvoie toujours une liste `default_presets` (suggestions IA, pas affichee dans l'UI) : laissee telle quelle.
- `vitest.config.ts` racine : ajout de `plugins/timer/src/**/*.test.ts` (conflit probable avec les autres phases : fusionner les listes).

## Fichiers a risque de conflit
`vitest.config.ts` (include), `plugins/timer/*`, `apps/mobile/app/(app)/(plugins)/timer/manager.tsx`.

## Humain / orchestrateur
Appliquer la migration 202612012001 ; compter (lecture seule) les lignes `Exemple` ; reset compte UAT (P1) pour TI-2.
