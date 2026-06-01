# 040-02 Summary: Compare mode UI controls + data wiring

## What was built

A new `useCoachClients` hook fetches the coach's client list via the `/coach/clients` API using a Supabase session JWT, filtering out the current client. A `CompareExpandRow` component animates in/out below the control bar when compare mode is active, providing Client and Période sub-mode tabs with a client dropdown picker and period segmented control. `DashboardControlBar` was extended with Comparer toggle and Export PDF buttons (4 states), and `dashboard/page.tsx` now manages all compare state and threads it to all 5 sport dashboard components.

## Files modified/created

- `apps/web/src/hooks/useCoachClients.ts` — created: TanStack Query hook fetching coach clients, filters current client (D-06)
- `apps/web/src/components/coach/dashboard/CompareExpandRow.tsx` — created: animated expand row with Client/Période mode toggle, client dropdown, period segmented control, loading spinner, error banner
- `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` — extended: Comparer button (inactive/active states), Export PDF button (idle/generating/done/error), CompareExpandRow rendered below main flex row
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — compare state (compareMode, compareSubMode, compareClientId, comparePeriod, pdfExportState), handleToggleCompare with reset logic, all props threaded to DashboardControlBar and sport dashboards
- `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` — optional compare props added (compareMode, compareClientId, comparePeriod)
- `apps/web/src/components/coach/dashboard/HyroxDashboard.tsx` — optional compare props added
- `apps/web/src/components/coach/dashboard/RunningDashboard.tsx` — optional compare props added
- `apps/web/src/components/coach/dashboard/BodybuildingDashboard.tsx` — optional compare props added
- `apps/web/src/components/coach/dashboard/WeightLossDashboard.tsx` — optional compare props added

## Verification

- [x] useCoachClients hook fetches and filters clients
- [x] CompareExpandRow animates in/out, renders Client + Period modes
- [x] DashboardControlBar has Comparer + Export PDF buttons
- [x] Compare state flows to sport dashboards
- [x] TypeScript: no errors (`npx tsc --noEmit` produced no output)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- Export PDF handler in page.tsx is a no-op (`/* no-op — wired in 040-04 */`)
- `compareLoading` and `compareError` are hardcoded `false` in page.tsx — real data fetching wired in 040-03

## Threat Flags

None — no new network endpoints or trust boundaries introduced. The useCoachClients hook follows the same JWT auth pattern as useWidgetData.

## Self-Check: PASSED

- `apps/web/src/hooks/useCoachClients.ts` — FOUND
- `apps/web/src/components/coach/dashboard/CompareExpandRow.tsx` — FOUND
- `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` — FOUND (modified)
- Commit `8d7de64` — FOUND in git log
