---
gsd_state_version: 1.0
milestone: v1.12
milestone_name: DA Coach
status: complete
last_updated: "2026-05-27"
last_activity: 2026-05-27
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 9
  completed_plans: 9
  percent: 100
---

# Project State

## Project Reference

**Milestone:** v1.12 DA Coach — ✅ SHIPPED 2026-05-27
**Core value:** Coach defines DA (color, logo, tone) — linked athletes see it automatically on next refresh. Pro 29 EUR/month differentiator.
**Current focus:** Milestone complete. Run `/gsd:new-milestone` to plan v1.13.

## Current Position

All 3 phases complete, all 9 plans executed. Milestone archived.

## Accumulated Context

### Decisions

- `coach_branding` table separate from `coach_profiles` (different lifecycle/change rate)
- Logo strategy: public bucket (not signed URLs) — signed URLs expire and break RN image cache
- Theme injection: `setCustomTheme()` in useThemeStore via inline style objects only — no NativeWind class interpolation
- RLS: `is_coach_of(coach_id, auth.uid())` — coach_id first, athlete second (matches migration 035 signature)
- MMKV cache: required to prevent cold-start flash; read synchronously before first render
- `tabBarActive` and `primaryLight` auto-derived from `primary` in `setCustomTheme` — cannot be spoofed by caller
- `clearCoachTheme` delegates to `get().resetTheme()` — single reset path
- `isPro` gate computed server-side in Next.js page.tsx — client receives read-only boolean prop
- Dedicated MMKV instance (`coach-storage`) for branding namespace isolation
- `queryKey: ['coach-link', userId]` shared between `useBrandingBootstrap` and `CoachScreen` for TanStack deduplication
- `user_profiles.id` (not `user_id`) is the PK — branding Pro gate uses `.eq('id', userId)` (pre-existing inconsistency in `creditGate.ts` noted)

### Deferred Items

| Category | Item | Status |
|----------|------|--------|
| feature | Tone injection into Claude system prompt | Deferred to post-v1.12 |
| feature | Configurable secondary color | Deferred — auto-derived from primary in v1.12 |

### Known Issues

- New EAS build required for `react-native-mmkv` JSI native module to work on device
- `creditGate.ts` uses `.eq('user_id', userId)` but `user_profiles` PK is `id` — pre-existing inconsistency, not introduced by this milestone
