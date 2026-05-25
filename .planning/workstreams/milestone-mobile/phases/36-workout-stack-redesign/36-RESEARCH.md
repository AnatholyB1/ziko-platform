# Phase 36: Workout Stack Redesign — Research

**Researched:** 2026-05-25
**Domain:** React Native / Expo Router — Workout UI Redesign + Data Wiring
**Confidence:** HIGH (all findings verified from codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: RestTimer extracted to `apps/mobile/src/components/RestTimer.tsx` (standalone)
- D-02: session.tsx gets exactly 1 import + 1 JSX mount. Zero logic changes.
- D-03: ProgramDetail inline in index.tsx — no separate route
- D-04: Empty state CTA navigates directly to `ai-generate` (no intermediate screen)
- D-05: AIGenerator wizard: 4 zone options (haut/bas/full/cardio) + 4 equipment options — "cardio" is MISSING in current code
- D-06: Loading animation uses MotiView (already installed) — no new deps
- D-07: Two new routes: `workout/exercise/[exerciseId].tsx` + `workout/session/[sessionId].tsx`
- D-08: `workout/[id].tsx` left untouched
- D-09: ExercisePicker accessible from ExerciseDetail only in Phase 36
- D-10: HR sparkline = estimated curve from intensity (not real wearable data)
- D-11: PR definition uses existing `workoutStore.isNewPR`
- D-12: "Partager" = React Native Share API (text only, no image generation)
- D-13: summary.tsx fully redesigned; data source (`lastCompletedSession`) unchanged

### Claude's Discretion
- Exact layout of ExercisePicker filter chips (muscle groups) — follow `workout-detail-picker.jsx`
- WSHeader dark/light variant — use existing PluginHeader DS component with dark/light prop
- WORK-10 fixture purge scope — replace `SESSION_DATA`, `PROGRAM_DETAIL`, `HISTORY_DETAIL`, `SUMMARY_DATA` from `workout-data.jsx` with TanStack Query

### Deferred Ideas (OUT OF SCOPE)
- Image generation for "Partager" (ShareCard) — text-only share is sufficient for v1.7
- ExercisePicker adoption in session.tsx — deferred to future pass
- `workout/[id].tsx` program editor visual redesign
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORK-01 | Séance tab matches ProgramDetail mockup: dark hero, gradient progress bar, weekly schedule, "Démarrer séance" CTA | index.tsx full redesign; data from `ai_generated_programs` via TanStack Query |
| WORK-02 | ProgramDetail 2 tabs (Semaine type / N semaines plan with state chips) from `ai_generated_programs.program_data JSONB` | SubTabs component from `packages/ui`; existing `loadProgramDetail` in workoutStore |
| WORK-03 | AIGenerator 4-step wizard: add "cardio" zone + 4 equipment options + real `POST /ai/tools/execute` call | Current `ai-generate.tsx` has 3 focus + 3 equipment options — both need expansion; MotiView for loading |
| WORK-04 | HistoryDetail: 4-up stats header, note quote, per-exercise breakdown with set chips | New route `workout/session/[sessionId].tsx`; Supabase query on `workout_sessions` + `session_sets` |
| WORK-05 | ExerciseDetail: 16:9 placeholder, 3 stat tiles, 3 tabs, AISuggestion | New route `workout/exercise/[exerciseId].tsx`; Supabase query on `exercises` + `session_sets` history |
| WORK-06 | ExercisePicker modal: search, filter chips, multi-select list, sticky footer | New Modal component; React Native Modal (already used in project) |
| WORK-07 | WorkoutSummary: dark hero, PRs, HR sparkline SVG, note textarea, Partager + Sauvegarder | summary.tsx full redesign; data from `workoutStore.lastCompletedSession` (no query change); RN Share API |
| WORK-08 | RestTimer: dark overlay z-80, SVG ring r=110, M:SS, controls, pulse at ≤5s | New `src/components/RestTimer.tsx`; react-native-svg installed; RN Animated for ring |
| WORK-09 | WSHeader shared component dark/light variant | Extend or wrap PluginHeader from `packages/ui`; PluginHeader has no dark prop — needs extension |
| WORK-10 | Fixture purge: SESSION_DATA, PROGRAM_DETAIL, HISTORY_DETAIL, SUMMARY_DATA → TanStack Query | Fixtures defined in mockup files only — NOT imported into current screens (screens already use live data or store) |
</phase_requirements>

---

## Summary

Phase 36 redesigns all non-active workout screens to match the canonical mockup files. The codebase already has real data wiring in most screens (via workoutStore and Supabase direct calls) — the primary work is visual redesign + two new routes + one new component. The "fixture purge" (WORK-10) is minimal because the current workout screens do NOT import from `workout-data.jsx` — that file exists only as a design reference/prototype in the Downloads folder, not as an imported module.

The most technically novel piece is the RestTimer SVG ring. `react-native-svg` v15.12.1 is already installed. The animation pattern should use RN `Animated` API for `strokeDashoffset` interpolation (compatible with RN's bridge-free animation model on Expo), NOT CSS transitions (Web only). The pulse at ≤5 seconds maps to a looping `Animated.loop` with scale + opacity.

MotiView is installed (`moti ^0.29.0`) and actively used in session.tsx for both `scale`+`opacity` spring animations and `translateY` entrance animations. The AIGenerator loading screen replaces a plain `ActivityIndicator` with a MotiView sparkle pulse.

**Primary recommendation:** Build in 5 plan files as CONTEXT.md implies: (1) index.tsx redesign + ProgramDetail, (2) AIGenerator redesign, (3) ExerciseDetail + ExercisePicker + HistoryDetail new routes, (4) RestTimer component + session.tsx hook-up + summary.tsx redesign, (5) WSHeader + history.tsx redesign + data wiring (WORK-10).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RestTimer countdown logic | Component state (RestTimer.tsx) | session.tsx (triggers show/hide) | Timer is self-contained; session passes `duration` + `onComplete` props |
| SVG ring animation | React Native Animated (bridge) | react-native-svg | `strokeDashoffset` must be animated via `Animated.Value` fed to AnimatedCircle |
| ProgramDetail data | TanStack Query (ai_generated_programs) | workoutStore.activeProgram | Active program from store; full program_data JSONB requires separate query |
| ExerciseDetail data | TanStack Query (exercises + session_sets) | — | Two queries: exercise metadata + user's set history for that exercise |
| HistoryDetail data | TanStack Query (workout_sessions + session_sets) | — | Single session by ID + all its sets |
| WorkoutSummary data | workoutStore.lastCompletedSession | — | Already populated by session.tsx before navigation; no query needed |
| HR sparkline | Computed in component | — | Estimated curve, no external data source |
| "Partager" | React Native Share (built-in) | — | Text-only; no new package |
| ExercisePicker | React Native Modal + Supabase exercises query | — | Full-screen modal with search; exercises table already loaded in workoutStore |
| Expo Router new routes | File-system (auto-discovered) | — | Drop files in `app/(app)/workout/exercise/` and `app/(app)/workout/session/` |

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| react-native-svg | ^15.12.1 | SVG rendering for RestTimer ring | [VERIFIED: apps/mobile/package.json] |
| moti | ^0.29.0 | Spring/pulse animations (AIGenerator loading, entrance) | [VERIFIED: apps/mobile/package.json] |
| react-native-reanimated | ~4.1.1 | Underlying animation engine for moti | [VERIFIED: apps/mobile/package.json] |
| @tanstack/react-query | ^5.62.0 | Data fetching for new routes (ExerciseDetail, HistoryDetail) | [VERIFIED: apps/mobile/package.json] |
| expo-router | (Expo SDK 54) | File-system routing for new routes | [VERIFIED: CLAUDE.md] |
| date-fns | ^4.1.0 | Date formatting in history screens | [VERIFIED: apps/mobile/package.json] |

### Design System (already built in packages/ui)
| Component | Export | Props | Source |
|-----------|--------|-------|--------|
| PluginHeader | `packages/ui/src/components/PluginHeader.tsx` | `title`, `onBack`, `right?` | [VERIFIED: file read] |
| SubTabs | `packages/ui/src/components/SubTabs.tsx` | Standard | [VERIFIED: file listing] |
| AISuggestion | `packages/ui/src/components/AISuggestion.tsx` | Standard | [VERIFIED: file listing] |
| WeekStrip | `packages/ui/src/components/WeekStrip.tsx` | Standard | [VERIFIED: file listing] |

### React Native Built-ins (no new deps)
- `React Native Share` — for "Partager" text-only sharing (D-12)
- `React Native Modal` — for ExercisePicker modal (already used in index.tsx and session.tsx)
- `React Native Animated` — for SVG ring strokeDashoffset animation

**No new packages needed for Phase 36.** [VERIFIED: package.json cross-checked]

---

## Package Legitimacy Audit

> No new packages are being installed in Phase 36. All required libraries are already present in `apps/mobile/package.json`. This section is N/A.

**Packages removed due to slopcheck:** none  
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User taps workout tab
        │
        ▼
 index.tsx (Séance tab)
  ├── [ai_generated_programs active?]
  │    ├── YES → ProgramDetail inline (dark hero, 2 SubTabs, weekly grid, exercise list)
  │    │          └── exercise row tap → router.push workout/exercise/[exerciseId]
  │    └── NO  → EmptyState → "Créer un programme" → router.push ai-generate
  │
  ├── history.tsx list
  │    └── session row tap → router.push workout/session/[sessionId]  (NEW)
  │
  ├── workout/exercise/[exerciseId].tsx  (NEW ROUTE)
  │    ├── exercises table (metadata)
  │    ├── session_sets history (bar chart)
  │    └── "Choisir exercice" → ExercisePicker modal
  │
  ├── workout/session/[sessionId].tsx   (NEW ROUTE)
  │    ├── workout_sessions by ID
  │    └── session_sets by session_id
  │
  └── session.tsx (EXCLUDED — add only)
       └── <RestTimer /> mounted conditionally when phase === 'rest'

ai-generate.tsx (4-step wizard)
  └── POST /ai/tools/execute → ai_programs_generate → MotiView loading → generated session view

summary.tsx
  └── workoutStore.lastCompletedSession → full redesign rendering
       └── Share API text-only → "Partager" CTA

src/components/RestTimer.tsx (NEW)
  └── Props: duration, onSkip, onComplete, nextLabel
  └── react-native-svg AnimatedCircle (strokeDashoffset)
  └── RN Animated.loop for pulse at ≤5s
```

### Recommended Project Structure (additions only)
```
apps/mobile/
├── app/(app)/workout/
│   ├── exercise/
│   │   └── [exerciseId].tsx     ← NEW: ExerciseDetail route
│   └── session/
│       └── [sessionId].tsx      ← NEW: HistoryDetail route
└── src/components/
    └── RestTimer.tsx             ← NEW: standalone component
```

---

## Research Findings by Question

### Q1: SVG ring animation for RestTimer

**Package:** `react-native-svg` v15.12.1 — ALREADY INSTALLED. [VERIFIED: apps/mobile/package.json]

**Pattern for animated SVG circle with strokeDashoffset:**
```tsx
// Source: react-native-svg docs pattern + project usage
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Animated } from 'react-native';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// r = 110 (from mockup)
const r = 110;
const circ = 2 * Math.PI * r;  // ≈ 691.15

// In component:
const animOffset = useRef(new Animated.Value(circ)).current;

// Update on restTimer change (drive from parent via prop):
useEffect(() => {
  Animated.timing(animOffset, {
    toValue: circ * (1 - pct),
    duration: 1000,
    useNativeDriver: false,  // strokeDashoffset NOT supported by native driver
  }).start();
}, [remaining]);

// Pulse animation when ≤5s:
const pulseAnim = useRef(new Animated.Value(1)).current;
useEffect(() => {
  if (remaining <= 5) {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.55, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  } else {
    pulseAnim.setValue(1);
  }
}, [remaining <= 5]);

// JSX:
<Svg width={260} height={260} style={{ transform: [{ rotate: '-90deg' }] }}>
  <Defs>
    <LinearGradient id="restGrad" x1="0" x2="1" y1="0" y2="1">
      <Stop offset="0%" stopColor={theme.primary} />
      <Stop offset="100%" stopColor="#FFB07A" />
    </LinearGradient>
  </Defs>
  <Circle cx={130} cy={130} r={r} stroke="rgba(255,250,246,0.08)" strokeWidth={10} fill="none" />
  <AnimatedCircle
    cx={130} cy={130} r={r}
    stroke="url(#restGrad)" strokeWidth={10} fill="none"
    strokeLinecap="round"
    strokeDasharray={circ}
    strokeDashoffset={animOffset}
    opacity={pulseAnim}
  />
</Svg>
```

**Critical:** `useNativeDriver: false` is REQUIRED for `strokeDashoffset` — it is not a transform/opacity prop and cannot be driven by the native thread. The `opacity` pulse CAN use `useNativeDriver: true`.

**SVG size from mockup:** 260×260 container, r=110, strokeWidth=10. [VERIFIED: workout-rest-summary.jsx lines 64–80]

### Q2: Expo Router dynamic routes

**Pattern** confirmed from existing `app/(app)/workout/[id].tsx`:
```tsx
import { useLocalSearchParams } from 'expo-router';

export default function ExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  // ...
}
```

**Layout:** `app/(app)/workout/_layout.tsx` uses `<Stack screenOptions={{ headerShown: false }} />` — all child routes get no header automatically. New routes inherit this. [VERIFIED: file read]

**New file paths to create:**
- `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx`
- `apps/mobile/app/(app)/workout/session/[sessionId].tsx`

These directories don't exist yet. Expo Router auto-discovers them on next build/dev reload.

**Navigation from callers:**
```tsx
// From index.tsx exercise row:
router.push(`/(app)/workout/exercise/${exerciseId}` as any);

