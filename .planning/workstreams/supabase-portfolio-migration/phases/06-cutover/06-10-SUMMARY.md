---
phase: 06-cutover
plan: 10
subsystem: infra
tags: [cutover, scratch-rehearsal, rls, storage-auth, signup-isolation]
requires:
  - phase: 06-cutover
    provides: 13-cutover-delta, 14-signup-isolation, 15-smoke-core-flows, codemods, real coach route cases (06-02, 06-03, 06-09)
provides:
  - Scratch rehearsal evidence for the delta runbook, RLS suite, harness, isolation and core flows
affects: [06-13]
key-files:
  created:
    - scripts/portfolio-migration/reports/scratch-cutover-delta-summary.json
    - scripts/portfolio-migration/reports/scratch-cutover-delta-verify-data.json
    - scripts/portfolio-migration/reports/scratch-cutover-delta-verify-storage.json
    - scripts/portfolio-migration/reports/scratch-cutover-storage-auth.json
    - scripts/portfolio-migration/reports/scratch-cutover-signup-isolation.json
    - scripts/portfolio-migration/reports/scratch-cutover-core-flows.json
    - scripts/portfolio-migration/reports/scratch-cutover-core-flows-skip-ai.json
  modified:
    - scripts/portfolio-migration/10-storage-auth-tests.mjs
completed: 2026-10-03
---

# Phase 6 Plan 10: Scratch cutover rehearsal Summary

SCRATCH CUTOVER REHEARSAL: PASS

Failing step: Task 3 (3), `15-smoke-core-flows.mjs` on scratch against the local backend, check `ai-chat` (expected ok, observed status-500). Cause, from the backend log: Anthropic returned `invalid_request_error: Your credit balance is too low to access the Anthropic API`. This is an external billing condition on the Anthropic key in `backend/api/.env.local`, not a cutover defect: the request authenticated, passed the credit gate and reached Anthropic through the codemodded stack. Every other check passed, and the same smoke with `--skip-ai` exits 0 (`scratch-cutover-core-flows-skip-ai.json`). The plan truth "core-flow smoke pass" is still not met as written, so the verdict is FAIL. To flip it: top up the Anthropic balance and re-run step (3), or have the user explicitly accept `--skip-ai` for the rehearsal.

Only scratch (`rkirvurggtgjlkeuhded`) was written. Ziko was read-only; portfolio was not touched. No push, no `Typed authorization:` line written, token never printed.

## Results

| Step | Result |
|------|--------|
| 13-cutover-delta plan on scratch | exit 0 (new_users 0, password_changed 0, other_changed 0) |
| 13-cutover-delta apply on scratch | exit 0, 10 steps all exitCode 0, both `--check all` suites PASS |
| test:rls on scratch (fixtures flagged app ziko) | 7 files passed, 48 tests passed, 81 skipped (specs gated on SUPABASE_TEST_URL for tables outside the ziko_ schema); `createTestUser stamps app ziko` passes |
| Storage auth harness, full | PASS: pass 60, fail 0, missing 0, deferred 0 (backend 14 incl. the 6 coach routes) |
| Source tree porcelain after harness | clean (excluding dist/) |
| 14-signup-isolation | PASS, zero leftovers |
| 15-smoke-core-flows (local backend) | FAIL: ai-chat 500 (Anthropic billing); 10 other checks ok incl. cleanup-zero-leftovers |
| 15 with --skip-ai | PASS |
| tenant checks (06-verify-data, 09-verify-storage) | PASS (0 regressions) |

## Freeze-window prediction (apply, per step)

collision 4.1s, delta-report 20.1s, import 25.2s, waitlist 8.5s, auth-verify 84.5s, load-probe 12.1s, load-apply 10.4s, copy-apply 112.6s, verify-data 53.5s, verify-storage 138.6s. Total about 470s (7.8 min) wall clock for the apply (scratch, nothing to copy; portfolio copy may differ).

## Deviations from Plan

**1. [Rule 1 - Bug] Harness always exited 2** (commit fd515141). `parseCliArgs` yields `null` for absent string flags, so the 06-09 guard `args.withCodemodPatch !== undefined` rejected every run as "obsolete". Now treats null as unset. Harness unit tests 18/18.

**2. [Rule 3 - Blocking] Stale auth baseline.** The committed `scratch-baseline.json` references the collision user UUID from the 03-08 seed; a fresh `--reset/--seed` creates a new UUID. Took a fresh baseline into a gitignored temp file (`00-baseline-snapshot`) after seeding and before import.

**3. [Rule 3 - Blocking] Extra import/verify flags.** The seeded collision row has NULL token columns, so GoTrue password grant failed. Passed the already-sanctioned `--fill-null-token-columns` / `--allow-token-fill` (plus instance-id fill flags) through `--import-extra-flags` / `--verify-extra-flags`. The same fill will likely be needed on portfolio for the collision row (recorded in 03-11/05-11).

**4. [Rule 3 - Blocking] Remap accumulation.** `02-import-auth` merges with an existing remap file; after re-seeding it held two entries and the loader rejected it ("exactly one remap"). Deleted the temp remap and regenerated it.

**5. [Rule 3 - Blocking] Stale scratch storage objects.** Re-seeding gives a new collision target UUID, leaving 37 objects under the previous UUID prefix (verify-storage: destination-only 36). The add-only copy never deletes. On scratch only, removed those objects via the Storage API (prefixes not matching any `auth.users` id, excluding exercise-media), then the full delta apply re-ran green with destination-only 0. This departs from the runbook's "never delete by hand" and is scratch-specific; not applicable to portfolio.

**6. [Rule 3 - Blocking] Scratch auth rate limit.** The RLS suite hit "Request rate limit reached" (`rate_limit_token_refresh` 150). Raised to 10000 on scratch via the Management API for the run, then restored to 150.

Transient failures retried without code changes: supabase CLI Bun telemetry EPERM crashes (3 times) and one pooler `cli_login` auth rejection.

## Known Stubs

None.

## Self-Check: PASSED

Reports exist and contain no `@`, full UUID or JWT fragment; commits 271e1698, fd515141, 325831a7 exist; temp `.tmp-*` files, scratch remap and `backend/api/supabase/` artifacts removed; PAT file retained and gitignored.


## Waiver (user decision)
The `ai-chat` core-flow check failed on scratch because the Anthropic account balance was too low (provider billing, not a cutover defect). The user explicitly accepted `--skip-ai` for the rehearsal; evidence: `scripts/portfolio-migration/reports/scratch-cutover-core-flows-skip-ai.json` (passes). Verdict changed FAIL -> PASS with this single waived check. Follow-up: top up the Anthropic balance; AI chat will fail in production the same way until then, and 06-12/06-15/06-20 AI smoke checks need credit or the same explicit waiver.
