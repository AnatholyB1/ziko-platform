---
phase: 29-plugin-mon-coach-full-impl
plan: "04"
subsystem: ui
tags: [react-native, expo-router, tanstack-query, settings, plugin-store, i18n, coach]

requires:
  - phase: 29-01
    provides: UserProfile.role type, coach i18n keys including coach.settings_section and store.mandatory_tooltip
  - phase: 29-02
    provides: CoachScreen scaffold, PluginLoader registration, route wrapper at (plugins)/coach/dashboard

provides:
  - MON COACH settings section in profile/settings.tsx, role+link gated, navigates to coach dashboard
  - Long-press tooltip on mandatory plugin trash button in store/[id].tsx

affects: [29-CONTEXT, settings-screen, store-detail-screen, coach-plugin]

tech-stack:
  added: []
  patterns:
    - "useQuery in settings screen for external API fetch with session token"
    - "Conditional STGroup injection between existing STGroups via role + remote data gate"
    - "TouchableOpacity onLongPress for non-destructive informational tooltip on mandatory UI elements"

key-files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx
    - apps/mobile/app/(app)/store/[id].tsx

key-decisions:
  - "Coach link status fetched via GET /coach/clients/links/me with Bearer token — result drives section visibility"
  - "STGroup injected between Préférences and Aide & infos, conditionally rendered (not hidden via opacity)"
  - "Mandatory trash button uses TouchableOpacity with no onPress to preserve non-destructive semantics — only onLongPress triggers tooltip"

patterns-established:
  - "Role-gated UI sections: derive role from profile?.role ?? 'client', gate on (role === 'client' || role === 'both')"
  - "Remote-data-gated sections: also gate on linkedCoachName (null = section absent, not just invisible)"

requirements-completed: [COACH-04, COACH-11]

duration: 8min
completed: 2026-05-20
---

# Phase 29 Plan 04: Mon Coach Integration Points Summary

**Role-gated MON COACH settings section with TanStack Query coach-link fetch, and long-press tooltip on mandatory plugin trash button via TouchableOpacity**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-20T00:00:00Z
- **Completed:** 2026-05-20T00:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- settings.tsx now fetches coach link status from `/coach/clients/links/me` and renders a MON COACH STGroup only when role is client/both AND a linked coach display_name is available
- store/[id].tsx mandatory trash gate upgraded from non-interactive View to TouchableOpacity with onLongPress showing `t('store.mandatory_tooltip')` via showAlert
- Zero new TypeScript errors introduced (pre-existing errors in apps/web and apps/mobile/ai/chat.tsx were pre-existing and out of scope)

## Task Commits

1. **Task 1: Inject MON COACH section into settings.tsx** - `e1911f5` (feat)
2. **Task 2: Upgrade mandatory trash button to TouchableOpacity with long-press tooltip** - `1c73fc8` (feat)

## Files Created/Modified
- `apps/mobile/app/(app)/profile/settings.tsx` - Added useTranslation, useQuery, supabase imports; role derivation; coach link useQuery; conditional MON COACH STGroup injection
- `apps/mobile/app/(app)/store/[id].tsx` - Replaced mandatory View with TouchableOpacity + onLongPress tooltip

## Decisions Made
- Used `profile?.role ?? 'client'` as default so existing users without a role field see the coach section when linked (safe default)
- Section gated on `linkedCoachName` being non-null rather than just on query success — avoids rendering an empty row during loading or when no coach is linked
- `showAlert(t('store.mandatory_tooltip'), '')` passes empty string as message body (the tooltip key contains the full message)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `apps/mobile/app/(app)/ai/chat.tsx` (textAlign on View style) and multiple `apps/web/` files (missing scaffolded modules) were present before this plan and are out of scope per deviation scope boundary rules. They were not introduced by plan 29-04 changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 2 is complete. All 4 plans for Phase 29 are done:
- 29-01: Types, i18n, DB migration
- 29-02: CoachScreen + route scaffold
- 29-03: Backend API routes
- 29-04: Settings injection + store tooltip (this plan)

The Mon Coach plugin is fully implemented end-to-end.

---
*Phase: 29-plugin-mon-coach-full-impl*
*Completed: 2026-05-20*
