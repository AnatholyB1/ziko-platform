# Phase 11 : Hydratation, boutons et reglages : SUMMARY

Branche `phase/11-hydratation`. Mobile + 1 migration (fichier) + outil IA.

## Livre
- `plugins/hydration/src/settings.ts` : logique pure (rappels n = floor((fin-debut)/intervalle)+1, cafe/the, bonus, validation objectif 1500-4000, dates locales, lecture/ecriture `ziko_hydration_settings`, detection jour de seance = seance dont `started_at` tombe dans le jour local).
- `reminders.ts` : planification (DAILY par horaire ; objectif atteint = 0 rappel aujourd'hui, uniques demain ; DAILY restaures a la prochaine ouverture de l'ecran), permission (granted/denied/undetermined). `haptics.ts` : impulsion legere.
- `screens/HydrationPlugin.tsx` : tuiles 132 dp (goutte 24/30/36, `PAR DEFAUT`, etat presse `#F0EFE9` + bord 2 dp `getActionPrimary`, haptique, verrou 300 ms, toast `+N ml ajoutes` + Annuler 5 s, bandeau d'erreur), actions `Autre quantite` / `Ajouter un cafe ou un the`, 4 lignes de reglage cliquables (valeur en `#B53D05`) ouvrant des feuilles basses. `screens/HydrationSheets.tsx` : feuilles Rappels, Verre, Cafe/the, Bonus, Objectif, Quantite, toutes via `KeyboardAvoidingView` + scroll (HYDR-06).
- Migration `supabase/portfolio-migrations/20261201110100_ziko_hydration_settings.sql` (RLS `auth.uid() = user_id`, CHECK sur chaque valeur). NON appliquee.
- Backend : `hydration_log` sans `amount_ml` utilise la taille de verre du reglage (schema `registry.ts` : `amount_ml` devient optionnel, 2 lignes hors perimetre D-06, additif).
- `vitest.config.ts` racine : ajout de `plugins/hydration/src/**/*.test.ts`.

## Exigences
| Id | Statut | Preuve |
|---|---|---|
| HYDR-01 | PARTIAL | code + tests unitaires haptique ; mesures dp/capture = UAT emulateur (HY-1..3) |
| HYDR-02 | PARTIAL | 11 tests rappels (9 planifies 08:00..20:00, off = 0, goal atteint, permission refusee) sur module notifications simule ; planification reelle non prouvee |
| HYDR-03 | PARTIAL | persistance + libelle testes ; usage reel par `J'ai bu` non livre (voir ci-dessous) ; l'assistant l'utilise (backend) |
| HYDR-04 | VERIFIED (logique) / PARTIAL (UI) | 125 ml a 50 %, off = 0 testes ; ajout via feuille dediee |
| HYDR-05 | PARTIAL | base+bonus teste, bornes de jour testees ; requete reelle `ziko_workout_sessions` non executee |
| HYDR-06 | PARTIAL | KeyboardAvoidingView + ScrollView dans la feuille ; comportement clavier Android a prouver a l'emulateur |

Tests : 30 nouveaux (settings 19, reminders/haptique 11) ; vitest racine 401/401 ; `tsc --noEmit` apps/mobile, plugins/hydration, backend/api : 0 erreur.

## Deviations / decisions
- Quick Log accueil (P8, `apps/mobile/src/lib/quickLog.ts` `logWater`) non importable depuis un plugin (couche) : le plugin garde son propre insert unique ; meme table/colonnes, date LOCALE alignee (l'ancien `getToday()` UTC corrige). Aucune ecriture eau dupliquee dans l'accueil.
- Cafe/the logge comme une ligne `amount_ml` = part comptee (pas de colonne type) : le total P8 de l'accueil reste correct sans toucher son code.
- Couleur eau `#2E7BF6` -> `#2563C9` (contrat lot E).
- Texte `Historique` : suggestion codee en dur (+30 %) remplacee par le bonus reel.

## NON prouve / limites
- Aucune execution emulateur/appareil ; migration jamais appliquee (pas de test RLS reel) ; notifications reelles, haptique reel, clavier Android non verifies.
- `J'ai bu` dans la notification (action de notification) NON livre : necessite categorie de notification + handler de reponse dans la racine de l'app (hors perimetre D-06) ; a decider (phase dediee ou P5).
- Les rappels DAILY ne peuvent pas sauter "aujourd'hui" : apres objectif atteint, uniques demain ; si l'ecran n'est pas rouvert, la serie quotidienne reprend seulement apres ces uniques.
- `hydration_set_goal` (outil IA) ecrit `ziko_user_plugins.settings.daily_goal_ml` alors que l'ecran lit `ziko_user_profiles.settings.hydration_goal_ml` : divergence preexistante, non corrigee.
- Jour de seance : `started_at` dans le jour local, seances non terminees comprises (CRITIQUE Q3 : seance loguee uniquement).

## Conflits probables au merge
`vitest.config.ts`, `backend/api/src/tools/registry.ts` (schema hydration_log).
