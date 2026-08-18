---
phase: 25
slug: invitations-mobile-mon-coach-minimal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `25-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 + @vitest/coverage-v8 3.2.4 (backend) |
| **Config file** | `backend/api/vitest.config.ts` (verify) + `backend/api/test/setup.ts` (shared bootstrap) |
| **Quick run command** | `cd backend/api && npm run test -- coach/invitations coach/clients` |
| **Full suite command** | `cd backend/api && npm run test && npm run test:rls` |
| **Estimated runtime** | ~30 seconds (quick) / ~120 seconds (full + RLS) |

Web e2e/component test infra not surveyed deeply — if Playwright/Vitest is not yet present in `apps/web/`, the planner must add a Wave 0 task to introduce it OR mark the cross-cutting safeNext test as Manual-Only.

---

## Sampling Rate

- **After every task commit:** Run `cd backend/api && npm run test -- coach/<module>` (subset for the touched module)
- **After every plan wave:** Run `cd backend/api && npm run test && npm run test:rls`
- **Before `/gsd-verify-work`:** Full suite must be green + RLS regression suite green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| INVITE-01 | Coach generates 6-char `[A-Z2-9]` code with 14d default expiration; persists to `coach_invitations` | unit (backend) + RLS | `npm run test -- coach/invitations` | ❌ W0 | ⬜ pending |
| INVITE-02 | Coach lists own invitations with computed status; revokes active code (sets `revoked_at`) | unit + RLS | `npm run test -- coach/invitations` | ❌ W0 | ⬜ pending |
| INVITE-03 | DB redeem RPC creates `coach_client_links` row (web-side wrapper) | RLS (exists) + integration | `npm run test:rls -- redeem-rpc.spec.ts` then `npm run test -- coach/clients/redeem` | ✅ partial / ❌ W0 wrapper | ⬜ pending |
| INVITE-04 | Rate limit: 6th IP attempt in 15min → 429; 11th user attempt in 1h → 429; both return constant-time envelope | integration (synthetic burst) | `npm run test -- coach/clients/ratelimit` | ❌ W0 | ⬜ pending |
| INVITE-04 | Timing test: max delta of redeem RPC response times < 50ms (p99-p1) across 6 input shapes | integration / timing | `npm run test -- coach/clients/timing` | ❌ W0 | ⬜ pending |
| INVITE-05 | `links/preview` returns coach preview payload (display_name, bio, specialties, photo_signed_url, kyc_status) on valid code | unit + integration | `npm run test -- coach/clients/preview` | ❌ W0 | ⬜ pending |
| INVITE-06 (web only) | Athlete DELETE `/coach/clients/links/:id` sets `revoked_at`; subsequent `is_coach_of()` returns FALSE | RLS + integration | `npm run test -- coach/clients/revoke` + `npm run test:rls -- coach-rls.spec.ts` | ✅ partial / ❌ W0 | ⬜ pending |
| INVITE-07 | Expired/used/revoked/missing code returns `{ ok: false, error_code: 'INVALID_OR_EXPIRED' }` (HTTP 200) | unit (table-driven) | `npm run test -- coach/clients/preview-errors` | ❌ W0 | ⬜ pending |
| X-cut | safeNext rejects `https://evil.com`; accepts `/r/[A-Z2-9]{6}` + `/redeem` | unit (table-driven) | `cd apps/web && npm run test -- actions/login` (if infra exists) | ❌ W0 / manual | ⬜ pending |
| X-cut | nanoid collision: mock `customAlphabet` to return a duplicate; assert 3-retry then success on third unique value | unit | `npm run test -- coach/invitations/generate-retry` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note on MOBILE-01 / MOBILE-05:** deferred to v1.6 seed per CONTEXT.md D-01 — out of Phase 25 scope, no validation required this phase.

---

## Wave 0 Requirements

- [ ] `backend/api/test/coach/invitations.spec.ts` — stubs for INVITE-01, INVITE-02, generate-retry
- [ ] `backend/api/test/coach/clients-preview.spec.ts` — stubs for INVITE-05, INVITE-07 (table-driven across all 6 error causes)
- [ ] `backend/api/test/coach/clients-redeem.spec.ts` — happy-path INVITE-03 wrapper test
- [ ] `backend/api/test/coach/clients-revoke.spec.ts` — INVITE-06 web-revoke half (DELETE endpoint + `is_coach_of()` follow-up read)
- [ ] `backend/api/test/coach/ratelimit.spec.ts` — INVITE-04 synthetic-burst test using mock Upstash or actual Upstash with unique key prefix
- [ ] `backend/api/test/coach/timing.spec.ts` — constant-time benchmark (N samples per error class; assert `max(p99) - min(p1) < 50ms` after warmup)
- [ ] `apps/web/test/safe-next.spec.ts` (if web test infra exists, else mark Manual-Only)
- [ ] Wave 0 install: `cd backend/api && npm install nanoid@^3.3.11` (per RESEARCH.md §Q3 — corrects CONTEXT.md D-08; v4/v5 are ESM-only)
- [ ] Wave 0 migration: create `supabase/migrations/038_peek_invitation_function.sql` and apply (per RESEARCH.md §Q2 — peek mirrors keystone RPC + LEFT JOIN to `coach_profiles`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generate-code copy-to-clipboard buttons work in browsers | UI (D-12) | Clipboard API requires real browser context + permissions | Manually verify "Copier le code" + "Copier le lien" on Chrome/Firefox/Safari |
| Typed-confirmation modal focus trap + Escape key | UI a11y (UI-SPEC §Accessibility) | Focus management requires real DOM | Tab through modal — focus stays inside; Escape closes |
| `/r/[code]` deep-link redirects unauthenticated user through login then back to redeem URL | INVITE-05 / Phase 24 safeNext | Multi-step navigation with cookie session | Logged-out browser → `/fr/r/ABCD23` → login → lands back at `/fr/r/ABCD23` with code prefilled |
| Coach photo signed-URL renders in preview card | INVITE-05 | Storage signed-URL TTL requires real Supabase env | Open preview card; verify image loads; wait 6+ min and re-check (should fail or 401) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 unit/integration files + migration 038 + nanoid install)
- [ ] No watch-mode flags in CI commands
- [ ] Feedback latency < 60s per-commit, < 120s per-wave
- [ ] `nyquist_compliant: true` set in frontmatter after planner inserts test stubs

**Approval:** pending
