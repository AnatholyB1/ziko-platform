# Plan 32-02 Summary

## Completed
- Created BugFab (42px dark circular FAB, right=20, bottom-right) + useBugStore + showBugReport
- Created BugSheet (single-sheet DS-07 UX: 5 chips, textarea, screenshot toggle, send CTA)
- Migrated PaywallScreen from paywall.tsx to packages/ui/ (onClose prop replaces router.back())
- Migrated RechargeSheet from paywall.tsx to packages/ui/
- Updated packages/ui/src/index.ts with 4 new export lines
- TypeScript type-check passes for all new files (pre-existing error in ai/chat.tsx unrelated to this plan)

## Key decisions
- BugFab uses dark #1C1A17 background (as per DS-07 spec) rather than theme.surface used by old BugReportFAB
- BugFab positioned on right=20 (DS-07) vs old FAB which was left=20
- BugSheet imports useBugStore from BugFab.tsx (same package, local import) to avoid circular dependency
- DS-07 simplifies the 3-step bug report flow to a single sheet with 5 type chips + textarea
- PaywallScreen internally imports RechargeSheet from ./RechargeSheet (co-located in packages/ui)
- themeStore import updated from apps/mobile local path to @ziko/plugin-sdk in both migrated files

## Self-Check
- packages/ui/src/components/BugFab.tsx: FOUND
- packages/ui/src/components/BugSheet.tsx: FOUND
- packages/ui/src/components/PaywallScreen.tsx: FOUND
- packages/ui/src/components/RechargeSheet.tsx: FOUND
- Commit 9c291b6: FOUND
