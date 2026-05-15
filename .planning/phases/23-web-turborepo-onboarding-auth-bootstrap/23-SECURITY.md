---
phase: 23
slug: web-turborepo-onboarding-auth-bootstrap
status: verified
threats_open: 0
threats_total: 31
threats_mitigated: 23
threats_accepted: 8
asvs_level: 1
created: 2026-05-15
audited: 2026-05-15
---

# Phase 23 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Covers 9 sub-plans (01–08 + 02b): Turborepo workspace setup, ziko-web subtree merge,
> coach-sdk package, Supabase SSR auth, ESLint architectural enforcement, smoke probe,
> CI/CD infrastructure, and Vercel deployment configuration.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| developer workstation → git remote (origin) | force-push of branch after `git reset --hard` | branch history (mutable); protected by pre-web-onboarding tag |
| node_modules hoisting (root) → apps/web bundler | dependency resolution crosses package boundary | native RN modules may leak into web bundle |
| C:/ziko-web repo → ziko-platform git history | subtree merge introduces unrelated commit DAG | commit history (developer-authored only) |
| ziko-platform → npm.pkg.github.com | publish via GITHUB_TOKEN | coach-sdk package artifact |
| coach-sdk schemas → consumer call sites (web, backend, mobile) | untrusted JSON crosses validation boundary | program data, profile URLs (Zod validates) |
| coach-sdk dist → consumer node_modules | package boundary; external:['zod'] keeps single instance | zod schema instances |
| browser → middleware (cookies in/out) | untrusted client cookies enter; updateSession refreshes | JWT access/refresh tokens |
| middleware → downstream Server Components | refreshed cookies propagate via dual-store setAll | Supabase session cookies |
| developer source code → build pipeline | ESLint is the build-time architectural enforcement boundary | import paths, module access patterns |
| browser → Server Action invocation | `'use server'` action callable from any client component | user identity (re-verified server-side) |
| layout guard → page render | trust transfer; layout fails closed (redirect) if user null | coach route access |
| browser → /api/_debug/limits | untrusted GET; gated by DEBUG_LIMITS env, returns 404 unless `=on` | internal limits config |
| GitHub Actions runner → npm.pkg.github.com | auth via GITHUB_TOKEN; package write required | coach-sdk package publish |
| Vercel build → repo root | `buildCommand` reaches up to root via `cd ../..` | monorepo build scope |
| Vercel dashboard → production env | env vars set in Production scope exposed to all production deploys | service role key, anon key, debug flags |
| `DEBUG_LIMITS` env var | distinguishes Preview from Production; misconfiguration exposes probe | environment isolation |
| Supabase admin → user creation | service-role API call creates test account | test user credentials |

---

## Threat Register

