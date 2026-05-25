# Phase 36: Workout Stack Redesign - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign all workout screens **except the active session** (`session.tsx` is EXCLUDED) to match the canonical mockup files. Design and real data wiring done together per screen. Each screen ships both visual redesign AND data connection.

**In scope:** Séance tab (index.tsx), ProgramDetail (inline in Séance tab), AIGenerator (ai-generate.tsx), ExerciseDetail (new route), ExercisePicker (new modal), HistoryDetail (new route), WorkoutSummary (summary.tsx), RestTimer (new component), workout/history.tsx list view.

**Out of scope:** session.tsx (active workout — EXCLUDED), workout/[id].tsx (program editor — left as-is), workout/program-builder.tsx (untouched).

</domain>

<decisions>
## Implementation Decisions

### RestTimer (WORK-08)

- **D-01:** Extract RestTimer as a **standalone component**: `apps/mobile/src/components/RestTimer.tsx`. Full visual redesign happens there (dark overlay, SVG countdown ring r=110, M:SS countdown, −30s/Pause/+30s controls, pulse animation ≤5s, "Reprendre maintenant" CTA).
- **D-02:** `session.tsx` gets exactly **1 import line + 1 JSX mount point** added. Zero logic changes to session.tsx — trigger logic (when to show/hide RestTimer) already exists there and stays untouched.

### Séance Tab Structure (WORK-01, WORK-02)

- **D-03:** ProgramDetail stays **inline in index.tsx** — no separate navigable screen. The Séance tab IS the program detail view: dark hero + gradient progress bar + 2 tabs (Semaine type / N semaines plan) + weekly schedule, all rendered directly in index.tsx.
- **D-04:** Empty state CTA ("Créer un programme") navigates **directly to AIGenerator**: `router.push('/(app)/workout/ai-generate')`. No intermediate program-type selection screen.

### AIGenerator Wizard (WORK-03)

