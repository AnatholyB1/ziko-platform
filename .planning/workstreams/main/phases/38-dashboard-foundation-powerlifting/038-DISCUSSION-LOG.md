# Phase 38: Dashboard Foundation + Powerlifting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 038-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 38-dashboard-foundation-powerlifting
**Areas discussed:** Data fetching, Default sport on open, 1RM formula, Animation approach

---

## Data Fetching

| Option | Description | Selected |
|--------|-------------|----------|
| Client component (full 'use client') | useState for sport+date, browser-side Supabase, no SSR for chart data | ✓ |
| Server wrapper + URL searchParams | Server component reads sport+dateRange from searchParams, fetches SSR, passes to client shell | |

**User's choice:** Client component

---

| Option | Description | Selected |
|--------|-------------|----------|
| TanStack Query useQuery | queryKey: [clientId, sport, dateRange], caching, auto loading/error states | ✓ |
| useEffect + useState | Manual loading/error booleans, no caching | |

**User's choice:** TanStack Query

---

| Option | Description | Selected |
|--------|-------------|----------|
| Utility functions file (lib/dashboard/powerlifting.ts) | Pure async functions, reusable in Phase 39 | ✓ |
| Inline in component | Query logic in PowerliftingDashboard.tsx | |

**User's choice:** Utility functions file

---

| Option | Description | Selected |
|--------|-------------|----------|
| One query, 4 results | Single useQuery returns { sbd, rpe, tonnage, intensity } | ✓ |
| 4 independent useQuery calls | Each chart fetches independently, parallel loading | |

**User's choice:** One query, 4 results

---

## Default Sport on Open

| Option | Description | Selected |
|--------|-------------|----------|
| No selection (null) | Placeholder shown, prompt empty state | ✓ |
| Default to Powerlifting | Tab opens with Powerlifting pre-selected, charts load immediately | |

**User's choice:** No selection — coach must pick explicitly

---

## 1RM Formula

| Option | Description | Selected |
|--------|-------------|----------|
| Epley always | weight * (1 + reps/30), RPE ignored | ✓ |
| RPE-adjusted (Tuchscherer) when available | More accurate when RPE is filled, lookup table needed | |

**User's choice:** Epley always

---

| Option | Description | Selected |
|--------|-------------|----------|
| Shared estimate1RM utility | One function in lib/dashboard/powerlifting.ts, used by SBD + Intensity charts | ✓ |
| Computed independently per chart | Each chart computes its own 1RM inline | |

**User's choice:** Shared utility

---

## Animation Approach

| Option | Description | Selected |
|--------|-------------|----------|
| CSS-only (@keyframes fadeInUp) | globals.css keyframes + animationDelay inline style, zero new deps | ✓ |
| Install Framer Motion | motion.div + AnimatePresence, +40KB gzipped, cleaner API | |

**User's choice:** CSS-only

---

| Option | Description | Selected |
|--------|-------------|----------|
| First mount only | Cards animate when sport first selected; date filter = instant re-render | ✓ |
| Re-animate on filter change | Every sport/date change triggers stagger animation | |

**User's choice:** First mount only

---

## Claude's Discretion

- Exact Supabase join query structure for session_sets + workout_sessions
- Whether to use useMemo for data transforms or compute inline in queryFn
- TypeScript type definitions for dashboard data shapes (follow UI-SPEC §Data Shape Reference)

## Deferred Ideas

- Framer Motion — deferred to Phase 39+ if needed
- RPE-adjusted 1RM (Tuchscherer) — future enhancement
- Hyrox, Running, Bodybuilding, Weight Loss dashboards — Phase 39
- Comparison mode — Phase 40
- PDF export — Phase 40
- AI insight chip real content — Phase 41
