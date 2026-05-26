---
phase: 38
slug: dashboard-foundation-powerlifting
date: 2026-05-26
---

# Phase 38: Validation Strategy

## Validation Architecture

This phase delivers the Dashboard tab infrastructure and Powerlifting dashboard for the coach client detail view. Validation is structured around four sequential sampling points that mirror the plan wave structure.

### Sampling Points

**038-01: TanStack Query provider installed and wraps coach layout**

| Check | Command | Pass Condition |
|-------|---------|----------------|
| Package installed | `cd C:/ziko-platform && rtk pnpm list --filter apps/web @tanstack/react-query` | Package present at v5.x |
| QueryProvider.tsx exists | `ls apps/web/src/components/coach/QueryProvider.tsx` | File exists |
| QueryProvider wraps coach layout children | `grep -c "QueryProvider" apps/web/src/app/\[locale\]/\(coach\)/coach/layout.tsx` | ≥ 1 |
| TypeScript clean | `cd apps/web && rtk tsc --noEmit -p tsconfig.json 2>&1 \| grep -i "QueryProvider\|QueryClient" \| head -5 \|\| echo NO_ERRORS` | NO_ERRORS |
| Unit tests pass | `cd apps/web && rtk vitest run src/lib/dashboard/powerlifting.test.ts` | All tests green |

**038-02: Dashboard route renders, tab visible in ClientTabStrip**

| Check | Command | Pass Condition |
|-------|---------|----------------|
| Dashboard tab entry | `grep -c "key: 'dashboard'" apps/web/src/components/coach/ClientTabStrip.tsx` | 1 |
| Page file exists | `ls apps/web/src/app/\[locale\]/\(coach\)/coach/clients/\[id\]/dashboard/page.tsx` | File exists |
| loading.tsx exists | `ls apps/web/src/app/\[locale\]/\(coach\)/coach/clients/\[id\]/dashboard/loading.tsx` | File exists |
| fadeInUp keyframe | `grep -c "fadeInUp" apps/web/src/app/globals.css` | ≥ 1 |
| TypeScript clean | `cd apps/web && rtk tsc --noEmit -p tsconfig.json 2>&1 \| grep -E "DashboardControlBar\|ChartCard\|DashboardEmptyState\|DashboardLoadingState" \| head -10 \|\| echo NO_ERRORS` | NO_ERRORS |

**038-03: Data fetch functions return typed data matching schema**

| Check | Command | Pass Condition |
|-------|---------|----------------|
| powerlifting.ts exists | `ls apps/web/src/lib/dashboard/powerlifting.ts` | File exists |
| estimate1RM exported | `grep -c "export.*estimate1RM" apps/web/src/lib/dashboard/powerlifting.ts` | ≥ 1 |
| fetchPowerliftingData exported | `grep -c "export.*fetchPowerliftingData" apps/web/src/lib/dashboard/powerlifting.ts` | ≥ 1 |
| Unit tests pass | `cd apps/web && rtk vitest run src/lib/dashboard/powerlifting.test.ts` | All tests green |
| TypeScript clean | `cd apps/web && rtk tsc --noEmit -p tsconfig.json 2>&1 \| grep -i "powerlifting" \| head -10 \|\| echo NO_ERRORS` | NO_ERRORS |

**038-04: 4 chart cards render with live Supabase data**

| Check | Command | Pass Condition |
|-------|---------|----------------|
| PowerliftingDashboard exists | `ls apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` | File exists |
| enabled guard present | `grep -c "enabled: sport === 'powerlifting'" apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` | 1 |
| queryKey uses sport variable | `grep "queryKey.*sport" apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` | Line references `sport` variable (not string literal) |
| All 4 chart types | `grep -c "LineChart\|BarChart\|AreaChart" apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` | ≥ 4 occurrences |
| SBD ReferenceLine at y=8 | `grep -c "ReferenceLine y={8}" apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` | 1 |
| TypeScript clean | `cd apps/web && rtk tsc --noEmit -p tsconfig.json 2>&1 \| grep -i "PowerliftingDashboard\|recharts" \| head -10 \|\| echo NO_ERRORS` | NO_ERRORS |
| Full test suite | `cd apps/web && rtk vitest run` | All tests pass |

### Phase Gate

Before `/gsd:verify-work`, all four sampling points must pass plus the full browser smoke test (Plan 038-04 human-verify checkpoint).

Required state for phase gate:
- `cd apps/web && npm run type-check` exits 0
- `cd apps/web && npx vitest run src/lib/dashboard/powerlifting.test.ts` all green
- Browser: Dashboard tab visible, Powerlifting selected shows 4 charts in 2×2 grid
- Browser: Date filter changes data without re-triggering mount animation
- Browser: No data period shows DashboardEmptyState (no crash)
