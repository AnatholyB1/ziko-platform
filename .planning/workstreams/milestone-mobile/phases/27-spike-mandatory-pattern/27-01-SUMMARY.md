---
phase: 27-spike-mandatory-pattern
plan: "01"
subsystem: planning
tags: [spike, architecture-decision, mandatory-plugin]
dependency_graph:
  requires: []
  provides: [27-SPIKE.md]
  affects: [27-02, 27-03]
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - .planning/workstreams/milestone-mobile/phases/27-spike-mandatory-pattern/27-SPIKE.md
  modified: []
decisions:
  - "Registry-driven chosen: mandatory?: boolean in PluginManifest, no DB migration"
  - "Data-driven documented as rollback: user_plugins.is_mandatory column"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-18"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 27 Plan 01: Write 27-SPIKE.md — Mandatory Plugin ADR Summary

**One-liner:** ADR comparing registry-driven (`manifest.mandatory: true`) vs data-driven (`user_plugins.is_mandatory` column) enforcement; registry-driven chosen — no migration, backward-compatible optional field, client-only enforcement with documented DB-level rollback path.

---

## Tasks Completed

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Write 27-SPIKE.md ADR | c7b16a6 | `.planning/workstreams/milestone-mobile/phases/27-spike-mandatory-pattern/27-SPIKE.md` |

---

## What Was Built

`27-SPIKE.md` is a 79-line architecture decision record covering:

- Problem statement: coach plugin must be pre-installed and non-removable for all athletes
- Comparison table: registry-driven vs data-driven, 7 dimensions each
- Decision: registry-driven chosen (D-01) — adds `mandatory?: boolean` to `PluginManifest` in `packages/plugin-sdk/src/types.ts`
- Files to touch: `types.ts`, `PluginLoader.tsx`, `store/[id].tsx` (3 files, no migration)
- Auto-install strategy: mandatory plugins loaded before `user_plugins` query, `loadedRef` guards double-registration
- Rollback plan: data-driven fallback with `user_plugins.is_mandatory` column documented step-by-step
- End-to-end verification: `npx tsc --noEmit` exits 0 + trash icon grayed out on coach detail screen
- Phase 29 scope boundary: 7 deferred items listed (tooltips, i18n, 3-state UX, role-gated loading, etc.)

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check: PASSED

- `27-SPIKE.md` exists at correct path: FOUND
- Commit `c7b16a6` exists: FOUND
- File contains "registry-driven": FOUND
- File contains "data-driven": FOUND
- File contains all three file paths: FOUND
- File contains "mandatory?: boolean": FOUND
- File contains "Rollback" with data-driven fallback: FOUND
- `wc -l` = 79 (> 60): PASSED
