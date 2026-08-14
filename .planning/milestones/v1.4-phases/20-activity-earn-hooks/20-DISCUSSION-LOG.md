# Phase 20: Activity Earn Hooks - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 20-activity-earn-hooks
**Mode:** discuss

## Gray Areas Presented

### Habit Earn Granularity
| Question | Options presented |
|----------|------------------|
| When does EARN-02 trigger? | Per habit tick vs. once per day (first habit) |

### Tool Executor Earn Placement
| Question | Options presented |
|----------|------------------|
| Where does earnCredits() live for tool executors? | Inside executor directly vs. all through POST /credits/earn HTTP |

### Workout Earn Path
| Question | Options presented |
|----------|------------------|
| EARN-01 with no tool executor? | Mobile POST /credits/earn after endSession vs. create workout tool executor |

## User Decisions

### Habit Earn Granularity
- **User chose:** Per habit tick
- **Rationale:** Every individual completion is rewarded; daily cap prevents overcounting

### Tool Executor Earn Placement
- **User chose:** Inside executor directly
- **Rationale:** Fire-and-forget inside executor, no extra HTTP round-trip for AI-triggered activities

### Workout Earn Path
- **User chose:** Mobile POST /credits/earn after endSession
- **Rationale:** Consistent with SC-4; no need to create a new tool executor

## Codebase Findings

### Executor returns (for idempotency key sourcing)
- `habits_log`: returns `{ success, habit_name, value, date }` — no UUID; use `habit_${habitId}_${date}`
- `nutrition_log_meal`: returns `{ success, entry: { id, ... } }` — use `entry.id`
- `measurements_log`: returns `{ success, measurement: { id, ... } }` — use `measurement.id`
- `stretching_log_session`: returns `{ success, session: { id, ... } }` — use `session.id`
- `cardio_log_session`: returns `{ success, session: { id, ... } }` — use `session.id`

### Mobile direct-write locations identified
- `workoutStore.ts:endSession()` L136 — session UUID in `currentSession.id`
- `HabitsDashboardScreen.tsx` — 6 upsert callsites (L403, L425, L447, L468, L510, L528)
- `LogMealScreen.tsx` L102 — insert returning `id`
- `MeasurementsLog.tsx` L53 — insert returning `id`
- `StretchingSession.tsx` L55 — insert returning `id`
- `CardioTracker.tsx` L197 — insert returning `id`

### POST /credits/earn endpoint
- Does not yet exist in `credits.ts` — must be created in this phase
- `creditService.earnCredits()` is already implemented and ready to call
