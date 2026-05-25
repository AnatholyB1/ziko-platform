---
phase: 35-profile-settings-redesign
plan: 04
subsystem: ui
tags: [react-native, tanstack-query, supabase, health_sync_log, integrations, settings]

requires:
  - phase: 35-01
    provides: STRow, STGroup, STToggle components in @ziko/ui
  - phase: 35-03
    provides: SettingsScreen rebuilt with STGroup/STRow, NotifSubScreen, AppearanceSubScreen

provides:
  - IntegrationsSubScreen wired to real health_sync_log data via TanStack Query
  - 6 integration cards with correct Ionicons (flash-outline Strava, watch-outline Garmin)
  - Green dot connected indicator derived from live health_sync_log query
  - Mon Coach STGroup with sub="Gérer" and corrected queryKey using userId

affects:
  - phase 41 (Mon Coach full settings redesign — uses same queryKey pattern)
  - wearables plugin (health_sync_log table shared)

tech-stack:
  added: []
  patterns:
    - "TanStack Query ['integrations', userId] reads health_sync_log, deduplicates by platform (latest synced_at wins), returns string[] of connected platform IDs"
    - "isConnected = connectedPlatforms.includes(it.id) — stateless per-card derived state"

key-files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx

key-decisions:
  - "INTEGRATIONS_LIST renamed from INTEGRATIONS to avoid collision — const moved inside module scope, connected field removed (derived from query)"
  - "Info card uses rgba(46,123,246,...) matching UI-SPEC #2E7BF6 (not 59,130,246 that was the old value)"
  - "Coach queryKey corrected to use userId (from useAuthStore) instead of profile?.id for consistency with other queries in the file"
  - "SET-05 Mon Coach section: sub='Gérer' added to STRow per requirement — full coach settings deferred to Phase 41 per UI-SPEC mockup authority note"

requirements-completed: [SET-04, SET-05]

duration: 12min
completed: 2026-05-22
---

# Phase 35 Plan 04: IntegrationsSubScreen Real Data + Mon Coach Summary

**IntegrationsSubScreen wired to health_sync_log via TanStack Query ['integrations', userId] with live green-dot connection state; Mon Coach STRow hardened with sub='Gérer' and corrected queryKey**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-22T08:00:00Z
- **Completed:** 2026-05-22T08:12:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- `IntegrationsSubScreen` now fetches `health_sync_log` via `useQuery({ queryKey: ['integrations', userId] })` — deduplicates by latest `synced_at` per platform
- 6 integration cards with correct Ionicons: `flash-outline` (Strava), `watch-outline` (Garmin) — `bicycle-outline` and `location-outline` eliminated
- Info card corrected to `rgba(46,123,246,0.06)` background / `rgba(46,123,246,0.18)` border, column layout with header row per UI-SPEC
- Mon Coach `useQuery` queryKey fixed: `['coach-link-settings', userId]` (was `profile?.id`); enabled guard uses `!!userId`
- Mon Coach STRow: `sub="Gérer"` added per SET-05 requirement

## Task Commits

1. **Task 1: Wire IntegrationsSubScreen with real health_sync_log data** — `9cb38d9` (feat)
2. **Task 2: Verify and harden Mon Coach section (SET-05)** — `9cb38d9` (feat, same commit)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `apps/mobile/app/(app)/profile/settings.tsx` — IntegrationsSubScreen: TanStack Query + INTEGRATIONS_LIST (no `connected` field) + corrected info card; Mon Coach: queryKey userId + sub="Gérer"

## Decisions Made

- Renamed `INTEGRATIONS` to `INTEGRATIONS_LIST` to make clear it no longer carries the `connected` field (state is derived from query, not hardcoded)
- Info card color corrected from `rgba(59,130,246,...)` (Tailwind blue-500) to `rgba(46,123,246,...)` matching UI-SPEC `#2E7BF6`
- Both tasks committed in a single atomic commit since they touch the same file and have no interdependency risk

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

- `connectedPlatforms` defaults to `[]` until query resolves — all 6 integrations appear as "Connecter" for new users with no `health_sync_log` rows. This is correct behavior, not a stub.
- "Connecter" buttons call `showAlert` with "bientôt disponible" — real OAuth integration is deferred to a future phase. Documented in plan as accepted behavior (T-35-04-02: accept disposition).

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The `health_sync_log` query is guarded by `enabled: !!userId` (T-35-04-01 mitigated) and RLS enforces `auth.uid() = user_id` server-side. No threat flags.

## Next Phase Readiness

Phase 35 is now complete (35-01 through 35-04 all have SUMMARYs). Profile + Settings redesign fully delivered:
- 35-01: STRow, STGroup, STToggle, ProfileHero, PRStatCard components in @ziko/ui
- 35-03: SettingsScreen, NotifSubScreen, AppearanceSubScreen rebuilt
- 35-04: IntegrationsSubScreen live data, Mon Coach hardened

Ready for Phase 41 (Mon Coach full settings redesign) or next milestone phase.

## Self-Check: PASSED

- `apps/mobile/app/(app)/profile/settings.tsx` — exists, modified
- Commit `9cb38d9` — verified via `git rev-parse --short HEAD`
- `grep -c "health_sync_log"` → 1 ✓
- `grep -c "integrations.*userId"` → 1 ✓
- `grep -c "flash-outline"` → 3 ✓ (Strava + Vibrations notification + Abonnement)
- `grep -c "bicycle-outline\|location-outline"` → 0 ✓
- `grep -c "Tes données restent à toi"` → 1 ✓
- `grep -c "Géré"` → 1 ✓
- `grep -c "Connecter"` → 1 ✓
- `grep -c "danger"` → 1 ✓
- TypeScript: 0 errors ✓

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
