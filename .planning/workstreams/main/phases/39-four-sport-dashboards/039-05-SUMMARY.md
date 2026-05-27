---
phase: 39
plan: "039-05"
subsystem: web-coach-dashboard
tags: [dashboard, sport-selector, routing, typescript]
dependency_graph:
  requires: [039-01, 039-02, 039-03, 039-04]
  provides: [full-sport-dashboard-routing]
  affects: [coach-client-dashboard-page]
tech_stack:
  added: []
  patterns: [conditional-render, useState]
key_files:
  modified:
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx
decisions:
  - Conditional renders per sport value (null → empty state, each sport → its dashboard)
metrics:
  duration: "5m"
  completed_date: "2026-05-27"
  tasks_completed: 1
  files_changed: 1
---

# Phase 39 Plan 05: Wire All 5 Sport Dashboards into Dashboard Page Summary

**One-liner:** Dashboard page now imports and conditionally renders all 5 sport dashboards (Powerlifting, Hyrox, Running, Bodybuilding, WeightLoss) driven by the sport selector control bar.

## What Was Built

Updated `dashboard/page.tsx` to import and render all 4 new dashboard components (HyroxDashboard, RunningDashboard, BodybuildingDashboard, WeightLossDashboard) alongside the existing PowerliftingDashboard. Sport selection in DashboardControlBar now drives the correct dashboard display.

## Commits

| Hash | Message |
|------|---------|
| 555320a | feat(039-05): wire all 5 sport dashboards into dashboard page |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — exists and updated
- Commit 555320a — verified in git log
- TypeScript: no errors (tsc --noEmit passed)
