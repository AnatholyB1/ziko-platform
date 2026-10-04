---
phase: 07-monitoring-decommission
plan: 06
subsystem: infra
tags: [decommission, env-audit, vercel, eas, ci, tdd]
requires: ["07-01"]
provides:
  - "23-decom-env-audit.mjs: value-blind env/CI audit (--all/--include-ci), --plan-remediation, --apply-remediation"
affects: [07-14, 07-15]
tech-stack:
  added: []
  patterns: ["classification by ref/fingerprint/JWT claim, values never emitted", "all subprocesses via injected runner", "approval-block gated remediation, values on stdin"]
key-files:
  created:
    - scripts/portfolio-migration/23-decom-env-audit.mjs
    - scripts/portfolio-migration/23-decom-env-audit.test.mjs
  modified:
    - scripts/portfolio-migration/17-env-switch.mjs
key-decisions:
  - "Report passes iff no points_at_ziko and no unknown rows (and, with --include-ci, ci.yml not injecting SUPABASE_* secrets). points_at_scratch Vercel rows do not fail the audit, per plan."
  - "Remediation plan is {items, clean_production_surfaces}; production is never targeted for a surface whose production rows are all clean."
  - "Unpullable (sensitive) Vercel values and hidden EAS values are recorded unknown, so they fail the audit (fail closed, T-07-23)."
  - "parseVercelEnvLs accepts both `vercel env ls --format json` (used by the CLI) and table text."
requirements-completed: []
duration: 30min
completed: 2026-10-04
---

# Phase 7 Plan 06: Env/CI value audit Summary

Value-blind audit that classifies every Vercel (production, preview incl. branch entries, development), EAS and CI env value as clean, points_at_ziko, points_at_scratch or unknown, with remediation possible only under the 07-14 approval block.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (RED) | Failing classifier/parser/builder tests | 0e77257b |
| 1 (GREEN) | Classifiers, parsers, remediation builders, report | 3fdf19d5 |
| 2 | Audit CLI and gated remediation | 4bb15f5b |

## Verification

- `node --test scripts/portfolio-migration/23-decom-env-audit.test.mjs` (20 tests) and 17-env-switch tests: green.
- Full `scripts/portfolio-migration/*.test.mjs` plus `scripts/auth-merge/*.test.mjs`: 423 pass, 0 fail.
- `--help` exits 0. No literal project ref in production code (grep prints 0).
- No live Vercel/EAS/GitHub call was made; CLI usage was confirmed with `--help` only (vercel 59.24.0: `env ls --format json`, `env pull --environment --git-branch --yes`; eas-cli 24.10.0: `env:list --include-sensitive`; `gh secret list --json`).

## Deviations from Plan

**1. [Rule 3 - Blocking] `collectSources` exported from 17-env-switch.mjs**
- Needed to derive code-read names per surface for remediation (rm vs set-portfolio). Only the `export` keyword was added; 17 tests unchanged and green.

**2. Task 2 was written as one commit** (tests and CLI together), matching the plan's single `feat(07-06): env audit CLI and gated remediation` commit.

## Notes for plan 07-14

- First live run should confirm the `vercel env ls --format json` shape and the EAS `env:list --include-sensitive` output; if either differs, the affected rows become `unknown` (audit fails closed) rather than passing silently.
- GitHub secret values are unreadable, so CI is judged from ci.yml: it currently injects the three SUPABASE_* secrets, so `--include-ci` reports on_scratch until ci.yml or the secrets are changed.
- `--record-gate` records `env_scopes_clean` and requires `--json-out` inside the repo.
- Requirements DECOM-05 left Pending (completes in 07-20).

## Known Stubs

None.

## Threat Flags

None. T-07-21 (temp files outside repo, removed in finally, tested), T-07-22 (approval block + portfolio confirm-ref, stdin values, refusals tested with zero runner calls), T-07-23 (unknown fails the audit) implemented.

## Self-Check: PASSED

Files and commits 0e77257b, 3fdf19d5, 4bb15f5b verified present.
