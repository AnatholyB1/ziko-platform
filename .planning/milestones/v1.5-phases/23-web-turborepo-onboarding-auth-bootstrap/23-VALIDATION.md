---
phase: 23
slug: web-turborepo-onboarding-auth-bootstrap
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
revised: 2026-05-15
audited: 2026-05-15
gaps_found: 1
gaps_resolved: 1
gaps_manual: 0
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `23-RESEARCH.md` §"Validation Architecture" (lines 646–693).
> Per-Task Verification Map populated by `gsd-planner` (revision iteration 1).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 (existing in `backend/api`; new in `packages/coach-sdk` + `apps/web`) |
| **Config files** | `packages/coach-sdk/vitest.config.ts` + `apps/web` Vitest invoked via npm script |
| **Quick run command** | `npm run lint --workspace=apps/web && npm run test --workspace=@ziko/coach-sdk -- --run` |
| **Full suite command** | `turbo run type-check lint test` |
| **Estimated runtime** | ~45–90 seconds (full suite, post-warmup) |

---

## Sampling Rate

- **After every task commit:** `npm run lint --workspace=apps/web && npm run test --workspace=@ziko/coach-sdk -- --run`
- **After every plan wave:** `turbo run type-check lint test`
- **Before `/gsd-verify-work`:** Full suite green + smoke deploy curl checks + bundle analyzer regex check (zero RN matches)
- **Max feedback latency:** ~90 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-T1 | 01 | 0 | ARCH-05 (RN-leak precursor) | T-23-01-01 | Root deps cannot hoist `react-native-worklets` into web bundle | grep | `! grep -q '"react-native-worklets"' package.json && grep -q '"react-native-worklets"' apps/mobile/package.json` | ✅ | ✅ green |
| 23-01-T2 | 01 | 0 | ARCH-05 | T-23-01-02 | Rollback tag preserves recoverable state before destructive merge | git | `git tag -l pre-web-onboarding \| grep -q pre-web-onboarding && git ls-remote --tags origin pre-web-onboarding \| grep -q pre-web-onboarding` | ✅ | ✅ green |
| 23-02-T1 | 02 | 1 | ARCH-05 | T-23-02-02, T-23-02-03 | History-preserving subtree merge; legacy admin.ts + 4 RGPD legal pages preserved | shell | `test -f apps/web/middleware.ts && test -f apps/web/src/lib/supabase/admin.ts && test -f "apps/web/src/app/[locale]/cgu/page.tsx" && npm ls --workspace=apps/web --depth=0` | ✅ | ✅ green |
| 23-02-T2 | 02 | 1 | ARCH-05 | — | Bundle analyzer is wired and emits stats.json on ANALYZE=true (v16 uses `analyzerMode: 'json'` — `generateStatsFile`/`statsFilename` removed) | grep | `npm ls --workspace=apps/web @next/bundle-analyzer --depth=0 && grep -q "withBundleAnalyzer" apps/web/next.config.ts && grep -q "analyzerMode: 'json'" apps/web/next.config.ts` | ✅ | ✅ green |
| 23-02-T3 | 02 | 1 | ARCH-05 (D-02 gate) | T-23-02-01 | Triple-green: web build + mobile prebuild + bundle clean | composite | `turbo run build --filter=web && (cd apps/mobile && npx expo prebuild --clean) && ANALYZE=true turbo run build --filter=web && ! grep -E '"name":\s*"[^"]*react-native(?!-web)' apps/web/.next/analyze/stats.json` | ✅ | ✅ green — UAT #5,#6 confirmed; monorepo path taken |
| 23-02b-T1..T5 | 02b | 1b | ARCH-04, ARCH-05 | T-23-02b-01..03 | Dual-repo fallback (contingent on 23-02-T3 FAIL) | composite | `! test -d apps/web && test -d packages/coach-sdk && gh variable get PUBLISH_COACH_SDK && npm view @ziko/coach-sdk --registry=https://npm.pkg.github.com versions` | ⚠ contingent | ✅ skipped — 23-02-T3 PASS; dual-repo path not taken (by design) |
| 23-03-T1 | 03 | 2 | ARCH-04 | T-23-03-02 | coach-sdk scaffold; peerDep zod ^4; external zod in tsup | shell | `test -f packages/coach-sdk/package.json && npm ls --workspace=@ziko/coach-sdk --depth=0 && grep -q "external: \['zod'\]" packages/coach-sdk/tsup.config.ts` | ✅ | ✅ green |
| 23-03-T2 | 03 | 2 | ARCH-04 | T-23-03-01, T-23-03-02 | 3 Zod schemas mirror migrations 034/035/036; tests green; dual ESM/CJS/dts built | unit + shell | `npm run test --workspace=@ziko/coach-sdk -- --run && turbo run build --filter=@ziko/coach-sdk && test -f packages/coach-sdk/dist/schemas/index.mjs && test -f packages/coach-sdk/dist/schemas/index.cjs && test -f packages/coach-sdk/dist/schemas/index.d.ts` | ✅ | ✅ green — 4/4 tests pass |
| 23-04-T1 | 04 | 3 | ARCH-05 | T-23-04-02, T-23-04-03 | @supabase/ssr installed; 3 factories created; admin.ts preserved | grep + shell | `npm ls --workspace=apps/web @supabase/ssr --depth=0 && head -1 apps/web/src/lib/supabase/server.ts \| grep -q "import 'server-only';" && grep -q "request.cookies.set" apps/web/src/lib/supabase/middleware.ts && grep -q "cache: 'no-store'" apps/web/src/lib/supabase/server.ts` | ✅ | ✅ green |
| 23-04-T2 | 04 | 3 | ARCH-05, ARCH-06 | T-23-04-01, T-23-04-04 | Composed middleware (Supabase first then next-intl); factories.spec.ts asserts updateSession returns NextResponse | unit | `grep -q "updateSession" apps/web/middleware.ts && grep -q "intlMiddleware" apps/web/middleware.ts && npm run test --workspace=apps/web -- --run` | ✅ | ✅ green — 3/3 tests pass |
| 23-05-T1 | 05 | 4 | ARCH-02, ARCH-05 | T-23-05-01, T-23-05-02, T-23-05-03 | ESLint bans @supabase/supabase-js + @supabase/auth-helpers-nextjs (error severity); allowlists admin.ts + tests; ships D-12 cross-module patterns | lint + grep | `grep -q "no-restricted-imports" apps/web/eslint.config.mjs && grep -q "\['error', {" apps/web/eslint.config.mjs && grep -q "@supabase/auth-helpers-nextjs" apps/web/eslint.config.mjs && grep -q "coach/\*/db" apps/web/eslint.config.mjs && npm run lint --workspace=apps/web` | ✅ | ✅ green — lint exits 0 |
| 23-06-T1 | 06 | 5 | ARCH-05, ARCH-06 | T-23-06-01, T-23-06-03 | Layout guards with getUser() + hard-coded /fr/login redirect; force-dynamic + revalidate=0 | grep + type-check | `grep -q "PHASE 23 SMOKE — DELETE IN PHASE 24" "apps/web/src/app/[locale]/(coach)/coach/layout.tsx" && grep -q "force-dynamic" "apps/web/src/app/[locale]/(coach)/coach/layout.tsx" && grep -q "redirect('/fr/login')" "apps/web/src/app/[locale]/(coach)/coach/layout.tsx" && grep -q "supabase.auth.getUser()" "apps/web/src/app/[locale]/(coach)/coach/layout.tsx"` | ✅ | ✅ green |
| 23-06-T2 | 06 | 5 | ARCH-05, ARCH-06 | T-23-06-02, T-23-06-04 | Smoke page renders user.id; Server Action re-checks getUser; SmokeButton client component invokes action | grep + type-check | `test -f "apps/web/src/app/[locale]/(coach)/coach/_smoke/page.tsx" && grep -q "'use server'" "apps/web/src/app/[locale]/(coach)/coach/_smoke/action.ts" && grep -q "'use client'" "apps/web/src/app/[locale]/(coach)/coach/_smoke/SmokeButton.tsx" && grep -q "smokeReCheck" "apps/web/src/app/[locale]/(coach)/coach/_smoke/SmokeButton.tsx" && turbo run type-check --filter=web` | ✅ | ✅ green |
| 23-07-T1 | 07 | 6 | ARCH-08 | T-23-07-01, T-23-07-02, T-23-07-05 | Vercel topology (2 vercel.json files with ignoreCommand); both _debug probes tagged DELETE | grep + type-check | `grep -q '"framework": "nextjs"' apps/web/vercel.json && grep -q "ignoreCommand" backend/api/vercel.json && grep -q "/supplements/cron/scrape" backend/api/vercel.json && grep -q "maxDuration = 60" apps/web/src/app/api/_debug/limits/route.ts && grep -q "PHASE 23 PRO PROBE" apps/web/src/app/api/_debug/limits/route.ts && turbo run type-check --filter=web --filter=api` | ✅ | ✅ green |
| 23-07-T2 | 07 | 6 | ARCH-02 | — | CI workflow APPENDS 4 jobs (preserves quality/deploy-backend/migrate-supabase); SERVICE_ROLE grep guarded by directory existence | grep | `grep -q "deploy-backend" .github/workflows/ci.yml && grep -q "migrate-supabase" .github/workflows/ci.yml && grep -q "type-check / lint / test" .github/workflows/ci.yml && grep -q "Verify no SERVICE_ROLE under coach/" .github/workflows/ci.yml && grep -q "\[ -d backend/api/src/coach \]" .github/workflows/ci.yml && ! grep -q "actions/cache@v3" .github/workflows/ci.yml` | ✅ | ✅ green |
| 23-07-T3 | 07 | 6 | ARCH-04 | T-23-07-03, T-23-07-04 | GHA publish workflow gated on vars.PUBLISH_COACH_SDK; no-op until D-04 activated | grep | `grep -q "Publish @ziko/coach-sdk" .github/workflows/publish-coach-sdk.yml && grep -q "vars.PUBLISH_COACH_SDK == 'true'" .github/workflows/publish-coach-sdk.yml && grep -q "registry-url: 'https://npm.pkg.github.com'" .github/workflows/publish-coach-sdk.yml` | ✅ | ✅ green |
| 23-08-T1 | 08 | 7 | ARCH-05, ARCH-08 | T-23-08-01, T-23-08-04 | .env.example template documents all required env vars and DEBUG_LIMITS preview-only convention | grep | `grep -q "NEXT_PUBLIC_SUPABASE_URL" apps/web/.env.example && grep -q "SUPABASE_SERVICE_ROLE_KEY" apps/web/.env.example && grep -q "DEBUG_LIMITS" apps/web/.env.example` | ✅ | ✅ green |
| 23-08-T2 | 08 | 7 | ARCH-05, ARCH-06, ARCH-08 | T-23-08-02, T-23-08-03 | Live preview proves: unauth → 307; authed → 200 + user.id; /api/_debug/limits → pro-confirmed after 30s on both projects; Cache-Control: no-store on (coach) responses | smoke | `curl -I $WEB_URL/fr/coach/_smoke \| head -1` returns 307; `curl -s -b $COOKIE $WEB_URL/fr/coach/_smoke \| grep "Signed in as"`; `curl -s -m 65 $WEB_URL/api/_debug/limits \| grep pro-confirmed`; `curl -s -m 65 $API_URL/_debug/limits \| grep pro-confirmed`; `curl -I -b $COOKIE $WEB_URL/fr/coach/_smoke \| grep -i "cache-control" \| grep -iE "no-store\|no-cache"` | ⚠ manual | ✅ green — UAT #7 PASS; SC1 (307) + SC3 (pro-confirmed) verified by user |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ⚠ manual = human-only verification*