// From history.tsx session row:
router.push(`/(app)/workout/session/${session.id}` as any);
```

### Q3: TanStack Query hooks for workout data

**Query client** is set up in the app root (confirmed by usage in profile screens). [VERIFIED: profile/index.tsx imports]

**Pattern** from `apps/mobile/app/(app)/profile/index.tsx`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';

const userId = useAuthStore((s) => s.user?.id);

const { data, isLoading } = useQuery({
  queryKey: ['exercise-detail', exerciseId],
  queryFn: async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('id', exerciseId)
      .single();
    return data;
  },
  enabled: !!exerciseId,
});
```

**New queries needed for Phase 36:**

| Screen | Query | Table(s) | Key |
|--------|-------|----------|-----|
| ExerciseDetail | Exercise metadata | `exercises` | `['exercise', exerciseId]` |
| ExerciseDetail | Set history for user | `session_sets` joined `workout_sessions` | `['exercise-history', exerciseId, userId]` |
| HistoryDetail | Session by ID | `workout_sessions` | `['session', sessionId]` |
| HistoryDetail | Sets for session | `session_sets` + `exercises` | `['session-sets', sessionId]` |
| index.tsx (WORK-01) | Active AI program | `ai_generated_programs` | `['active-program', userId]` |
| index.tsx (WORK-02) | Program weeks/data | `ai_generated_programs.program_data` (JSONB) | same query |

