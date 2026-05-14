---
phase: 23
slug: web-turborepo-onboarding-auth-bootstrap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `23-RESEARCH.md` §"Validation Architecture" (lines 646–693).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 (existing in `backend/api`; new in `packages/coach-sdk` + `apps/web`) |
| **Config file** | `packages/coach-sdk/vitest.config.ts` (mirrors `backend/api/vitest.config.ts` shape) |
| **Quick run command** | `npm run lint --workspace=apps/web && npm run test --workspace=@ziko/coach-sdk -- --run` |
| **Full suite command** | `turbo run type-check lint test` |
| **Estimated runtime** | ~45–90 seconds (full suite, post-warmup) |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint --workspace=apps/web && npm run test --workspace=@ziko/coach-sdk -- --run`
- **After every plan wave:** Run `turbo run type-check lint test`
- **Before `/gsd-verify-work`:** Full suite green + smoke deploy curl checks + bundle analyzer regex check (zero RN matches)
- **Max feedback latency:** ~90 seconds (full suite)

---

## Per-Task Verification Map

> Populated by `gsd-planner` during planning. Each task in PLAN.md must reference a row below by `task_id` and have either an `<automated>` verify or a Wave 0 dependency.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-XX-XX | XX | X | REQ-XX | T-23-XX / — | (to be filled by planner) | unit/lint/grep/smoke | `(command)` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Phase Requirements → Test Map (from RESEARCH.md §"Validation Architecture")

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-02 (ESLint) | `no-restricted-imports` blocks `coach/*/db/**` and `coach/*/internal/**` from outside `service.ts` | lint | `npm run lint --workspace=apps/web` | ❌ Wave 0 |
| ARCH-02 (CI grep) | No `SERVICE_ROLE` references under `backend/api/src/coach/` | grep | `! grep -r 'SERVICE_ROLE' backend/api/src/coach/ 2>/dev/null` (exit 0) | ❌ Wave 0 |
| ARCH-04 (coach-sdk exists) | `import { ImportedProgramSchema } from '@ziko/coach-sdk/schemas'` resolves and runs | unit | `npm run test --workspace=@ziko/coach-sdk -- --run` | ❌ Wave 0 |
| ARCH-04 (round-trip) | All 3 Zod schemas accept golden inputs and reject malformed inputs | unit | same as above | ❌ Wave 0 |
| ARCH-04 (tree-shake) | `import` from `@ziko/coach-sdk/schemas` does not pull `@ziko/coach-sdk/types` | type-check | `tsc --noEmit` over imports in `apps/web` | ❌ Wave 0 |
| ARCH-05 (middleware refresh) | `updateSession()` returns a `NextResponse` with refreshed cookies | unit | `npm run test --workspace=apps/web -- factories.spec.ts` | ❌ Wave 0 |
| ARCH-05 (layout guard) | Coach layout's `getUser()` returns the test user under cookie injection | smoke | `curl -b sb-auth.cookie -s https://<preview>/fr/coach/_smoke` | ❌ Wave-final |
| ARCH-05 (Server Action re-check) | Smoke button POST returns `{ ok: true, userId, ts }` | smoke | manual via preview deploy | ❌ Wave-final |
| ARCH-05 (ESLint ban) | Lint fails when any file outside allowlist imports `@supabase/supabase-js` | lint | `npm run lint --workspace=apps/web` | ❌ Wave 0 |
| ARCH-06 (force-dynamic) | All `(coach)` routes declare `dynamic = 'force-dynamic'`, `revalidate = 0` | grep | `grep -L "force-dynamic" apps/web/src/app/\[locale\]/\(coach\)/**/page.tsx` (zero files) | ❌ Wave-final |
| ARCH-06 (no-store) | All Supabase reads in `(coach)` use `cache: 'no-store'` or are uncached server reads | grep + manual | `grep -r "cache:" apps/web/src/app/\[locale\]/\(coach\)/` audit | ❌ Wave-final |
| ARCH-08 (Pro tier — web) | `GET /api/_debug/limits` with `DEBUG_LIMITS=on` returns 200 after 30s | smoke | `curl -s -m 65 'https://<preview>/api/_debug/limits' \| jq` | ❌ Wave-final |
| ARCH-08 (Pro tier — backend) | Same probe on `backend/api/src/routes/_debug.ts` | smoke | `curl -s -m 65 'https://ziko-api-lilac.vercel.app/_debug/limits'` | ❌ Wave-final |
| Bundle hygiene (D-02 step 3) | Zero matches for `/react-native(?!-web)/` in `.next/analyze/client.json` | CI grep | `ANALYZE=true turbo run build --filter=web && ! grep -E 'react-native(?!-web)' apps/web/.next/analyze/client.json` | ❌ Wave 0 |
| Triple-green (D-02) | Web build green + mobile prebuild green + bundle clean | composite | spike script in RESEARCH.md §11 | ❌ Spike day |

---

## Wave 0 Requirements

- [ ] `packages/coach-sdk/test/schemas.spec.ts` — covers ARCH-04 (round-trip parse/safeParse for all 3 schemas: `ImportedProgramSchema`, `CoachClientLinkSchema`, `CoachProfileSchema`)
- [ ] `packages/coach-sdk/vitest.config.ts` — config mirrors `backend/api/vitest.config.ts` shape
- [ ] `apps/web/src/lib/supabase/__tests__/factories.spec.ts` — covers ARCH-05 middleware unit + factory return-type assertions (mocked cookies)
- [ ] `.github/workflows/ci.yml` — new workflow with `type-check`, `lint`, `test`, `grep SERVICE_ROLE`, and `bundle-analyzer` regex steps
- [ ] Framework install: `npm install --workspace=@ziko/coach-sdk --save-dev vitest@^3.2.4 tsup@^8.5.1`
- [ ] `apps/web/.env.example` — template for required env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` server-only, `DEBUG_LIMITS` preview-only)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Authed GET on `/fr/coach/_smoke` renders `Signed in as {user.id}` | ARCH-05 | Requires cookie injection from a `supabase.auth.admin.createUser()` admin call against the Supabase staging project; not yet automatable without a Playwright stack (deferred to Phase 24) | (1) `supabase.auth.admin.createUser({ email: 'phase23-smoke@test.invalid', email_confirm: true })` (2) Sign user in via SDK, capture `sb-*` cookies from response (3) `curl -b @cookies.txt -s https://<preview>/fr/coach/_smoke` (4) Expect 200 + `Signed in as <uuid>` in HTML |
| Vercel Pro tier confirmed via `/api/_debug/limits` 30s sleep | ARCH-08 | Requires a live preview deploy with `DEBUG_LIMITS=on` env var; Hobby tier returns 504 at 10s, Pro returns 200 at 30s | (1) Set `DEBUG_LIMITS=on` on a preview deploy only (2) `curl -s -m 65 'https://<preview>/api/_debug/limits'` (3) Expect 200 + `{"ok":true,"tier":"pro-confirmed"}` (4) Repeat for `backend/api`; record both responses in `23-VERIFICATION.md` |
| Vercel dashboard project provisioning (ziko-web) | ARCH-08 / D-14 | Vercel project creation is a one-time dashboard action (`Add Project → import apps/web/ root`); no API/CLI step in the CI workflow | Manual checklist task in the final wave of PLAN.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`packages/coach-sdk/test/`, `apps/web/src/lib/supabase/__tests__/`, `.github/workflows/ci.yml`)
- [ ] No watch-mode flags (`--run` everywhere; `--watch` banned)
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter after planner populates Per-Task Verification Map

**Approval:** pending