### Phase Requirements → Test Map (from RESEARCH.md §"Validation Architecture")

| Req ID | Behavior | Test Type | Automated Command | Covered By |
|--------|----------|-----------|-------------------|------------|
| ARCH-02 (ESLint) | `no-restricted-imports` blocks `coach/*/db/**` and `coach/*/internal/**` from outside `service.ts` | lint | `npm run lint --workspace=apps/web` | 23-05-T1 |
| ARCH-02 (CI grep) | No `SERVICE_ROLE` references under `backend/api/src/coach/` | grep | `! grep -r 'SERVICE_ROLE' backend/api/src/coach/ 2>/dev/null` (exit 0) | 23-07-T2 |
| ARCH-04 (coach-sdk exists) | `import { ImportedProgramSchema } from '@ziko/coach-sdk/schemas'` resolves and runs | unit | `npm run test --workspace=@ziko/coach-sdk -- --run` | 23-03-T2 |
| ARCH-04 (round-trip) | All 3 Zod schemas accept golden inputs and reject malformed inputs | unit | same as above | 23-03-T2 |
| ARCH-04 (tree-shake) | `import` from `@ziko/coach-sdk/schemas` does not pull `@ziko/coach-sdk/types` | type-check | `tsc --noEmit` over imports in `apps/web` | 23-03-T2, 23-06-T2 |
| ARCH-05 (middleware refresh) | `updateSession()` returns a `NextResponse` with refreshed cookies | unit | `npm run test --workspace=apps/web -- factories.spec.ts` | 23-04-T2 |
| ARCH-05 (layout guard) | Coach layout's `getUser()` returns the test user under cookie injection | smoke | `curl -b sb-auth.cookie -s https://<preview>/fr/coach/_smoke` | 23-08-T2 |
| ARCH-05 (Server Action re-check) | Smoke button POST returns `{ ok: true, userId, ts }` | smoke | manual via preview deploy | 23-08-T2 |
| ARCH-05 (ESLint ban) | Lint fails when any file outside allowlist imports `@supabase/supabase-js` | lint | `npm run lint --workspace=apps/web` | 23-05-T1 |
| ARCH-06 (force-dynamic) | All `(coach)` routes declare `dynamic = 'force-dynamic'`, `revalidate = 0` | grep | `grep -L "force-dynamic" "apps/web/src/app/[locale]/(coach)/coach/**/*.tsx"` (zero files) | 23-06-T1, 23-06-T2 |
| ARCH-06 (no-store fetch) | Supabase server.ts injects `cache: 'no-store'` via global.fetch override | grep | `grep -q "cache: 'no-store'" apps/web/src/lib/supabase/server.ts` | 23-04-T1 |
| ARCH-06 (no-store HTTP header) | (coach) responses carry `Cache-Control: no-store` (or absence of `max-age`) | smoke | `curl -I -b $COOKIE $WEB_URL/fr/coach/_smoke \| grep -iE "no-store\|no-cache"` | 23-08-T2 |
| ARCH-08 (Pro tier — web) | `GET /api/_debug/limits` with `DEBUG_LIMITS=on` returns 200 after 30s | smoke | `curl -s -m 65 'https://<preview>/api/_debug/limits' \| jq` | 23-08-T2 |
| ARCH-08 (Pro tier — backend) | Same probe on `backend/api/src/routes/_debug.ts` | smoke | `curl -s -m 65 'https://ziko-api-lilac.vercel.app/_debug/limits'` | 23-08-T2 |
| Bundle hygiene (D-02 step 3) | Zero matches for `/react-native(?!-web)/` in `.next/analyze/stats.json` | CI grep | `ANALYZE=true turbo run build --filter=web && ! grep -E 'react-native(?!-web)' apps/web/.next/analyze/stats.json` | 23-02-T3, 23-07-T2 |
| Triple-green (D-02) | Web build green + mobile prebuild green + bundle clean | composite | spike script in RESEARCH.md §11 | 23-02-T3 |