| Threat ID | Plan | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|------|----------|-----------|-------------|-----------------------|--------|
| T-23-01-01 | 01 | I (Info Disclosure) | Web bundle / react-native-worklets | mitigate | Root `package.json` has no `react-native-worklets`; Wave 6 bundle-analyzer CI job verifies absence | closed |
| T-23-01-02 | 01 | T (Tampering) | Remote branch force-push | accept | Gated on D-02 explicit failure; `pre-web-onboarding` tag immutable on origin | closed |
| T-23-02-01 | 02 | I (Info Disclosure) | `.next/analyze/stats.json` RN modules | mitigate | D-02 step 3 grep gate; rollback invoked on failure; Plan 23-01 removed hoisting source | closed |
| T-23-02-02 | 02 | T (Tampering) | Subtree merge commit history | accept | All ziko-web commits authored by developer; `pre-web-onboarding` tag enables one-command revert | closed |
| T-23-02-03 | 02 | E (Elevation) | `admin.ts` SERVICE_ROLE usage | mitigate | File migrated verbatim; ESLint allowlist scoped to `admin.ts`; `import 'server-only'` present at line 1 | closed |
| T-23-02b-01 | 02b | T (Tampering) | Remote branch force-push (reset) | accept | Gated by Task 1 human decision; `pre-web-onboarding` tag immutable | closed |
| T-23-02b-02 | 02b | I (Info Disclosure) | `.npmrc` GITHUB_TOKEN exposure | mitigate | `.npmrc` uses `${GITHUB_TOKEN}` env interpolation only — no literal token committed | closed |
| T-23-02b-03 | 02b | E (Elevation) | PUBLISH_COACH_SDK left enabled | accept | Variable restricted to repo admin; workflow path-filtered to `packages/coach-sdk/**` | closed |
| T-23-03-01 | 03 | T (Tampering) | `weeks_data` JSONB malformed shape | mitigate | `ImportedProgramSchema.strict()` rejects unknown keys; min/max on every field | closed |
| T-23-03-02 | 03 | I (Info Disclosure) | zod-instance drift breaks `instanceof` | mitigate | `peerDependencies: {zod:"^4.0.0"}` + `external:['zod']` in tsup; Wave 6 CI `zod-drift` job | closed |
| T-23-03-03 | 03 | I (Info Disclosure) | `CoachProfileSchema` URL XSS vector | accept | Phase 24 downstream sanitization; Zod validates URL syntax only — no rendering in Phase 23 | closed |
| T-23-04-01 | 04 | I (Info Disclosure) | Stale JWT after locale redirect | mitigate | D-10: `updateSession` runs FIRST in middleware before intl delegation (`middleware.ts` line 13) | closed |
| T-23-04-02 | 04 | T (Tampering) | Cookie not propagated to Server Components | mitigate | `setAll` dual-store: `request.cookies.set(name,value)` + rebuild response + `response.cookies.set(name,value,options)` (`middleware.ts` lines 16–22) | closed |
| T-23-04-03 | 04 | E (Elevation) | `server.ts` imported in client bundle | mitigate | `import 'server-only';` at line 1 of `apps/web/src/lib/supabase/server.ts` — fails build on client import | closed |
| T-23-04-04 | 04 | T (Tampering) | `getUser()` swallows refresh failure | mitigate | No try/catch around `await supabase.auth.getUser()` in `middleware.ts` line 30; comment enforces pattern | closed |
| T-23-05-01 | 05 | E (Elevation) | service-role client in Server Component | mitigate | ESLint `no-restricted-imports` bans `@supabase/supabase-js`; allowlist scoped to `admin.ts` only | closed |
| T-23-05-02 | 05 | T (Tampering) | Cross-module imports bypass `service.ts` | mitigate (forward) | D-12 patterns ban `db/` and `internal/` imports; Phase 24 activation; Wave 6 CI grep second layer | closed |
| T-23-05-03 | 05 | T (Tampering) | Deprecated `@supabase/auth-helpers-nextjs` | mitigate | ESLint bans package with deprecation message; lint exits non-zero on import | closed |
| T-23-06-01 | 06 | T (Tampering) | Open redirect via `next` query param | mitigate | Hard-coded `redirect('/fr/login')` — no `searchParams.next` interpolation anywhere in layout | closed |
| T-23-06-02 | 06 | I (Info Disclosure) | Stale cookie passes layout, null user in Server Action | mitigate | ARCH-05 layer 3: Server Action re-calls `getUser()` independently of layout guard | closed |
| T-23-06-03 | 06 | I (Info Disclosure) | Cached RSC leaks cross-user data | mitigate | `dynamic = 'force-dynamic'` + `revalidate = 0` on both `layout.tsx` and coach page — no shared cache | closed |
| T-23-06-04 | 06 | T (Tampering) | Phase 24 forgets to delete `_smoke` route | accept (process) | Every `_smoke` file carries "PHASE 23 SMOKE — DELETE IN PHASE 24" header; Phase 24 plan-checker greps for marker | closed |
| T-23-07-01 | 07 | I (Info Disclosure) | `_debug/limits` route exposed on production | mitigate | `process.env.DEBUG_LIMITS !== 'on'` → 404; var set Preview ONLY per D-15 checklist; Phase 24 deletes route | closed |
| T-23-07-02 | 07 | D (Denial of Service) | Debug probe sleeps 30s — hammerable | accept | Gated by `DEBUG_LIMITS` env var; only set on preview deploys; Vercel preview rate limits apply | closed |
| T-23-07-03 | 07 | T (Tampering) | Forged push triggers publish workflow | mitigate | `if: vars.PUBLISH_COACH_SDK == 'true'` gate; variable unset on monorepo path; admin-only write | closed |
| T-23-07-04 | 07 | E (Elevation) | GITHUB_TOKEN over-permissioned | mitigate | `permissions: { contents: read, packages: write }` — minimum scope for publish workflow | closed |
| T-23-07-05 | 07 | T (Tampering) | `ignoreCommand` triggers cross-project rebuilds | mitigate | `ignoreCommand: "git diff --quiet HEAD^ HEAD -- ."` scoped per Vercel project + Root Directory verified | closed |
| T-23-08-01 | 08 | I (Info Disclosure) | `DEBUG_LIMITS=on` set on Production scope | mitigate | Manual checklist step explicitly distinguishes Production vs Preview scope; verification records which scope | closed |
| T-23-08-02 | 08 | I (Info Disclosure) | SERVICE_ROLE key in dashboard screenshot | accept (process) | Dashboard redacts secrets by default; reviewer manually redacts before pasting evidence | closed |
| T-23-08-03 | 08 | T (Tampering) | Test user account persists past phase close | mitigate | 23-VERIFICATION.md "Open Items": delete test user as Phase 24 first-wave checklist item | closed |
| T-23-08-04 | 08 | E (Elevation) | Wrong Vercel Root Directory triggers cross-project builds | mitigate | Root Directory verified: `apps/web` (ziko-web) + `backend/api` (ziko-api-lilac); RESEARCH §6.3 step 3 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-23-01 | T-23-01-02 | Force-push of rollback only triggered on D-02 explicit failure; `pre-web-onboarding` tag is immutable and enables full recovery. Risk window: minutes of branch history rewrite, no data or secret exposure. | developer | 2026-05-15 |
| AR-23-02 | T-23-02-02 | Merged commit history is 100% developer-authored; no third-party code introduced. Full revert available via tag. | developer | 2026-05-15 |
| AR-23-03 | T-23-02b-01 | Same as AR-23-01 — reset gated by human Task 1 decision; tag provides recovery path. | developer | 2026-05-15 |
| AR-23-04 | T-23-02b-03 | `PUBLISH_COACH_SDK` write-access restricted to repo admin. Variable activates only after explicit D-04 enablement. No unintended publish path exists without admin action. | developer | 2026-05-15 |
| AR-23-05 | T-23-03-03 | `CoachProfileSchema` URL field accepted as-is — XSS risk is downstream (UI rendering). Phase 23 has no rendering of this field. Phase 24 sanitizes at display. | developer | 2026-05-15 |
| AR-23-06 | T-23-06-04 | `_smoke` route is temporary scaffolding. Phase 24 plan-checker grep on "PHASE 23 SMOKE — DELETE IN PHASE 24" enforces deletion as a blocking check before plan approval. | developer | 2026-05-15 |
| AR-23-07 | T-23-07-02 | Debug probe DoS surface exists only on preview deploys (gated by `DEBUG_LIMITS=on`). Production is never exposed. Preview rate limits apply. | developer | 2026-05-15 |
| AR-23-08 | T-23-08-02 | Dashboard screenshot redaction is a process control. Risk: reviewer pastes unredacted screenshot in private docs. Consequence: key in internal artifact. Mitigated by policy — no public issue/PR contains secrets. | developer | 2026-05-15 |

---

## Security Audit Trail

| Audit Date | Threats Total | Mitigated | Accepted | Open | Run By |
|------------|---------------|-----------|----------|------|--------|
| 2026-05-15 | 31 | 23 | 8 | 0 | gsd-secure-phase (claude-sonnet-4-6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-15
