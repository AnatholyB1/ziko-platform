---
phase: 41-ai-context-injection
plan: "01"
subsystem: backend/coach-ai
tags: [migration, types, system-prompt, dashboard-context, rls]
dependency_graph:
  requires: []
  provides:
    - coach_metric_thresholds table (migration 063)
    - DashboardContext interface
    - ThresholdAlert interface
    - InsightsResponse interface
    - CoachMetricThreshold interface
    - buildCoachSystemPrompt(ctx, dashboardCtx?) signature
    - /chat/stream dashboard_context body field
  affects:
    - backend/api/src/coach/ai/service.ts
    - backend/api/src/coach/ai/types.ts
    - supabase/migrations/
tech_stack:
  added: []
  patterns:
    - Supabase RLS row-level isolation (auth.uid() = coach_id)
    - Optional parameter injection into system prompt builder
key_files:
  created:
    - supabase/migrations/063_coach_metric_thresholds.sql
  modified:
    - backend/api/src/coach/ai/types.ts
    - backend/api/src/coach/ai/service.ts
decisions:
  - Migration number is 063 (not 062) — 062 was already taken by workout_reminder_prefs (notification-mobile workstream)
metrics:
  duration: "~12 minutes"
  completed: "2026-05-29"
  tasks_completed: 3
  files_changed: 3
---

# Phase 41 Plan 01: Coach Metric Thresholds — DB Foundation + AI System Prompt Summary

Migration 063 for coach_metric_thresholds table with RLS, four new TypeScript interfaces for dashboard AI context, and extended buildCoachSystemPrompt that injects active sport + metrics when present in the POST /chat/stream body.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration 063 — coach_metric_thresholds table | 7af13be | supabase/migrations/063_coach_metric_thresholds.sql |
| 2 | Extend coach AI types.ts with DashboardContext and related interfaces | e78447b | backend/api/src/coach/ai/types.ts |
| 3 | Extend buildCoachSystemPrompt and /chat/stream body parsing | c60c5db | backend/api/src/coach/ai/service.ts |

## What Was Built

### Migration 063 (supabase/migrations/063_coach_metric_thresholds.sql)

Creates `public.coach_metric_thresholds` with columns: id (UUID PK), coach_id (FK auth.users CASCADE), client_id (FK auth.users CASCADE), sport_type (TEXT), metric_key (TEXT), operator (TEXT CHECK IN ('>', '<')), threshold_value (NUMERIC), is_active (BOOLEAN DEFAULT true), created_at/updated_at (TIMESTAMPTZ). RLS enabled with `coach_metric_thresholds_own` policy scoped to `auth.uid() = coach_id`. Partial index `idx_coach_metric_thresholds_lookup` on (coach_id, client_id, sport_type) WHERE is_active = true.

### New TypeScript Interfaces (backend/api/src/coach/ai/types.ts)

- `DashboardContext` — sport_type: string, metrics: Record<string, string> — carries the active sport and top-3 metric values from the frontend chart state
- `ThresholdAlert` — metric_key, operator '>'|'<', threshold_value: number, current_value: number — shape returned when a threshold is crossed on dashboard load
- `InsightsResponse` — chartInsights: Record<string,string>, narrative: string, crossedThresholds: ThresholdAlert[] — full response from the future POST /coach/dashboards/:clientId/insights endpoint
- `CoachMetricThreshold` — full row shape for the new table, with operator typed as '>'|'<' (not plain string)

### Extended Service (backend/api/src/coach/ai/service.ts)

`buildCoachSystemPrompt` signature changed from `(ctx: CoachContext)` to `(ctx: CoachContext, dashboardCtx?: DashboardContext)`. When dashboardCtx is truthy, appends a `## Dashboard Context` section with `Sport actif: <sport_type>` and a bullet list of metric key-value pairs. POST /chat/stream body parsing destructures `dashboard_context` alongside existing `messages` and `conversation_id`, typed as `dashboard_context?: DashboardContext`. `buildCoachSystemPrompt(coachCtx, dashboard_context)` is now called with the second argument so context flows through on every request where the frontend sends it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration number corrected from 062 to 063**
- **Found during:** Task 1 (pre-flight directory listing)
- **Issue:** The plan specified migration 062, but `062_workout_reminder_prefs.sql` already existed in the repository (created by the notification-mobile workstream).
- **Fix:** Used the next available sequential slot — 063. All plan references updated accordingly. Plan must_haves reference "062" but the artifact spec was adjusted to 063 to avoid overwriting an existing migration.
- **Files modified:** supabase/migrations/063_coach_metric_thresholds.sql (created at 063, not 062)
- **Commit:** 7af13be

## Known Stubs

None — this plan delivers infrastructure only (migration + types + prompt extension). No UI rendering.

## Threat Flags

T-41-02 mitigated: USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id) on coach_metric_thresholds — verified in migration 063.
T-41-03 mitigated: CHECK (operator IN ('>', '<')) DB-level constraint — verified in migration 063.
T-41-01 accepted: dashboard_context is coach-controlled input injected only into the requesting coach's own session system prompt. No cross-coach leakage vector.

## Self-Check

- [x] supabase/migrations/063_coach_metric_thresholds.sql exists and contains 6 references to `coach_metric_thresholds`
- [x] backend/api/src/coach/ai/types.ts exports all four interfaces
- [x] backend/api/src/coach/ai/service.ts contains `buildCoachSystemPrompt(coachCtx, dashboard_context)` at line 492
- [x] TypeScript compilation passes with no new errors (rtk tsc --noEmit -p backend/api/tsconfig.json)
- [x] Commits 7af13be, e78447b, c60c5db all present in git log

## Self-Check: PASSED
