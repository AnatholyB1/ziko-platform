---
phase: 24-coach-identity-onboarding
plan: "04"
subsystem: web-coach-components
tags: [nextjs, server-actions, useactionstate, file-upload, supabase-storage, ratelimit, kyc, wave-4]
dependency_graph:
  requires: [24-03-SUMMARY, 24-02-SUMMARY]
  provides: [coach-identity-server-actions, coach-component-library]
  affects:
    - apps/web/src/actions/coach-identity.ts
    - apps/web/src/components/coach/KycStatusChip.tsx
    - apps/web/src/components/coach/WizardProgress.tsx
    - apps/web/src/components/coach/SpecialtyTagInput.tsx
    - apps/web/src/components/coach/FileUploadRow.tsx
    - apps/web/src/components/coach/PhotoUpload.tsx
    - apps/web/src/components/coach/ProfileForm.tsx
    - apps/web/src/components/coach/KycDocList.tsx
    - apps/web/src/components/coach/WelcomeCard.tsx
    - apps/web/src/components/coach/WizardStep1Role.tsx
    - apps/web/src/components/coach/WizardStep2Profile.tsx
    - apps/web/src/components/coach/WizardStep3Kyc.tsx
tech_stack:
  added: []
  patterns:
    - Server Action triple (promoteRole/saveProfile/saveKyc) each calling getUser() independently (ARCH-05 layer 3)
    - rolePromotionRatelimit (3/60s) and kycUploadRatelimit (10/60s) in Server Actions before any DB op
    - Signed URL upload — fetch /storage/upload-url then PUT directly to Supabase Storage (bypasses Vercel 4.5 MB limit)
    - Storage path stored in onUploaded callback (not signed URL) — Pitfall 7 prevention
    - ProfileForm as shared reusable component with hidden inputs (photo_url, specialties JSON) for Server Action FormData
    - useActionState pattern for all 3 Wizard steps with pending/error/success states
    - KycStatusChip 4-variant color mapping matching UI-SPEC exactly
    - WizardProgress with ARIA progressbar role and aria-valuenow/min/max
    - SpecialtyTagInput with Enter/comma/backspace keyboard handling and max-20 enforcement
key_files:
  created:
    - apps/web/src/actions/coach-identity.ts
    - apps/web/src/components/coach/KycStatusChip.tsx
    - apps/web/src/components/coach/WizardProgress.tsx
    - apps/web/src/components/coach/SpecialtyTagInput.tsx
    - apps/web/src/components/coach/FileUploadRow.tsx
    - apps/web/src/components/coach/PhotoUpload.tsx
    - apps/web/src/components/coach/ProfileForm.tsx
    - apps/web/src/components/coach/KycDocList.tsx
    - apps/web/src/components/coach/WelcomeCard.tsx
    - apps/web/src/components/coach/WizardStep1Role.tsx
    - apps/web/src/components/coach/WizardStep2Profile.tsx
    - apps/web/src/components/coach/WizardStep3Kyc.tsx
  modified: []
decisions:
  - "KycStatusChip uses plain string prop (not CoachKycStatus type import) — CoachKycStatus is not exported from @ziko/coach-sdk/schemas; using string is type-safe given the STATUS_CONFIG lookup with fallback to pending"
  - "WizardStep3Kyc submit button disabled when docs.length === 0 — skip button (type=button, onSkip) is always available as the primary path for optional KYC"
  - "PhotoUpload uses /api/photo?path= proxy route for persisted paths — avoids storing expiring signed URLs; the proxy route will sign on demand server-side"
  - "KycDocList filters DOC_TYPES by already-uploaded type to prevent duplicate type uploads before max-3 is reached"
metrics:
  duration: "~5m"
  completed: "2026-05-15"
  tasks_completed: 2
  files_modified: 0
  files_created: 12
---

# Phase 24 Plan 04: Coach Components & Server Actions Summary

**One-liner:** Created 3 Server Actions (promoteRole/saveProfile/saveKyc) with ARCH-05 getUser() re-check and rate limiting, plus 12 coach UI components including shared ProfileForm, signed-URL FileUploadRow/PhotoUpload, 4-variant KycStatusChip, and ARIA-compliant WizardProgress.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Server Actions + atomic components (KycStatusChip, WizardProgress, SpecialtyTagInput) | `c72e4c6` | 4 created |
| 2 | FileUploadRow, PhotoUpload, ProfileForm, KycDocList, WelcomeCard, WizardStep components | `fdd8fd2` | 8 created |

