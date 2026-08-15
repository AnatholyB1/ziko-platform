---
phase: 02-download-match-dry-run
plan: 01
subsystem: testing
tags: [vitest, fastest-levenshtein, npm, monorepo-tooling]

# Dependency graph
requires:
  - phase: 01-schema
    provides: exercises schema + REQUIREMENTS.md/ROADMAP.md context for Phase 2
provides:
  - "fastest-levenshtein@1.0.16 installed at repo root (human-approved via blocking package-legitimacy checkpoint)"
  - "Root-level vitest.config.ts scoped to scripts/exercise-import/**/*.test.ts — first root test-runner home in the monorepo"
  - "npm run test:import script"
  - "scripts/exercise-import/.dataset-cache/ gitignored"
  - "scripts/exercise-import/README.md documenting pipeline order, env vars, invocation, module-system constraint"
affects: [02-02, 02-03, 02-04, 02-05, phase-3-merge]

# Tech tracking
tech-stack:
  added: [fastest-levenshtein@1.0.16, vitest@^3.2.7 (root), "@vitest/coverage-v8@^3.2.7 (root)"]
  patterns: ["Root-level vitest config scoped by test.include glob, separate from backend/api's own vitest config", "Pipeline scripts run via tsx from repo root only — no __dirname/import.meta.url in lib/**"]

key-files:
  created: [vitest.config.ts, scripts/exercise-import/README.md]
  modified: [package.json, package-lock.json, .gitignore]

key-decisions:
  - "fastest-levenshtein approved after independent npm registry + slopcheck verification (repo github.com/ka-weihe/fastest-levenshtein, v1.0.16, MIT, no deprecation, no risky install scripts, ~25.4M weekly downloads) — exact pin (no caret) per threat model T-02-SC"
  - "Root vitest.config.ts has no setupFiles and is narrowly scoped to scripts/exercise-import/**/*.test.ts so it never collides with backend/api's own vitest suite"

patterns-established:
  - "Pipeline scripts (fetch.ts/match.ts) are thin CommonJS-compiled entrypoints; all testable logic lives in lib/** with repo-root-relative path constants (lib/paths.ts, not yet created — arrives in plan 02-02)"

requirements-completed: [IMPORT-01, IMPORT-02]

# Metrics
duration: 16min
completed: 2026-08-15
---

# Phase 2 Plan 1: Toolchain Scaffold Summary

**Root-level vitest test-runner home + fastest-levenshtein@1.0.16 install (human-approved) + gitignored dataset-cache path, closing the Wave 0 "no root test runner" gap for the entire exercise-import pipeline.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-15T01:13:47Z
- **Completed:** 2026-08-15T01:29:35Z
- **Tasks:** 2 (1 checkpoint + 1 auto)
- **Files modified:** 5 (package.json, package-lock.json, vitest.config.ts, .gitignore, scripts/exercise-import/README.md)

