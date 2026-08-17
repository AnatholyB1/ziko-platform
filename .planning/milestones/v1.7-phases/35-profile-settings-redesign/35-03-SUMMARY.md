---
phase: 35-profile-settings-redesign
plan: 03
subsystem: ui
tags: [react-native, settings, supabase, STGroup, STRow, STToggle, ziko-ui, notifications, appearance, persistence]

requires:
  - phase: 35-01
    provides: STGroup, STRow, STToggle shared components exported from @ziko/ui

provides:
  - SettingsScreen rebuilt with @ziko/ui shared components (STGroup, STRow, STToggle)
  - NotifSubScreen: 9 toggles, 500ms debounced Supabase persistence (notif_prefs JSONB)
  - AppearanceSubScreen: 70px theme cards, locked Sombre/Auto, units persistence (appearance.units_preference JSONB)
  - JSONB merge-safe upsert pattern: loads full settings before write to avoid overwriting sibling keys

affects: [35-04, 35-05, settings screens, profile navigation]

tech-stack:
  added: []
  patterns:
    - "STGroup/STRow/STToggle imported from @ziko/ui — no local definitions in consumer screens"
    - "JSONB merge-safe upsert: load full settings JSON, spread with new key, then upsert"
    - "Debounced Supabase persistence: 500ms clearTimeout/setTimeout pattern with saveRef"
    - "Theme lock pattern: opacity:0.5 + pointerEvents:none for future themes"

key-files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx

key-decisions:
  - "Both tasks (Task 1 and Task 2) committed in a single atomic commit since they modify only settings.tsx"
  - "JSONB merge-safe: load full settings before upsert in both NotifSubScreen and AppearanceSubScreen (threat T-35-03-02)"
  - "STGroup, STRow, STToggle already exported from @ziko/ui index.ts (added by prior work) — no index change needed"
  - "NotifSubScreen and AppearanceSubScreen receive userId prop from parent SettingsScreen to enable Supabase queries"

requirements-completed: [SET-01, SET-02, SET-03, SET-05]

duration: 7min
completed: 2026-05-22
---

# Phase 35 Plan 03: Settings Screen Redesign Summary

**SettingsScreen rebuilt with @ziko/ui STGroup/STRow/STToggle, PREMIUM account card, 4 correct groups, and NotifSubScreen/AppearanceSubScreen with 500ms debounced JSONB persistence**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-22T11:34:51Z
- **Completed:** 2026-05-22T11:41:27Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced all inline STGroup/STRow/STToggle local definitions with `import { STGroup, STRow, STToggle } from '@ziko/ui'`
- Account card: 48px avatar borderRadius:12, PREMIUM badge (was FREE), correct name/email layout per UI-SPEC
- 4 STGroups rebuilt per UI-SPEC: Compte (4 rows), Abonnement (4 rows), Préférences (5 rows), Aide & infos (5 rows)
- Se déconnecter button: paddingVertical:16 borderRadius:16 color #E94B3C, correct alert copy per UI-SPEC
- Version footer: "Ziko · v2.4.1 · build 8842"
- NotifSubScreen: 9 toggles across 3 groups with correct Ionicons names (musical-note-outline, flash-outline, notifications-outline), initial state loaded from DB, 500ms debounced upsert
- AppearanceSubScreen: 70px theme preview cards, Sombre/Auto at opacity:0.5, units persisted to appearance.units_preference
- JSONB merge-safe: both screens load full settings JSON before upsert to avoid overwriting sibling keys

## Task Commits

1. **Task 1: Rebuild SettingsScreen main view** + **Task 2: NotifSubScreen + AppearanceSubScreen** - `ad52f1a` (feat)

Both tasks committed atomically since they modify only `settings.tsx`.

## Files Created/Modified

- `apps/mobile/app/(app)/profile/settings.tsx` - Full rewrite: STGroup/STRow/STToggle from @ziko/ui, 4 groups, account card, NotifSubScreen with DB persistence, AppearanceSubScreen with theme cards and units persistence

## Decisions Made

- Both tasks executed in a single commit since they modify only one file (settings.tsx) — no split needed
- JSONB merge-safe pattern implemented per threat T-35-03-02: load existing settings JSON first, spread with new key, then upsert
- STGroup, STRow, STToggle were already exported from `packages/ui/src/index.ts` (by prior work) — no index.ts change needed
- NotifSubScreen and AppearanceSubScreen receive `userId` as prop from parent SettingsScreen (not from useAuthStore directly) to keep logic centralized
- Kept IntegrationsSubScreen as-is (no persistence needed per plan spec — not in task scope)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] JSONB merge-safe upsert (T-35-03-02)**
- **Found during:** Task 2 (NotifSubScreen + AppearanceSubScreen)
- **Issue:** Threat model T-35-03-02 explicitly requires loading full settings before upsert to avoid overwriting sibling keys. The plan's task 2 action code showed a simplified upsert without the load step.
- **Fix:** Both NotifSubScreen and AppearanceSubScreen load full `settings` JSON first, spread with the new partial key (`notif_prefs` or `appearance`), then upsert — prevents JSONB key stomping
- **Files modified:** apps/mobile/app/(app)/profile/settings.tsx
- **Verification:** `grep -c "...current" settings.tsx` → 2 instances (one per sub-screen)
- **Committed in:** ad52f1a

---

**Total deviations:** 1 auto-fixed (Rule 2 - Missing Critical — threat model compliance)
**Impact:** Required for data integrity; no scope creep.

## Issues Encountered

None.

## Known Stubs

- PREMIUM badge uses flat `backgroundColor: '#FF5C1A'` instead of LinearGradient (`linear-gradient(95deg, #FF5C1A, #FF8E5A)` per UI-SPEC). This is intentional for v1.7 — `expo-linear-gradient` is not installed and installing it requires project rebuild. The badge renders in orange per mockup intent.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers.

## Next Phase Readiness

- settings.tsx fully rebuilt, passes TypeScript, all 4 groups render correctly
- NotifSubScreen and AppearanceSubScreen have Supabase persistence wired
- Ready for plan 35-04 (profile screen rebuild)

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
