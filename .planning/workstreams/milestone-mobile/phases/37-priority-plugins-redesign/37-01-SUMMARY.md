---
phase: 37-priority-plugins-redesign
plan: 37-01
subsystem: ui
tags: [react-native, expo, tanstack-query, react-native-svg, nutrition, plugin-redesign, subtabs, aisuggestion]

requires:
  - phase: 36-workout-redesign
    provides: single-entrypoint pattern (ExerciseDetail, ProgramDetail), SubTabs/AISuggestion/PluginHeader components

provides:
  - SubTabs component: pill/capsule style (rgba container, white active tab, shadow), same props API
  - AISuggestion component: "COACH IA · SUGGESTION" label above tip text
  - NutritionPlugin.tsx: 4-tab single-entrypoint (Aujourd'hui/Ajouter/Historique/Réglages) with real TanStack Query data
  - Route wrapper updated to load NutritionPlugin
  - NutritionDashboard.tsx deleted

affects: [37-02, 37-03, 37-04, 37-05, 37-06, 37-07]

tech-stack:
  added: []
  patterns:
    - "Single-entrypoint plugin: one file, internal useState<string> tab, conditional render per tab"
    - "SVG calorie ring: react-native-svg Svg/Circle, strokeDasharray = progress * circumference"
    - "Macro bars: View with dynamic width percentage, 3 colors (orange/blue/amber)"
    - "PLUG-N-06 AISuggestion rule: protein_g < 0.30 * protein_goal_g => boost tip"
    - "Delete-after-verify: grep imports before rm to prevent broken builds"

key-files:
  created:
    - plugins/nutrition/src/screens/NutritionPlugin.tsx
  modified:
    - packages/ui/src/components/SubTabs.tsx (already in target state — no change needed)
    - packages/ui/src/components/AISuggestion.tsx (already in target state — no change needed)
    - apps/mobile/app/(app)/(plugins)/nutrition/dashboard.tsx
    - plugins/nutrition/src/index.ts
  deleted:
    - plugins/nutrition/src/screens/NutritionDashboard.tsx

key-decisions:
  - "SubTabs and AISuggestion were already in their target state (pill style + COACH IA label) — no Task 1 changes needed"
  - "NutritionPlugin uses calorie stepper buttons (−100/−50/+50/+100) instead of @react-native-community/slider — avoids native dependency and achieves same UX"
  - "Récents list built from todayLogs deduplicated inline (no extra Supabase query for recent history)"
  - "Goals derived from user_profiles.goal field (fat_loss/muscle_gain/maintenance) with sensible default fallbacks"

patterns-established:
  - "Pattern: Tab content as inline render functions (renderTodayTab, renderAddTab...) inside main component"
  - "Pattern: CARD_STYLE const for consistent card shadow/border across all sections"
  - "Pattern: protein rule check — proteinPct < 0.30 => personalized tip, else encouragement"

requirements-completed: [PLUG-N-01, PLUG-N-02, PLUG-N-03, PLUG-N-04, PLUG-N-05, PLUG-N-06, PLUG-N-07]

duration: 25min
completed: 2026-05-26
---

# Phase 37 Plan 01: NutritionPlugin Redesign Summary

**4-tab Nutrition plugin entrypoint with SVG calorie ring, macro bars, TanStack Query data wiring, protein AISuggestion rule (PLUG-N-06), and old NutritionDashboard deleted**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-26
- **Completed:** 2026-05-26
- **Tasks:** 3
- **Files modified:** 5 (created 1, modified 2, deleted 1, no-op 2)

## Accomplishments

- NutritionPlugin.tsx: 765-line single-entrypoint with 4 SubTabs (Aujourd'hui / Ajouter / Historique / Réglages)
- SVG calorie ring (react-native-svg Svg/Circle, r=38, strokeDasharray computed from consumed/target ratio)
- Protein AISuggestion rule PLUG-N-06: protein_g < 30% target => personalized boost tip, else encouragement
- Route wrapper and barrel updated; NutritionDashboard.tsx deleted with zero remaining imports

## Task Commits

1. **Task 1: Patch SubTabs (pill style) and AISuggestion (label)** — No commit (both components already in target state)
2. **Task 2: Build NutritionPlugin.tsx** — `5b49c9b` (feat)
3. **Task 3: Wire route wrapper + barrel, delete old dashboard** — `53602d5` (feat)

## Files Created/Modified

- `plugins/nutrition/src/screens/NutritionPlugin.tsx` — New single-entrypoint: 4 SubTabs, SVG ring, macro bars, 4 meal cards, Ajouter/Historique/Réglages tabs
- `apps/mobile/app/(app)/(plugins)/nutrition/dashboard.tsx` — Updated import: NutritionPlugin replaces NutritionDashboard
- `plugins/nutrition/src/index.ts` — Updated barrel export: NutritionPlugin replaces NutritionDashboard
- `plugins/nutrition/src/screens/NutritionDashboard.tsx` — Deleted (340 lines removed)

## Decisions Made

- SubTabs pill style and AISuggestion "COACH IA · SUGGESTION" label were already present in the codebase — Task 1 required no changes. This is correct (prior work exists).
- Used calorie stepper buttons (±50/±100) instead of `@react-native-community/slider` to avoid native module dependency. Equivalent UX with range 1200–4000 kcal enforced client-side.
- Récents list sourced from `todayLogs` deduplicated by `food_name` (last 5 unique). Avoids an extra query while the history query already provides this data.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as specified, with one pre-existing condition:

**Note: Task 1 was a no-op.** Both `SubTabs.tsx` and `AISuggestion.tsx` were already in their target state (pill container style + "COACH IA · SUGGESTION" label). The prior session or another plan had already applied these changes. Verified by reading both files before execution.

**1. [Rule 1 - Deviation] Slider replaced by stepper buttons in Réglages tab**
- **Found during:** Task 2 (NutritionPlugin build)
- **Issue:** `@react-native-community/slider` import would require native module verification; existing implementation used stepper buttons instead
- **Fix:** Kept stepper pattern (−100/−50/+50/+100 buttons), enforced min=1200/max=4000 clamping, same data save logic
- **Files modified:** `plugins/nutrition/src/screens/NutritionPlugin.tsx`
- **Verification:** Calorie value clamped to [1200, 4000]; persisted to `user_profiles.settings.calorie_target`
- **Committed in:** `5b49c9b`

---

**Total deviations:** 1 (stepper instead of slider — equivalent UX)
**Impact on plan:** No functional loss. Stepper is simpler and avoids native dependency risk.

## Issues Encountered

None — TypeScript check returned 0 errors. All verification checks passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SubTabs pill style and AISuggestion label are confirmed present — plans 37-02 through 37-06 can import both components immediately
- NutritionPlugin pattern (single-entrypoint + CARD_STYLE + render functions per tab) is the reference implementation for all subsequent plugins
- Route wrapper and barrel correctly export NutritionPlugin — mobile app will render the redesigned screen on next launch

---
*Phase: 37-priority-plugins-redesign*
*Completed: 2026-05-26*
