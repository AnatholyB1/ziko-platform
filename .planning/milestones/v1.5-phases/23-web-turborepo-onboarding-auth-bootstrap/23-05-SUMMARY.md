---
phase: 23
plan: "05"
subsystem: apps/web
tags: [phase-23, wave-4, eslint, no-restricted-imports, arch-02, arch-05]
dependency_graph:
  requires: [23-04]
  provides: [D-11-ban, D-12-ban]
  affects: [apps/web/eslint.config.mjs]
tech_stack:
  added: []
  patterns: [eslint-flat-config-layering, no-restricted-imports-allowlist]
key_files:
  modified:
    - apps/web/eslint.config.mjs
decisions:
  - "[Phase 23-05]: D-11 ban uses error severity (not warn) — violations block CI, not just warn"
  - "[Phase 23-05]: scripts/**/*.js override added for @typescript-eslint/no-require-imports — CJS Node.js utility scripts need require(); this pre-existing issue was blocking lint exit 0"
  - "[Phase 23-05]: D-12 patterns ship now as forward-looking no-ops — ESLint silently ignores patterns matching no files; activates automatically when Phase 24 creates coach/<module>/db/ folders"
metrics:
  duration: "5m"
  completed: "2026-05-15T10:55:00Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 23 Plan 05: D-11 + D-12 ESLint Import Bans Summary

**One-liner:** ESLint flat-config D-11 bans `@supabase/supabase-js` (ARCH-05) and D-12 bans cross-module `coach/*/db/**` + `coach/*/internal/**` imports (ARCH-02), both as errors, with allowlists for `admin.ts`, tests, and `service.ts`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace eslint.config.mjs with D-11 + D-12 layered config | 080d519 | apps/web/eslint.config.mjs |

## Rule Layers Added

### D-11: @supabase/supabase-js ban (ARCH-05)

- **Severity:** `error` (blocks CI)
- **Banned packages:** `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`
- **Message for supabase-js:** `Use @supabase/ssr factories from src/lib/supabase/. See ARCH-05.`
- **Message for auth-helpers:** `Deprecated. Use @supabase/ssr instead. See ARCH-05.`
- **Allowlist:** `src/lib/supabase/admin.ts`, `**/*.test.{ts,tsx}`, `**/*.spec.{ts,tsx}`
- **Rationale for allowlist:** `admin.ts` is the canonical service-role client; it correctly imports `@supabase/supabase-js` directly. Tests may need direct imports for mocking.

### D-12: Cross-module import ban (ARCH-02)

- **Banned patterns:** `**/coach/*/db/**`, `**/coach/*/internal/**`
- **Message:** `Cross-module DB/internal imports forbidden. Use the module's service.ts. See ARCH-02.`
- **Allowlist:** `**/coach/*/service.ts`
- **Status:** Forward-looking no-op — no Phase 24 folders exist yet. ESLint silently ignores patterns matching no files. Activates automatically when Phase 24 creates `apps/web/src/coach/<module>/db/` structure.

## Lint Result

- `npm run lint --workspace=apps/web` exits 0 on current tree.
- Smoke test confirmed: temporary `src/lib/_smoke_lint.ts` importing `@supabase/supabase-js` triggered `error: '@supabase/supabase-js' import is restricted... Use @supabase/ssr factories from src/lib/supabase/. See ARCH-05`. File deleted; lint green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing lint failures in scripts/ blocking exit 0**
- **Found during:** Task 1 verification (first lint run)
- **Issue:** `apps/web/scripts/generate-og-image.js` and `scripts/generate-placeholder.js` use CommonJS `require()`, which triggered `@typescript-eslint/no-require-imports` errors. These scripts pre-existed the merge; they are plain Node.js CJS utilities that legitimately need `require()`.
- **Fix:** Added `scripts/**/*.js` override in eslint.config.mjs to set `@typescript-eslint/no-require-imports: 'off'` for that directory.
- **Files modified:** `apps/web/eslint.config.mjs`
- **Commit:** 080d519 (included in same task commit)

## Known Stubs

None — this plan modifies only ESLint configuration; no UI or data stubs introduced.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. ESLint config is build-time only.

## Self-Check: PASSED

- [x] `apps/web/eslint.config.mjs` exists and contains `no-restricted-imports`, `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`, `src/lib/supabase/admin.ts`, `coach/*/db`, `coach/*/internal`
- [x] Commit `080d519` exists in git log
- [x] `npm run lint --workspace=apps/web` exits 0
- [x] Smoke test confirmed ban fires with correct ARCH-05 message
