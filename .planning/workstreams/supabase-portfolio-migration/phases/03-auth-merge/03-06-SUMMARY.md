---
phase: 03-auth-merge
plan: 06
subsystem: auth-migration
tags: [supabase, auth, verification, triggers, sequence]
requires: ["03-01", "03-02"]
provides: [apply-trigger-gate-cli, sync-waitlist-seq-cli, verify-suite]
affects: [03-08-rehearsal]
tech-stack:
  added: []
  patterns: [pure evaluators with node:test, scratch-only destructive probes with finally-restore, self-rolling-back production probe]
key-files:
  created:
    - scripts/auth-merge/03-apply-trigger-gate.mjs
    - scripts/auth-merge/04-sync-waitlist-seq.mjs
    - scripts/auth-merge/06-verify.mjs
    - scripts/auth-merge/06-verify.test.mjs
decisions:
  - "Equality digests are built from jsonb_each(to_jsonb(row)) filtered to the digestColumns list, avoiding the 100-argument limit of jsonb_build_object."
  - "tenants check takes an optional --source-ref; with it, collision target ids become the allowed fill ids, without it the allow-lists are empty (pre-import use)."
  - "signup on a non-scratch target returns a FAIL result before any key fetch or network call."
metrics:
  tasks: 2
  files: 4
  completed: 2026-10-01
---

# Phase 3 Plan 06: Trigger gate, sequence sync and verification suite Summary

Built the stage-aware trigger/gate apply CLI, the live setval sequence copy, and the single `06-verify.mjs` suite (users, identities, gotrue, triggers, signup, sequence, tenants, all) with unit-tested pure evaluators. Nothing was written to portfolio or ziko.

## Commits
- b36b67b1: apply-trigger-gate + sync-waitlist-seq
- 036377dc: failing tests for verify evaluators (RED)
- c7d2eeb6: 06-verify.mjs (GREEN)

## Verification
- `node --test "scripts/auth-merge/*.test.mjs"`: 44 pass, 0 fail (20 new in 06-verify.test.mjs).
- Sequence sync dry-run against portfolio: source last_value=87 is_called=true, target 1/false, nothing written, exit 0.
- `03-apply-trigger-gate.mjs --stage functions` on portfolio without --confirm-ref: exit 1 before SQL; without --stage: exit 2.
- Read-only `--check tenants` on portfolio against the committed baseline: PASS, 0 warnings, exit 0.
- `--check signup` on portfolio: FAIL before any network call, exit 1.
- Greps: no reset-function call or literal 87 in the sequence script, no local volatile-column list, no secret/token/hash in console lines, 2 `finally` blocks.

## Deviations from Plan
None. The gotrue (scratch), signup, triggers, users, identities and sequence checks and the apply paths were not executed live (plan defers the scratch rehearsal to Plan 08); the pure evaluators are unit-tested.

## Known Stubs
None.

## Self-Check: PASSED
