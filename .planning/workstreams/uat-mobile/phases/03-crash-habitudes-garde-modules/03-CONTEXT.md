# Phase 3: Crash Habitudes & garde d'erreur modules - Context

**Gathered:** 2026-11-12 (recap chantier 2). Req : HABT-01, HABT-02.

## Decisions verrouillees
- **D-01** Symptome : Accueil > "Tous mes outils" > Habitudes : ecran visible ~0,5 s puis ecran blanc, utilisateur bloque, a chaque fois. Trouver la cause racine (rendu, store persiste MMKV corrompu/format ancien, donnee `ziko_habits` inattendue, import de plugin, navigation) ; ne pas masquer par un try/catch aveugle.
- **D-02** Reproduction : d'abord par test de rendu (vitest/testing-library si possible) et analyse statique ; reproduction emulateur en file apres P1. Si non reproductible sans emulateur, ecrire un test de non-regression qui encode la cause identifiee et un flow Maestro pour la file UAT.
- **D-03** Garde d'erreur modules (HABT-02) : tout crash de rendu d'un plugin affiche `ErrorScreen`/`ErrorBoundary` avec bouton retour -> accueil, jamais un ecran bloquant. Mettre la garde au point commun (layout des routes `(plugins)` et/ou `PluginLoader`), couvrir les 19 plugins d'un coup. Style charte Ziko (theme clair, tokens, Ionicons, inline styles, `paddingBottom: 100`).
- **D-04** L'erreur est journalisee vers Sentry (`@sentry/react-native`) avec le nom du plugin en tag ; aucun envoi reel pendant les tests.
- **D-05** Test de preuve : un module factice qui throw au rendu affiche l'ecran d'erreur et le bouton retour fonctionne.

## Fichiers (P3 proprietaire)
`plugins/habits/**`, `apps/mobile/src/components/ErrorBoundary.tsx`, `ErrorScreen.tsx`, `apps/mobile/src/lib/PluginLoader.tsx` (edit minimal, P25 en sera proprietaire plus tard), `apps/mobile/app/(app)/(plugins)/_layout.tsx` si present. Ne pas toucher aux autres plugins.

## Zones grises restantes
Aucune.