- **D-05:** Align wizard **exactly to WORK-03**: 4 zone options (haut/bas/full/**cardio** — current code is missing "cardio") + 4 equipment options (align to mockup `workout-program-ai.jsx`). Current 3-option wizard is outdated.
- **D-06:** Loading animation (between wizard completion and generated session): **MotiView-based sparkle/pulse in orange** (`#FF5C1A`). MotiView is already in the codebase (session.tsx uses it) — no new deps.

### Routing — New Screens (WORK-04, WORK-05, WORK-06)

- **D-07:** ExerciseDetail and HistoryDetail **do not currently exist** as standalone routes. Create:
  - `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` → ExerciseDetail (WORK-05)
  - `apps/mobile/app/(app)/workout/session/[sessionId].tsx` → HistoryDetail (WORK-04)
- **D-08:** `workout/[id].tsx` (program editor) is **left as-is** — out of Phase 36 scope.
- **D-09:** ExercisePicker (WORK-06) is accessible **from ExerciseDetail only** in Phase 36. Create as a Modal component; session.tsx will adopt it in a later pass.

### WorkoutSummary (WORK-07)

- **D-10:** HR sparkline = **estimated curve based on workout intensity** (sets/volume/duration). No real wearable data queried. Visual polish only — not real-time accuracy.
- **D-11:** PR definition = **max weight for any rep count** (uses existing `workoutStore.isNewPR`). No changes to PR detection logic.
- **D-12:** "Partager" CTA = **React Native `Share` API with text summary** (session name, duration, volume, PRs). No image generation, no new deps.
- **D-13:** `summary.tsx` is **fully redesigned** to match `workout-rest-summary.jsx` mockup. Data source (`workoutStore.lastCompletedSession`) stays unchanged — only the visual layer is rebuilt.

### Claude's Discretion

- Exact layout of ExercisePicker filter chips (muscle groups) — follow `workout-detail-picker.jsx` mockup
- `WSHeader` (WORK-09) dark vs light variant — use existing PluginHeader DS component with dark/light prop
- WORK-10 fixture purge scope — `SESSION_DATA`, `PROGRAM_DETAIL`, `HISTORY_DETAIL`, `SUMMARY_DATA` from `workout-data.jsx` → replace with TanStack Query hooks per screen

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mockup Files (source of truth for visual design)
- `C:/Users/Anatholy/Downloads/ziko/workout-program-ai.jsx` — ProgramDetail + AIGenerator wizard (Séance tab, plan 36-01 + 36-02)
- `C:/Users/Anatholy/Downloads/ziko/workout-detail-picker.jsx` — ExerciseDetail + ExercisePicker modal (plans 36-03)
- `C:/Users/Anatholy/Downloads/ziko/workout-rest-summary.jsx` — RestTimer overlay + WorkoutSummary (plans 36-04 + 36-05)
- `C:/Users/Anatholy/Downloads/ziko/workout-data.jsx` — `SESSION_DATA`, `PROGRAM_DETAIL`, `HISTORY_DETAIL`, `SUMMARY_DATA` fixtures (to be replaced in WORK-10)

### Requirements
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §WORK — WORK-01 through WORK-10 (10 requirements for this phase)
- `.planning/workstreams/milestone-mobile/ROADMAP.md` §Phase 36 — success criteria + 6 plan breakdown

### Existing Screens (to redesign or reference)
- `apps/mobile/app/(app)/workout/index.tsx` — Séance tab (full redesign)
- `apps/mobile/app/(app)/workout/ai-generate.tsx` — AIGenerator wizard (full redesign)
- `apps/mobile/app/(app)/workout/summary.tsx` — WorkoutSummary (full redesign)
- `apps/mobile/app/(app)/workout/history.tsx` — Session history list (redesign; item tap → new HistoryDetail route)
- `apps/mobile/app/(app)/workout/session.tsx` — EXCLUDED (add 1 RestTimer import only)
- `apps/mobile/app/(app)/workout/[id].tsx` — Program editor (DO NOT TOUCH)

### Stores & Data
- `apps/mobile/src/stores/workoutStore.ts` — `lastCompletedSession`, `recentSessions`, `isNewPR`, `saveSessionNotes` — data source for Summary + History
- Supabase tables: `ai_generated_programs` (program_data JSONB), `workout_sessions`, `session_sets`, `exercises`

### Design System (Phase 32, all built)
- `packages/ui/src/` — `AISuggestion`, `SubTabs`, `PluginHeader`, `WeekStrip`, `FormRing` components
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §DS — DS-01 design tokens (`primary #FF5C1A`, `bg #F7F6F3`, `surface #FFFFFF`, `border #E2E0DA`, `text #1C1A17`, `muted #6B6963`, `shadow { opacity: 0.08, radius: 12, elevation: 3 }`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/ui/`: `SubTabs`, `AISuggestion`, `PluginHeader`, `WeekStrip` — use on every screen; fully built in Phase 32
- `MotiView` from `moti` — already imported in session.tsx; use for AIGenerator loading animation
- `workoutStore.lastCompletedSession` — in-memory session data powering WorkoutSummary (no extra query needed)
- `workoutStore.recentSessions` + `loadRecentSessions(90)` — powers history.tsx session list
- `React Native Share` — built-in; no new dep for "Partager" CTA
- `playSound`, `playCountdownBeep` from `apps/mobile/src/lib/sounds` — RestTimer can use countdown beep at ≤5s

### Established Patterns
- **NativeWind v4** for all styling — no StyleSheet. Inline style objects or className strings
- **TanStack Query** for all Supabase data fetching — `useQuery` / `useMutation` pattern from Phases 33–35
- **`showAlert`** from `@ziko/plugin-sdk` (not `Alert.alert`) — required in all workout screens
- **`paddingBottom: 100`** on all ScrollViews for tab bar clearance
- **Design tokens** via `useThemeStore((s) => s.theme)` — `theme.primary`, `theme.background`, `theme.surface`, `theme.text`, `theme.muted`, `theme.border`
- **Dark variant** for workout context: hero cards use `theme.text` as background (`#1C1A17`) with white text

### Integration Points
- `session.tsx` ← RestTimer: add `import RestTimer from '../../../src/components/RestTimer'` + mount `<RestTimer ... />` where the current rest overlay renders
- `history.tsx` → `workout/session/[sessionId].tsx`: item tap navigates with session ID
- `index.tsx` → `workout/exercise/[exerciseId].tsx`: exercise row taps in ProgramDetail navigate to ExerciseDetail
- `ai-generate.tsx` → `POST /ai/tools/execute` with `ai_programs_generate` tool (existing Hono route)
- New routes must be added to `app/(app)/workout/` directory — Expo Router auto-discovers

</code_context>

<specifics>
## Specific Ideas

- **RestTimer overlay:** dark gradient background `#1C1A17 → #2A211B`, z-index 80, SVG ring r=110, pulse animation when ≤5s remain (from mockup CSS: `ringPulse .8s ease infinite`)
- **AIGenerator loading:** orange sparkle MotiView pulse animation (no Lottie — use MotiView scale + opacity)
- **WorkoutSummary hero:** dark card (`theme.text` bg = `#1C1A17`), orange radial glow orb (top-right, `blur(50px)`), "Highlight" label + insight text, 4-up stat grid (durée / volume / séries / FC moy.)
- **WorkoutSummary PRs:** orange trophy card with gradient background `color-mix(primary 8%, card-bg)` + orange shadow on trophy icon
- **Séance tab empty state:** minimal — session name placeholder card with "Aucun programme actif" + orange "Créer un programme" button navigating directly to AIGenerator

</specifics>

<deferred>
## Deferred Ideas

- Image generation for "Partager" (ShareCard as image) — deferred, not in Phase 36; text-only share is sufficient for v1.7
- ExercisePicker adoption in session.tsx — deferred; session.tsx is excluded from Phase 36; planner notes the hook-up point for a future pass
- `workout/[id].tsx` program editor visual redesign — deferred; not in Phase 36 scope

</deferred>

---

*Phase: 36-workout-stack-redesign*
*Context gathered: 2026-05-25*
