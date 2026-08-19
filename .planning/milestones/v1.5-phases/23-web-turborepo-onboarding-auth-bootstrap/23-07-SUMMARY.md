---
phase: 23-web-turborepo-onboarding-auth-bootstrap
plan: "07"
subsystem: vercel-topology / ci-guardrails / gha-release
tags: [phase-23, wave-6, vercel-topology, pro-tier-probe, ci-guardrails, gha-release]
dependency_graph:
  requires: [23-03, 23-04, 23-05]
  provides: [vercel-topology, ci-pipeline, coach-sdk-release-insurance]
  affects: [.github/workflows, apps/web, backend/api]
tech_stack:
  added: []
  patterns:
    - Vercel ignoreCommand per-project for monorepo skip optimization
    - Next.js App Router Route Handler with maxDuration export
    - Hono route module with Vercel config export
    - GitHub Actions matrix: turbo-scoped jobs, dir-existence-gated grep, ANALYZE build
    - GHA conditional publish workflow gated by repository variable
key_files:
  created:
    - apps/web/vercel.json
    - apps/web/src/app/api/_debug/limits/route.ts
    - backend/api/src/routes/_debug.ts
    - .github/workflows/publish-coach-sdk.yml
  modified:
    - backend/api/vercel.json
    - backend/api/src/app.ts
    - .github/workflows/ci.yml
decisions:
  - "D-15: _debug probes gated by DEBUG_LIMITS=on env var — returns 404 on production, 200 after 30s confirms Pro tier"
  - "ARCH-02: CI no-service-role-in-coach job guards with [ -d backend/api/src/coach ] — passes in Phase 23 before dir exists"
  - "D-04: publish-coach-sdk.yml ships as no-op (vars.PUBLISH_COACH_SDK unset on monorepo path)"
  - "ignoreCommand uses git diff --quiet HEAD^ HEAD -- . in both Vercel configs for per-project skip"
metrics:
  duration: "8m"
  completed_date: "2026-05-15"
  tasks_completed: 3
  files_modified: 7
---

# Phase 23 Plan 07: Vercel Topology + CI Guardrails + GHA Release Insurance Summary

Vercel two-project topology configured with per-project ignoreCommand; Pro-tier evidence probes created on both web and backend (tagged DELETE IN PHASE 24); CI extended with 4 new jobs covering type-check/lint/test, ARCH-02 SERVICE_ROLE grep, bundle hygiene, and zod drift; conditional @ziko/coach-sdk publish workflow shipped as D-04 insurance.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Vercel configs + _debug probes | a003b95 | apps/web/vercel.json, backend/api/vercel.json, apps/web/src/app/api/_debug/limits/route.ts, backend/api/src/routes/_debug.ts, backend/api/src/app.ts |
| 2 | CI workflow 4 new jobs | 7e764e3 | .github/workflows/ci.yml |
| 3 | publish-coach-sdk GHA workflow | cbafa92 | .github/workflows/publish-coach-sdk.yml |

## Artifacts

### apps/web/vercel.json
- framework: nextjs
- buildCommand: `cd ../.. && turbo run build --filter=web`
- installCommand: `cd ../.. && npm install`
- outputDirectory: .next
- ignoreCommand: `git diff --quiet HEAD^ HEAD -- .`

### backend/api/vercel.json
- Preserved: buildCommand, rewrites (/(.*) → /api/app), crons (supplements + storage)
- Added: ignoreCommand: `git diff --quiet HEAD^ HEAD -- .`

### _debug probes (both tagged DELETE IN PHASE 24)
- `apps/web/src/app/api/_debug/limits/route.ts`: Next.js Route Handler, `export const maxDuration = 60`, gated by `DEBUG_LIMITS !== 'on'` → 404, 30s sleep → `{ ok: true, tier: 'pro-confirmed', durationSec: 30 }`
- `backend/api/src/routes/_debug.ts`: Hono router, same gate + sleep, `export const config = { maxDuration: 60 }`, mounted at `/_debug` in app.ts

### .github/workflows/ci.yml — 4 new jobs
| Job | Name | Purpose |
|-----|------|---------|
| verify | type-check / lint / test | turbo run across all packages (ARCH-08 CI baseline) |
| no-service-role-in-coach | Verify no SERVICE_ROLE under coach/ | ARCH-02 enforcement, dir-existence gated |
| bundle-hygiene | Verify no react-native in web bundle | D-02 step 3, ANALYZE=true build |
| zod-drift | coach-sdk zod resolves to root zod | D-08 hoisting safety |

pull_request trigger added (was push-only before).

### .github/workflows/publish-coach-sdk.yml
- Triggers: push to main on `packages/coach-sdk/**` + workflow_dispatch
- Gate: `if: ${{ vars.PUBLISH_COACH_SDK == 'true' }}` — no-op on monorepo path
- permissions: contents read, packages write
- registry: npm.pkg.github.com, scope: @ziko
- D-04 insurance: activates only if dual-repo fallback engages

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all files are complete infrastructure/config with no UI or data-flow stubs.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: info-disclosure | apps/web/src/app/api/_debug/limits/route.ts | _debug probe — mitigated by DEBUG_LIMITS gate + Phase 24 deletion |
| threat_flag: info-disclosure | backend/api/src/routes/_debug.ts | _debug probe — same mitigation |

## Self-Check: PASSED

- apps/web/vercel.json: EXISTS, contains framework+ignoreCommand
- backend/api/vercel.json: EXISTS, contains ignoreCommand+crons
- apps/web/src/app/api/_debug/limits/route.ts: EXISTS
- backend/api/src/routes/_debug.ts: EXISTS
- .github/workflows/ci.yml: EXISTS, all 7 jobs present
- .github/workflows/publish-coach-sdk.yml: EXISTS
- Commits a003b95, 7e764e3, cbafa92: verified in git log
