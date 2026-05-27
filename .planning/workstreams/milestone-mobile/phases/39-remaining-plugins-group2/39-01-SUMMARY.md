---
phase: 39
plan: "39-01"
subsystem: milestone-mobile
tags: [journal, cardio, plugins, subtabs, tanstack-query, ui-redesign]
dependency_graph:
  requires: []
  provides:
    - plugins/journal/src/screens/JournalPlugin.tsx
    - plugins/cardio/src/screens/CardioPlugin.tsx
  affects:
    - apps/mobile/app/(app)/(plugins)/journal/dashboard.tsx
    - apps/mobile/app/(app)/(plugins)/cardio/dashboard.tsx
tech_stack:
  added: []
  patterns:
    - Single-entrypoint plugin with internal SubTabs
    - TanStack Query useQuery/useMutation for all DB operations
    - Local MiniBars component (no external dep)
    - Rule-based AI suggestion text without AI calls
key_files:
  created:
    - plugins/journal/src/screens/JournalPlugin.tsx
    - plugins/cardio/src/screens/CardioPlugin.tsx
  modified:
    - apps/mobile/app/(app)/(plugins)/journal/dashboard.tsx
    - apps/mobile/app/(app)/(plugins)/cardio/dashboard.tsx
    - plugins/journal/src/index.ts
    - plugins/cardio/src/index.ts
  deleted:
    - plugins/journal/src/screens/JournalDashboard.tsx
    - plugins/cardio/src/screens/CardioDashboard.tsx
decisions:
  - Mood picker uses 5 emojis with violet #7B5BD0 accent; selected state uses rgba(123,91,208,0.14) background and 1.5px border
  - Context chips single-select (Matin/Post-séance/Pré-séance/Soir) with #7B5BD0 active state
  - AISuggestion text is rule-based (avg mood < 3 / >= 4 / else) — no AI API call
  - Cardio activity grid 2-col, 6 tiles (Course/Vélo/Rameur/Marche/Hyrox/Functional) navigating to existing tracker route
  - Plan card is rule-based (cardioWeek.length < 2 → LISS suggestion; sleep avg < 3 → rest suggestion)
  - Old dashboards deleted after verify-zero-imports per Phase 37/38 pattern
metrics:
  duration: "~30 min"
  completed: "2026-03-17"
  tasks_completed: 3
  files_changed: 8
---

# Phase 39 Plan 01: Journal + Cardio Plugins Complete Summary

**One-liner:** JournalPlugin (mood picker violet, 3 SubTabs, useMutation journal_entries) and CardioPlugin (6-tile activity grid, rule-based dark plan card, MiniBars stats) replacing old dashboards.

## What Was Built

### Task 1: JournalPlugin.tsx
Full redesign of the Journal plugin entrypoint with 3 internal SubTabs:

- **Aujourd'hui tab:** 5-emoji mood picker with violet (`#7B5BD0`) accent highlighting, single-select context chips (Matin/Post-séance/Pré-séance/Soir), multiline TextInput for notes, AISuggestion static card, and "Enregistrer" button wired to `useMutation` inserting into `journal_entries`. On success: mood/notes/context reset.
- **Historique tab:** `useQuery(['journal_history', userId])` fetching `journal_entries ORDER BY created_at DESC LIMIT 30`. RowList showing emoji icon from mood value, note preview (40 chars), relative date.
- **Tendances tab:** `useQuery(['journal_trends', userId])` fetching last 7 entries. Local `MiniBars` (color `#7B5BD0`, max 5) for mood bars. `AISuggestion` text rule-based on avg mood (< 3 / ≥ 4 / stable).

Security: `user_id` sourced from `supabase.auth.getUser()` only; mood validated client-side (1-5 range enforced by MOODS array). `showAlert` used for error feedback (not `Alert.alert`).

### Task 2: CardioPlugin.tsx
Full redesign of the Cardio plugin entrypoint with 3 internal SubTabs:

- **Activités tab:** `AISuggestion` with rule-based cardio week count text (tint `#E94B3C`). 2-column grid of 6 activity tiles (Course/Vélo/Rameur/Marche/Hyrox/Functional), each navigating to `/(app)/(plugins)/cardio/tracker?activity_type=...`. "Récents" `useQuery(['cardio_recent', userId])` from `cardio_sessions ORDER BY created_at DESC LIMIT 5`.
- **Plan tab:** `useQuery(['cardio_week', userId])` + `useQuery(['sleep_recent', userId])` for rule-based plan title/description. Dark card (`#1C1A17`) with "Plan IA" chip, title, description, progress bar (`cardioWeek.length / 3 * 100%`), week counter. Static planned sessions RowList.
- **Stats tab:** `useQuery(['cardio_stats', userId])` for 7-day distance data. Local `MiniBars` (color `#E94B3C`). 2×2 `StatTile` grid: Total km, Séances, Durée totale, Vitesse moy.

Security: All queries scoped with `.eq('user_id', userId)`. Sleep logs query falls back to empty array on error (read-only, non-blocking).

### Task 3: Route Wrappers, Barrels, Dashboard Deletion
- `apps/mobile/app/(app)/(plugins)/journal/dashboard.tsx`: imports `JournalPlugin` from `@ziko/plugin-journal/screens/JournalPlugin`
- `apps/mobile/app/(app)/(plugins)/cardio/dashboard.tsx`: imports `CardioPlugin` from `@ziko/plugin-cardio/screens/CardioPlugin`
- `plugins/journal/src/index.ts`: added `export { default as JournalPlugin } from './screens/JournalPlugin'`
- `plugins/cardio/src/index.ts`: added `export { default as CardioPlugin } from './screens/CardioPlugin'`
- `JournalDashboard.tsx` deleted (zero import references verified before deletion)
- `CardioDashboard.tsx` deleted (CardioTracker.tsx, CardioDetail.tsx, CardioLog.tsx confirmed intact)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 + 2 | `074ba71` | feat(39-01): JournalPlugin + CardioPlugin with SubTabs and real data |
| 3 | `da7c1b9` | feat(39-01): wire route wrappers, update barrels, delete old dashboards |

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript: zero `error TS` | PASS (0 errors) |
| JournalPlugin export default | PASS |
| CardioPlugin export default | PASS |
| `#7B5BD0` violet accent in JournalPlugin | PASS |
| `#E94B3C` cardio accent in CardioPlugin | PASS |
| `Hyrox` in 6-tile activity grid | PASS |
| JournalDashboard.tsx deleted | PASS |
| CardioDashboard.tsx deleted | PASS |
| CardioTracker.tsx intact | PASS |
| Zero import refs to old dashboards | PASS |

## Known Stubs

- **Plan tab — planned sessions:** 3 static sessions (Demain · Tempo run / Vendredi · Intervalles / Dimanche · Sortie longue) are display-only stubs. These represent the plan's scheduled workouts and will be replaced with dynamic data in a future plan when a `planned_sessions` table is introduced. The plan card title and description are dynamically rule-based.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All DB access scoped by `user_id` from `supabase.auth.getUser()`.

## Self-Check: PASSED

- `plugins/journal/src/screens/JournalPlugin.tsx`: EXISTS
- `plugins/cardio/src/screens/CardioPlugin.tsx`: EXISTS
- Commit `074ba71`: EXISTS
- Commit `da7c1b9`: EXISTS
- `JournalDashboard.tsx`: DELETED
- `CardioDashboard.tsx`: DELETED
