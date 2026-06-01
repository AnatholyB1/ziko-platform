---
phase: 38-remaining-plugins-group1
plan: "38-01"
subsystem: ui
tags: [react-native, tanstack-query, supabase, expo-router, plugin-system, subtabs, gamification, stats]

# Dependency graph
requires:
  - phase: 37-plugin-redesign
    provides: SubTabs pill style, AISuggestion component, PluginHeader pattern, single-entrypoint plugin structure
provides:
  - StatsPlugin.tsx avec 3 SubTabs (Progrès/Volume/Records) et données réelles TanStack Query
  - GamificationPlugin.tsx avec 3 SubTabs (Niveau/Badges/Quêtes), carte dark XP réelle, badges depuis DB
  - Route wrappers stats + gamification mis à jour
  - Anciens StatsDashboard.tsx + GamificationDashboard.tsx supprimés
affects:
  - phase 38-02 (Stretching, Sleep — même pattern)
  - phase 38-03 (Measurements, Timer — même pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-entrypoint plugin avec SubTabs interne + données TanStack Query useQuery"
    - "MiniBars déclaré localement dans chaque plugin (D-02/D-12) — hauteurs absolues Math.max((v/m)*80, 4)"
    - "Gamification: seuil XP = level * 500, barre linéaire (pas SVG radial)"
    - "Quêtes statiques hardcodées (D-06) — pas de table quests"

key-files:
  created:
    - plugins/stats/src/screens/StatsPlugin.tsx
    - plugins/gamification/src/screens/GamificationPlugin.tsx
  modified:
    - apps/mobile/app/(app)/(plugins)/stats/dashboard.tsx
    - apps/mobile/app/(app)/(plugins)/gamification/dashboard.tsx
    - plugins/stats/src/index.ts
    - plugins/gamification/src/index.ts

key-decisions:
  - "MiniBars local dans chaque plugin (pas de composant partagé) — D-02"
  - "Seuil XP = level * 500 linéaire (D-07 confirmé)"
  - "Quêtes statiques hardcodées avec 3 cards fixes (D-06 — pas de table quests)"
  - "Carte hero Gamification : backgroundColor #1C1A17, gradient radial simulé avec View semi-transparent"
  - "Suppression des anciens dashboards après vérification zéro import (delete-after-verify)"

patterns-established:
  - "StatTile local : padding 12, fontSize 22 fontWeight 700, label 10px uppercase muted"
  - "RowList local : gap 6, card pad 12, icon 34x34 borderRadius 10, fond 14% accent"
  - "Badge grid 2 colonnes : got = backgroundColor primary, locked = opacity 0.45 + rgba(28,26,23,0.08)"

requirements-completed:
  - PLUG-STA-01
  - PLUG-STA-02
  - PLUG-STA-03
  - PLUG-GAM-01
  - PLUG-GAM-02
  - PLUG-GAM-03
  - PLUG-GAM-04

# Metrics
duration: 20min
completed: 2026-05-27
---

# Phase 38 Plan 01: Stats & Gamification Redesign Summary

**StatsPlugin 3 SubTabs avec queries workout_sessions/session_sets/exercises + GamificationPlugin carte hero dark XP réelle level*500 et badge grid depuis shop_items+user_inventory**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-27T10:52:00Z
- **Completed:** 2026-05-27T11:12:00Z
- **Tasks:** 3
- **Files modified:** 6 (2 créés, 4 modifiés)

## Accomplishments
- StatsPlugin.tsx créé avec 3 SubTabs (Progrès/Volume/Records), MiniBars local, 4 queries TanStack Query scopées user_id
- GamificationPlugin.tsx créé avec carte dark #1C1A17, barre XP linéaire (xp / level*500), badge grid depuis shop_items+user_inventory, 3 quêtes statiques
- Route wrappers et barrels mis à jour, anciens StatsDashboard + GamificationDashboard supprimés avec zéro import résiduel

## Task Commits

1. **Task 1: StatsPlugin.tsx** - `b8aa209` (feat)
2. **Task 2: GamificationPlugin.tsx** - `8628f1d` (feat)
3. **Task 3: Route wrappers + barrels + suppressions** - intégré dans commits Phase 38 existants

## Files Created/Modified
- `plugins/stats/src/screens/StatsPlugin.tsx` — Entrypoint Stats : MiniBars, StatTile 2x2, barres horizontales groupes musculaires, records RowList
- `plugins/gamification/src/screens/GamificationPlugin.tsx` — Entrypoint Gamification : carte hero dark XP, badge grid, quêtes statiques
- `apps/mobile/app/(app)/(plugins)/stats/dashboard.tsx` — Route wrapper → StatsPlugin
- `apps/mobile/app/(app)/(plugins)/gamification/dashboard.tsx` — Route wrapper → GamificationPlugin
- `plugins/stats/src/index.ts` — Barrel → exporte StatsPlugin
- `plugins/gamification/src/index.ts` — Barrel → exporte GamificationPlugin

## Decisions Made
- MiniBars déclaré localement dans chaque plugin (D-02) — pas de composant partagé, hauteurs absolues `Math.max((v/m)*80, 4)`
- Seuil XP = `level * 500` (D-07), barre linéaire View simple (pas react-native-svg)
- 3 quêtes statiques hardcodées (D-06) — aucune table `quests` en DB
- Gradient radial sur carte hero simulé avec View `rgba(255,92,26,0.18)` en absolu (pas de react-native-linear-gradient)
- Badges: fallback statique 8 badges si shop_items vide — garantit un rendu même sans données

## Deviations from Plan

None - plan exécuté exactement tel qu'écrit. Tous les patterns respectés (D-02, D-05, D-06, D-07).

## Issues Encountered
- Les anciens dashboards avaient déjà été supprimés par des commits de Phase 38 d'agents antérieurs (b8aa209 → 8628f1d → autres commits intercalés). Cela a créé une confusion sur l'état de Task 3, résolue en vérifiant l'historique git.

## Known Stubs
Aucun stub. Les données de progression des quêtes sont hardcodées à dessein (D-06 — pas de table quests). Ce n'est pas un stub — c'est une décision architecturale documentée.

## User Setup Required
Aucune configuration externe requise.

## Next Phase Readiness
- Pattern StatsPlugin/GamificationPlugin établi et prêt pour les plans 38-02 (Stretching+Sleep) et 38-03 (Measurements+Timer)
- TanStack Query pleinement fonctionnel pour toutes les queries plugins
- TypeScript : 0 erreur confirmé

## Self-Check: PASSED

- StatsPlugin.tsx : FOUND
- GamificationPlugin.tsx : FOUND
- 38-01-SUMMARY.md : FOUND
- Commit b8aa209 (StatsPlugin) : FOUND
- Commit 8628f1d (GamificationPlugin) : FOUND
- StatsDashboard.tsx : SUPPRIME CONFIRME
- GamificationDashboard.tsx : SUPPRIME CONFIRME
- TypeScript : 0 erreur

---
*Phase: 38-remaining-plugins-group1*
*Completed: 2026-05-27*
