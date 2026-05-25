# Phase 36: Workout Stack Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 36-workout-stack-redesign
**Areas discussed:** RestTimer scope, Séance tab structure, AIGenerator wizard alignment, [id].tsx routing, WorkoutSummary

---

## RestTimer Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Extract as standalone component | Create RestTimer.tsx in apps/mobile/src/components/. session.tsx imports and mounts it — one minimal import line. | ✓ |
| Redesign within session.tsx | Treat RestTimer's visual section inside session.tsx as 'in scope' even though session.tsx is otherwise excluded. | |
| Defer RestTimer to a later phase | Skip WORK-08 in Phase 36. | |

**User's choice:** Extract as standalone component

| Option | Description | Selected |
|--------|-------------|----------|
| Import + mount only | 1 import line + 1 JSX mount point in session.tsx. Trigger logic stays untouched. | ✓ |
| Allow trigger wiring too | Planner can also refactor how session.tsx shows/hides RestTimer. | |

**User's choice:** Import + mount only — zero session logic changes

---

## Séance Tab Structure

| Option | Description | Selected |
|--------|-------------|----------|
| All inline in index.tsx | The Séance tab IS the program detail view. No navigation needed. | ✓ |
| ProgramDetail as separate screen | index.tsx shows a summary card; tapping opens a separate ProgramDetail route. | |

**User's choice:** All inline in index.tsx

| Option | Description | Selected |
|--------|-------------|----------|
| Directly to AIGenerator | Empty state CTA → `workout/ai-generate`. | ✓ |
| Program type selection first | Show a choice (AI vs manual) before landing in AIGenerator. | |

**User's choice:** Directly to AIGenerator

---

## AIGenerator Wizard Alignment

| Option | Description | Selected |
|--------|-------------|----------|
| Align exactly to WORK-03 | 4 zone options (haut/bas/full/cardio) + 4 equipment options. Current 3-option wizard is outdated. | ✓ |
| Keep current options | Visual redesign only, no option changes. | |

**User's choice:** Align exactly to WORK-03

| Option | Description | Selected |
|--------|-------------|----------|
| Custom Moti animation | MotiView-based sparkle/pulse in orange. No new deps. | ✓ |
| ActivityIndicator only | Simpler but less visual polish. | |
| You decide | Defer to planner. | |

**User's choice:** Custom Moti animation

---

## [id].tsx Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Create new routes for both | `workout/exercise/[exerciseId].tsx` + `workout/session/[sessionId].tsx`. | ✓ |
| Repurpose [id].tsx for HistoryDetail | Replace program editor with HistoryDetail. | |
| Both as modals | ExerciseDetail and HistoryDetail as Modal overlays. | |

**User's choice:** Create new routes for both
**Notes:** Discovered that workout/[id].tsx is a program editor (not ExerciseDetail/HistoryDetail as assumed). ExerciseDetail and HistoryDetail are new screens.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep [id].tsx as-is — out of scope | Program editor serves different purpose. Phase 36 doesn't touch it. | ✓ |
| Redesign [id].tsx too | Include program editor in Phase 36 scope. | |

**User's choice:** Keep [id].tsx as-is

| Option | Description | Selected |
|--------|-------------|----------|
| ExerciseDetail only — new route context | ExercisePicker is a modal from ExerciseDetail. | ✓ |
| Standalone modal from Séance tab | ExercisePicker accessible via 'Parcourir exercices' CTA. | |
| You decide | Defer to planner. | |

**User's choice:** ExercisePicker accessible from ExerciseDetail only

---

## WorkoutSummary

**Context:** User asked whether current summary.tsx follows the mockup design. Answer: no — current code has the right structure but doesn't match `workout-rest-summary.jsx` design (orange glow orb, trophy card styling, Highlight text, FC moy. stat tile). Full redesign needed in plan 36-04.

| Option | Description | Selected |
|--------|-------------|----------|
| Estimated HR curve — static visualization | Plausible curve based on intensity. No wearable data. | ✓ |
| Skip HR sparkline | Defer to Phase 41. | |
| Real data from wearables | Query wearable_daily_summary matched to workout time window. | |

**User's choice:** Estimated HR curve — static visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Max weight for any rep count | Uses existing workoutStore.isNewPR. | ✓ |
| Max estimated 1RM | Calculate via RPE table and compare historical 1RM. | |
| You decide | Use whatever workoutStore currently implements. | |

**User's choice:** Max weight for any rep count

| Option | Description | Selected |
|--------|-------------|----------|
| Share sheet with summary card image (text) | React Native Share API, text summary only. No image generation. | ✓ |
| Generate shareable image | react-native-view-shot, heavier implementation. | |
| Defer sharing | Placeholder button in Phase 36. | |

**User's choice:** React Native Share API — text summary (session name, duration, volume, PRs)

---

## Claude's Discretion

- `WSHeader` (WORK-09) dark vs light variant — use PluginHeader DS component with dark/light prop
- Exact layout of ExercisePicker filter chips — follow workout-detail-picker.jsx mockup
- WORK-10 fixture purge — `SESSION_DATA`, `PROGRAM_DETAIL`, `HISTORY_DETAIL`, `SUMMARY_DATA` → TanStack Query hooks per screen

## Deferred Ideas

- Image-based "Partager" (ShareCard as styled image) — deferred; text-only share sufficient for v1.7
- ExercisePicker adoption in session.tsx — deferred; session.tsx excluded from Phase 36
- `workout/[id].tsx` program editor visual redesign — deferred; not in Phase 36 scope
