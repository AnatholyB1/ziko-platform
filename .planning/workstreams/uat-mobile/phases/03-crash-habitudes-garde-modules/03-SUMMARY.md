# Phase 3 - Summary (HABT-01, HABT-02)

Branche `phase/03-crash-habitudes-garde-modules` (base `milestone/v1.20`, merge de `milestone/v1.20` fait). Pas de push.

## Cause racine HABT-01 : NON reproduite hors appareil
Analyse statique complete de `HabitsPlugin`, `notifications.ts`, `PluginsDrawer`, `(plugins)/_layout`, `PluginLoader`, `gating` + test de rendu avec donnees saines, vides, nulles et non-tableau : aucun throw au rendu. Donc pas de "cause unique prouvee". Defauts reels trouves et corriges (tous en lien avec "visible 0,5 s puis blanc, bloque") :
1. Etats chargement/erreur de `HabitsPlugin` = vue nue sans fond, sans header, sans retour (ecran blanc sans issue pendant le fetch ; ErrorScreen reseau sans bouton retour). La requete `ziko_habits` demarre apres `auth.getUser()` (~0,5 s apres le premier rendu avec header) puis remplace l'ecran par cette vue blanche avec 3 retries (~7 s). Hypothese la plus coherente avec le symptome, a confirmer sur logcat.
2. Rappels : `scheduleAllReminders` lance des effets natifs (expo-notifications) des l'arrivee des donnees, `ensureHandler` hors try. Differe (1,5 s), `.catch`, handler dans le try.
3. Lignes DB non fiabilisees (non-tableau, colonnes nulles) : `normalize.ts`.
4. Retour : `router.back()` sans historique -> `router.replace('/(app)/')`.
Non prouve : que l'un de ces points soit la cause du blanc du 2026-11-12 16:03 (evenement Sentry non consulte : aucun appel Sentry autorise).

## HABT-02 : garde d'erreur
- `ErrorBoundary.tsx` reecrit (tag Sentry `plugin`, `resetKey`, `onBack`), `ErrorScreen.tsx` variante `module` (Ionicons, tokens themeStore, `paddingBottom: 100`, retro-compatible).
- Garde posee au point commun `app/(app)/(plugins)/_layout.tsx` : couvre les 19 plugins d'un coup, bouton retour -> `router.replace('/(app)/')`, reset au changement de route. `PluginLoader.tsx` NON modifie.
- Route de test gardee `(plugins)/crash-test` (lien `ziko://crash-test`), inerte en production.

## Tests (apps/mobile, `npm test`)
- vitest node existant : 63 tests verts. Nouveau harnais `vitest.render.config.ts` (happy-dom + react-dom, RN/natifs stubbes) : 12 tests verts (`habits.test.tsx` 6, `moduleGuard.test.tsx` 6), dont module factice qui throw -> ecran d'erreur -> bouton retour -> `router.replace('/(app)/')` (D-05).
- Type-check mobile `tsc --noEmit` : 0 erreur ; `plugins/habits` : 0 erreur. Lint : pas de config lancee.
- Les tests de rendu sont exclus de `tsc` (`exclude` dans `tsconfig.json`) car ils importent hors du projet.

## Limites (ce que les tests ne prouvent pas)
react-dom + stubs ne prouvent ni le comportement natif Android (react-native-screens, Modal, expo-notifications), ni la repro du blanc. Sentry est stube (D-04 : tag + capture verifies uniquement cote code). Toute la validation reelle = `UAT-PLAN.md` / `.maestro/p03-habits-crash.yaml` en file emulateur (selecteurs a confirmer).

## Statut exigences
HABT-01 : PARTIAL (correctifs + non-regression, repro appareil en attente). HABT-02 : VERIFIED en logique (tests), appareil en attente.

## Conflits potentiels
`apps/mobile/package.json` (script test), `apps/mobile/tsconfig.json` (exclude), `ErrorScreen.tsx`/`ErrorBoundary.tsx`, `(plugins)/_layout.tsx`.