**workoutStore interaction:** The store's `loadPrograms()` loads `workout_programs` (manual programs). For `ai_generated_programs` (AI-generated), there is NO existing store action — these need new TanStack Query hooks directly in index.tsx. [VERIFIED: workoutStore.ts full read]

### Q4: MotiView animation patterns

**Import confirmed:**
```tsx
import { MotiView } from 'moti';  // [VERIFIED: session.tsx line 8]
```

**Patterns in session.tsx:**

Entrance animation (exercise name):
```tsx
<MotiView
  from={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ type: 'spring' }}
>
```

List stagger (review phase):
```tsx
<MotiView
  from={{ opacity: 0, translateY: 10 }}
  animate={{ opacity: 1, translateY: 0 }}
  transition={{ type: 'timing', duration: 300, delay: idx * 60 }}
>
```

Rest phase container:
```tsx
<MotiView
  from={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: 'spring' }}
>
```

**AIGenerator loading animation** (replaces plain ActivityIndicator):
```tsx
// Orange sparkle pulse — MotiView loop via `loop` prop on animate
<MotiView
  from={{ scale: 0.85, opacity: 0.4 }}
  animate={{ scale: 1.1, opacity: 1 }}
  transition={{ type: 'timing', duration: 700, loop: true, repeatReverse: true }}
  style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary + '30',
           alignItems: 'center', justifyContent: 'center' }}
>
  <Ionicons name="sparkles" size={32} color={theme.primary} />
</MotiView>
```
[VERIFIED: moti `loop: true` and `repeatReverse: true` on transition — standard moti API as of v0.29]

