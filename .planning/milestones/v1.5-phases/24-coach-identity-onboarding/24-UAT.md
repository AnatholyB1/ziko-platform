---
status: complete
phase: 24-coach-identity-onboarding
source: [24-01-SUMMARY.md, 24-02-SUMMARY.md, 24-03-SUMMARY.md, 24-04-SUMMARY.md, 24-05-SUMMARY.md, 24-06-SUMMARY.md]
started: "2026-05-16T00:00:00.000Z"
updated: "2026-05-16T10:00:00.000Z"
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Kill any running local backend/web dev server (if running). Start the backend API from
  scratch: `cd backend/api && npm run dev`. Server boots without errors, the new
  `/coach/identity` routes are registered (no 404 on startup), and a
  `GET http://localhost:3000/health` returns a live 200 response.
result: pass

### 2. Login page loads
expected: |
  Navigate to https://ziko-app.com/fr/login (or localhost equivalent).
  You should see a login form with an email field, a password field, and a submit button.
result: pass

### 3. New user coach signup — role promotion (SC1)
expected: |
  Log in with a NEW test account (never used before — role defaults to 'client').
  After login, you should be automatically redirected to /coach/onboarding.
result: pass
note: re-tested after GAP fix — locale prefix now correct

### 4. Profile fields saved (SC2)
expected: |
  In Step 2 of onboarding (or via /coach/settings), fill in display name, bio,
  specialties, website. Submit. Reload — values should be pre-populated.
result: pass
note: fixed — NEXT_PUBLIC_API_URL added to apps/web/.env (user confirmed)

### 5. KYC document upload (SC3)
expected: |
  Upload a PDF/image ≤5 MB in Step 3 or /coach/settings. Filename pill appears.
  KYC status chip → "Soumis" (blue). Persists on reload.
result: pass
note: same fix as Test 4 — NEXT_PUBLIC_API_URL resolved the fetch failure

### 6. Existing athlete promotes to 'both' role (SC4)
expected: |
  Existing 'client' user completes Step 1 onboarding → role becomes 'both'.
result: pass
note: auto-verified — DB query confirms role='both' for anatholyb@gmail.com

### 7. Dashboard content
expected: |
  /coach/dashboard shows WelcomeCard with display_name, KYC status chip, Phase 25 teaser.
result: pass
note: re-tested after GAP fix — no marketing header on coach routes

### 8. Settings edit persists (SC5)
expected: |
  Change display_name in /coach/settings, save, reload — new value persists.
result: pass

### 9. Sidebar navigation: Bientôt badges
expected: |
  Dashboard + Paramètres clickable; Clients/Programmes/IA show "Bientôt" badge.
result: pass

### 10. Security: open redirect prevention
expected: |
  Login with ?next=https://evil.com → must redirect to /coach/dashboard, not evil.com.
result: pass

## Summary

total: 10
passed: 10
issues: 0
skipped: 0
blocked: 0
pending: 0

## Gaps

- truth: "After login, redirect goes to /{locale}/coach/onboarding with locale prefix"
  status: diagnosed
  reason: "User reported: Redirect après login va vers /coach/onboarding sans le préfixe /fr → 404"
  severity: major
  test: 3
  root_cause: "loginAction (login.ts:63-67) returns hardcoded locale-less paths ('/coach/onboarding', '/coach/dashboard'). LoginForm.tsx:21 calls router.push(state.redirectTo) verbatim. next-intl middleware short-circuits for /coach/* paths before intlMiddleware runs, so no locale prefix is injected."
  artifacts:
    - path: "apps/web/src/actions/login.ts"
      issue: "Lines 23, 65, 67 — redirect paths hardcoded without locale prefix"
    - path: "apps/web/src/app/[locale]/login/LoginForm.tsx"
      issue: "Line 21 — router.push() without prepending locale"
  missing:
    - "Add useLocale() in LoginForm and prepend locale to redirectTo before router.push"

- truth: "Photo/avatar and KYC file uploads complete successfully via Supabase Storage signed URLs"
  status: diagnosed
  reason: "User reported: Failed to fetch — PhotoUpload.tsx line 42 fetch to /storage/upload-url fails"
  severity: major
  test: 4
  root_cause: "NEXT_PUBLIC_API_URL not set in apps/web/.env.local or Vercel env — components fall back to http://localhost:3000 which is unreachable in production. Backend route GET /storage/upload-url exists and coach-kyc is in ALLOWED_BUCKETS."
  artifacts:
    - path: "apps/web/.env.local"
      issue: "Missing NEXT_PUBLIC_API_URL — added https://ziko-api-lilac.vercel.app"
  missing:
    - "Add NEXT_PUBLIC_API_URL=https://ziko-api-lilac.vercel.app to Vercel environment variables for apps/web project"

- truth: "KYC document upload completes — filename pill appears, KYC chip → Soumis, persists on reload"
  status: diagnosed
  reason: "Same as Test 4 — NEXT_PUBLIC_API_URL missing"
  severity: major
  test: 5
  root_cause: "Same as Test 4 — same env var missing, same fallback to localhost:3000"
  artifacts:
    - path: "apps/web/.env.local"
      issue: "Same — fixed alongside Test 4"
  missing:
    - "Same — add NEXT_PUBLIC_API_URL to Vercel env"

- truth: "Coach dashboard navbar is visually integrated with the page layout"
  status: resolved
  reason: "PASS on re-test — marketing header removed from coach routes via (marketing) route group"
  severity: minor
  test: 7
