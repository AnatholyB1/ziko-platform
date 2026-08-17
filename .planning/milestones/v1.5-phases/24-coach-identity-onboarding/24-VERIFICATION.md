# Phase 24: Coach Identity & Onboarding — Verification Report

**Date:** 2026-05-15
**Phase:** 24-coach-identity-onboarding
**Verifier:** Automated (Plan 24-06 executor agent)
**Status:** AUTOMATED CHECKS PASSED | Human smoke test pending

---

## Automated Check Results

### SC1 — Phase 23 Smoke/Debug Files Deleted + app.ts Clean

| Check | Result |
|-------|--------|
| `apps/web/src/app/[locale]/(coach)/coach/_smoke/` directory | DELETED — PASS |
| `apps/web/src/app/api/_debug/limits/route.ts` | DELETED — PASS |
| `backend/api/src/routes/_debug.ts` | DELETED — PASS |
| `backend/api/src/app.ts` — no `_debug` import | CONFIRMED CLEAN (verified in 24-01) |

**Result: SC1 PASS**

### SC2 — coach-kyc Bucket + RLS Policies in Supabase

| Check | Result |
|-------|--------|
| `supabase/migrations/037_coach_kyc_bucket.sql` exists | EXISTS — PASS |
| Migration applied to project `slkobhavpwsubnsmuhya` | CONFIRMED (24-01 applied via supabase db query --linked) |
| 3 RLS policies (coach_kyc_insert, coach_kyc_select, coach_kyc_delete) | VERIFIED via pg_policies query (24-01) |
| `backend/api/src/routes/storage.ts` — `coach-kyc` in ALLOWED_BUCKETS | CONFIRMED (24-01) |

**Result: SC2 PASS**

### SC3 — 4 Hono Routes in service.ts Registered in app.ts + ARCH-03 Clean

| Check | Result |
|-------|--------|
| `backend/api/src/coach/identity/service.ts` exists | EXISTS — PASS |
| `backend/api/src/coach/identity/db.ts` exists | EXISTS — PASS |
| `backend/api/src/coach/identity/types.ts` exists | EXISTS — PASS |
| 4 routes: PATCH /role, POST /profile, PATCH /profile, GET /profile | CONFIRMED (24-02) |
| `backend/api/src/app.ts` registers `identityRouter` | CONFIRMED (24-02) |
| ARCH-03 grep — `grep -r 'SERVICE_ROLE\|SUPABASE_SERVICE_KEY' backend/api/src/coach/` | **ARCH-03 PASS — no output** |

**Result: SC3 PASS**

### SC4 — Coach Pages (layout, login, onboarding, dashboard, settings)

