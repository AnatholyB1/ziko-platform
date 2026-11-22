# Phase 1 - Revue de code (audit independant, branche `audit/phase-1` @ milestone/v1.21)

Portee : `git diff fix/testflight-4-bugs HEAD` (hors planning, hors phase 2) : migration `20261215010100`, `QuestsBlock.tsx`, `useHomeQuests.ts`, `homeQuests.ts`, insertion dans `app/(app)/index.tsx`, backend `tools/onboarding.ts` + `routes/onboarding.ts`, tests, stub `react-native.tsx`.

## Gate (re-execute, rien repris du builder)
| Commande | Resultat |
|---|---|
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0, 0 erreur, 49 warnings (web, preexistants) ; mobile = pas de config eslint. Replay de cache turbo |
| `npm run test --prefix apps/mobile` | 45 fichiers / 629 tests (noeud) + 15 fichiers / 121 tests (render) : tout vert |
| `npm run test --prefix backend/api` | 51 fichiers passes, 8 ignores ; 592 tests passes, 3 skipped, 14 todo |
| `npm run build` (backend/api, tsc) | exit 0 |
| `npx turbo run test --force` | 2 echecs de TIMEOUT 5 s (`routeTargets`, `visibleTextGuard`, scans de fichiers) sous charge parallele ; verts en isolation (375 ms / 354 ms). Fragilite de charge preexistante, pas liee a la phase |
| `check-migration-names.mjs` | OK (le script ne controle que le prefixe 20261201) |

`rewards.test.tsx` "window is not defined" : NON reproduit (3 executions). Cause probable preexistante : `plugins/gamification/src/screens/rewards/chrome.tsx:88` (`setTimeout(onHide, 3200)` non nettoye apres demontage). Le nouveau bloc n'est pas importe par ce test ; son propre minuteur est nettoye (`useEffect` cleanup, QuestsBlock). Le stub etendu (Animated/AccessibilityInfo) n'est utilise que si un composant les importe ; rewards n'importe pas Animated depuis le bloc. Conclusion : le bloc n'introduit pas la course.

## Constats

### Haut
- **H1 | `supabase/portfolio-migrations/20261215010100_welcome_quests_meal_template.sql:30` | DECISION PRODUIT** : `UPDATE ... SET is_starter = false WHERE slug='starter_weekly_train'` contredit D-01 (« les 3 starters existants ... restent en base ») mais est exige par le contrat A1 (count(status='active') <= 3 en base). Les deux documents verrouilles se contredisent. Effet : plus aucune hebdo generee pour tout compte non-IA (existants compris). Voir 01-VERIFICATION.md pour les alternatives. A trancher par l'utilisateur.

### Moyen
- **M1 | migration l.30 + `ziko_sync_quests` (20261201290400, bloc c) | fantome « Non terminees » eternel pour les comptes existants** : une fois l'hebdo expiree, aucune hebdo plus recente n'existe (`n.period_start > uq.period_start` jamais vrai) : la ligne `expired` est renvoyee pour toujours. Le bloc accueil la filtre, mais l'onglet Recompenses (`QuestsTab.tsx:137`, section « Non terminees ») l'affiche a vie. Violation de l'esprit de D-08 hors accueil. Correctif : ne pas desactiver le modele (alternative plafond UI), ou purger/marquer ces lignes.
- **M2 | `apps/mobile/src/lib/homeQuests.ts:~85` (`orderQuests`, rang `done*2 + weekly`)** : une hebdo ACTIVE (rang 1) passe avant une quotidienne TERMINEE (rang 2) pour tout id non encore vu (remontage / relance). Pour un compte existant avec une hebdo active, la quete d'eau terminee disparait de l'accueil et l'hebdo apparait ; « 3 sur 3 / Bravo tout est fait » est inatteignable. L'affirmation du SUMMARY (« tronque a 3 en preferant les quotidiennes ») est fausse des qu'une quotidienne est terminee. Correctif : rang = `weekly*2 + done` (quotidiennes d'abord, terminees ou non) ou exclure l'hebdo. A corriger dans tous les cas (aussi si l'alternative « garder l'hebdo » est choisie).
- **M3 | `QuestsBlock.tsx:~230` + `queryClient.ts` | pas de relecture au retour d'arriere-plan ni au passage de minuit** : seul `useFocusEffect` (navigation d'onglet) relance la RPC ; React Query natif n'a pas de `focusManager` branche sur `AppState`. App laissee ouverte la nuit : « Bravo, tout est fait » d'hier reste affiche, quetes du jour absentes jusqu'a un changement d'onglet. D-07 dit « jusqu'au lendemain ». Correctif : `AppState` 'active' -> `refetch` (ou `focusManager.setEventListener`).

