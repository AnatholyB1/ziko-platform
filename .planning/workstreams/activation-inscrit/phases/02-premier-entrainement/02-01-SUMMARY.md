# Phase 2, plan 01 : SUMMARY

Branche `phase/02-premier-entrainement` (depuis `milestone/v1.21`, fusionnée avec elle avant la porte). Aucun backend, aucune migration, aucun push.

## Livré
- Carte d'accueil `src/components/home/FirstWorkoutCard.tsx` + logique pure `src/lib/firstWorkout.ts` + hook `src/hooks/useFirstWorkout.ts`. Cout, solde et quota gratuit lus sur `GET /ai/workshop/info` (une seule source serveur : IA simple et atelier passent par `creditCheck('chat')`) ; repli « Consomme des crédits IA » ; aucun chiffre en dur (garde de source dans les tests).
- Séances terminées : `ziko_workout_sessions` (`ended_at` non nul + prédicat « comptable » existant), requête `count/head` clé `['workouts','finished']`, ajoutée à `HOME_QUERY_KEYS` (disparition au retour sur l'accueil).
- `app/(app)/index.tsx` (propriétaire P2) : carte sous l'en-tête, Mission du jour (variante vide masquée tant que la carte occupe la place), commentaire d'emplacement du bloc Quêtes juste après Mission du jour.
- Onglet Entraînement : état vide (Créer un programme -> feuille `CreateProgramSheet`, Générer une séance IA -> ai-generate, épuisé = verrou + texte ambre), « + » libellé `Créer un entraînement` et feuille à deux groupes, cible 44 dp ; texte de `programs.tsx` aligné sur les 4 étapes.
- `step-7.tsx` : variante B (« C'est noté. », 3 étapes « La suite », bouton Continuer + icône), fond sombre, 4 étapes de chargement honnêtes ; `handleFinish` inchangé.

## Exigence -> statut -> tests
Voir `02-01-PLAN.md`. Tous les tests passent : mobile 611 (logique) + 108 (rendu, dont 19 nouveaux) ; nouveaux fichiers `lib/__tests__/firstWorkout.test.ts` (23), `lib/__tests__/onboardingEnd.test.ts` (8), `render/firstWorkoutCard.test.tsx` (12), `render/firstWorkoutHook.test.tsx` (7).

## Porte
`npm run type-check` 24/24 ; `npm run lint` 5/5 (mobile : pas de config eslint, sauté) ; `npx turbo run test` 7/7. Backend non touché.

## Écarts au contrat / décisions
1. Erreur de lecture des séances (programme connu vide) : la carte reste offerte (Manuel). R4 reste appliquée à l'erreur de lecture du programme. Contredit P2-9 uniquement si seules les séances échouent.
2. Badge « Conseillé » sur IA simple (D-02) : absent des maquettes H01.
3. Fin d'onboarding en fond sombre (D-06) : la maquette O03 est claire.
4. Ordre de l'accueil : la carte est juste sous l'en-tête, mais « Forme du jour » reste entre la carte et Mission du jour (je n'ai pas déplacé ce bloc pour ne pas changer l'accueil des comptes existants). P2-2 (carte < Mission < Quêtes) tient ; la maquette H01 montrait Mission juste après la carte.
5. Quota gratuit d'IA simple : quotidien (le code utilise le quota `chat`), pas « ce mois-ci » comme la maquette H08.
6. Mouvement : fondu + translation 200 ms à l'apparition, sortie 150 ms via `AnimatePresence` ; reduced motion lu avec `AccessibilityInfo`. Le clignotement de la pastille « en cours » du chargement d'onboarding n'a pas reçu de variante reduced motion.
7. Bouton plein de l'onglet : `#FF5C1A` existant (non `getActionPrimary`).

## Non prouvé
Rendu natif réel (aucun émulateur, aucun Metro) : espacements, ombres, anneau de focus, échelle de police 130 %, animation moti/AnimatePresence, ordre des blocs à l'écran, cibles tactiles mesurées, contrastes sur appareil, comportement de `Modal`. Appel réel à `/ai/workshop/info` et au 402 (tests sur doubles). Disparition « sans relancer l'app » après création de programme / fin de séance (invalidation par clés et par refocus : testée par les clés, pas observée). UAT = phase 3.

## Humain
Valider les écarts 1, 2, 4 ; décider si Mission du jour doit passer au-dessus de « Forme du jour » (maquette). Sur merge avec la phase 1 : `apps/mobile/app/(app)/index.tsx` (voir le commentaire « Quetes (phase 1) » après le bloc Mission) ; éventuellement `homeQueries.ts` et `workout/index.tsx` si la phase 1 y a touché.