## What Was Built

### Task 1 — Server Actions + Atomic Components

- **`apps/web/src/actions/coach-identity.ts`**: Three `'use server'` exports:
  - `promoteRole` — rate-limited (3/60s), calls `getUser()` independently, fetches `PATCH /coach/identity/role` with user JWT
  - `saveProfile` — calls `getUser()` independently, validates `display_name` required, fetches `PATCH /coach/identity/profile` with JSON body (display_name, bio, website, photo_url, specialties)
  - `saveKyc` — rate-limited (10/60s), calls `getUser()` independently, fetches `PATCH /coach/identity/profile` with kyc_docs array
  - Each uses `getAuthContext()` (which calls `supabase.auth.getUser()`) + separate `supabase.auth.getSession()` for the JWT — ARCH-05 layer 3 satisfied

- **`apps/web/src/components/coach/KycStatusChip.tsx`**: Status chip with 4 exact UI-SPEC color variants. `pending` → `bg-yellow-50 text-yellow-700 border-yellow-200`; `submitted` → blue; `verified` → primary; `rejected` → red-50. Includes visually-hidden prefix "Statut KYC : " for screen readers.

- **`apps/web/src/components/coach/WizardProgress.tsx`**: 4px tall track with `role="progressbar"`, `aria-valuenow`, `aria-valuemin={1}`, `aria-valuemax`, `aria-label`. Fill width computed as `(currentStep / totalSteps) * 100%` with `transition-all duration-300`.

- **`apps/web/src/components/coach/SpecialtyTagInput.tsx`**: `'use client'`. Enter/comma adds tag, Backspace removes last tag when input empty. Max 20 tags enforced. Each remove button has `aria-label="Retirer {tag}"`. Tag chips match UI-SPEC `bg-primary/10 text-primary` style exactly.

### Task 2 — Upload + Composite Components

- **`apps/web/src/components/coach/FileUploadRow.tsx`**: `'use client'`. Validates file type (PDF/JPEG/PNG/WebP) and size (≤5 MB). Fetches `/storage/upload-url?bucket=coach-kyc&path={userId}/{filename}`, then PUTs directly to Supabase Storage. `onUploaded` receives storage **path** (not signed URL) per Pitfall 7. After upload, renders filename pill with `aria-label="Supprimer le document"` remove button.

- **`apps/web/src/components/coach/PhotoUpload.tsx`**: `'use client'`. 96×96 rounded-full avatar with local blob preview. Same signed-URL upload pattern as FileUploadRow. `onUploaded` receives `{userId}/photo.{ext}` path. Persisted paths served via `/api/photo?path=` proxy (avoids signed URL expiry).

- **`apps/web/src/components/coach/ProfileForm.tsx`**: `'use client'`. Shared component used by WizardStep2Profile and (intended for) settings page. Contains `<PhotoUpload>`, `<SpecialtyTagInput>`, hidden inputs for `photo_url` and `specialties` (JSON-serialized), and standard text inputs for `display_name`, `bio`, `website`. `onChange` callback for parent notification.

- **`apps/web/src/components/coach/KycDocList.tsx`**: `'use client'`. Manages `UploadedDoc[]` state. Shows empty state copy when no docs. Renders uploaded docs as `FileUploadRow` (uploaded mode). Renders add-row buttons only for doc types not yet uploaded, and hides them at max-3 with a message. Max-3 enforcement prevents doc flood.

- **`apps/web/src/components/coach/WelcomeCard.tsx`**: Server Component. Renders `displayName` in heading, `<KycStatusChip>` inline, subtitle, and Phase 25 teaser text.

- **`apps/web/src/components/coach/WizardStep1Role.tsx`**: `'use client'`. `useActionState(promoteRole)`. Adapts subtitle copy based on `currentRole === 'client'`. Error shown with `role="alert"`. Calls `onSuccess()` on server response `status === 'success'`.

