---
phase: 24-coach-identity-onboarding
plan: "03"
subsystem: web-coach-chrome
tags: [nextjs, server-actions, useactionstate, sidebar, auth-guard, login, open-redirect, ratelimit, wave-3]
dependency_graph:
  requires: [24-02-SUMMARY, phase-23-web-foundation]
  provides: [coach-layout-chrome, login-page, loginAction]
  affects:
    - apps/web/src/app/[locale]/(coach)/coach/layout.tsx
    - apps/web/src/components/coach/CoachSidebar.tsx
    - apps/web/src/components/coach/NavItem.tsx
    - apps/web/src/app/[locale]/login/page.tsx
    - apps/web/src/app/[locale]/login/LoginForm.tsx
    - apps/web/src/actions/login.ts
tech_stack:
  added: []
  patterns:
    - CoachSidebar 'use client' with 5 nav items (2 enabled, 3 disabled with Bientôt badge)
    - NavItem with active/inactive/disabled states and aria-disabled
    - Server Component layout auth guard — role check + redirect pattern
    - loginAction Server Action with useActionState (pending, error, success states)
    - safeNext() allowlist validation for ?next= open-redirect prevention
    - useEffect + router.push for post-login redirect (avoids redirect() inside try/catch pitfall)
    - Suspense wrapper on LoginPage for useSearchParams in App Router
key_files:
  created:
    - apps/web/src/components/coach/CoachSidebar.tsx
    - apps/web/src/components/coach/NavItem.tsx
    - apps/web/src/actions/login.ts
    - apps/web/src/app/[locale]/login/page.tsx
    - apps/web/src/app/[locale]/login/LoginForm.tsx
  modified:
    - apps/web/src/app/[locale]/(coach)/coach/layout.tsx
decisions:
  - "LoginForm uses useEffect+router.push for redirect (not redirect() in Server Action) — avoids Pitfall 6 where redirect() throws inside useActionState and navigation is swallowed"
  - "CoachSidebar hardcodes /fr/ locale prefix in hrefs — Clients/Programmes/IA are disabled (Bientôt badge) until Phases 26-28 flip their disabled prop"
  - "Role check in layout.tsx uses ['coach', 'both'].includes(profile.role) — role='both' users (athletes who became coaches) pass through"
  - "safeNext() falls back to /coach/dashboard for any non-allowlisted next= value — T-24-03-01 open-redirect mitigated"
metrics:
  duration: "~4m"
  completed: "2026-05-15"
  tasks_completed: 2
  files_modified: 1
  files_created: 5
---

# Phase 24 Plan 03: Coach Layout Chrome & Login Page Summary

**One-liner:** Replaced Phase 23 smoke layout with real auth-guarded coach chrome (CoachSidebar with 5 nav items + role check), and built /fr/login with useActionState loginAction featuring rate limiting, signInWithPassword, role-based redirect, and ?next= allowlist open-redirect prevention.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Coach layout chrome (auth guard + CoachSidebar + NavItem) | `e7ff69e` | 2 created, 1 modified |
| 2 | Login page + LoginForm + loginAction Server Action | `62e924c` | 3 created |

## What Was Built

### Task 1 — Coach Layout Chrome

- **`apps/web/src/components/coach/NavItem.tsx`**: Client component for individual nav items. Three states: active (left-border primary, primary text, primary/5 bg), inactive (text hover bg-background), disabled (aria-disabled, "Bientôt" badge, muted text, cursor-default). Uses `usePathname()` for active detection.

- **`apps/web/src/components/coach/CoachSidebar.tsx`**: Client sidebar with 5 nav items:
  - Dashboard (`/fr/coach/dashboard`) — enabled
  - Clients (`/fr/coach/clients`) — disabled (Bientôt)
  - Programmes (`/fr/coach/programs`) — disabled (Bientôt)
  - IA (`/fr/coach/ai`) — disabled (Bientôt)
  - Paramètres (`/fr/coach/settings`) — enabled
  Icons from `react-icons/io5`. Sidebar: `w-60 sticky top-0 h-screen` with ZIKO logo area.

