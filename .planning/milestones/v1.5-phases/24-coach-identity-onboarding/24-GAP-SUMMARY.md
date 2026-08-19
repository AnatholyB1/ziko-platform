---
phase: 24-coach-identity-onboarding
plan: GAP
status: complete
completed: "2026-05-16"
---

## Summary

Closed all four UAT gaps blocking coach onboarding end-to-end.

## What Was Built

### Task 1: Locale-prefixed login redirect
- `LoginForm.tsx`: added `useLocale()` import, prepends `/${locale}` before `router.push(state.redirectTo)`
- `(coach)/coach/layout.tsx`: added `getLocale()` import, fixed hardcoded `/fr/login` → `/${locale}/login` and `/coach/onboarding` → `/${locale}/coach/onboarding`

### Task 2: Upload failures fixed
- `PhotoUpload.tsx`: replaced raw `fetch PUT` with `supabase.storage.from('coach-kyc').uploadToSignedUrl(path, token, file)` using `createClientSupabase()`; extracts `token` from `/storage/upload-url` response; `catch` now logs to console
- `FileUploadRow.tsx`: same fix — `uploadToSignedUrl` replaces raw PUT; `catch` logs `[FileUploadRow] upload failed:`

### Task 3: Header/Footer suppressed for coach routes
- Created `[locale]/(marketing)/layout.tsx` with `<Header>` + `<Footer>`
- Moved 5 marketing pages into `(marketing)/`: `page.tsx`, `cgu/`, `mentions-legales/`, `politique-de-confidentialite/`, `supprimer-mon-compte/`
- Removed `<Header>` and `<Footer>` from `[locale]/layout.tsx` — coach routes no longer inherit marketing header

## Verification

- TypeScript: `npx tsc --noEmit` → zero errors
- UAT tests 3, 4, 5, 7 addressed:
  - Test 3: login redirects to `/${locale}/coach/onboarding` (no 404)
  - Test 4 & 5: photo + KYC uploads use SDK method, errors surfaced in console
  - Test 7: coach dashboard inherits no marketing Header

## Key Files

- `apps/web/src/app/[locale]/login/LoginForm.tsx`
- `apps/web/src/app/[locale]/(coach)/coach/layout.tsx`
- `apps/web/src/components/coach/PhotoUpload.tsx`
- `apps/web/src/components/coach/FileUploadRow.tsx`
- `apps/web/src/app/[locale]/(marketing)/layout.tsx` (new)
- `apps/web/src/app/[locale]/layout.tsx`

## Self-Check: PASSED
