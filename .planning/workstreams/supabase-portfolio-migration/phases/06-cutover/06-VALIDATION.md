---
phase: 6
slug: cutover
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-03
---

# Phase 6 — Validation Strategy

See `06-RESEARCH.md` § Validation Architecture (authoritative).

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | `node --test` (scripts/portfolio-migration), Vitest v3 (backend, web) |
| Quick run | `node --test scripts/portfolio-migration/12-codemod-tables.test.mjs`; `npx turbo run type-check` |
| Full suite | `npx turbo run type-check lint test` + `12-codemod-tables.mjs --check` + `11-codemod-buckets.mjs --check` |

## Sampling Rate

- Per task commit: codemod unit tests + type-check of touched workspaces
- Per wave: full suite + both `--check` residual passes
- Phase gate: delta `--check all` green, tenants diff zero, per-surface smoke green before each flip

## Requirement Map

| Req | Behavior | Command |
|-----|----------|---------|
| CUTOVER-01 | local apps vs portfolio, no residual old names | `12-codemod-tables.mjs --check`, `11-codemod-buckets.mjs --check`, type-check |
| CUTOVER-02 | prod/preview env correct | `vercel env ls` (names only), post-deploy smoke |
| CUTOVER-03 | ordered flip + per-surface smoke | `10-storage-auth-tests.mjs --mode smoke`, `15-smoke-core-flows`, device checklist |
| CUTOVER-04 | rh_/gecko_ unchanged | `06-verify-data --check tenants`, `09-verify-storage --check tenants`, `14-signup-isolation.mjs` |
| CUTOVER-05 | CI linked to portfolio, no unprefixed push | CI run with read-only link step |

## Wave 0 Requirements

- [ ] `12-codemod-tables.mjs` + test
- [ ] `13-cutover-delta.mjs` orchestrator + test
- [ ] `14-signup-isolation.mjs`
- [ ] `15-smoke-core-flows.mjs`
- [ ] drop `deferred-table-codemod` list in `10-storage-auth-backend.ts`
- [ ] `createTestUser` sets `user_metadata.app='ziko'`
- [ ] manual device checklist for the 17 items

## Manual-Only Verifications

Mobile device flows (avatar, profile photo, exercise media, scan photo, coach logo, video) via committed checklist.

**Approval:** pending
