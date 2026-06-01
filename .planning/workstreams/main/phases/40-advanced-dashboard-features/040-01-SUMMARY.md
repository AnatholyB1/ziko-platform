# 040-01 Summary: Sub-tab strip + dashboard page restructure

## What was built

Restructured the client dashboard page to introduce a Sport/Personnalisé sub-tab pill strip. The Sport tab (default) renders `DashboardControlBar` plus a sport selector switch that shows the appropriate sport dashboard component (`PowerliftingDashboard`, `HyroxDashboard`, `RunningDashboard`, `BodybuildingDashboard`, `WeightLossDashboard`) or `DashboardEmptyState` when no sport is selected. The Personnalisé tab renders the custom-widget `DashboardGrid` with the existing Éditer flow. Tab transitions use a 150ms CSS `fadeIn` animation added to `globals.css`.

## Files modified

- `apps/web/src/app/globals.css` — added `@keyframes fadeIn` block immediately after `@keyframes fadeInUp`
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — fully restructured with `activeTab`, `sport`, `dateRange` state and Sport/Personnalisé sub-tab strip

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted DashboardEditOverlay props to match actual component interface**
- **Found during:** Task 2
- **Issue:** The plan's JSX spec referenced props that do not exist on `DashboardEditOverlay` (`currentWidgets`, `previousWidgets`, `onClose`, `isEditing`, `setIsEditing`). The actual component interface is `initialWidgets`, `onSave`, `onCancel`.
- **Fix:** Used the correct props (`initialWidgets={config.widgets}`, `onSave={handleSave}`, `onCancel={handleCancel}`) preserving the existing save/cancel logic from the prior implementation.
- **Files modified:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx`
- **Commit:** cf5ccca

## Verification

- [x] `globals.css` contains `@keyframes fadeIn` (exact match confirmed via grep)
- [x] `dashboard/page.tsx` contains `activeTab` state with default `'sport'`
- [x] Sub-tab strip `<div>` has `pdf-exclude` class
- [x] Tab content `<div>` has `key={activeTab}` and `animate-[fadeIn_150ms_ease-out_forwards]`
- [x] Sport tab renders `DashboardControlBar` + sport dashboard switch
- [x] Personnalisé tab renders `DashboardGrid` + Éditer button
- [x] Loading/error guards remain outside tab structure
- [x] TypeScript: no errors in `dashboard/page.tsx` (`npx tsc --noEmit` — no output)

## Commits

| Hash | Message |
|------|---------|
| cf5ccca | feat(040-01): sub-tab strip + dashboard page restructure |

## Self-Check: PASSED

- `apps/web/src/app/globals.css` — exists, contains `@keyframes fadeIn`
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — exists, contains `activeTab`
- Commit `cf5ccca` — confirmed in git log
