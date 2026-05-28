---
phase: 41-ai-context-injection
plan: "04"
subsystem: coach-dashboard
tags:
  - threshold-alerts
  - chart-badge
  - modal-crud
dependency_graph:
  requires:
    - 041-01
    - 041-02
  provides:
    - AlertesModal component with GET/POST/DELETE threshold CRUD
    - ChartCard extended with crossedThresholds badge rendering
  affects:
    - apps/web/src/components/coach/dashboard/
tech_stack:
  added: []
  patterns:
    - fixed-modal-overlay with bg-black/40 backdrop
    - conditional IIFE for badge severity computation
    - optional prop extension (non-breaking)
key_files:
  created:
    - apps/web/src/components/coach/dashboard/AlertesModal.tsx
  modified:
    - apps/web/src/components/coach/dashboard/ChartCard.tsx
decisions:
  - Badge severity threshold set at 20% delta (delta ≤ 0.2 → orange warning, delta > 0.2 → red critical)
  - IIFE pattern used inside JSX for badge severity logic (avoids separate helper function)
  - Title bar refactored from bare h3 to flex row (h3 + optional badge) — minimal structural change
metrics:
  duration: "~15 minutes"
  completed: "2026-05-29"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 41 Plan 04: AlertesModal + ChartCard Badge Summary

**One-liner:** Sport-scoped threshold CRUD modal (GET/POST/DELETE) + orange/red pill badge on ChartCard title bar when a threshold is crossed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create AlertesModal component | 9c99d80 | apps/web/src/components/coach/dashboard/AlertesModal.tsx (new) |
| 2 | Extend ChartCard with crossedThresholds badge | 95a8fc8 | apps/web/src/components/coach/dashboard/ChartCard.tsx |

## What Was Built

### AlertesModal (`AlertesModal.tsx`)

New component exporting `AlertesModal`. Key behaviors:
- On mount, fetches `GET /api/coach/dashboards/:clientId/thresholds?sport=...` (deps: `clientId`, `sport`)
- Loading skeleton (`animate-pulse`) while fetching; error text on failure
- Empty state: "Aucun seuil configuré" with description paragraph
- Existing thresholds list: metric_key label, operator chip, threshold value, delete button (`aria-label="Supprimer ce seuil"`)
- Orange dot (8px, `bg-[#FF5C1A]`) shown on rows matching `crossedThresholds` prop; current value shown below row
- "+ Ajouter un seuil" button appends editable form row (metric_key text input, operator select, threshold_value number input)
- "Enregistrer les seuils" footer button calls `POST /api/coach/dashboards/:clientId/thresholds` for each non-empty new form, then clears form rows
- `DELETE /api/coach/dashboards/:clientId/thresholds/:id` on per-row delete
- Modal: `fixed inset-0 z-50`, `bg-black/40` backdrop, 480px panel, `role="dialog"` `aria-modal="true"`

### ChartCard extension (`ChartCard.tsx`)

Two additive changes (all new props optional — no breaking change):

1. Props interface extended with:
   - `crossedThresholds?: Array<{ metric_key, operator, threshold_value, current_value }>`
   - `metricKey?: string`

2. Title bar refactored to `flex items-center gap-2 mb-4` row:
   - `h3` takes `flex-1`
   - Conditional badge (IIFE): finds matching entry in `crossedThresholds` by `metricKey`
     - `delta = |current - threshold| / threshold`
     - `delta ≤ 0.20` → orange pill: `bg-[#FFF7ED] text-[#FF5C1A] border border-[#FF5C1A]/20 rounded-full`
     - `delta > 0.20` → red pill: `bg-red-50 text-red-500 border border-red-200 rounded-full`
     - Badge text: `"{metric_key} {operator} {threshold_value}"`

## Verification Results

- `npm run type-check` passes (only pre-existing errors unrelated to this plan)
- All 12 AlertesModal acceptance criteria satisfied
- All 8 ChartCard acceptance criteria satisfied

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder data or hardcoded empty values introduced.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced (frontend UI only).

## Self-Check: PASSED

- `apps/web/src/components/coach/dashboard/AlertesModal.tsx` — FOUND
- `apps/web/src/components/coach/dashboard/ChartCard.tsx` — FOUND (modified)
- Commit `9c99d80` — feat(41-04): create AlertesModal component for threshold CRUD
- Commit `95a8fc8` — feat(41-04): extend ChartCard with crossedThresholds badge prop
