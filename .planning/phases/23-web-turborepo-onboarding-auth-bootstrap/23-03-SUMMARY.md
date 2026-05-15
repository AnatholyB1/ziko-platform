---
phase: 23
plan: "03"
subsystem: packages/coach-sdk
tags: [phase-23, wave-2, coach-sdk, zod, tsup, schemas, vitest]
dependency_graph:
  requires: [23-02]
  provides: [packages/coach-sdk, ImportedProgramSchema, CoachClientLinkSchema, CoachProfileSchema]
  affects: [apps/web, backend/api, apps/mobile]
tech_stack:
  added: [tsup@8.5.1, vitest@3.2.4 (coach-sdk), zod@4.3.6 (workspace dep)]
  patterns: [dual-esm-cjs-tsup, zod-schema-as-source-of-truth, workspace-peer-dep, sub-path-exports]
key_files:
  created:
    - packages/coach-sdk/package.json
    - packages/coach-sdk/tsup.config.ts
    - packages/coach-sdk/tsconfig.json
    - packages/coach-sdk/vitest.config.ts
    - packages/coach-sdk/src/index.ts
    - packages/coach-sdk/src/schemas/index.ts
    - packages/coach-sdk/src/schemas/imported-program.ts
    - packages/coach-sdk/src/schemas/coach-client-link.ts
    - packages/coach-sdk/src/schemas/coach-profile.ts
    - packages/coach-sdk/src/types/index.ts
    - packages/coach-sdk/test/schemas.spec.ts
  modified:
    - packages/coach-sdk/tsup.config.ts (outExtension added after build deviation)
    - apps/web/package.json (@ziko/coach-sdk dep wired)
    - package-lock.json
decisions:
  - "outExtension added to tsup.config.ts: tsup default ESM emits .js not .mjs; explicit mapping required to match exports map"
  - "Test UUIDs use crypto.randomUUID() format: Zod v4 uses RFC 4122 strict UUID regex requiring version bits (1-8) and variant bits ([89abAB]); all-zeros UUIDs invalid"
  - "isLinkActive() and CoachKycStatusSchema/CoachKycDocSchema remain accessible via direct sub-path import; barrel (schemas/index.ts) only re-exports the three main schema names per plan spec"
metrics:
  duration: 10m
  completed: "2026-05-15"
  tasks_completed: 2
  files_created: 11
  files_modified: 3
  tests_added: 4
---

# Phase 23 Plan 03: coach-sdk Workspace Package Summary

**One-liner:** `packages/coach-sdk` workspace with Zod v4 triple schemas (ImportedProgram/CoachClientLink/CoachProfile), tsup dual ESM+CJS build with sub-path exports, and 4-test Vitest suite — single source of truth for weeks_data JSONB validation per Phase 22 D-11.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Scaffold coach-sdk package shape (manifest, configs, install deps) | f624c8c | package.json, tsup.config.ts, tsconfig.json, vitest.config.ts |
| 2 | Write three Zod schemas + barrels + types + tests, then build | 10f9594 | src/ (7 files), test/schemas.spec.ts, apps/web/package.json |

## Schema Traceability (Migration → Schema Field Counts)

| Schema | Migration | DB Columns | Zod Fields | Match |
|--------|-----------|------------|------------|-------|
| `CoachProfileSchema` | 034_coach_role_profiles.sql (lines 29–41) | 10 | 10 | 1:1 |
| `CoachClientLinkSchema` | 035_coach_invitations_links_rls.sql (lines 43–51) | 6 | 6 | 1:1 |
| `ImportedProgramSchema` | 036_workout_programs_ai_imports.sql (weeks_data JSONB) | JSONB | nested (Exercise/Session/Week/Program) | Zod-only guard per D-11 |

## Test Results

| Test | Status |
|------|--------|
| ImportedProgramSchema > parses a minimal valid program | PASS |
| ImportedProgramSchema > rejects negative reps | PASS |
| CoachClientLinkSchema > accepts active link | PASS |
| CoachProfileSchema > accepts valid kyc_status | PASS |

**Total: 4/4 PASS**

## Build Output

| File | Size | Format |
|------|------|--------|
| dist/schemas/index.mjs | 3.3 KB | ESM |
| dist/schemas/index.cjs | 3.6 KB | CJS |
| dist/schemas/index.d.ts | 2.9 KB | Types |
| dist/index.mjs | 3.3 KB | ESM |
| dist/index.cjs | 3.6 KB | CJS |
| dist/types/index.mjs | 70 B | ESM |
| dist/types/index.cjs | 84 B | CJS |

CJS bundle size 3.6 KB << 50 KB — confirms zod is external (not inlined).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tsup emits .js not .mjs for ESM by default**
- **Found during:** Task 2 build
- **Issue:** tsup's default ESM output extension is `.js`, but package.json exports map references `.mjs`. Build succeeded but import paths would not resolve at runtime.
- **Fix:** Added `outExtension({ format }) { return { js: format === 'esm' ? '.mjs' : '.cjs' }; }` to tsup.config.ts
- **Files modified:** packages/coach-sdk/tsup.config.ts
- **Commit:** 10f9594

**2. [Rule 1 - Bug] Test UUIDs rejected by Zod v4 strict RFC 4122 validator**
- **Found during:** Task 2 test run (2 of 4 tests failed)
- **Issue:** Zod v4 uses a stricter UUID regex requiring valid RFC 4122 version bits (1-8 in position 14) and variant bits ([89abAB] in position 19). Test data used all-zeros UUIDs like `00000000-0000-0000-0000-000000000001` which fail this check.
- **Fix:** Replaced placeholder UUIDs in test/schemas.spec.ts with valid v4 UUIDs generated via `crypto.randomUUID()` (e.g. `19e3cefa-dd66-4cc8-859c-36c0a54f62d8`)
- **Files modified:** packages/coach-sdk/test/schemas.spec.ts
- **Commit:** 10f9594

## Threat Model Coverage

| Threat | Mitigation | Status |
|--------|------------|--------|
| T-23-03-01: weeks_data JSONB tampering | `ImportedProgramSchema.strict()` with min/max on all fields | Implemented |
| T-23-03-02: zod-instance drift breaks instanceof | `peerDependencies: {zod:"^4.0.0"}` + `external:['zod']` in tsup | Implemented |
| T-23-03-03: CoachProfileSchema URL XSS | Accepted — Phase 24 UI sanitization is downstream | Accepted |

## Self-Check: PASSED

Files exist:
- packages/coach-sdk/package.json: YES
- packages/coach-sdk/dist/schemas/index.mjs: YES
- packages/coach-sdk/dist/schemas/index.cjs: YES
- packages/coach-sdk/dist/schemas/index.d.ts: YES
- packages/coach-sdk/dist/types/index.mjs: YES
- packages/coach-sdk/dist/index.mjs: YES

Commits exist:
- f624c8c (Task 1 scaffold): YES
- 10f9594 (Task 2 schemas + build): YES

Runtime verification:
- `node -e "require('./packages/coach-sdk/dist/schemas/index.cjs')"` → `['CoachClientLinkSchema', 'CoachProfileSchema', 'ImportedProgramSchema']` PASS
- 4/4 Vitest tests PASS
- zod external confirmed: CJS bundle 3.6 KB (< 50 KB threshold)
- apps/web dependency wired: `@ziko/coach-sdk: "^0.1.0"` in apps/web/package.json