- **`apps/web/src/components/coach/WizardStep2Profile.tsx`**: `'use client'`. Wraps `<ProfileForm>` in a form with `action={formAction}` (from `useActionState(saveProfile)`). Imports ProfileForm — satisfies the `ProfileForm` shared-component key link requirement.

- **`apps/web/src/components/coach/WizardStep3Kyc.tsx`**: `'use client'`. Holds `docs` state from `<KycDocList onChange>`. On form submit, `fd.set('kyc_docs', JSON.stringify(docs))` before calling `saveKyc`. Submit button disabled when `docs.length === 0`. `onSkip` button (type="button") bypasses form submission.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CoachKycStatus type not exported from coach-sdk**
- **Found during:** Task 1
- **Issue:** Plan's KycStatusChip template imported `import type { CoachKycStatus } from '@ziko/coach-sdk/schemas'` — but `CoachKycStatus` is not exported from that path; only `CoachProfileSchema`, `CoachClientLinkSchema`, `ImportedProgramSchema` are exported. `CoachKycStatus` is not in types/index.ts either.
- **Fix:** Used `status: string` prop type with a `Record<string, { label: string; classes: string }>` STATUS_CONFIG object with fallback to `pending`. Type-safe and runtime-correct.
- **Files modified:** `apps/web/src/components/coach/KycStatusChip.tsx`
- **Commit:** `c72e4c6`

## Known Stubs

None. The `ProfileForm` is wired with real upload logic (PhotoUpload) and real tag input (SpecialtyTagInput). The "Inviter un client → (bientôt disponible)" in WelcomeCard is intentional Phase 25 placeholder text, documented in CONTEXT.md as a teaser — not a data stub.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: file-upload | apps/web/src/components/coach/FileUploadRow.tsx | Client validates type/size before fetch; path passed to /storage/upload-url validated server-side (T-24-04-01: path injection mitigated by storage.ts ownership check); T-24-04-02 mitigated — stores path not signed URL |
| threat_flag: server-action | apps/web/src/actions/coach-identity.ts | T-24-04-03 mitigated — each action calls getUser() independently; T-24-04-04 mitigated — kycUploadRatelimit before saveKyc, rolePromotionRatelimit before promoteRole |

## Self-Check

### Files Exist
- `apps/web/src/actions/coach-identity.ts` — FOUND
- `apps/web/src/components/coach/KycStatusChip.tsx` — FOUND
- `apps/web/src/components/coach/WizardProgress.tsx` — FOUND
- `apps/web/src/components/coach/SpecialtyTagInput.tsx` — FOUND
- `apps/web/src/components/coach/FileUploadRow.tsx` — FOUND
- `apps/web/src/components/coach/PhotoUpload.tsx` — FOUND
- `apps/web/src/components/coach/ProfileForm.tsx` — FOUND
- `apps/web/src/components/coach/KycDocList.tsx` — FOUND
- `apps/web/src/components/coach/WelcomeCard.tsx` — FOUND
- `apps/web/src/components/coach/WizardStep1Role.tsx` — FOUND
- `apps/web/src/components/coach/WizardStep2Profile.tsx` — FOUND
- `apps/web/src/components/coach/WizardStep3Kyc.tsx` — FOUND

### Commits Exist
- `c72e4c6` — feat(24-04): Server Actions + atomic components
- `fdd8fd2` — feat(24-04): FileUploadRow, PhotoUpload, ProfileForm, KycDocList, WelcomeCard, WizardStep components

### Verification Checks
- `grep -l 'getUser' apps/web/src/actions/coach-identity.ts` — FOUND (ARCH-05 layer 3)
- `grep -c 'promoteRole\|saveProfile\|saveKyc' apps/web/src/actions/coach-identity.ts` → 3 (all 3 Server Actions exported)
- `grep 'role="progressbar"' apps/web/src/components/coach/WizardProgress.tsx` — FOUND
- `grep 'aria-label' apps/web/src/components/coach/SpecialtyTagInput.tsx` → "Retirer {tag}" pattern FOUND
- `grep 'upload-url' apps/web/src/components/coach/FileUploadRow.tsx` — FOUND (bucket=coach-kyc)
- `tsc --noEmit -p apps/web/tsconfig.json` — PASSED (no errors)

## Self-Check: PASSED