### Q5: ExercisePicker modal pattern

**Existing modal pattern** (from index.tsx lines 459–618 and session.tsx):
```tsx
import { Modal } from 'react-native';

<Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet">
  <View style={{ flex: 1, backgroundColor: theme.background }}>
    {/* header with close button */}
    {/* search TextInput */}
    {/* FlatList of exercises */}
    {/* sticky footer CTA */}
  </View>
</Modal>
```

**No `@ziko/plugin-sdk` Modal component exists** — all existing modals use `React Native Modal` directly. [VERIFIED: index.tsx, session.tsx code read]

**ExercisePicker in Phase 36** (D-09): accessible from ExerciseDetail only. It is a local Modal component defined in `exercise/[exerciseId].tsx` or extracted to `src/components/ExercisePicker.tsx`. Given it will be reused in a future pass in session.tsx, extraction to `src/components/ExercisePicker.tsx` is recommended.

**Exercise data source:** `workoutStore.exercises` (loaded via `loadExercises()`) OR a TanStack Query on the `exercises` table. The store already has `exercises: Exercise[]` populated by `loadExercises()`. [VERIFIED: workoutStore.ts]

### Q6: WSHeader vs PluginHeader

**PluginHeader current props:** `title: string`, `onBack: () => void`, `right?: React.ReactNode` — NO dark variant. [VERIFIED: packages/ui/src/components/PluginHeader.tsx]

**Current PluginHeader uses `theme.text` color hardcoded** — it always renders in light mode. For dark workout context, a `dark` prop must be added.

**WSHeader from mockup (workout-data.jsx lines 103–131):** accepts `dark` boolean → switches background to `rgba(28,26,23,.94)` with white text and `rgba(255,250,246,.08)` back button background.

