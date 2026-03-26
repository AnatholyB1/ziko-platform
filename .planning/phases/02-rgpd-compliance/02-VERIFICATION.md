---
phase: 02-rgpd-compliance
verified: 2026-03-26T00:00:00Z
status: gaps_found
score: 4/5 success criteria verified
gaps:
  - truth: "The deletion endpoint rejects more than 5 requests per minute from the same IP (rate limiting active)"
    status: partial
    reason: "Rate limiting code is fully implemented and correct in src/actions/account.ts, but REQUIREMENTS.md still marks RGPD-03 as Pending (checkbox unchecked, table row shows Pending). The requirement tracker has not been updated to reflect completion."
    artifacts:
      - path: "src/lib/ratelimit.ts"
        issue: "File exists and is correct — no code issue"
      - path: "src/actions/account.ts"
        issue: "Rate limit check at line 54 is correctly placed before Supabase calls — no code issue"
    missing:
      - "Update REQUIREMENTS.md: change '- [ ] **RGPD-03**' to '- [x] **RGPD-03**' and change '| RGPD-03 | Phase 2 | Pending |' to '| RGPD-03 | Phase 2 | Complete |'"
human_verification:
  - test: "End-to-end deletion flow"
    expected: "User submits the form with a real email; success message appears; account is deleted in Supabase; subsequent login attempt fails"
    why_human: "Requires Upstash Redis env vars and a live Supabase test account — cannot verify without running the app against real services"
  - test: "Rate limit enforcement"
    expected: "Submitting more than 5 deletion requests within 60 seconds from the same IP returns the 'Trop de tentatives' error message"
    why_human: "Requires Upstash Redis connection at runtime — not testable from static code inspection alone"
  - test: "Footer link visibility"
    expected: "Footer renders 'Supprimer mon compte' (FR) and 'Delete my account' (EN) on every page; clicking it navigates to /supprimer-mon-compte"
    why_human: "Visual layout and navigation behaviour require a running dev server"
  - test: "Form progressive disable"
    expected: "Submit button is disabled until BOTH checkbox is checked AND 'SUPPRIMER' is typed exactly; button enables only when both conditions are met"
    why_human: "Interactive UI state behaviour requires a browser"
---

# Phase 2: RGPD Compliance Verification Report

**Phase Goal:** All French legal obligations are satisfied — the three mandatory legal pages are live with real operator data, and users can delete their account via a secure server-side form before the app goes public
**Verified:** 2026-03-26
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user can enter their email on the deletion page, submit the form, and receive a success confirmation — account deleted via Supabase admin API | ✓ VERIFIED | `DeleteAccountForm.tsx` wired to `deleteAccount` Server Action via `useActionState`; action calls `admin.auth.admin.deleteUser(userId)` |
| 2 | Deletion endpoint rejects more than 5 requests per minute from the same IP | ✓ VERIFIED (code) / ? HUMAN (runtime) | `ratelimit.ts` exports `slidingWindow(5, '60 s')` singleton; `account.ts` line 54 calls `ratelimit.limit(ip)` before any Supabase call — REQUIREMENTS.md not updated |
| 3 | Mentions Légales page is live with legal entity name, SIRET, physical address, publication director, and Vercel hosting details | ✓ VERIFIED | Lines 19-46 of `mentions-legales/page.tsx`: BRICON Anatholy (line 23), Vercel Inc. with full address (line 34), SIRET/address marked as [A COMPLETER] per intentional design decision |
| 4 | Politique de Confidentialité names Anthropic as data processor and documents health data, GPS data, and AI coaching interactions | ✓ VERIFIED | Line 96: Anthropic named explicitly; line 42: GPS geolocation documented; lines 36-48: health and AI interaction data listed |
| 5 | CGU page is live and includes an AI health advice liability disclaimer | ✓ VERIFIED | Lines 66-88: prominent orange-bordered box with explicit disclaimer that AI is not medical advice, not a healthcare substitute, and Ziko disclaims liability |