---

## Wave 0 Requirements

- [x] `packages/coach-sdk/test/schemas.spec.ts` — covers ARCH-04 (Plan 23-03 Task 2)
- [x] `packages/coach-sdk/vitest.config.ts` — config mirrors `backend/api/vitest.config.ts` (Plan 23-03 Task 1)
- [x] `apps/web/src/lib/supabase/__tests__/factories.spec.ts` — covers ARCH-05 middleware unit (Plan 23-04 Task 2)
- [x] `.github/workflows/ci.yml` — MODIFY existing file to append 4 new jobs (Plan 23-07 Task 2, per WARNING 9 revision)
- [x] Framework install: `npm install --workspace=@ziko/coach-sdk --save-dev vitest@^3.2.4 tsup@^8.5.1` (Plan 23-03 Task 1)
- [x] `apps/web/.env.example` — template for required env vars (Plan 23-08 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| D-02 triple-green spike outcome (PASS or FAIL) | ARCH-05 / D-01 / D-02 | Human reviews 3 exit codes + bundle analyzer output and chooses monorepo vs dual-repo | Plan 23-02 Task 3 BLOCKING checkpoint; outcome recorded in 23-ROLLBACK.md |
| Authed GET on `/fr/coach/_smoke` renders `Signed in as {user.id}` | ARCH-05 | Cookie injection from `supabase.auth.admin.createUser()`; not yet automatable without a Playwright stack (deferred to Phase 24) | Plan 23-08 Task 2 — `curl -b @cookies.txt -s https://<preview>/fr/coach/_smoke` |
| Vercel Pro tier confirmed via `/api/_debug/limits` 30s sleep | ARCH-08 | Requires live preview with `DEBUG_LIMITS=on`; Hobby returns 504 at 10s | Plan 23-08 Task 2 — `curl -s -m 65 'https://<preview>/api/_debug/limits'` on both web + backend previews |
| Cache-Control: no-store on (coach) response | ARCH-06 | HTTP header check requires a live preview deploy | Plan 23-08 Task 2 — `curl -I -b $COOKIE $WEB_URL/fr/coach/_smoke` |
| Vercel dashboard project provisioning (ziko-web) | ARCH-08 / D-14 | One-time dashboard action; no API/CLI step | Plan 23-08 Task 2 manual checklist (Root Directory = apps/web, env vars in Production + Preview scopes, DEBUG_LIMITS=on Preview only) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every PLAN.md task has `<automated>` block; manual checkpoints documented above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every plan's first task has automated verification; multi-task plans verify per-task)
- [x] Wave 0 covers all MISSING references (`packages/coach-sdk/test/`, `apps/web/src/lib/supabase/__tests__/`, `.github/workflows/ci.yml` — all created or modified by Waves 0–6)
- [x] No watch-mode flags (`--run` everywhere; `--watch` banned)
- [x] Feedback latency < 90s (single-workspace tests run in seconds; full turbo suite well under 90s)
- [x] `nyquist_compliant: true` set in frontmatter (revision iteration 1)

**Approval:** approved (post-revision)

---

## Validation Audit 2026-05-15

| Metric | Count |
|--------|-------|
| Tasks audited | 17 |
| Gaps found | 1 |
| Resolved (command updated) | 1 |
| Escalated to manual | 0 |

**Note:** Gap on 23-02-T2 — validation command referenced `statsFilename: 'stats.json'` (removed in `@next/bundle-analyzer` v16). Updated to `analyzerMode: 'json'`. Behavior was correct; UAT #4 confirmed PASS. All 17 tasks now ✅ green or ✅ skipped-by-design.