- **`apps/web/src/app/[locale]/(coach)/coach/layout.tsx`** (replaced): Auth guard calls `createServerSupabase().auth.getUser()`. Unauthenticated → `redirect('/fr/login')`. Role check via `user_profiles.role` — non-coach/non-both → `redirect('/coach/onboarding')`. Renders `<CoachSidebar />` + `<main>` chrome. `force-dynamic` + `revalidate=0` preserved (ARCH-06).

### Task 2 — Login Page + Server Action

- **`apps/web/src/actions/login.ts`**: Server Action `loginAction(prevState, formData)`:
  - Rate limits by IP using existing `ratelimit` (5/60s sliding window)
  - Reads `email`, `password`, `next` from FormData
  - Calls `supabase.auth.signInWithPassword({ email, password })`
  - Reads `user_profiles.role` post-auth
  - `safeNext()` validates `?next=` against allowlist `['/coach/onboarding', '/coach/dashboard', '/coach/settings']`
  - Coach/both → `safeNext(next)` (prevents re-routing coach to onboarding)
  - Client role → `/coach/onboarding`
  - Returns `{ status: 'success', redirectTo }` — client handles navigation (Pitfall 6 avoidance)

- **`apps/web/src/app/[locale]/login/LoginForm.tsx`**: Client component with `useActionState(loginAction, initialState)`. Email + password inputs with red border on error. Error shown with `role="alert"`. Submit button disabled with `pending`. `useEffect` watches `state.status === 'success'` and calls `router.push(state.redirectTo)`. Passes `?next=` via hidden input. Wrapped in `framer-motion` fadeUp animation.

- **`apps/web/src/app/[locale]/login/page.tsx`**: Server Component page wrapping `<LoginForm>` in `<Suspense>` (required by Next.js 15 App Router for `useSearchParams` usage).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. CoachSidebar's disabled nav items (Clients, Programmes, IA) are intentional stubs controlled by a `disabled` prop — they render correctly with a "Bientôt" badge and are not stub data. These will be enabled in Phases 26-28 by flipping `disabled: false` in the NAV_ITEMS array.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: auth-form | apps/web/src/app/[locale]/login/LoginForm.tsx | New email+password login form — T-24-03-01 (open redirect) mitigated by safeNext() allowlist; T-24-03-03 (brute force) mitigated by ratelimit.limit(); T-24-03-04 (account existence leak) mitigated by identical error message for wrong email/password |
| threat_flag: auth-guard | apps/web/src/app/[locale]/(coach)/coach/layout.tsx | Role-based gate added — T-24-03-02 (non-coach bypass) mitigated by ['coach','both'].includes(profile.role) check |

## Self-Check

### Files Exist
- `apps/web/src/components/coach/CoachSidebar.tsx` — FOUND
- `apps/web/src/components/coach/NavItem.tsx` — FOUND
- `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` — imports CoachSidebar, role check — FOUND
- `apps/web/src/actions/login.ts` — NEXT_PARAM_ALLOWLIST + safeNext + signInWithPassword — FOUND
- `apps/web/src/app/[locale]/login/LoginForm.tsx` — useActionState + useEffect redirect — FOUND
- `apps/web/src/app/[locale]/login/page.tsx` — Suspense wrapper — FOUND

### Commits Exist
- `e7ff69e` — feat(24-03): coach layout chrome — CoachSidebar, NavItem, auth guard with role check
- `62e924c` — feat(24-03): login page + LoginForm + loginAction Server Action

### TypeScript
- `tsc --noEmit -p apps/web/tsconfig.json` — PASSED (no errors)

### Verification Checks
- `grep 'NEXT_PARAM_ALLOWLIST' apps/web/src/actions/login.ts` — 3 entries confirmed
- `grep 'force-dynamic|revalidate' layout.tsx` — both exports present
- `grep 'CoachSidebar' layout.tsx` — import + usage present
- `grep 'Suspense' login/page.tsx` — wrapper present

## Self-Check: PASSED
