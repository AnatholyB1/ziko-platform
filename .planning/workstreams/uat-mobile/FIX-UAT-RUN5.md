# FIX-UAT-RUN5 : corrections des defauts confirmes au run 5

Branche `fix/uat-run5` (base `milestone/v1.20`). Un commit par defaut. Aucune migration, aucun push, aucune ecriture base.

## Corrige (tests de comportement verts)

| # | Defaut | Correction | Tests |
|---|--------|-----------|-------|
| 1 | P24 "Squat" absent du catalogue reel | `apps/mobile/src/lib/exerciseMatch.ts` : exact normalise (casse/accents/pluriel/FR-EN) puis score de recouvrement de tokens, preference au mouvement de base ; toast "Exercice remplace : Squat par barbell full squat" ; ambigu -> ignore, la seance demarre. | `exerciseMatch.test.ts` sur les 80 squats + bench/deadlift reels (`scripts/exercise_names.txt`, 1318 noms) |
| 2 | P7 "En pause 0 %" + bandeau P24 apres reactivation | `programStatus.ts` : "En pause" exige un avancement > 0 (started_at est pose a la 1re activation par le trigger P24). Backend `periodization/relaunch.ts` : programme actif portant deja `results` = reactive -> pas re-clos, relance `dismissed` ; `getOpenRelaunch` ignore une relance dont le programme est actif non termine. | `programStatus.test.ts`, `periodization.test.ts` (+1) |
| 3 | P25 MC-11 bouton "Obligatoire" inerte | `PluginStoreButton.tsx` (extrait de la carte) : plus d'`accessibilityState disabled`, tap -> `showAlert("Module obligatoire")`. | `render/pluginStoreButton.test.tsx` |
| 4 | Accueil "Aucun programme actif" (programme coach) | `activeProgram.ts` : `getActiveProgram` (ziko_ai_generated_programs OU ziko_workout_programs, seances coach -> `program_data.sessions`) et `loadProgramForSession`. Accueil, ecran Seance et `startPlannedSession` l'utilisent ; la seance coach garde `program_id` / `program_workout_id`. | `activeProgram.test.ts` |
| 5 | Objectif d'eau 2,5 L -> 2,0 L | Cause probable : le bonus jour de seance comptait les seances fantomes (nettoyees apres relance). `hasWorkoutOnDay` ne compte que les seances comptables ; erreur de lecture du profil remontee (plus de 2,0 L par defaut mis en cache) ; `resolveGoalMl` partage par accueil et ecran Hydratation, repli = derniere valeur connue (cache puis AsyncStorage). | `settings.test.ts` (+4) |
| 6a | Description store en anglais | `pluginCopy.ts` : francais impose pour habits / nutrition / persona (le registre seed porte l'anglais), manifestes locaux traduits. | `pluginCopy.test.ts` |
| 6b | Demarrage a froid hors ligne -> Bienvenue | `authInit.ts` : `getSession` null + erreur NON permanente -> session persistee relue (mode degrade). Erreur permanente (jeton revoque) = deconnexion (regle P2). | `authInit.test.ts` (+4) |
| 6c | Profil prive sans mention | `PrivateProfileNotice` : "Ce profil est prive" remplace les faux zeros quand `is_private`. | `render/privateProfile.test.tsx` |

## Non corrige
- **6d "Niveau 3" vs `athlete_state.level = 5`** : pas de defaut de code constate. `ziko_get_public_profile` lit `ziko_user_gamification.level`, exactement la source de l'ecran Recompenses (`profile.level`). `ziko_athlete_state.level` est le niveau de preparation coaching (autre notion, deverrouillage progressif), pas affiche par la gamification. Rien modifie.

## A re-verifier sur emulateur
- P24 : demarrage "Squat" -> toast "Exercice remplace : Squat par barbell full squat" (sans fixture `Back Squat`).
- P7 : programme jamais pratique -> "Pas encore demarre" ; reactiver un programme termine -> bandeau "Programme termine" disparait apres l'ouverture de l'onglet Seance (le `check` marque la relance).
- P25 MC-11 : tap sur "Obligatoire" -> alerte. (Le stub RN des tests ignore `accessibilityState` : la garde est statique + comportement du handler ; le vrai blocage tactile n'est pas reproduit en test.)
- Accueil + Seance + "Allez, c'est parti" avec le programme coach actif ; la seance demarre avec les exercices du coach.
- Eau : valeur identique accueil / ecran Hydratation apres relance et a froid hors ligne. Hypothese (seance fantome) non prouvee sur donnees reelles.
- Hors ligne a froid : ecran principal (degrade) au lieu de Bienvenue, puis retour a la normale au retour du reseau (le client supabase n'a pas la session en memoire tant que le refresh n'a pas reussi).
- Profil prive d'un non-ami : mention affichee. Niveau d'un ami : comparer `ziko_user_gamification.level` de B a l'ecran Recompenses de B.

## Gate
type-check mobile + backend OK (pas de `.expo/types/router.d.ts`), `npx vitest run` racine 1116 OK (inclut le test statique GRANT), backend 566 OK / 8 fichiers ignores (env), rendu mobile `vitest.render.config.ts` 88 OK.
