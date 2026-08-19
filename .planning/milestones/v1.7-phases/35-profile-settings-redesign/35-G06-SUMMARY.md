---
phase: 35
plan: G06
subsystem: referral
tags: [referral, promo, mobile, backend, migration]
dependency_graph:
  requires: [35-G05]
  provides: [referral-screen, promo-codes, referral-routes]
  affects: [settings-screen, backend-api]
tech_stack:
  added: []
  patterns: [hono-route, tanstack-query, react-native-share]
key_files:
  created:
    - supabase/migrations/053_referral_schema.sql
    - backend/api/src/routes/referral.ts
    - apps/mobile/app/(app)/profile/referral.tsx
  modified:
    - backend/api/src/app.ts
    - apps/mobile/app/(app)/profile/settings.tsx
decisions:
  - Used Share.share() instead of expo-clipboard (not installed) for code copy — opens native share sheet, no extra dependency
  - Promo /validate and /apply routes co-located in referral.ts, registered under both /referral and /promo prefixes in app.ts
  - Removed Share import from settings.tsx after replacing inline handler with router.push
metrics:
  duration: 12m
  completed: 2026-05-23T11:56:00Z
  tasks: 5
  files: 5
---

# Phase 35 Plan G06: Parrainage — Full Implementation (track-only rewards) Summary

**One-liner:** Referral system with personal codes, invite tracking, and promo code redemption — migration 053 + 4 Hono endpoints + ReferralScreen (2 tabs) + settings row navigation.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Migration 053: referral_code col, app_invites extension, promo_codes, user_promo_redemptions | 1ef3857 |
| 2 | Hono routes: GET /referral, POST /referral/redeem, POST /promo/validate, POST /promo/apply | 1ef3857 |
| 3 | Register referral + promo routes in app.ts | 1ef3857 |
| 4 | ReferralScreen — 2 tabs (Parraine un ami / Code promo) | 1ef3857 |
| 5 | Settings Parrainage row → router.push to /profile/referral | 1ef3857 |

## Key Decisions

- **expo-clipboard not installed** — used `Share.share()` from react-native for the "Copier" button (opens native share sheet). No new package dependency. [Rule 3 deviation auto-resolved]
- **Promo endpoints co-located** in `referral.ts` under nested paths `/promo/validate` and `/promo/apply`, mounted as both `/referral` and `/promo` in app.ts to satisfy the plan's routing spec.
- **Removed `Share` import** from settings.tsx after replacing the inline Parrainage handler (which used `Share.share()`) with a `router.push` — kept imports clean.

## Deviations from Plan

### Auto-resolved Issues

**1. [Rule 3 - Blocking] expo-clipboard not installed**
- **Found during:** Task 4 (ReferralScreen — Clipboard.setStringAsync call)
- **Issue:** `expo-clipboard` was not present in `apps/mobile/package.json` or `node_modules`
- **Fix:** Used `Share.share()` from `react-native` (already imported) as the copy mechanism — opens native OS share sheet where user can select "Copy". This avoids a new package install.
- **Files modified:** `apps/mobile/app/(app)/profile/referral.tsx`
- **Commit:** 1ef3857

## Self-Check: PASSED

- [x] `supabase/migrations/053_referral_schema.sql` — exists
- [x] `backend/api/src/routes/referral.ts` — exists
- [x] `backend/api/src/app.ts` — modified, referralRoutes imported and registered
- [x] `apps/mobile/app/(app)/profile/referral.tsx` — exists
- [x] `apps/mobile/app/(app)/profile/settings.tsx` — Parrainage row uses router.push
- [x] Commit 1ef3857 — verified in git log
- [x] TypeScript: 0 new errors (6 pre-existing errors in unrelated files)
