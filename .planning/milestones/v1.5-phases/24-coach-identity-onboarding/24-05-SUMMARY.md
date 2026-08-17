---
phase: 24-coach-identity-onboarding
plan: "05"
subsystem: web-coach-pages
tags: [nextjs, server-components, force-dynamic, supabase, i18n, onboarding, wizard, wave-5]
dependency_graph:
  requires: [24-04-SUMMARY]
  provides: [coach-onboarding-pages, coach-dashboard-page, coach-settings-page, i18n-keys]
  affects:
    - apps/web/src/app/[locale]/coach/onboarding/page.tsx
    - apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx
    - apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx
    - apps/web/messages/fr.json
    - apps/web/messages/en.json
tech_stack:
  added: []
  patterns:
    - Public onboarding page (outside (coach) layout) with Suspense wrapping useSearchParams client component
    - Client-side auth gate in OnboardingWizard (redirects to /fr/login?next=/coach/onboarding if unauthenticated)
    - Idempotent wizard — coach/both role users at step 1 redirected to /coach/dashboard
    - force-dynamic + revalidate=0 on all (coach) Server Component pages (ARCH-06)
    - SettingsClient: JWT fetched client-side via createClientSupabase(), passed to ProfileForm and KycDocList
    - createClientSupabase() wrapper used instead of direct @supabase/ssr import (avoids missing-type errors)
key_files:
  created:
    - apps/web/src/app/[locale]/coach/onboarding/page.tsx
    - apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx
    - apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx
  modified:
    - apps/web/messages/fr.json
    - apps/web/messages/en.json
decisions:
  - "Used createClientSupabase() helper (from @/lib/supabase/client.ts) instead of direct @supabase/ssr import in OnboardingWizard and SettingsClient — avoids the pre-existing TS2307 missing-module error that affects all files importing @supabase/ssr directly"
  - "SettingsClient receives userId from Server Component (trusted: originates from supabase.auth.getUser()) and fetches JWT client-side via getSession() — consistent with ARCH-05 layer 3 (Server Actions re-check auth independently)"
  - "Explicit TypeScript annotation on getSession().then() callback parameter in SettingsClient to eliminate TS7006 implicit-any from any-typed supabase client"
metrics:
  duration: "~8m"
  completed: "2026-05-15"
  tasks_completed: 2
  files_modified: 2
  files_created: 5
---

# Phase 24 Plan 05: Coach Pages Assembly Summary

**One-liner:** Assembled 3 page routes (public onboarding wizard, protected dashboard, protected settings) wiring Plan 24-04 components to real Supabase data, plus 47 i18n keys across fr.json and en.json for all coach copy namespaces.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Onboarding wizard page + OnboardingWizard client component | `a9750cd` | 2 created |
| 2 | Dashboard page, Settings page, i18n translation keys | `b187904` | 3 created, 2 modified |

## What Was Built

### Task 1 — Onboarding Page

- **`apps/web/src/app/[locale]/coach/onboarding/page.tsx`**: Public Server Component at `[locale]/coach/onboarding/` — OUTSIDE the `(coach)` layout (no auth guard fires on load). Wraps `<OnboardingWizard>` in `<Suspense>` (required because OnboardingWizard uses `useSearchParams()`).

- **`apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx`**: `'use client'`. Reads `?step=` URL param via `useSearchParams()`, clamped to 1–3. On mount: checks session via `createClientSupabase()`. Unauthenticated → redirects to `/fr/login?next=/coach/onboarding` (D-06). Already-coach → redirects step 1 to `/coach/dashboard` (idempotent). Renders WizardProgress + step component based on current step. Step navigation via `router.push('/coach/onboarding?step=N')`.

### Task 2 — Dashboard, Settings, i18n

- **`apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx`**: Server Component. `force-dynamic + revalidate=0` (ARCH-06). Reads `coach_profiles` (display_name, kyc_status) for the authenticated user. Falls back to `user.email` if no profile. Renders `<WelcomeCard>` from Plan 24-04.