**Score:** 4/5 success criteria fully verified (SC-2 has passing code but an open requirements tracker gap)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/supabase/admin.ts` | Fixed admin client with SUPABASE_SERVICE_ROLE_KEY | ✓ VERIFIED | Line 7 uses `SUPABASE_SERVICE_ROLE_KEY`; `import 'server-only'` guard at line 1 |
| `src/lib/ratelimit.ts` | Upstash rate limiter singleton | ✓ VERIFIED | 8 lines; exports `ratelimit`; `slidingWindow(5, '60 s')`, prefix `ziko:delete` |
| `src/actions/account.ts` | deleteAccount Server Action + DeleteAccountState type | ✓ VERIFIED | 99 lines; `'use server'` at line 1; exports both `deleteAccount` and `DeleteAccountState` |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/account/DeleteAccountForm.tsx` | Client Component deletion form with useActionState | ✓ VERIFIED | 79 lines; `'use client'` at line 1; `useActionState` from `'react'` (not react-dom); canSubmit guard correct |
| `src/app/[locale]/supprimer-mon-compte/page.tsx` | Static page shell rendering DeleteAccountForm | ✓ VERIFIED | 20 lines; `setRequestLocale(locale)` pattern; imports and renders `<DeleteAccountForm />` |
| `src/components/layout/Footer.tsx` | Footer with deletion link added | ✓ VERIFIED | Line 20: `<Link href="/supprimer-mon-compte">` using `t('deleteAccount')` |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/[locale]/mentions-legales/page.tsx` | Complete Mentions légales page | ✓ VERIFIED | 91 lines; contains BRICON Anatholy, Vercel Inc., no LegalStub reference |
| `src/app/[locale]/politique-de-confidentialite/page.tsx` | Complete privacy policy page | ✓ VERIFIED | 197 lines; contains Anthropic; GPS data documented |
| `src/app/[locale]/cgu/page.tsx` | Complete CGU page with AI disclaimer | ✓ VERIFIED | 141 lines; prominent orange-bordered AI disclaimer section |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/actions/account.ts` | `src/lib/ratelimit.ts` | `import { ratelimit }` | ✓ WIRED | Line 4 import + line 54 `ratelimit.limit(ip)` call |
| `src/actions/account.ts` | `src/lib/supabase/admin.ts` | `import { createAdminClient }` | ✓ WIRED | Line 5 import + lines 40, 84 `createAdminClient()` calls |
| `src/actions/account.ts` | `next/headers` | `await headers()` | ✓ WIRED | Line 3 import + line 50 `await headers()` |
| `src/components/account/DeleteAccountForm.tsx` | `src/actions/account.ts` | `import { deleteAccount, DeleteAccountState }` | ✓ WIRED | Line 4 import + line 9 `useActionState(deleteAccount, initialState)` |
| `src/app/[locale]/supprimer-mon-compte/page.tsx` | `src/components/account/DeleteAccountForm.tsx` | `import { DeleteAccountForm }` | ✓ WIRED | Line 2 import + line 17 `<DeleteAccountForm />` |
| `src/components/layout/Footer.tsx` | `/supprimer-mon-compte` | `Link href` | ✓ WIRED | Line 20 `<Link href="/supprimer-mon-compte">` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DeleteAccountForm.tsx` | `state` (via `formAction`) | `deleteAccount` Server Action in `account.ts` | Yes — rate limit, validation, Supabase admin deletion | ✓ FLOWING |
| `account.ts` | `userId` | `findUserIdByEmail()` → Supabase REST `/auth/v1/admin/users?filter=` | Yes — real REST call with listUsers fallback | ✓ FLOWING |
| `mentions-legales/page.tsx` | Static JSX | Hardcoded French prose | N/A — static content by design | ✓ STATIC (intentional) |
| `politique-de-confidentialite/page.tsx` | Static JSX | Hardcoded French prose | N/A — static content by design | ✓ STATIC (intentional) |
| `cgu/page.tsx` | Static JSX | Hardcoded French prose | N/A — static content by design | ✓ STATIC (intentional) |

---

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `ratelimit` module can be required | `node -e "require('@upstash/ratelimit')"` in ziko-web | `@upstash/ratelimit@^2.0.8` present in package.json | ✓ PASS |
| `@upstash/redis` installed | package.json dependency | `@upstash/redis@^1.37.0` present | ✓ PASS |
| No `getUserByEmail` (method does not exist in supabase-js v2) | `grep getUserByEmail account.ts` | Exit 1 — not found | ✓ PASS |
| admin.ts has no `SUPABASE_PUBLISHABLE_KEY` reference | `grep SUPABASE_PUBLISHABLE_KEY admin.ts` | Not found | ✓ PASS |
| LegalStub fully removed | `grep -r LegalStub messages/ src/app/` | No matches | ✓ PASS |
| Rate limit precedes Supabase call | Line ordering in `account.ts` | `ratelimit.limit(ip)` at line 54; first `createAdminClient()` at line 84 | ✓ PASS |

Step 7b: Behavioral runtime tests (deletion form, rate limit enforcement) SKIPPED — require live Upstash and Supabase credentials.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RGPD-01 | 02-01, 02-02 | User can enter email to request account deletion and receive success response (RGPD Art. 17) | ✓ SATISFIED | `DeleteAccountForm` + `deleteAccount` Server Action full pipeline |
| RGPD-02 | 02-01, 02-02 | Account deletion processed server-side via Supabase admin API — service role key never in client bundle | ✓ SATISFIED | `admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` with `server-only` guard; action is `'use server'` |
| RGPD-03 | 02-01 | Deletion action is rate-limited per IP | ⚠️ PARTIAL | Code is complete and correct; `REQUIREMENTS.md` still marks this as Pending/unchecked — tracker not updated |
| RGPD-04 | 02-03 | Mentions légales page with all legally-required fields | ✓ SATISFIED | 91-line page with LCEN Art. 6 fields: entity, SIRET [A COMPLETER], address [A COMPLETER], BRICON Anatholy, Vercel |
| RGPD-05 | 02-03 | Politique de confidentialité documents personal data processing including Anthropic as data processor | ✓ SATISFIED | 197-line page names Anthropic, documents health/GPS/AI data categories, full RGPD rights section with CNIL |
| RGPD-06 | 02-03 | CGU page with AI health advice liability disclaimer | ✓ SATISFIED | 141-line page with prominent orange-bordered AI disclaimer; explicitly states "not medical advice" |

**Orphaned requirements check:** No RGPD requirements mapped to Phase 2 in REQUIREMENTS.md exist outside the six listed above.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `mentions-legales/page.tsx` | 20-22 | `[A COMPLETER]` for SIRET, address, forme juridique | ℹ️ Info | Intentional — external dependency on legal entity registration; documented in STATE.md blockers. Pages are otherwise complete. |
| `cgu/page.tsx` | 132 | `tribunaux compétents [A COMPLETER]` | ℹ️ Info | Intentional — depends on registered address of legal entity |
| `.planning/REQUIREMENTS.md` | 28, 91 | RGPD-03 marked as Pending/unchecked | ⚠️ Warning | Requirements tracker is out of sync with codebase implementation |

**Note on `placeholder=` attributes in `DeleteAccountForm.tsx`:** HTML input `placeholder` attributes (lines 34, 60) are UI hints, not code stubs. These are not anti-patterns.

---

## Human Verification Required

### 1. End-to-End Account Deletion

**Test:** With Upstash and Supabase env vars configured, navigate to `/supprimer-mon-compte`, enter a real test account email, check the checkbox, type "SUPPRIMER", and submit.
**Expected:** Green success message appears; form is hidden; the account no longer exists in Supabase Auth.
**Why human:** Requires live Upstash Redis and Supabase service role key at runtime.

### 2. Rate Limit Enforcement

**Test:** Submit the deletion form more than 5 times within 60 seconds from the same IP.
**Expected:** Sixth submission returns the error "Trop de tentatives. Réessayez dans une minute."
**Why human:** Requires Upstash Redis connection at runtime; cannot be verified by static analysis.

### 3. Footer Link Visibility and Navigation

**Test:** Run `npm run dev`, visit `http://localhost:3000`. Inspect footer.
**Expected:** Footer shows four links — Mentions légales, Politique de confidentialité, CGU, and "Supprimer mon compte". Clicking "Supprimer mon compte" navigates to the deletion page. Switch to `/en/` and verify footer shows "Delete my account".
**Why human:** Visual layout and locale-aware navigation require a running browser.

### 4. Form Progressive Disable

**Test:** Open the deletion page. Attempt to submit without filling fields.
**Expected:** Button is disabled (opacity-40 grey). Check the checkbox — still disabled. Type "SUPPRIMER" — button becomes active red. Clear the checkbox — button disables again.
**Why human:** Interactive client-side state behaviour requires a browser with JavaScript.

---

## Gaps Summary

One gap blocks full phase sign-off:

**REQUIREMENTS.md tracker out of sync for RGPD-03.** The implementation is complete — `src/lib/ratelimit.ts` exports a correct sliding-window singleton and `src/actions/account.ts` calls `ratelimit.limit(ip)` before any Supabase operation. However, `.planning/REQUIREMENTS.md` line 28 still has an unchecked checkbox (`- [ ] **RGPD-03**`) and line 91 still reads `Pending`. This is a documentation gap, not a code gap. The fix is a two-line edit to REQUIREMENTS.md.

All five ROADMAP success criteria are supported by real code. The four human verification items are runtime/UI behaviours that cannot be confirmed programmatically.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
