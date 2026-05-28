---
phase: 40-advanced-dashboard-features
plan: "040-04"
subsystem: web-coach-dashboard
tags: [pdf-export, html2canvas, jspdf, hooks, client-side]
dependency_graph:
  requires: ["040-01", "040-02"]
  provides: ["PDF export for sport and personnalise dashboard tabs"]
  affects: ["apps/web/src/hooks/useExportPDF.ts", "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx"]
tech_stack:
  added: ["html2canvas@1.x", "jspdf@2.x"]
  patterns: ["dynamic import for SSR safety", "useCallback hook", "useRef for DOM capture", "state machine (idle/generating/done/error)"]
key_files:
  created:
    - apps/web/src/hooks/useExportPDF.ts
  modified:
    - apps/web/package.json
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx
decisions:
  - "Dynamic imports of html2canvas and jspdf ensure SSR safety (no module-level import)"
  - "useCallback placed before early returns to satisfy React hooks rules"
  - "buildPDFFilename logic inlined in handleExportPDF to avoid hoisting issues with function declarations after useCallback"
  - "clientId used as fallback slug when config.client_name is not available (UUID, readable enough for filename uniqueness)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_changed: 3
requirements: [DASH-05]
---

# Phase 40 Plan 04: PDF Export (html2canvas + jsPDF) Summary

Client-side PDF export for both Sport and Personnalisé dashboard tabs using html2canvas (DOM capture at 2x scale) and jsPDF (PDF wrapping), with a four-state button machine (idle/generating/done/error).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install html2canvas and jspdf | 1fe622e | apps/web/package.json |
| 2 | Create useExportPDF hook + wire into dashboard/page.tsx | f8fffeb | apps/web/src/hooks/useExportPDF.ts, dashboard/page.tsx |

## What Was Built

### useExportPDF hook (`apps/web/src/hooks/useExportPDF.ts`)
- Exports `exportPDF(element, filename)` async function and `exportState` state machine
- Dynamic imports of html2canvas and jspdf (SSR-safe — not imported at module level)
- html2canvas configured with `scale: 2` (retina), `useCORS: true`, `ignoreElements` filtering `pdf-exclude` class
- jsPDF auto-detects landscape vs portrait based on canvas dimensions
- State transitions: `idle` → `generating` → `done` (2s) → `idle`, with `error` on failure

### dashboard/page.tsx wiring
- `sportDashboardRef` wraps the chart area in the Sport tab (ControlBar excluded via `pdf-exclude` wrapper)
- `widgetDashboardRef` wraps DashboardGrid in the Personnalisé tab
- `handleExportPDF` dispatches to the correct ref based on `activeTab`
- PDF filename: `{slug}-{sport|personnalise}-dashboard-{YYYY-MM-DD}.pdf`
- Sport tab: `DashboardControlBar` now receives real `onExportPDF={handleExportPDF}` and `exportState={exportState}` (replacing 040-02 no-op)
- Personnalisé tab: inline PDF button added next to Éditer, with same idle/generating/done/error visual states
- Éditer button wrapped in `<div className="pdf-exclude">` per D-15

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useCallback placement before early returns**
- **Found during:** Task 2 implementation
- **Issue:** Original plan placed `handleExportPDF = useCallback(...)` after the `if (isLoading)` and `if (error || !config)` early returns, violating React hooks rules (hooks must not be called conditionally)
- **Fix:** Moved all hooks (`useExportPDF`, `clientName`, `handleExportPDF`) before the early returns
- **Files modified:** dashboard/page.tsx

**2. [Rule 1 - Refactor] buildPDFFilename inlined**
- **Found during:** Task 2 implementation
- **Issue:** Plan placed `buildPDFFilename` as a regular function after `handleExportPDF = useCallback(...)`. In JS, function declarations are hoisted but placing them between `useCallback` and `if (isLoading)` would create a confusing pattern. The filename logic was inlined directly in `handleExportPDF` to keep hooks-related code together before early returns.
- **Fix:** Inlined slug generation and filename building into `handleExportPDF` callback
- **Files modified:** dashboard/page.tsx

## Known Stubs

None — `exportPDF` is fully functional. `clientName` falls back to `clientId` (UUID) when `config.client_name` is not available; this is documented with a TODO comment.

## Self-Check: PASSED

- `apps/web/src/hooks/useExportPDF.ts` — created and committed (f8fffeb)
- `apps/web/package.json` — html2canvas and jspdf present (1fe622e)
- `dashboard/page.tsx` — modified and committed (f8fffeb)
- TypeScript check: zero errors in modified files
- `grep -c "html2canvas\|jspdf" apps/web/package.json` returns 2
