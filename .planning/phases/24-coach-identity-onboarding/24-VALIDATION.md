---
phase: 24
slug: coach-identity-onboarding
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-15
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3 (existing — backend/api/vitest.config.ts) |
| **Config file** | `backend/api/vitest.config.ts` |
| **Quick run command** | `cd backend/api && npm test -- --run coach-identity` |
| **Full suite command** | `npm run type-check && npm run lint && cd backend/api && npm test -- --run` |
| **Estimated runtime** | ~30 seconds (integration tests hit live Supabase) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend/api && npm test -- --run coach-identity`
- **After every plan wave:** Run `npm run type-check && npm run lint && cd backend/api && npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-housekeeping | 01 | 1 | ARCH-01 | — | `_smoke/` deleted, `_debug` deleted, no dead imports | manual + type-check | `turbo run type-check` | ✅ | ⬜ pending |
| 24-migration-037 | 01 | 2 | COACH-03 | — | `coach-kyc` bucket exists, RLS denies cross-user read | integration | `cd backend/api && npm test -- --run coach-identity` | ❌ W0 | ⬜ pending |
| 24-backend-module | 02 | 3 | ARCH-01, ARCH-03 | T-24-01 | No SERVICE_ROLE under coach/ | CI grep + integration | `.github/workflows ci no-service-role-in-coach` + `npm test -- --run coach-identity` | ❌ W0 | ⬜ pending |
| 24-role-promotion | 02 | 3 | COACH-01, COACH-04 | T-24-02 | role set to 'coach' or 'both', idempotent | integration | `cd backend/api && npm test -- --run coach-identity` | ❌ W0 | ⬜ pending |
| 24-profile-crud | 02 | 3 | COACH-02, COACH-05 | — | coach_profiles row created/updated; fields match CoachProfileSchema | integration | `cd backend/api && npm test -- --run coach-identity` | ❌ W0 | ⬜ pending |
| 24-kyc-upload | 03 | 3 | COACH-03 | — | kyc_docs JSONB updated; kyc_status stays 'pending' | integration | `cd backend/api && npm test -- --run coach-identity` | ❌ W0 | ⬜ pending |
| 24-login-page | 04 | 4 | COACH-01 | — | /fr/login renders, Server Action returns error on bad creds | manual smoke | manual | N/A | ⬜ pending |
| 24-onboarding-wizard | 05 | 5 | COACH-01, COACH-02, COACH-03, COACH-04 | — | Wizard completes; role promoted; coach_profiles created | manual smoke | manual | N/A | ⬜ pending |
| 24-dashboard-settings | 06 | 6 | COACH-05 | — | /coach/dashboard and /coach/settings render with real data | manual smoke | manual | N/A | ⬜ pending |
| 24-ci-guard | 07 | 7 | ARCH-03 | T-24-01 | CI grep finds no SERVICE_ROLE under backend/api/src/coach/ | CI | `turbo run lint` + ci job | ✅ (job exists) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/api/test/coach/identity.spec.ts` — integration tests for COACH-01 through COACH-04 (role promotion, profile CRUD, KYC docs, role='both' case). Mirrors structure of `backend/api/test/rls/` existing tests.
- [ ] `backend/api/test/coach/` directory — created alongside identity.spec.ts

Existing infrastructure covers fixtures and vitest config — only the test file itself is new.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /fr/login renders email+password form | COACH-01 | No Playwright; Next.js Server Components not unit-testable | Visit `/fr/login`; check form renders; submit bad creds → error shows |
| Post-login redirect on role | COACH-01, COACH-04 | Session-dependent routing; branch on role value | Login as coach → lands `/coach/dashboard`; login as client → redirected to `/coach/onboarding` |
| Wizard step 1 auth gate | COACH-01 | Requires unauthenticated browser session | Visit `/coach/onboarding` unauthenticated; click CTA → redirected to `/fr/login?next=/coach/onboarding` |
| Wizard step 2 photo upload | COACH-02 | File system + Storage integration | Upload photo in step 2; check 96×96 preview shows; complete step; verify `coach_profiles.photo_url` set |
| Settings page shows saved data | COACH-05 | SSR page rendering | Complete onboarding; open `/coach/settings`; verify fields prepopulated with saved data |
| KYC doc visible in settings | COACH-03 | JSONB rendering | Upload KYC doc in step 3; open `/coach/settings`; verify doc appears in doc list with correct type |
| Disabled sidebar nav items | COACH-01 (dashboard UX) | Client-side rendering | Open `/coach/dashboard`; verify Clients/Programmes/IA sidebar items show "Bientôt" badge and are not clickable |
| `?next=` allowlist blocks open-redirect | ARCH security | Security boundary | Try `/fr/login?next=https://evil.com`; after login, verify redirected to `/coach/dashboard` (not evil.com) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING (❌) references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
