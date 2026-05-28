---
phase: 03-in-app-notification-center
plan: 03
subsystem: mobile

key-files:
  modified:
    - apps/mobile/app/(app)/_layout.tsx

requirements-completed:
  - CENTER-03
  - CENTER-05

duration: 15min
completed: 2026-05-28
---

# Phase 03 Plan 03: Badge Sync + Realtime Subscription

**_layout.tsx wired with AppState badge sync and Supabase Realtime**

## What changed

- AppState 'active' -> syncUnreadCount(userId) -- badge refreshes on foreground
- Supabase Realtime channel on notification_log INSERT for current user
- Realtime handler: invalidateQueries + syncUnreadCount
- Cleanup: supabase.removeChannel in useEffect return

## Commits

| Task | Commit  | Files                                     |
|------|---------|-------------------------------------------|
| 1    | 8220919 | apps/mobile/app/(app)/_layout.tsx         |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- apps/mobile/app/(app)/_layout.tsx: FOUND
- Commit 8220919: FOUND
- syncUnreadCount present (2 occurrences): VERIFIED
- removeChannel present: VERIFIED
- TypeScript errors on _layout: NONE
