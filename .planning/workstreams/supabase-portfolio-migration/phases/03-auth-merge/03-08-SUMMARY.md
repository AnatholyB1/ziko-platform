---
phase: 03-auth-merge
plan: 08
subsystem: auth-migration
tags: [supabase, auth, rehearsal, scratch, gotrue, instance_id]
requires: ["03-05", "03-06"]
provides: [scratch-rehearsal-evidence, null-instance-id-finding]
affects: [03-10-portfolio-run]
key-files:
  created:
    - scripts/auth-merge/baseline/scratch-baseline.json
  modified:
    - scripts/auth-merge/lib.mjs
    - scripts/auth-merge/lib.test.mjs
decisions:
  - "NULL instance_id blocks GoTrue login: yes. Plan 10 must choose option-approve-instance-fix (--fill-null-instance-id, --allow-instance-id-fill) or accept that the merged collision user cannot log in."
metrics:
  tasks: 2
  completed: 2026-10-01
---

# Phase 3 Plan 08: Scratch rehearsal Summary

Full database side of Phase 3 rehearsed on scratch `rkirvurggtgjlkeuhded` (all writes scratch only; ziko read as source; portfolio untouched). `06-verify --check all` is green. One research assumption failed (NULL instance_id), recorded below.

## Key finding for Plan 10: NULL instance_id blocks GoTrue login: yes

- Seeded the portfolio-shaped collision row (NULL password, NULL instance_id, no identity) and imported with the default path (no `--fill-null-instance-id`).
- `--check users` PASS, `--check identities` PASS, `--check gotrue` FAIL for ONLY the merged collision user ("grant rejected"). The sampled normal imported user logged in fine, so the hand-inserted rows, token columns and `jsonb_populate_recordset` fidelity are accepted by GoTrue (RESEARCH A3/A4 hold).
- After `--reset`, `--seed`, baseline and re-import with `--fill-null-instance-id` (sets instance_id to the zero UUID on that row): `--check gotrue` PASS for both users.
- Conclusion: on portfolio the merged collision row (also NULL instance_id) will be unable to sign in unless the instance_id fill is approved. The fill is a single guarded UPDATE (`WHERE instance_id IS NULL`) on the one collision row. The remainder of the rehearsal ran with the fill; `06-verify` therefore used `--allow-instance-id-fill` (tenants check).

## Rehearsal results (counts and PASS/FAIL only)

| Step | Result |
|------|--------|
| seed collision | reset deleted=0, seeded 1 row |
| collision-check | source 39, target 1, collisions 1, known=true, target_has_password=false, target_instance_id_null=true |
| `--plan` | to_insert=38 collisions=1 |
| `--dry-run` | users_present=38 identities_present=38 collision_password_filled=1 collision_identity_added=1 instance_id_filled=0 (rolled back) |
| `--apply` (no fill) | users PASS, identities PASS, gotrue FAIL (collision user only) |
| `--apply --fill-null-instance-id` (after reset/seed) | users PASS, identities PASS, gotrue PASS, instance_id_filled=1 |
| second `--apply` | instance_id_filled=0; counts auth.users 39 / identities 39 before and after (0 inserted); ziko collision UUID absent on scratch (count 0) |
| `--delta-report` | password_changed=0, other_changed=0 |
| password refresh rehearsal | changed hash on one non-collision user and a different hash on the collision target: delta-report listed exactly that one non-collision UUID (password_changed=1), collision target not listed; dry-run passwords_updated=1; apply passwords_updated=1, counts unchanged 39/39; delta-report then password_changed=0; `--check users` PASS; collision target md5 digest identical before and after the update run (never touched); original hash restored from stash, stash table dropped (0 remain); `--check gotrue` PASS afterwards |
| `03-apply-trigger-gate --stage all` | functions gated=true (2), triggers enabled (2) |
| `--check triggers` | PASS: triggers=2, rolled-back probe 0/0/0/1/1/1, residual 0 |
| `--check signup` | PASS: unflagged 0/0/0, flagged 1/1/1, residual 0 (real GoTrue admin creations, deleted afterwards) |
| `04-sync-waitlist-seq` | scratch 1/false -> 87/true, equals ziko |
| re-import with triggers attached | 0 auth rows, 0 ziko_user_profiles, 0 ziko_user_ai_credits created (before/after identical: users 39, identities 39, profiles 0, credits 0) |
| `--check all` with scratch baseline and `--allow-instance-id-fill` | users, identities, gotrue, triggers, sequence, tenants, signup all PASS, exit 0 |
| `@example.invalid` users left | 0 |

- Exactly 2 triggers (`ziko_on_auth_user_created`, `ziko_on_auth_user_created_credits`) on scratch auth.users; sequence 87/true.
- The third Wave 0 item of 03-VALIDATION.md (scratch seeded from a ziko export) is now satisfied.
- The `--check signup` PASS is the only real-GoTrue evidence for SC3; portfolio relies on the rolled-back SQL probe (Plan 11).

## Commits
- 3851848e: scratch baseline
- 2c90bb51: fix for masked secret key in `getProjectApiKeys` (+ unit test)

## Deviations from Plan

**1. [Rule 3 - Blocking] `getProjectApiKeys` used a masked `sb_secret_*` key**
- **Found during:** Task 2, `--check signup` (HTTP 401 "Invalid API key")
- **Issue:** `supabase projects api-keys` returns new-style secret keys masked with non-printable bullets; GoTrue rejects them. The portfolio gotrue check (admin lookup) would have hit the same problem.
- **Fix:** new pure `pickApiKeys` skips unusable (non-printable) keys and falls back to the revealed legacy `service_role` JWT; unit test added (61 pass, 0 fail).
- **Files:** scripts/auth-merge/lib.mjs, lib.test.mjs
- **Commit:** 2c90bb51

**2. Fallback path used for the whole rehearsal.** Per plan, the NULL instance_id fallback was triggered, so the later steps ran with `--fill-null-instance-id`. The no-fill state was observed only up to step 5.

Note: the console summary `users_present` / `identities_present` are totals after the run, not insert counts; idempotence was proven with before/after table counts.

## Known Stubs
None.

## Cleanup / PII
Temp remaps and the fill marker removed from the OS temp dir; no remap file in git; baseline file contains no emails or hashes. The scratch project still holds copied ziko users (T-3-32, accepted).

## Self-Check: PASSED
