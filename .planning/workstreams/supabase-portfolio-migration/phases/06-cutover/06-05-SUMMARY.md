---
phase: 06-cutover
plan: 05
subsystem: infra
tags: [env, vercel, eas, supabase, cutover, rollback]
requires: []
provides:
  - "17-env-switch.mjs: one gated command to flip or roll back Supabase env of api/web/mobile at local/vercel/eas"
affects: [06-cutover]
tech-stack:
  added: []
  patterns: ["injected runners for offline tests", "fingerprint-only output"]
key-files:
  created:
    - scripts/portfolio-migration/17-env-switch.mjs
    - scripts/portfolio-migration/17-env-switch.test.mjs
  modified: []
key-decisions:
  - "Added NEXT_PUBLIC_SUPABASE_KEY to the web matrix (publishable alias read by 7 web files)"
  - "eas-cli pinned to 24.10.0"
requirements-completed: [CUTOVER-01, CUTOVER-02]
duration: 15min
completed: 2026-10-03
---

# Phase 6 Plan 05: Env switch Summary

Env switcher with audited per-surface matrix, Vercel (stdin values) and EAS (pinned eas-cli) writers, local gitignored file renderer, `--audit` and `--verify-remote`; flip and rollback differ only by `--target`.

## Tasks
1. Tests E1-E9 (RED) - 5895e171
2. Implementation (GREEN, 9/9 pass; `--audit` exits 0 for api, web, mobile) - 04e2336c

## Deviations from Plan

**1. [Rule 2 - Missing critical] NEXT_PUBLIC_SUPABASE_KEY added to the web matrix**
- **Found during:** Task 2 audit
- **Issue:** Web code (DashboardGrid, TemplateNamingModal, VideoListClient, useCoachClients, useCoachMemory, useDashboardConfig, useWidgetData) reads `process.env.NEXT_PUBLIC_SUPABASE_KEY`, which the plan matrix omitted. Flipping only `NEXT_PUBLIC_SUPABASE_ANON_KEY` would leave those browser clients on the old project (Pitfall 8 class).
- **Fix:** Added it to the web matrix, fed with the publishable key (public by design, no secret leak); E1 asserts it. Both vars are switched together.
- **Commit:** 04e2336c

## Decisions / notes
- Pinned eas-cli version: `24.10.0` (constant `EAS_CLI_VERSION`, threat T-6-24).
- Audit scans test-file-excluded sources of each surface plus `plugins/*/src` and `packages/*/src` (checked against the union of all matrices). Results on current tree: api, web, mobile all pass.
- `--plan` needs no gates and prints names + fingerprints only; gates (confirm-ref + typed line) apply on `--apply` for vercel production and for every EAS write. Rollback (`--target ziko`) uses the same gate and phrase (portfolio ref).
- EAS values are passed on argv (no stdin support); values containing shell metacharacters are refused.
- No live Vercel/EAS/Supabase call was made and no env file was touched.

## Known Stubs
None.

## Self-Check: PASSED
- scripts/portfolio-migration/17-env-switch.mjs and .test.mjs exist; commits 5895e171, 04e2336c exist.
