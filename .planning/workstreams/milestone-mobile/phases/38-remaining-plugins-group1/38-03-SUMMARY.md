---
plan: 38-03
phase: 38
subsystem: plugins/measurements + plugins/timer
tags: [measurements, timer, countdown, supabase, tanstack-query, subtabs]
dependency_graph:
  requires: []
  provides: [MeasurementsPlugin, TimerPlugin]
  affects: [apps/mobile routes measurements+timer]
tech_stack:
  added: []
  patterns:
    - MiniBars locaux (hauteur absolue, pas de librairie chart)
    - countdown useRef+setInterval+AppState (D-08)
    - INSERT workout_sessions colonnes D-09 uniquement
    - useMutation + useQueryClient.invalidateQueries pour logs
key_files:
  created:
    - plugins/measurements/src/screens/MeasurementsPlugin.tsx
    - plugins/timer/src/screens/TimerPlugin.tsx
  modified:
    - apps/mobile/app/(app)/(plugins)/measurements/dashboard.tsx
    - apps/mobile/app/(app)/(plugins)/timer/dashboard.tsx
    - plugins/measurements/src/index.ts
    - plugins/measurements/package.json
    - plugins/timer/src/index.ts
    - plugins/timer/package.json
  deleted:
    - plugins/measurements/src/screens/MeasurementsDashboard.tsx
    - plugins/timer/src/screens/TimerDashboard.tsx
decisions:
  - Countdown global (hors tabs) pour partager l'état Séance/Tabata/Intervalle sans rerender
  - work_sec→work_seconds mappé à la lecture DB (pas de migration)
  - Onglet Tabata et Intervalle naviguent vers Séance + pre-sélectionnent le preset sans auto-start (user clique play)
  - Presets fallback builtin si aucun preset DB (4 presets hardcodés)
metrics:
  duration: 35min
  completed: 2026-05-27
  tasks_completed: 3
  files_created: 2
  files_modified: 6
  files_deleted: 2
---

# Phase 38 Plan 03: MeasurementsPlugin + TimerPlugin Summary

**One-liner:** Redesign complet Measurements (SubTabs + body_measurements + MiniBars + modal) et Timer (countdown useRef+AppState + presets DB + save workout_sessions D-09).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | MeasurementsPlugin — 3 SubTabs, mesures réelles | 2714b29 | MeasurementsPlugin.tsx |
| 2 | TimerPlugin — countdown useRef+AppState, presets DB | 1c7aa90 | TimerPlugin.tsx |
| 3 | Route wrappers, barrels, suppression anciens dashboards | ca623c9 | dashboard.tsx x2, index.ts x2, package.json x2, delete x2 |

## What Was Built

### MeasurementsPlugin.tsx
- **Onglet Aujourd'hui** : carte poids `weight_kg` depuis `body_measurements` ORDER BY date DESC LIMIT 2, chip delta vert/rouge vs mesure précédente, RowList 5 mensurations (poitrine/bras/taille/cuisse/masse grasse), AISuggestion tintColor SUCCESS, CTA "Logger des mesures"
- **Modal saisie** : 7 champs TextInput (weight requis, 6 optionnels), `useMutation` INSERT `body_measurements`, invalidation `['latest_measurement', 'measurements_6weeks']` on success, `showAlert` confirmation
- **Onglet Évolution** : MiniBars 6 semaines locaux (hauteur absolue, pattern interfaces), `useQuery` 42 jours regroupés par semaine, texte delta global
- **Onglet Objectifs** : 3 objectifs statiques (76kg/78cm taille/40cm bras) avec valeurs réelles depuis latest_measurement

### TimerPlugin.tsx
- **Countdown D-08** : `intervalRef = useRef<ReturnType<typeof setInterval>>`, `startedAtRef = useRef<number>`, `setInterval` 1s, correction `AppState.addEventListener('change')` pour reprise background
- **Onglet Séance** : carte dark `backgroundColor '#1C1A17'`, countdown `fontSize 72 fontWeight '900' color '#FF5C1A'`, contrôles -15s/play-pause 64px/+15s, grille presets 2 colonnes, CTA "Sauvegarder" visible après arrêt
- **Insert D-09** : `workout_sessions` avec UNIQUEMENT `user_id/name/started_at/ended_at/notes` — zéro `duration_minutes` ni `calories_burned`
- **Presets DB** : `useQuery timer_presets` avec mapping `work_sec→work_seconds, rest_sec→rest_seconds`; fallback 4 presets builtin si vide
- **Sons** : `playSound('start'|'rest'|'complete')`, `playCountdownBeep(s)` si s <= 3, `Vibration.vibrate([0,400,200,400])` à la fin
- **Onglet Tabata** : démarrage rapide 20s/10s/8 rounds, navigate Séance
- **Onglet Intervalle** : formulaire +/- effort/repos/rounds/sets, calcul durée totale, navigate Séance

### Task 3 — Câblage
- Route `measurements/dashboard.tsx` : import `MeasurementsPlugin` (plus `MeasurementsDashboard`)
- Route `timer/dashboard.tsx` : import `TimerPlugin` (plus `TimerDashboard`)
- Barrels mis à jour avec exports
- `package.json` exports mis à jour pour les deux plugins
- `MeasurementsDashboard.tsx` et `TimerDashboard.tsx` supprimés — 0 import résiduel confirmé

## Deviations from Plan

None — plan exécuté exactement comme spécifié. Les noms de fonctions route (`MeasurementsDashboardRoute`, `TimerDashboardRoute`) sont des noms de composants export et non des imports des anciens modules — vérification grep confirmée.

## Known Stubs

Aucun stub. Toutes les données sont tirées de Supabase via TanStack Query.

## Self-Check: PASSED

- `plugins/measurements/src/screens/MeasurementsPlugin.tsx` : FOUND
- `plugins/timer/src/screens/TimerPlugin.tsx` : FOUND
- Commits 2714b29, 1c7aa90, ca623c9 : FOUND
- TypeScript erreurs : 0
- `duration_minutes|calories_burned` dans TimerPlugin insert : 0 occurrences
- `MEASUREMENTS_DATA|TIMER_DATA` fixtures : 0 occurrences
- `AppState` dans TimerPlugin : FOUND
- `#1C1A17` dans TimerPlugin : FOUND
- `fontSize 72` dans TimerPlugin : FOUND
- `MeasurementsDashboard.tsx` supprimé : CONFIRMED
- `TimerDashboard.tsx` supprimé : CONFIRMED
