---
phase: "04"
plan: "01"
subsystem: coach-dashboards
tags: [coach-memory, api, mem-02, preferences-inference]
dependency_graph:
  requires: []
  provides: [memory-api-shape, mem-02-fire-and-forget]
  affects: [apps/web/src/components/coach/dashboard, backend/api/src/coach/dashboards]
tech_stack:
  added: []
  patterns: [deep-merge-partial-update, fire-and-forget-fetch, ref-sync-pattern]
key_files:
  created: []
  modified:
    - backend/api/src/coach/dashboards/service.ts
    - backend/api/src/coach/dashboards/types.ts
    - apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx
    - apps/web/src/components/coach/dashboard/EditChatPanel.tsx
decisions:
  - "GET /memory returns flat shape (no wrapper) — 200 with empty defaults instead of 404"
  - "PUT /memory 409 fires only for net-new templates whose name conflicts with existing names (detected by id mismatch + name match)"
  - "MEM-02 uses ref-sync pattern (historyRef) instead of prop drilling messages state to avoid EditChatPanel re-render coupling"
  - "Pre-existing VocalReview.test.tsx TS error is out of scope — unrelated to plan changes"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-05-28"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 04 Plan 01: Fix /memory API Shape + MEM-02 Preference Inference Summary

**One-liner:** Fixed GET/PUT /memory API contract (flat response, deep-merge partial body, 409 duplicate guard) and added MEM-02 fire-and-forget preferences inference on every dashboard save.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix GET/PUT /memory API shape + 409 duplicate guard + update types | 1b2fc21 | service.ts, types.ts |
| 2 | MEM-02 — fire-and-forget preferences inference in DashboardEditOverlay | d21d1e9 | DashboardEditOverlay.tsx, EditChatPanel.tsx |

## What Was Built

### Task 1 — API Shape Fixes (backend/api)

**GET /memory** now returns the flat shape required by the UI-SPEC:
```json
{ "preferences": {}, "templates": [], "recent_actions": [] }
```
Previously returned `{ "memory": { "templates": [], "preferences": {} } }` — the frontend hook could not consume this directly.

**PUT /memory** now accepts a partial body `{ templates?, preferences?, recent_actions? }` and deep-merges into the existing record:
- `preferences` field is shallow-merged (spread) with existing preferences
- `templates` replaces the array entirely (user passes full updated list)
- `recent_actions` replaces the array (last N actions, not cumulative)
- Previously read `body.memory` wrapper — now reads body directly

**409 duplicate name guard:** Returns `{ error: 'Template name already exists' }` with HTTP 409 when a net-new template (id not in existing set) uses a name that already exists in the stored templates array.

**TypeScript types (types.ts):** Added three new interfaces:
- `CoachMemoryPreferences` — typed preferred_period, preferred_widgets, preferred_chart_type
- `CoachMemoryTemplate` — typed id, name, widgets, created_at
- `CoachMemoryData` — typed preferences + templates + recent_actions
- `CoachMemoryRow.memory` upgraded from `{ templates: unknown[]; preferences: Record<string, unknown> }` to `CoachMemoryData`

### Task 2 — MEM-02 Fire-and-Forget (apps/web)

**DashboardEditOverlay.tsx:**
- Added `conversationHistoryRef` (ref to array of `{role, content}` objects)
- After every successful `PUT /:clientId` save, fires a non-blocking `PUT /api/coach/dashboards/memory` with:
  - `preferences.preferred_widgets`: unique widget types from current configRef
  - `recent_actions`: last 3 user messages from conversation history
- `.catch(() => {})` ensures silent fail — preferences are best-effort, never block UX

**EditChatPanel.tsx:**
- Added optional `historyRef` prop (`React.MutableRefObject<...>`)
- New `useEffect` syncs all non-`system-opening` messages to `historyRef.current` on every message change
- DashboardEditOverlay passes its `conversationHistoryRef` as `historyRef` to EditChatPanel

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is wired end-to-end.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced beyond what was planned in the threat model. T-04-01 (unknown keys in PUT body ignored) and T-04-03 (userId always from auth context) both mitigated as designed.

## Self-Check: PASSED

- [x] `1b2fc21` commit exists: `git log --oneline | grep 1b2fc21`
- [x] `d21d1e9` commit exists: `git log --oneline | grep d21d1e9`
- [x] `backend/api/src/coach/dashboards/service.ts` — modified
- [x] `backend/api/src/coach/dashboards/types.ts` — modified
- [x] `apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx` — modified
- [x] `apps/web/src/components/coach/dashboard/EditChatPanel.tsx` — modified
- [x] `tsc --noEmit` in backend/api: 0 errors
- [x] `tsc --noEmit` in apps/web: 0 errors in plan-modified files (1 pre-existing error in VocalReview.test.tsx — out of scope)
