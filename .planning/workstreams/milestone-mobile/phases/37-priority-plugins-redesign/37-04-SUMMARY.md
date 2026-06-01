---
phase: 37-priority-plugins-redesign
plan: 37-04
subsystem: ui
tags: [react-native, expo, tanstack-query, ai-programs, plugin-redesign, dark-hero, subtabs, aisuggestion]

requires:
  - plan: 37-01
    provides: SubTabs/AISuggestion/PluginHeader components (pill style)

provides:
  - AIProgramsPlugin.tsx: 3-tab single-entrypoint (Programme/Générer/Bibliothèque) with real TanStack Query data and dark hero card
  - Route wrapper updated to use AIProgramsPlugin
  - AIProgramsDashboard.tsx deleted
  - AIProgramsPlugin exported from barrel index.ts

affects: []

tech-stack:
  added: []
  patterns:
    - "Dark hero card: backgroundColor '#1C1A17', glow circle rgba(46,123,246,0.30), chip rgba(46,123,246,0.25)"
    - "is_active wiring: .eq('is_active', true).maybeSingle() for active program query"
    - "Réactiver mutation (D-11): two-step — UPDATE is_active=false WHERE user_id, then UPDATE is_active=true WHERE id"
    - "Navigate to generator: router.push('/workout/ai-generate') — existing AIGenerator wizard"
    - "Navigate to session: router.push('/workout/session') — existing workout session screen"
    - "AISuggestion rule for Générer tab: goal + days_per_week → recommended program type"

key-files:
  created:
    - plugins/ai-programs/src/screens/AIProgramsPlugin.tsx
  modified:
    - apps/mobile/app/(app)/(plugins)/ai-programs/dashboard.tsx
    - plugins/ai-programs/src/index.ts
  deleted:
    - plugins/ai-programs/src/screens/AIProgramsDashboard.tsx

decisions:
  - "Used SupabaseClient type from @supabase/supabase-js for type safety (vs any in old dashboard)"
  - "progress% derived from program_data.sessions completion or fallback 20% if active, 100% if not (JSONB opaque per UI-SPEC §4.6)"
  - "Two-step Réactiver confirmed per D-11: clear all user's programs first, then activate selected"
  - "AIProgramsDashboardRoute function name kept in route wrapper (Expo Router convention)"

metrics:
  duration_minutes: 15
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  files_deleted: 1
  commit: 3ce0358
  completed_date: 2026-05-26
---

# Phase 37 Plan 04: AI Programs Plugin Redesign Summary

**One-liner:** AIProgramsPlugin.tsx — 3-tab entrypoint with dark hero card (bg #1C1A17), is_active TanStack Query wiring, two-step Réactiver mutation, and navigate-to AIGenerator CTA.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Build AIProgramsPlugin.tsx — 3-tab entrypoint with dark hero and Réactiver | 3ce0358 | plugins/ai-programs/src/screens/AIProgramsPlugin.tsx |
| 2 | Wire route wrapper + barrel, delete old dashboard | 3ce0358 | apps/.../ai-programs/dashboard.tsx, plugins/ai-programs/src/index.ts, (deleted AIProgramsDashboard.tsx) |

## What Was Built

### Task 1: AIProgramsPlugin.tsx
- **Programme tab:** Dark hero card (backgroundColor `#1C1A17`) for active `ai_generated_programs` row fetched via `.eq('is_active', true).maybeSingle()`. Includes blue glow decoration, "Programme actif" chip, program name, progress bar (fill `#FF5C1A`), "Prochaine séance" CTA (`router.push('/workout/session')`), and "Détails" ghost button. Shimmer loading state. Empty state with barbell icon and CTA to switch to Générer tab.
- **Générer tab:** Static launch card with "Génération IA" chip, title, description, and "Générer un programme" CTA (`router.push('/workout/ai-generate')`). AISuggestion with rule-based text derived from `user_profiles.goal` (hypertrophie→Push/Pull/Legs 8w, force→5×5 12w, else→Endurance 6w).
- **Bibliothèque tab:** All `ai_generated_programs` ordered by created_at DESC. Each card shows name, status chip (En cours/Terminé), progress bar, date. "Réactiver" ghost button for non-active programs triggers two-step mutation with `showAlert` confirmation.

### Task 2: Wiring
- Route wrapper `dashboard.tsx` updated: imports `AIProgramsPlugin` from `@ziko/plugin-ai-programs/screens/AIProgramsPlugin`.
- Barrel `index.ts` updated: exports `AIProgramsPlugin`.
- `AIProgramsDashboard.tsx` deleted after confirming zero remaining import references.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `progress%` in Bibliothèque cards: derived from `program_data.sessions` completion array if available; falls back to 20% for active / 100% for inactive since session completion tracking is opaque in the JSONB structure. This is documented in UI-SPEC §4.6 and is intentional — the JSONB schema is not enforced at DB level.

## Threat Flags

None — all queries are scoped by `user_id`. Both UPDATE calls in the Réactiver mutation use `.eq('user_id', userId)` for Step 1 and `.eq('id', programId)` for Step 2, matching T-37-04-01 mitigation plan. RLS enforces the same at database level.

## Self-Check: PASSED

- `plugins/ai-programs/src/screens/AIProgramsPlugin.tsx` — FOUND
- `apps/mobile/app/(app)/(plugins)/ai-programs/dashboard.tsx` — FOUND (updated)
- `plugins/ai-programs/src/index.ts` — FOUND (updated)
- `plugins/ai-programs/src/screens/AIProgramsDashboard.tsx` — DELETED OK
- Commit 3ce0358 — FOUND
- TypeScript errors: 0
