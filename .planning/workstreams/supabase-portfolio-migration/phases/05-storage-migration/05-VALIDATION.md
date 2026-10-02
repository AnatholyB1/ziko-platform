---
phase: 5
slug: storage-migration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract. Full detail: `05-RESEARCH.md` § Validation Architecture.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (scripts/portfolio-migration); Vitest v3 for backend/web touched by the codemod |
| **Config file** | none for scripts; `backend/api/vitest.config.ts`, web vitest config |
| **Quick run command** | `node --test "scripts/portfolio-migration/lib-storage.test.mjs" "scripts/portfolio-migration/11-codemod-buckets.test.mjs"` |
| **Full suite command** | `node --test "scripts/portfolio-migration/*.test.mjs"` then `npx turbo run test type-check lint` (codemod branch) |
| **Estimated runtime** | ~30 s quick, minutes for full |

## Sampling Rate

- **After every task commit:** quick run command
- **After every plan wave:** full `node --test` glob; codemod branch also turbo type-check + test
- **Before `/gsd:verify-work`:** scratch `--check all` + auth matrix green, portfolio `--check all` + smoke green, `06-verify-data.mjs --check tenants` unchanged
- **Max feedback latency:** 30 seconds (pure libs)

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| STORAGE-01 | Bucket plan from live config, `ziko-` guard, converge | unit + live | `node --test scripts/portfolio-migration/lib-storage.test.mjs`; `09-verify-storage.mjs --check buckets` | ❌ W0 |
| STORAGE-02 | Re-key, skip logic, no-delete guard, SHA-256, count/bytes parity | unit + live | `lib-storage.test.mjs`; `09-verify-storage.mjs --check objects`, `--check hashes` | ❌ W0 |
| STORAGE-02 (D-05) | URL rewrite transform, zero leftovers | unit + live | `lib-data.test.mjs`; `--check urls` | extend |
| STORAGE-03 | Policy rewrite, stale-ref grep, 25 policies, portfolio's 17 unchanged | unit + live | `lib-storage.test.mjs`; `--check policies` | ❌ W0 |
| STORAGE-04 | Per-bucket matrix with real JWTs | integration | `10-storage-auth-tests.mjs --mode full` (scratch) | ❌ W0 |
| D-04 | Codemod exactness, no false positives, residual scan zero | unit + grep | `11-codemod-buckets.mjs --check`; turbo type-check test | ❌ W0 |

## Wave 0 Requirements

- [ ] `lib-storage.mjs` + `lib-storage.test.mjs`
- [ ] `07-generate-storage-policies.mjs`, `08-copy-storage.mjs`, `09-verify-storage.mjs` (+ guard/arg tests)
- [ ] `10-storage-auth-tests.mjs`
- [ ] `11-codemod-buckets.mjs` + fixture tests
- [ ] Extend `lib-data.test.mjs` for `createUrlRewriteTransform`; extend `05-load-data.mjs`
- [ ] Portfolio storage tenant baseline snapshot before first write

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Typed-phrase checkpoint before first portfolio write; PAT supply | STORAGE-01..04 | Human authorization | Follow Phase 3/4 checkpoint pattern |
| Mobile/web UI-level storage flows | STORAGE-04 | Deferred to Phase 6 smoke | Phase 6 plan |

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity maintained
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set once Wave 0 lands

**Approval:** pending