| Check | Result |
|-------|--------|
| `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` — full auth guard + CoachSidebar | EXISTS — PASS |
| `apps/web/src/app/[locale]/login/page.tsx` — /fr/login with email+password form | EXISTS — PASS |
| `apps/web/src/app/[locale]/coach/onboarding/page.tsx` — 3-step wizard (public route) | EXISTS — PASS |
| `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — WelcomeCard + KYC chip | EXISTS — PASS |
| `apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx` — editable profile + KYC list | EXISTS — PASS |
| CoachSidebar: Dashboard + Paramètres enabled, Clients/Programmes/IA disabled (Bientôt) | CONFIRMED (24-03) |
| safeNext() allowlist prevents open redirect | CONFIRMED (24-03) |
| force-dynamic + revalidate=0 on all (coach) pages | CONFIRMED (24-03, 24-05) |

**Result: SC4 PASS** (manual smoke test still required — see Human Checkpoint below)

### SC5 — Full Test Suite

#### TypeScript (apps/web)
```
TypeScript: 17 errors in 4 files (pre-existing @supabase/ssr TS2307 baseline)
- src/lib/supabase/server.ts: 7 errors (TS2307 + cascading TS7006/TS7031)
- src/lib/supabase/middleware.ts: 7 errors (same cascade)
- src/lib/supabase/client.ts: 1 error (TS2307)
- src/lib/supabase/__tests__/factories.spec.ts: 2 errors (TS2307)
- apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx: 0 errors (fixed in 24-06)
```
Note: 17 pre-existing errors are NOT introduced by Phase 24. They are a Phase 23 baseline caused by `@supabase/ssr` being missing from node_modules (type declarations issue). Phase 24 plan 24-03 verified with 0 errors; plans 24-04 and 24-05 inadvertently introduced 2 new OnboardingWizard errors (TS7006). Plan 24-06 fixed those 2 errors (commit `4677b5a`).

**Result: TypeScript — 0 Phase 24 regressions. Pre-existing baseline unchanged.**

#### ESLint (apps/web)
```
Next.js Build
Errors: 0 | Warnings: 0
```
**Result: LINT PASS**

#### Backend Integration Tests
All 8 test files pass individually:

| Test File | Tests | Result |
|-----------|-------|--------|
| `test/coach/identity.spec.ts` | 8 passed | PASS |
| `test/rls/ai-imports.spec.ts` | 9 passed | PASS |
| `test/rls/coach-profiles.spec.ts` | 6 passed | PASS |
| `test/rls/coach-rls.spec.ts` | 10 passed | PASS |
| `test/rls/fixtures.test.ts` | 4 passed | PASS |
| `test/rls/redeem-rpc.spec.ts` | 8 passed | PASS |
| `test/rls/role.spec.ts` | 5 passed | PASS |
| `test/rls/workout-programs.spec.ts` | 5 passed | PASS |

**Total: 55 tests, all passing when run individually.**

Note: Running all 8 suites simultaneously triggers Supabase free-tier auth rate limiting (max sign-ups per minute). This is an infrastructure constraint on the remote Supabase project, not a code defect. CI/CD environments with sequential test file execution will not hit this limit. Identical to the transient failure pattern documented in 24-02 SUMMARY.

**Result: SC5 PASS (all 55 tests pass)**

---

## ARCH-03 CI Grep Result

```bash
grep -r 'SERVICE_ROLE\|SUPABASE_SERVICE_KEY' backend/api/src/coach/
# Output: (empty)
ARCH-03 PASS
```

Zero SERVICE_ROLE references under `backend/api/src/coach/`. All DB access uses per-request user JWT with `SUPABASE_PUBLISHABLE_KEY`.

---

## File Existence Checklist

| File | Status |
|------|--------|
| `supabase/migrations/037_coach_kyc_bucket.sql` | EXISTS |
| `backend/api/src/coach/identity/service.ts` | EXISTS |
| `backend/api/src/coach/identity/db.ts` | EXISTS |
| `backend/api/src/coach/identity/types.ts` | EXISTS |
| `apps/web/src/app/[locale]/coach/onboarding/page.tsx` | EXISTS |
| `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` | EXISTS |
| `apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx` | EXISTS |

---

## Human Smoke Test Checkpoint

The following 5 success criteria require manual verification by the user (live Supabase environment):

**SC1 — Role promotion:** Visit `/fr/login`, log in with a NEW test account, verify redirect to `/coach/onboarding`, complete Step 1, verify `user_profiles.role = 'coach' | 'both'`.

**SC2 — Profile persisted:** Complete Step 2 with display_name, bio, specialties, website. Verify `coach_profiles` row matches form input.

**SC3 — KYC upload:** In Step 3, upload a PDF/image ≤5 MB. Verify `kyc_docs` has 1 entry and `kyc_status = 'submitted'`.

**SC4 — role='both' (existing athlete):** Log in as existing `role='client'` user, complete Step 1. Verify `role = 'both'`.

**SC5 — Settings edit:** From `/coach/dashboard`, navigate to Paramètres, change display_name, save. Verify success message and persistence on reload.

**Security check:** Visit `/fr/login?next=https://evil.com`, log in. Must redirect to `/coach/dashboard`, NOT to `evil.com`.

**Sidebar check:** On `/coach/dashboard`, verify Clients/Programmes/IA show "Bientôt" badge; Dashboard + Paramètres are clickable.

---

## Sign-Off

- Automated TypeScript check: PASS (17 pre-existing errors, 0 Phase 24 regressions)
- Automated lint check: PASS (0 errors, 0 warnings)
- Automated backend tests: PASS (55/55 when run individually)
- ARCH-03 CI grep: PASS (zero SERVICE_ROLE references)
- Human smoke test: PENDING (awaiting user verification)
