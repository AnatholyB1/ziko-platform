---
phase: 03-in-app-notification-center
plan: 01
subsystem: mobile

key-files:
  created:
    - apps/mobile/src/stores/notificationStore.ts
    - apps/mobile/src/hooks/useNotifications.ts

requirements-completed:
  - CENTER-01
  - CENTER-02
  - CENTER-03

duration: 20min
completed: 2026-05-28
---

# Phase 03 Plan 01: Notification Data Layer

**notificationStore + useNotifications built — Wave 2 unblocked**

## What was built

- notificationStore.ts: Zustand store avec unreadCount, setUnreadCount (badge sync via setBadgeCountAsync fire-and-forget), syncUnreadCount (query Supabase notification_log avec count exact)
- useNotifications.ts: TanStack Query hook fetching notification_log (LIMIT 50, ORDER created_at DESC), markRead mutation (UPDATE read_at = now), markAllRead mutation (UPDATE WHERE read_at IS NULL), mapping NotificationRow → NotifItem via constantes CATEGORY_ICON/TINT/CAT
- NotificationRow interface exportée pour les consommateurs Wave 2

## Key decisions

- Supabase direct client (no Hono hop) — correspond au pattern bypass coach
- setBadgeCountAsync est fire-and-forget (best-effort, non attendu)
- markAllRead appelle setUnreadCount(0) immédiatement dans onSuccess
- toRelativeTime produit du français natif (À l'instant, Il y a X min/h/j, Hier · HH:MM)
- unreadCount dérivé du data TanStack Query et synchronisé au store après chaque fetch

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- apps/mobile/src/stores/notificationStore.ts: FOUND
- apps/mobile/src/hooks/useNotifications.ts: FOUND
- Commit 3d77e8a: FOUND
- TypeScript: 0 erreurs dans les fichiers créés (13 erreurs pré-existantes non liées)
