---
phase: 38
plan: "02"
subsystem: plugins-stretching-sleep
tags: [stretching, sleep, subtabs, minibars, heuristic, tanstack-query]
dependency_graph:
  requires: []
  provides: [StretchingPlugin, SleepPlugin]
  affects: [apps/mobile/app/(app)/(plugins)/stretching/dashboard.tsx, apps/mobile/app/(app)/(plugins)/sleep/dashboard.tsx]
tech_stack:
  added: []
  patterns: [TanStack Query useQuery, local MiniBars, sleep stage heuristic, SubTabs pill navigation]
key_files:
  created:
    - plugins/stretching/src/screens/StretchingPlugin.tsx
    - plugins/sleep/src/screens/SleepPlugin.tsx
  modified:
    - plugins/stretching/src/index.ts
    - plugins/sleep/src/index.ts
    - apps/mobile/app/(app)/(plugins)/stretching/dashboard.tsx
    - apps/mobile/app/(app)/(plugins)/sleep/dashboard.tsx
  deleted:
    - plugins/stretching/src/screens/StretchingDashboard.tsx
    - plugins/sleep/src/screens/SleepDashboard.tsx
decisions:
  - "MiniBars déclaré localement dans chaque plugin file (hauteur absolue Math.max(v/m*72, 4)px) — D-02"
  - "Sleep stage bar : heuristique Profond 18% / Léger 53% / REM 24% / Éveillé 5% × duration_hours — D-04"
  - "Sleep accent violet #7C3AED — spécification mockup plugins-2.jsx"
  - "Anciens dashboards supprimés après vérification zéro import résiduel — D-03"
metrics:
  duration: "~25 min"
  completed: "2026-05-27"
  tasks_completed: 3
  files_changed: 8
---

# Phase 38 Plan 02: Stretching + Sleep Plugins Redesign Summary

**One-liner:** StretchingPlugin (3 SubTabs, routines DB, bibliothèque 6 exos, MiniBars 7j) et SleepPlugin (durée violet 36px, barre de phases heuristique flex proportionnel, MiniBars 7 nuits) remplacent les anciens dashboards.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | StretchingPlugin.tsx + SleepPlugin.tsx | 8628f1d | plugins/stretching/src/screens/StretchingPlugin.tsx, plugins/sleep/src/screens/SleepPlugin.tsx |
| 3 | Câblage routes, barrels, suppression anciens dashboards | 247dc84 | 4 fichiers modifiés, 2 supprimés |

## What Was Built

### StretchingPlugin.tsx
- 3 SubTabs : Routines / Bibliothèque / Suivi
- Onglet Routines : TanStack Query `stretching_routines` avec icônes colorées cycliques (primary/info/violet/success), état vide, AISuggestion basée sur dernière session
- Onglet Bibliothèque : 6 exercices statiques (Pigeon, Cobra, Couch stretch, World's greatest, Foam roll IT band, Cat-cow)
- Onglet Suivi : compteur mensuel + MiniBars 7 jours depuis `stretching_logs` (durée en minutes), AISuggestion sur jours manqués

### SleepPlugin.tsx
- 3 SubTabs : Cette nuit / Historique / Réglages
- Onglet Cette nuit : durée en violet 36px (`formatDuration`), horaires + quality score, barre de phases heuristique 4 segments flex proportionnel, légende 4 colonnes, StatTiles Fréq. cardiaque / Variabilité (données non disponibles)
- `estimateSleepStages(dh)` : Profond 18%, Léger 53%, REM 24%, Éveillé 5% × duration_hours (D-04)
- AISuggestion avec règle quality (< 3 → caféine, >= 4 → encouragement, else → conseil)
- Onglet Historique : MiniBars 7 nuits, moyenne calculée, AISuggestion pire jour semaine
- Onglet Réglages : 5 paramètres statiques non-interactifs

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface Scan

Aucune nouvelle surface réseau ou endpoint non prévu. Les deux plugins utilisent `.eq('user_id', userId)` sur toutes les requêtes (mitigations T-38-02-01 et T-38-02-02 appliquées).

## Self-Check: PASSED

- `plugins/stretching/src/screens/StretchingPlugin.tsx` — FOUND
- `plugins/sleep/src/screens/SleepPlugin.tsx` — FOUND
- Commit 8628f1d — FOUND
- Commit 247dc84 — FOUND
- `StretchingDashboard.tsx` — DELETED
- `SleepDashboard.tsx` — DELETED
- Zero références résiduelles aux anciens dashboards dans imports — CONFIRMED
- TypeScript: 0 erreurs TS — CONFIRMED