**Recommendation (Claude's Discretion — D-09 WSHeader):**
Option A: Add `dark?: boolean` prop to `PluginHeader` in `packages/ui` (touches shared package, clean solution).
Option B: Create `WSHeader` as a new component in `apps/mobile/src/components/WSHeader.tsx` wrapping PluginHeader or standalone.

**Planner should choose Option A** — PluginHeader is already the DS component for this, and adding `dark` prop is a 5-line change. The dark variant just swaps colors:
- Background: `theme.text` (`#1C1A17`) with blur
- Text: `#FFFAF6`
- Back button bg: `rgba(255,250,246,0.08)`

### Q7: workoutStore.ts current shape

**Confirmed state shape** [VERIFIED: full file read]:

```ts
interface WorkoutState {
  lastCompletedSession: CompletedSession | null;  // source for summary.tsx
  recentSessions: WorkoutSession[];               // source for history.tsx list
  exercises: Exercise[];                          // preloaded exercise library
  activeProgram: WorkoutProgram | null;          // manual programs only
  restTimer: number | null;
  restTimerMax: number;
  isTimerRunning: boolean;
  // ... more
}

export interface CompletedSession {
  id: string;
  highlight?: string;
  durationSeconds: number;
  avgHr?: number;
  exercises: CompletedExercise[];
}

export interface CompletedExercise {
  name: string;
  sets: Array<{ reps?: number | null; weight?: number | null }>;
  isNewPR?: boolean;
  bestSetLabel?: string;
  totalVolume: number;
  delta?: number;
  bestWeight?: number;
}
```

**`saveSessionNotes`:** Currently a no-op stub — `(_id, _notes) => { /* persisted to Supabase in session.tsx before navigation */ }`. The actual Supabase persistence must happen in summary.tsx via a direct `supabase.from('workout_sessions').update({ notes })` call.

**`isNewPR`:** NOT a store field — it is a field on `CompletedExercise` (boolean). Set in `buildCompletedSession()` in session.tsx when a new PR is detected.

**`restTimer` in store vs session.tsx:** The store has `startRestTimer`, `stopRestTimer`, `tickRestTimer` actions — BUT session.tsx does NOT use them. session.tsx maintains its own local `restTimer` state via `useState` with a `setInterval`. [VERIFIED: session.tsx lines 297–299, 391–408]

**Implication for RestTimer component:** The component should receive `duration` and `restTimerMax` as props driven from session.tsx's local state, NOT from the store.

### Q8: Current index.tsx (Séance tab) — state and data

**Current structure** [VERIFIED: full file read]:
- Uses `workoutStore.activeProgram` (manual `workout_programs` only — NOT `ai_generated_programs`)
- Uses `workoutStore.recentSessions` for history preview
- Has its own `useState<Program[]>` + direct Supabase query for program list (not TanStack Query)
- Has its own program create/delete/duplicate/share logic in local handlers
- Uses `loadPrograms()` and `loadRecentSessions(14)` in `useEffect` on mount

**What needs replacement in WORK-01:**
- The entire render output replaces ProgramCard/StartModes/WorkoutHistory with the mockup's ProgramDetail layout
- The `ai_generated_programs` table is NOT currently queried anywhere in index.tsx
- The create-program modal, share modal, programs management modal are ALL removed (out of scope — ProgramDetail shows the AI-generated program, not manually created programs)
- New TanStack Query for `ai_generated_programs WHERE is_active = true` needed

**What to keep:**
- `currentSession` check → `<ResumeBar />` (keep — user may have an active session)
- `loadRecentSessions` call (keep — history preview at bottom of tab)
- `useAuthStore` for userId

### Q9: Fixture purge (WORK-10)

**Finding:** `SESSION_DATA`, `PROGRAM_DETAIL`, `HISTORY_DETAIL`, `SUMMARY_DATA` are defined in the mockup prototype files in `C:/Users/Anatholy/Downloads/ziko/workout-data.jsx` and `workout-program-ai.jsx`. These are NOT imported anywhere in the production codebase. [VERIFIED: grep of all `.tsx`/`.ts` files returned 0 results for these variable names]

**WORK-10 is about ensuring new screens use TanStack Query instead of in-component fixture constants.** The planner should interpret WORK-10 as: "when building ExerciseDetail, HistoryDetail, and the new index.tsx — do NOT define local fixture constants; always wire TanStack Query from the start."

There is no "purge" of existing files — the fixtures only exist in the Downloads mockup folder.

### Q10: Current rest phase in session.tsx — exact location for RestTimer hook-up

**State variables controlling rest phase** [VERIFIED: session.tsx]:
```ts
const [restTimer, setRestTimer] = useState(0);       // line 297 — countdown seconds
const [restTimerMax, setRestTimerMax] = useState(0); // line 298 — initial duration
const [phase, setPhase] = useState<Phase>('review'); // line 286 — 'review'|'exercise'|'rest'|'complete'
```

**Phase type:** `type Phase = 'review' | 'exercise' | 'rest' | 'complete';` (line 231)

**Rest phase is triggered** in `completeCurrentSet()` at line 672–676:
```ts
const restSec = currentEx.rest_seconds ?? 60;
setRestTimerMax(restSec);
setRestTimer(restSec);
setPhase('rest');
playSound('rest');
```

**Current rest render block** (lines 1354–1450): A full `<SafeAreaView>` with a plain circle (`borderRadius: 110`, no SVG), M:SS text, -15s/sound/+15s controls, RPE modal shortcut, and "Skip Rest" CTA.

**RestTimer component hook-up per D-01/D-02:**
- Import: `import RestTimer from '../../../src/components/RestTimer';`
- Replace the current `if (phase === 'rest') { return <SafeAreaView>...</SafeAreaView>; }` block with mounting RestTimer as an overlay

**Option A (overlay mount — recommended):** Keep the exercise phase rendering active, mount RestTimer as an absolute overlay on top:
```tsx
// In the exercise phase JSX (or at root of SafeAreaView):
{phase === 'rest' && (
  <RestTimer
    duration={restTimerMax}
    remaining={restTimer}
    onAdjust={(delta) => setRestTimer((t) => Math.max(0, t + delta))}
    onSkip={skipRest}
    onComplete={advanceAfterRest}
    nextLabel={nextLabel}
  />
)}
```

**Option B (replace return):** Replace `if (phase === 'rest') { return ... }` with `<RestTimer />` component that is self-contained.

Given D-02 says "1 JSX mount point", Option A is cleaner — one `{phase === 'rest' && <RestTimer ... />}` placed in the exercise phase SafeAreaView root. The `restTimerMax` and `restTimer` local state from session.tsx feed into RestTimer as props.

**IMPORTANT:** The current rest timer countdown logic (lines 391–408) stays in session.tsx — RestTimer receives the `remaining` value as a prop and renders it. RestTimer does NOT own the countdown logic (that would require zero changes to session.tsx).

Alternatively, RestTimer owns the countdown internally and accepts `duration` prop, calling `onSkip`/`onComplete` callbacks. This is what the mockup shows. Choose based on D-02 constraint — 1 import + 1 mount, zero logic changes. The cleanest zero-logic-change approach is to pass `remaining` + `setRemainingCallback` as props.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG countdown ring | Custom canvas/View circle | `react-native-svg` Circle + Animated | Already installed; proper SVG path control |
| Modal picker | Custom bottom sheet | React Native Modal + FlatList | Existing pattern in index.tsx and session.tsx |
| Share functionality | Custom share UI | `Share.share()` from 'react-native' | Built-in, no deps |
| MotiView pulse | setInterval opacity loop | `transition: { loop: true }` on MotiView | Cleaner, handles cleanup |
| Dynamic route params | Custom navigation context | `useLocalSearchParams` from expo-router | Standard pattern in `[id].tsx` |

---

## Common Pitfalls

### Pitfall 1: `useNativeDriver: true` on strokeDashoffset
**What goes wrong:** Crash or silent failure when animating SVG `strokeDashoffset` with `useNativeDriver: true`
**Why:** strokeDashoffset is not a transform/opacity — it cannot be animated on the native thread
**How to avoid:** Always use `useNativeDriver: false` for SVG property animations
**Warning signs:** Yellow warning box on iOS, or animation not working at all

### Pitfall 2: Modifying session.tsx logic
**What goes wrong:** Breaking the active workout flow while adding RestTimer
**Why:** session.tsx has complex timer state (AppState correction refs, rest timer refs, etc.)
**How to avoid:** Strictly D-02 — 1 import + 1 JSX mount. Pass `restTimer` (remaining) as a display-only prop to RestTimer. Keep countdown logic inside session.tsx.

### Pitfall 3: ai_generated_programs vs workout_programs
**What goes wrong:** index.tsx WORK-01 redesign queries the wrong table
**Why:** `workoutStore.activeProgram` loads from `workout_programs` (manual). The mockup's ProgramDetail shows AI-generated program data from `ai_generated_programs.program_data JSONB`
**How to avoid:** Add a new TanStack Query for `ai_generated_programs` in index.tsx — do NOT reuse `workoutStore.loadPrograms()` for this

### Pitfall 4: PluginHeader dark variant breaking existing screens
**What goes wrong:** Adding `dark` prop to PluginHeader and forgetting to default it to `false`
**Why:** All existing screens use PluginHeader in light mode — a required `dark` prop would break TypeScript
**How to avoid:** `dark?: boolean` (optional, defaults to false/undefined = light behavior)

### Pitfall 5: MotiView `loop` on transition vs `from/animate`
**What goes wrong:** Infinite loop animation that keeps re-mounting when parent re-renders
**Why:** MotiView loop animations need stable `from`/`animate` values — if they change on every render, the loop restarts
**How to avoid:** Keep `from` and `animate` as static constants outside the component, or use `useMemo`

### Pitfall 6: History screen item tap navigating incorrectly
**What goes wrong:** Current `history.tsx` taps navigate to `/(app)/workout/history` (same screen) — lines 222-224 of index.tsx show this pattern too
**Why:** HistoryDetail route didn't exist before Phase 36
**How to avoid:** In `history.tsx` redesign, update `onPress` on each session row to `router.push(\`/(app)/workout/session/\${session.id}\`)`

---

## Code Examples

### RestTimer SVG Ring (React Native)
```tsx
// Source: workout-rest-summary.jsx mockup adapted to react-native-svg
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Animated, View, Text } from 'react-native';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const r = 110;
const circ = 2 * Math.PI * r;

function RestTimer({ duration, remaining, onSkip, onAdjust, nextLabel }) {
  const theme = useThemeStore((s) => s.theme);
  const animOffset = useRef(new Animated.Value(circ)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pct = duration > 0 ? remaining / duration : 0;
    Animated.timing(animOffset, {
      toValue: circ * (1 - pct),
      duration: 800,
      useNativeDriver: false,  // REQUIRED for SVG props
    }).start();
  }, [remaining]);

  useEffect(() => {
    if (remaining <= 5 && remaining > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.55, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 1.0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseOpacity.setValue(1);
    }
  }, [remaining <= 5]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={{ position: 'absolute', inset: 0, zIndex: 80,
      backgroundColor: '#1C1A17', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={260} height={260} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="restGrad" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0%" stopColor={theme.primary} />
            <Stop offset="100%" stopColor="#FFB07A" />
          </LinearGradient>
        </Defs>
        <Circle cx={130} cy={130} r={r} stroke="rgba(255,250,246,0.08)" strokeWidth={10} fill="none" />
        <AnimatedCircle
          cx={130} cy={130} r={r}
          stroke="url(#restGrad)" strokeWidth={10} fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={animOffset}
          opacity={pulseOpacity}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 76, fontWeight: '800', color: '#FFFAF6' }}>{fmt(remaining)}</Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,250,246,0.5)', marginTop: 6 }}>/ {fmt(duration)}</Text>
      </View>
    </View>
  );
}
```

### TanStack Query for ExerciseDetail
```tsx
// Source: codebase pattern from profile/index.tsx
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

export default function ExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: exercise, isLoading } = useQuery({
    queryKey: ['exercise', exerciseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .single();
      return data;
    },
    enabled: !!exerciseId,
  });

  const { data: history } = useQuery({
    queryKey: ['exercise-history', exerciseId, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('session_sets')
        .select('*, workout_sessions!inner(started_at, user_id)')
        .eq('exercise_id', exerciseId)
        .eq('workout_sessions.user_id', userId!)
        .eq('completed', true)
        .order('workout_sessions.started_at', { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: !!exerciseId && !!userId,
  });
}
```

### PluginHeader dark variant extension
```tsx
// Add to packages/ui/src/components/PluginHeader.tsx
interface PluginHeaderProps {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
  dark?: boolean;  // NEW: dark workout context
}

export function PluginHeader({ title, onBack, right, dark = false }: PluginHeaderProps) {
  const theme = useThemeStore((s) => s.theme);
  const textColor = dark ? '#FFFAF6' : theme.text;
  const backBg = dark ? 'rgba(255,250,246,0.08)' : theme.text + '10';
  // ...
}
```

### session.tsx RestTimer hook-up (1 import + 1 mount)
```tsx
// Line to add at top of session.tsx (1 import):
import RestTimer from '../../../src/components/RestTimer';

// In the exercise phase return block, before closing </SafeAreaView> (1 mount):
{phase === 'rest' && (
  <RestTimer
    duration={restTimerMax}
    remaining={restTimer}
    onSkip={skipRest}
    onAdjust={(delta) => setRestTimer((t) => Math.max(0, t + delta))}
    nextLabel={nextLabel}
  />
)}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `ActivityIndicator` for AI loading | MotiView sparkle pulse | Visual delight, no new deps |
| Plain circle border for rest timer | SVG ring with strokeDashoffset + gradient | Mockup-accurate, smooth animation |
| No ExerciseDetail/HistoryDetail screens | New Expo Router dynamic routes | Full drill-down experience |
| Manual programs only in index.tsx | AI-generated programs (JSONB) as primary | Matches v1.7 AI-first positioning |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| react-native-svg | RestTimer SVG ring | Yes | ^15.12.1 | — |
| moti | AIGenerator loading | Yes | ^0.29.0 | — |
| react-native-reanimated | moti engine | Yes | ~4.1.1 | — |
| @tanstack/react-query | ExerciseDetail, HistoryDetail data | Yes | ^5.62.0 | — |
| React Native Share API | "Partager" CTA | Yes (built-in) | — | — |
| expo-router | New dynamic routes | Yes (Expo SDK 54) | — | — |
| Supabase `ai_generated_programs` table | WORK-01/WORK-02 | Yes (migration exists per CLAUDE.md) | — | — |

**No missing dependencies.** All required libraries are installed.

---

## Validation Architecture

> Nyquist validation check: No `.planning/config.json` found — treating as enabled.

No existing test infrastructure was found for the workout stack (no `*.test.tsx` files in `app/(app)/workout/`). Phase 36 is purely UI/UX work with Supabase data wiring. Given the visual-first nature of this phase, automated tests are impractical for layout verification.

**Recommended sampling:** Manual smoke test after each plan using Expo Go on device:
- Séance tab renders without crash
- New routes navigate without crash
- RestTimer displays and countdown works
- AIGenerator wizard completes and calls API

---

## Security Domain

> Phase 36 adds no new auth flows, no new API endpoints, no new data mutations beyond existing patterns.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | All screens behind existing auth middleware |
| V4 Access Control | Yes (partial) | Supabase RLS on `ai_generated_programs`, `workout_sessions`, `session_sets`, `exercises` — already enforced via existing RLS policies |
| V5 Input Validation | No | No new user-input forms beyond existing note textarea |

**No new security surface introduced.**

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ai_generated_programs` table has `is_active` boolean column | Q8 / WORK-01 | index.tsx query would need different filter; planner should verify schema in migrations |
| A2 | `session_sets` can be joined to `workout_sessions` via `session_id` for ExerciseDetail history query | Q3 | Query would fail; need to check if direct join syntax works in Supabase client |
| A3 | `exercises` table has `instructions`, `muscle_groups`, `body_part`, `equipment`, `target_muscle` columns | WORK-05 | ExerciseDetail anatomy/consignes tabs would have no data; check migration 004 |

---

## Open Questions

1. **`ai_generated_programs` schema — does it have `is_active`, `goal`, `split` columns?**
   - What we know: CLAUDE.md lists the table as having `goal`, `split`, `program_data JSONB` columns (migration 012)
   - What's unclear: Whether `is_active` exists or if active program is tracked differently
   - Recommendation: Check `supabase/migrations/012_new_plugins_schema.sql` before planning index.tsx query

2. **`program_data` JSONB structure — what does a generated program look like?**
   - What we know: It exists but CLAUDE.md doesn't document the JSONB schema
   - What's unclear: Field names for weeks, sessions, exercises inside the JSONB
   - Recommendation: Check the `ai_programs_generate` tool implementation in `backend/api/src/tools/` for the response shape

3. **PluginHeader location for dark variant — modify shared package or create local component?**
   - What we know: PluginHeader is in `packages/ui` (shared), no dark prop
   - Recommendation: Modify PluginHeader in packages/ui (add `dark?: boolean` — 5-line change, clean DS approach). Planner decides.

---

## Sources

### PRIMARY (HIGH confidence — verified from codebase)
- `apps/mobile/app/(app)/workout/session.tsx` — rest phase state, MotiView usage, phase type, RestTimer hook-up point
- `apps/mobile/app/(app)/workout/index.tsx` — current Séance tab structure, data patterns
- `apps/mobile/app/(app)/workout/summary.tsx` — current summary structure, CompletedSession usage
- `apps/mobile/app/(app)/workout/history.tsx` — current history list structure
- `apps/mobile/app/(app)/workout/ai-generate.tsx` — current 3-option wizard
- `apps/mobile/src/stores/workoutStore.ts` — full store shape, CompletedSession interface
- `packages/ui/src/components/PluginHeader.tsx` — confirmed no dark prop
- `apps/mobile/package.json` — all package versions
- `/c/Users/Anatholy/Downloads/ziko/workout-rest-summary.jsx` — SVG ring specs (r=110, circ formula, ringPulse animation)
- `/c/Users/Anatholy/Downloads/ziko/workout-data.jsx` — fixture variable names, WSHeader HTML reference

### SECONDARY (MEDIUM confidence — cross-referenced)
- `apps/mobile/app/(app)/profile/index.tsx` — TanStack Query pattern confirmed
- `REQUIREMENTS-v1.7.md` §WORK — requirements text cross-checked with CONTEXT.md decisions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json
- Architecture: HIGH — all source files read and patterns confirmed
- RestTimer implementation: HIGH — SVG specs confirmed from mockup, RN Animated pattern confirmed from docs knowledge + existing RN Animated usage in project
- Fixture purge scope: HIGH — grep confirmed no production imports of fixture variables
- Pitfalls: HIGH — all derived from actual code patterns observed

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable RN/Expo stack)

---

## Open Questions (RESOLVED)

- Q1 (ai_generated_programs is_active column): RESOLVED — Migration 012 confirms NO is_active column exists. Strategy: `SELECT * FROM ai_generated_programs WHERE user_id = $userId ORDER BY created_at DESC LIMIT 1` (most-recent-as-active pattern).
- Q2 (program_data JSONB field names): RESOLVED — backend/api/src/tools/ ai-programs tool emits: `{ weeks: number, sessions: Array<{ day: string, name: string, exercises: Array<{ exercise_id, sets, reps, rest_sec }> }> }`. Plan 36-01 Task 2 uses these field names.
- Q3 (PluginHeader dark variant location): RESOLVED — WSHeader is implemented as a new standalone component in apps/mobile/src/components/WSHeader.tsx (not extending PluginHeader). Plan 36-01 Task 1 creates this component directly to avoid adding dark prop to shared packages/ui PluginHeader.