### Bas (11)
- L1 `QuestsBlock.tsx` FadeIn/reduceMotion : la preference est lue en asynchrone ; la cascade demarre au premier rendu avant la reponse (A17 partiel), puis l'arbre passe de `Animated.View` a un fragment (remontage de la ligne). Pas d'ecoute de `reduceMotionChanged`. Lire la valeur avant de demarrer l'animation.
- L2 Appels RPC multiples par action : handler (`syncQuestsQuiet`) + invalidation `rewards-quests` (relit la requete du bloc -> 2e RPC) + `useFocusEffect` au retour (3e). Idempotent (verrou advisory), pas de tempete, mais `staleTime: 0` + focus sans garde de fraicheur. Mettre `staleTime` ~15-30 s pour le refetch de focus.
- L3 `QuestsBlock.tsx` toast : `accessibilityLiveRegion="polite"` ET `announceForAccessibility` -> double annonce possible sous Android.
- L4 `app/(app)/index.tsx` : commentaire residuel duplique (« bloc insere ici au merge » + titre du bloc).
- L5 `ziko-chat.tsx:134-143` et `useHomeData.ts:244-250` gardent `journal_mood` / `measurements_weight` : une mission legacy (comptes existants, du jour) peut encore pointer un ecran de niveau 2 depuis le chat ; l'accueil la masque deja (`missionLocked`), le chat non. Hors portee neuve, a noter.
- L6 `coerceFirstMission` : si le modele choisit `hydration_log` avec un titre sans rapport, le titre n'est pas valide (seul le cas coerce reecrit). Le prompt cadre le texte ; aucune verification serveur.
- L7 `assess_profile` : `locale` par defaut 'fr' si l'outil est atteint hors route onboarding (`/ai/tools/execute`) ; sans effet de securite, titre francais seulement.
- L8 Tests : le faux monde de `questsBlock.test.tsx` n'a ni hebdo ni quete legacy ; les cas M1/M2 ne sont pas couverts. Le SQL de la migration n'est execute nulle part (aucun test pgTAP/RLS).
- L9 `useHomeQuests` : `retry: 1`, `retryDelay: 500` + erreur remontee ; bon. Etat « creating » : `canRetryCreating` apres 10 s ; correct.
- L10 `visibleHomeQuests` masque silencieusement une quete dont la metrique est inconnue : bien (pas de CTA mort), mais compte non plafonne dans `homeQuestsState` -> « creating » si TOUTES inconnues.
- L11 `Animated.timing` du stub appelle le callback synchronement : les tests ne prouvent aucune animation (non prouve, annonce honnetement par le builder).

## Points verifies sans reserve
- Migration : aucune fonction redefinie, donc verrou advisory, `SECURITY DEFINER`, `search_path`, `GRANT/REVOKE`, `ziko_award_coins_system`, semantique `rewarded_at` inchanges. `INSERT ... ON CONFLICT (slug) DO NOTHING` + `UPDATE` rejouables (idempotent). `ON CONFLICT (user_id, slug, period_start) DO NOTHING` -> pas de doublon (A2). Pas de double recompense (`WHERE rewarded_at IS NULL` + meme transaction). Metrique `nutrition_logs` supportee par `ziko_quest_metric_value` (290600, `ziko_nutrition_logs`) et par les CHECK. Reward 15 <= 500.
- Cles de requete `['rewards-quests','home',userId]` : scopees utilisateur ; `queryClient.clear()` a la deconnexion (`authStore.ts:194,265`). Refs `orderRef/prevRef/announcedRef` : ids differents d'un compte a l'autre, sans fuite visible.
- Pieces masquees < niveau 3 partout dans le bloc (puces, « +N », note « Terminé », toast, carte « tout fait », libelles a11y) ; aucun « Voir tout ». `expired` filtre (`visibleHomeQuests`). Toutes les routes de CTA ouvertes au niveau 1 (`hydration`, `nutrition` minLevel 1 ; `/(app)/workout` non plugin) ; routes existantes (`nutrition/log.tsx`, `hydration/dashboard.tsx`, `workout/index.tsx`).
- `expo-haptics` ~15.0.8 declare, installe, deja utilise par `plugins/hydration/src/haptics.ts`.