- **`apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx`**: Server Component. `force-dynamic + revalidate=0`. Reads full `coach_profiles` row. Passes `userId` + `initialProfile` to `<SettingsClient>`.

- **`apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx`**: `'use client'`. Fetches JWT client-side on mount via `createClientSupabase().auth.getSession()`. Renders two sections: Profile (ProfileForm + save button via `useActionState(saveProfile)`) and KYC (KycDocList + KycStatusChip + save button via `useActionState(saveKyc)`). Both forms show inline success/error feedback.

- **`apps/web/messages/fr.json`**: Added 6 top-level namespaces: Login (7 keys), Onboarding (21 keys), Dashboard (3 keys), Settings (6 keys), KycStatus (4 keys), Upload (5 keys) — 46 keys total + namespace counts. All French copy matches UI-SPEC copywriting contract exactly.

- **`apps/web/messages/en.json`**: Matching English translations for all 6 namespaces.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Direct @supabase/ssr import causes TS2307 + cascading TS7006 errors**
- **Found during:** Task 1 TypeScript verification
- **Issue:** Plan template used `import { createBrowserClient } from '@supabase/ssr'` directly. The worktree has a pre-existing `TS2307 Cannot find module '@supabase/ssr'` baseline (19 errors) affecting server.ts, middleware.ts, client.ts. Importing directly from `@supabase/ssr` in new files adds that file to the error count.
- **Fix:** Used `createClientSupabase()` from `@/lib/supabase/client.ts` in both `OnboardingWizard.tsx` and `SettingsClient.tsx` — same pattern as Plan 24-04 components. Added explicit TypeScript annotation on `.then()` callback in SettingsClient to prevent cascading TS7006.
- **Files modified:** `OnboardingWizard.tsx`, `SettingsClient.tsx`
- **Commits:** `a9750cd`, `b187904`

## Known Stubs

None. Dashboard reads real `coach_profiles.display_name` and `kyc_status` from Supabase. Settings pre-populates from `coach_profiles.*`. The "Inviter un client → (bientôt disponible)" text in WelcomeCard is an intentional Phase 25 teaser (documented in CONTEXT.md D-09), not a data stub.

## Threat Surface Scan

No new threat surface beyond what was declared in the plan's threat model:
- T-24-05-02 mitigated: `createServerSupabase()` uses RLS-enforced client; `coach_profiles_own` policy limits reads to `auth.uid() = user_id`.
- T-24-05-03 accepted: `userId` in SettingsClient originates from server-side `supabase.auth.getUser()` (trusted); Server Actions re-check auth independently (ARCH-05 layer 3).

## Self-Check

### Files Exist
- `apps/web/src/app/[locale]/coach/onboarding/page.tsx` — FOUND
- `apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx` — FOUND
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — FOUND
- `apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx` — FOUND
- `apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx` — FOUND
- `apps/web/messages/fr.json` (Login/Onboarding/Dashboard/Settings/KycStatus/Upload) — FOUND
- `apps/web/messages/en.json` (matching English keys) — FOUND

### Commits Exist
- `a9750cd` — feat(24-05): onboarding page + OnboardingWizard client component
- `b187904` — feat(24-05): dashboard page, settings page, i18n translation keys

### Verification Checks
- `ls apps/web/src/app/[locale]/coach/onboarding/` → OnboardingWizard.tsx + page.tsx (NOT inside (coach)/) — PASS
- `grep 'force-dynamic\|revalidate' dashboard/page.tsx` → both exports present — PASS
- `grep 'force-dynamic\|revalidate' settings/page.tsx` → both exports present — PASS
- `grep 'Suspense' onboarding/page.tsx` → present — PASS
- `grep 'coach_profiles' dashboard/page.tsx` → present — PASS
- `grep '"Login"' fr.json` → present — PASS
- `grep '"Onboarding"' fr.json` → present — PASS
- TypeScript error count: 19 errors (same as pre-task baseline) — PASS

## Self-Check: PASSED
