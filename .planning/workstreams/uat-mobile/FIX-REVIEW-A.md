# FIX-REVIEW-A : correctifs des constats de AUDIT-REVIEW-A (v1.20, phases 1-12, 15)

Branche `fix/review-a` (base `milestone/v1.20`, merge de `milestone/v1.20` fait, sans conflit). Pas de push. Aucune migration ajoutee.
Gate : type-check mobile OK, backend OK ; `npx vitest run` racine 1051 pass ; `backend/api` 540 pass (3 skipped, 14 todo, pre-existants) ; `apps/mobile` 463 pass ; `vitest.render.config.ts` 80 pass.

## Corrige (par constat)

| # | Correctif | Preuve (test) |
|---|---|---|
| 1 HAUTE | `ai_programs_generate` : insere `is_active:false` puis RPC `ziko_set_active_program(kind 'ai')` ; JSON invalide = erreur, plus de `{raw}` ; ligne orpheline supprimee si la RPC echoue. `parseProgramJson` exporte. | `backend/api/src/tools/ai-programs.test.ts` (5) |
| 2 HAUTE | `lib/homeQueries.ts` (`HOME_QUERY_KEYS` = vraies cles de `useHomeData`) ; invalidation en fin de seance (`handleFinish`), apres eau rapide de la seance, apres log/undo Hydratation ; `useFocusEffect` sur l'accueil (premier focus ignore). | `homeQueries.test.ts` (vrai QueryClient) |
| 3 HAUTE | Hydratation invalide `['hydration','today']` (la vraie cle, qui porte `goalMl`) au lieu de `['hydration','goal']`. | `homeQueries.test.ts` (prouve que l'ancienne cle ne touchait pas la requete) |
| 4 | Mesures : `localDateKey()` (saisie, semaine, depuis). | `noUtcDateKeys.test.ts` (garde statique) |
| 5 | `useSessionStreak` : `consecutiveDayStreak` (date locale, `setDate` pour le changement d'heure). `todayDone` et points de la semaine aussi en local. | `localDate.test.ts` (TZ Europe/Paris, 00:30 locale, DST) |
| 6 | Habitudes (ecran + store), serie gamification (`streak.ts`, `computeNextStreak`), eau rapide de la seance, store Hydratation/Nutrition + ecran Nutrition : dates locales. Erreur d'update de la serie journalisee (plus silencieuse). | `streak.test.ts` (7), `noUtcDateKeys.test.ts` (10) |
| 7 | `saveSessionStats` ne depend plus d'un `catch{}` : `writeSessionTotals` leve sur `error` (supabase ne leve pas), `saveWithRetry` (2 essais), alerte + on reste sur la seance si echec, navigation vers le resume seulement apres succes (les 4 boutons "Et maintenant ?" aussi). | `sessionFinish.test.ts` |
| 8 | Filtre Recent/semaine : garde les seances terminees historiques sans totaux (`total_sets NULL` + `ended_at`), exclut `total_sets=0` et les seances ouvertes. `COUNTABLE_SESSION_OR_FILTER` = jumeau serveur de `isCountableSession`. | `workoutPlan.test.ts` |
| 9 | `resolveDayIndexBase` : base explicite `program_data.day_index_base` (0/1) ; sans declaration seul un `0` litteral prouve la base 0, sinon convention ISO (comme `day_of_week`). | `workoutPlan.test.ts` |
| 10 | "Tu rates X N fois sur 7" -> formulation neutre ("... est plus difficile en ce moment (k jours sur 7). On ajuste la cible ...") | `visibleTextGuard.test.ts` |
| 11 | "Target reached!", "Min reached!", "Target:" traduits (session.tsx). Test durci : `visibleTextGuard.test.ts` scanne TOUS les .tsx visibles (texte JSX + litteraux, mots anglais courants) et les emojis (liste de dette connue hors perimetre, qui ne doit pas grandir). | `visibleTextGuard.test.ts` (6) |
| 12 | Notification d'habitude en francais sans emoji ; "Seance du jour" sans emoji ; modale permission sans emoji ; coches "✓ logue" de l'accueil. | idem |
| 13 | Objectif kcal accueil : hook `useNutritionGoal` (`fetchKcalGoal` : `ziko_user_plugins.settings.calorie_goal`, repli 2000) -> anneau + score Forme du jour. `NUTRITION_GOAL_KCAL` = 2000 (egalite garantie par test). | `nutritionTargets.test.ts` (sdk), `quickLog.test.ts` |
| 14 | `resyncRemindersFromDb` (reminders.ts) : relit objectif + total du jour et replanifie ; appele apres tout log d'eau (accueil, seance, Hydratation) et au focus de l'accueil (restaure les DAILY le lendemain). | `reminders.test.ts` (+3) |
| 15 | `runExclusive` (verrou ref synchrone) sur `commit` et `flushPending` ; ids de ligne generes cote client (`newRowId`) : un renvoi d'un lot deja insere (23505) est relu, pas recree. | `mealLog.test.ts` (+5) |
| 16 | `authInit.ts` : `loadInitialSession` (`done()` toujours appele, plus de splash infini si `getSession` rejette) ; `refreshProfile` et `handleExpired` differes hors du callback `onAuthStateChange`. | `authInit.test.ts` (6) |
| 17 | Interface (voir ci-dessous) ; cote client : erreur d'update de serie journalisee. Montants : le serveur plafonne deja (fix/security, `ziko_award_*`). | `streak.test.ts` |
| 19 | `executeRanger` : compensation (restaure quantites/dates, supprime les lignes inserees), ordre maj -> ajout -> suppression courses en dernier. | `pantryRanger.test.ts` (3, faux client en memoire) |
| 20 | Timeout 8 s (AbortController) sur OpenFoodFacts. | `pantry.test.ts` |
| 21 | Eau optimiste : `goalMl` conserve, rollback par soustraction (un 2e tap n'est pas perdu). | revue de code seulement (composant) |
| 24 | Contenants d'eau par defaut : icones Ionicons (plus d'emoji) ; seance affiche `water-outline`. | `visibleTextGuard.test.ts` |
| 25 | `permission denied for ...` n'est plus classe "session expiree". | `sessionManager.test.ts` |
| 26 | `_layout.tsx` et `ConversationScreen` : `formatDateFr` / `formatClock`. | revue de code |
| 27 | Emojis du calculateur TDEE -> Ionicons ; titres sans emoji. | `visibleTextGuard.test.ts` |
| 28 | `duplicateProgram` : echec du rollback signale (message explicite). | existant `programsService.test.ts` (non etendu) |

## Interface attendue pour #17 (a faire par fix/security, SQL)
Le client appelle encore `UPDATE ziko_user_gamification` (serie) puis `ziko_award_xp/coins` avec `p_amount`. Interface cible : une RPC SECURITY DEFINER `ziko_record_activity(p_kind text, p_source_id uuid)` qui calcule serie (date locale fournie ou fuseau du profil), XP et pieces cote serveur ; le client n'enverrait plus ni montant ni DML. Tant que le REVOKE DML client n'est pas pose/verifie, la serie fonctionne ; s'il l'est, elle ne progresse pas (desormais visible dans les logs : `[gamification] streak update failed`).

## Non corrige / limites
- #18 (migrations non appliquees 1203/1204/1205/1803/2504) : pas de code ; reste dans DEPLOY-CHECKLIST-v1.20.md (pas de test RLS d'integration ajoute).
- #22 (poids/humeur select puis insert), #23 (deux chemins de lecture de l'objectif d'eau), #29 (RPC coach/athlete), #30, #31 (emojis par defaut des habitudes : donnee utilisateur) : non traites.
- #26 partiel : `coachLinked.ts` / `coachState.ts` gardent `toLocaleDateString` (fichiers purs avec repli ISO ; importer le SDK casserait leurs tests node).
- Dates UTC restantes hors perimetre revue A (cardio, coach, community, stats, wearables, calendar, profile, workout/[id], onboarding) : 28 occurrences `toISOString().split/slice`, non migrees.
- `now = useMemo(new Date())` de LogMealScreen (repas suggere fige a l'heure de montage) : non modifie.
- Ecriture des `day_index` : aucun ecrivain dans le depot ; la base 0/1 reste ambigue pour les donnees heritees sans `day_index_base`.

## A re-verifier sur emulateur
1. Seance terminee -> retour accueil : Recent, semaine, serie et eau a jour sans pull-to-refresh ; coupure reseau a "Terminer" : alerte, seance conservee, re-tap OK.
2. Changer l'objectif d'eau / ajouter de l'eau dans Hydratation -> accueil mis a jour au retour.
3. Objectif kcal des reglages Nutrition reflete sur l'anneau et le score Forme du jour.
4. Rappels d'eau : atteindre l'objectif via Quick Log -> plus de rappel aujourd'hui ; lendemain : DAILY restaures apres ouverture de l'accueil.
5. Double tap rapide sur "Enregistrer" (repas) : une seule ecriture ; mode avion puis retour : pas de doublon.
6. Demarrage a froid avec stockage de session illisible : l'app sort du splash.
7. Genere un programme via le coach IA : un seul programme actif ensuite (Programmes).
8. Saisie de poids / habitude entre 00:00 et 02:00 : date du jour local.
9. Le champ `id` fourni par le client sur `ziko_nutrition_logs` doit etre accepte par la base (RLS/colonnes) : a confirmer en integration.