## Accomplishments
- Blocking package-legitimacy checkpoint for `fastest-levenshtein` resolved — human (via orchestrator) independently verified npm registry metadata (repo, version, license, download count, no deprecation/risky scripts) before install proceeded
- `fastest-levenshtein@1.0.16` installed at the repo root as an exact-pinned runtime dependency (no caret range)
- Root `vitest.config.ts` created — the monorepo's first root-level test-runner config, scoped via `test.include: ['scripts/exercise-import/**/*.test.ts']` so it never collides with `backend/api`'s own vitest suite (which has its own config + required `setupFiles`)
- `npm run test:import` script added and verified to run green with `--passWithNoTests`
- `scripts/exercise-import/.dataset-cache/` gitignored and verified via `git check-ignore`
- `scripts/exercise-import/README.md` (105 lines) documents pipeline order, publishable-key-only env vars (explicit `SUPABASE_SERVICE_KEY` prohibition), repo-root invocation form, `--refetch` flag, and the module-system constraint (no `__dirname`/`import.meta.url` in `lib/**`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate — fastest-levenshtein** — checkpoint only, no code commit (blocking-human gate; approval relayed from orchestrator after independent npm registry + slopcheck verification)
2. **Task 2: Install dependencies and create the root vitest test-runner home** - `555f3a3` (feat)

**Plan metadata:** committed together with this SUMMARY.md (docs commit, see below)

## Files Created/Modified
- `vitest.config.ts` - Root vitest config, `environment: 'node'`, scoped to `scripts/exercise-import/**/*.test.ts`, `reporters: 'default'`, no `setupFiles`
- `scripts/exercise-import/README.md` - Pipeline usage doc: fetch→match order, env vars, invocation, `--refetch`, test command, module-system constraint, folder layout
- `package.json` - Added `fastest-levenshtein@1.0.16` (exact pin) to `dependencies`; `vitest@^3.2.7` + `@vitest/coverage-v8@^3.2.7` to `devDependencies`; added `test:import` script
- `package-lock.json` - Lockfile updated for the above installs
- `.gitignore` - Added `scripts/exercise-import/.dataset-cache/` entry with explanatory comment

## Decisions Made
- fastest-levenshtein approved for install after the blocking-human checkpoint: orchestrator relayed independent verification (npm registry + downloads API) matching the plan's own registry/slopcheck findings — repo `github.com/ka-weihe/fastest-levenshtein`, v1.0.16, MIT license, no deprecation flag, no risky install scripts, ~25.4M weekly downloads. Installed as an exact pin (`"1.0.16"`, no caret) per the threat model's T-02-SC mitigation.
- vitest/@vitest/coverage-v8 landed at `^3.2.7` (npm resolved the latest patch within the requested `^3.2.4` range) rather than an exact `3.2.4` match — this satisfies the plan's intent ("same vitest major as backend/api") since backend/api's own `^3.2.4` range would also resolve to `3.2.7` on a fresh install; no separate approval needed as this falls under normal semver-range dependency installation, not the package-legitimacy gate (which applied only to the previously-`[ASSUMED]`-tagged `fastest-levenshtein`).

## Deviations from Plan

None - plan executed exactly as written. Task 1's checkpoint was answered "approved" by the human (relayed via the orchestrator with independent verification evidence matching the plan's own findings), and Task 2 was executed and verified against every acceptance criterion listed in the plan.

## Issues Encountered

None. The `npm install fastest-levenshtein@1.0.16 --save-exact` and `npm install --save-dev vitest@^3.2.4 @vitest/coverage-v8@^3.2.4` commands both exceeded the default 120s foreground timeout under Windows/PowerShell-backed Bash and were automatically moved to background execution — this is expected behavior for a 1700+ package monorepo install and not a plan deviation; both completed successfully (exit code 0) and were verified in the foreground afterward.

## User Setup Required

None - no external service configuration required. All installs and config are local to the repo.

## Next Phase Readiness

- `npm run test:import` is now a working, green command from the repo root — every downstream plan in this phase (02-02 through 02-05) can write `*.test.ts` files under `scripts/exercise-import/lib/` and have them picked up immediately by the root vitest config with no further scaffolding.
- `fastest-levenshtein@1.0.16` is resolvable for plan 02-02's `normalize.ts` similarity implementation.
- `scripts/exercise-import/.dataset-cache/` is genuinely gitignored, so plan 02-03's dataset clone step cannot accidentally commit ~128MB of third-party media.
- `scripts/exercise-import/README.md` exists as the canonical pipeline doc for future contributors and downstream plans to extend (fetch.ts/match.ts sections, env vars) rather than rewrite.
- No blockers for plan 02-02 (lib/paths.ts, lib/types.ts, lib/normalize.ts, lib/supabase-client.ts).

---
*Phase: 02-download-match-dry-run*
*Completed: 2026-08-15*

## Self-Check: PASSED

- FOUND: vitest.config.ts
- FOUND: scripts/exercise-import/README.md
- FOUND: .planning/workstreams/image-exo/phases/02-download-match-dry-run/02-01-SUMMARY.md
- FOUND: commit 555f3a3 (Task 2: install + scaffold)
- FOUND: commit d496ce6 (docs: SUMMARY.md)
