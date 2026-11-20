# Phase 1 - Corrections de l'audit (branche `fix/phase-1-audit`)

Decision utilisateur : la quete hebdo de depart « S'entrainer 3 fois » est GARDEE (D-11). Le bloc plafonne a 3 quetes en preferant les quotidiennes. Aucune migration appliquee, aucun push.

| Constat | Disposition | Commit |
|---|---|---|
| H1 migration retire `is_starter` de l'hebdo | CORRIGE : etape 4 supprimee, la migration n'ajoute que le modele « repas » + ordre + libelles (rejouable). D-11 ajoute a 01-CONTEXT, SUMMARY et test statique mis a jour. | aedc1f97 |
| M1 fantome « Non terminees » eternel | RESOLU par H1 (l'hebdo continue d'etre generee, plus de ligne `expired` orpheline creee par la migration) | aedc1f97 |
| M2 rang `done*2 + weekly` | CORRIGE : rang `weekly*2 + done`. Tests : remontage 1 quotidienne terminee + hebdo active + 2 quotidiennes actives, et « 3 sur 3 » atteignable avec hebdo presente | 9c12919c |
| M3 pas de relecture foreground / minuit | CORRIGE : `useQuestRefreshTriggers` (AppState `active` + minuteur de minuit local), via `requestQuestRefresh` (debounce existant). Tests : AppState mocke, minuit en faux minuteurs, desabonnement | 972b6f8f |
| L1 reduced motion lu en asynchrone | CORRIGE : liste affichee seulement une fois la preference connue (cache de session -> lecture synchrone ensuite), `Animated.View` toujours present (pas de remontage), ecoute de `reduceMotionChanged` | 972b6f8f |
| L3 double annonce | CORRIGE : live region retiree, seul `announceForAccessibility` reste | 972b6f8f |
| Flake rewards « window is not defined » | Le `setTimeout` de `chrome.tsx:88` est DEJA nettoye (cleanup de l'effet) : la cause supposee etait inexacte. Cause retenue : les tests ne demontent jamais leurs arbres, des minuteurs en attente se declenchent apres la fin de l'environnement. CORRIGE : `afterEach` qui demonte les racines (rewards + questsBlock) | 4893af8a |
| Timeouts 5 s `routeTargets` / `visibleTextGuard` | CORRIGE : `vi.setConfig({ testTimeout: 20_000 })` dans les deux fichiers | 4893af8a |
| L5 mission legacy `journal_mood` / `measurements_weight` (`ziko-chat.tsx`) | NON SUPPRIME : pas mort. `MICRO_ACTION_POOL` (backend/api/src/tools/onboarding.ts) et `useHomeData.ts` les portent encore pour les missions deja stockees des comptes existants. Documente | - |
| L2 jusqu'a 3 RPC de synchro par action loguee | DOCUMENTE seulement : handler + invalidation + refetch de focus ; idempotent (verrou advisory) | - |
| L4, L6, L7, L8, L9, L10, L11 | DOCUMENTES seulement, non modifies (voir 01-REVIEW.md) | - |
