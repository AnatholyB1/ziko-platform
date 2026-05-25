---
phase: 29-plugin-mon-coach-full-impl
plan: 02
subsystem: ui
tags: [expo, react-native, plugin-system, supabase, metro-bundler]

# Dependency graph
requires:
  - phase: 29-01
    provides: coach plugin scaffold (plugins/coach/src/manifest.ts, CoachScreen.tsx, dashboard route)
provides:
  - Coach plugin registered in PLUGIN_LOADERS static map with literal-string Metro-safe import
  - autoInstallCoachPlugin function that upserts user_plugins row for athlete-role users on sign-in
  - Idempotent coach plugin installation via onConflict: 'user_id,plugin_id'
affects:
  - 29-03 (CoachScreen implementation — coach plugin now auto-installed for athletes)
  - 29-04 (settings injection, revocation — coach row guaranteed to exist for clients)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase upsert with onConflict for idempotent plugin installation"
    - "Role-gated auto-install: query user_profiles.role, default to client if missing"

key-files:
  created: []
  modified:
    - apps/mobile/src/lib/PluginLoader.tsx

key-decisions:
  - "autoInstallCoachPlugin defined as a standalone async function outside the component — cleaner than inner function, receives supabase via module scope"
  - "Default role to 'client' when user_profiles row is missing — conservative install (athletes get coach, worst case is an extra row)"
  - "Pre-existing TypeScript error in chat.tsx (textAlign on View) is out of scope — not introduced by this plan"

patterns-established:
  - "Standalone async helper functions (autoInstallCoachPlugin) placed between the module-level helpers and the React component — consistent with applyPersonaDynamicPrompt placement"

requirements-completed:
  - COACH-02
  - COACH-03

# Metrics
duration: 8min
completed: 2026-05-20
---

# Phase 29 Plan 02: PluginLoader — Coach Registration + Auto-Install Summary

**Coach plugin added to PLUGIN_LOADERS with literal Metro import, plus idempotent role-gated upsert into user_plugins on every athlete sign-in**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-20T00:00:00Z
- **Completed:** 2026-05-20T00:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `coach: () => import('@ziko/plugin-coach/manifest') as any` to the PLUGIN_LOADERS static map (Metro bundler constraint: literal string import)
- Implemented `autoInstallCoachPlugin(userId)` with role gate — only runs upsert for `role === 'client' || role === 'both'`; coach-only users are skipped
- Inserted `await autoInstallCoachPlugin(user.id)` call at the correct position: after the mandatory pre-load loop, before the user_plugins SELECT query
- Upsert uses `{ onConflict: 'user_id,plugin_id' }` — idempotent, safe to call on every sign-in

## Task Commits

1. **Task 1: Register coach in PLUGIN_LOADERS and add auto-install logic** - `18bfa0f` (feat)

**Plan metadata:** (committed with SUMMARY + state docs)

## Files Created/Modified
- `apps/mobile/src/lib/PluginLoader.tsx` — Added coach to PLUGIN_LOADERS map (line 28), added autoInstallCoachPlugin function (lines 58-78), added call site (line 112)

## Decisions Made
- `autoInstallCoachPlugin` defined as a module-level standalone function (same pattern as `applyPersonaDynamicPrompt` already in the file) rather than inside the component body — cleaner separation and consistent with existing conventions
- Default role to `'client'` when `user_profiles.select('role')` returns no data — ensures athletes without a profile row still receive the coach plugin rather than silently skipping the install

## Deviations from Plan

None - plan executed exactly as written.

**Note on pre-existing TypeScript error:** `app/(app)/ai/chat.tsx` line 357 has a `textAlign` property on a View (wrong prop for View vs Text). This error pre-dates this plan, is not in any file modified here, and is logged as an out-of-scope issue. Per deviation rules, pre-existing errors in unrelated files are not auto-fixed.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Coach plugin is now registered in Metro's static bundle and will auto-install for all athletes on sign-in
- Plan 29-03 can proceed: CoachScreen.tsx implementation (State A/B/C) — the coach plugin row in user_plugins is guaranteed to exist for client-role users
- Plan 29-04 can proceed: settings injection and revocation flow

## Self-Check

- [x] `apps/mobile/src/lib/PluginLoader.tsx` modified — confirmed by grep
- [x] coach entry in PLUGIN_LOADERS — line 28: `coach: () => import('@ziko/plugin-coach/manifest') as any,`
- [x] autoInstallCoachPlugin defined — lines 58-78
- [x] autoInstallCoachPlugin called — line 112
- [x] onConflict: 'user_id,plugin_id' — line 72
- [x] role gate check — line 67
- [x] Commit 18bfa0f exists

## Self-Check: PASSED

---
*Phase: 29-plugin-mon-coach-full-impl*
*Completed: 2026-05-20*
