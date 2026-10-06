---
phase: 07-monitoring-decommission
verified: 2026-10-06T00:00:00Z
status: human_needed
score: 4/4 non-waived criteria verified; 1 criterion (rollback window) accepted as user override
overrides_applied: 1
overrides:
  - must_have: "ziko is kept live in read-only mode for the defined rollback window (DECOM-01)"
    reason: "No real mobile users, 39 ziko profiles, 0 new accounts since the flip; a write-freeze before backup replaces the window"
    accepted_by: "user (07-CONTEXT D-01; 07-AUTHORIZATIONS block 07-01, 2026-10-04)"
    accepted_at: "2026-10-04"
human_verification:
  - test: "Confirm the encrypted backup archive decrypts with your passphrase from the second copy (ziko-final-2026-10-04.tar.gpg, sha256 prefix 1732e313ee71)"
    expected: "Decrypt succeeds; only then delete the local passphrase file"
    why_human: "Passphrase custody and the off-machine second copy cannot be checked from the repo. ziko is already deleted, so this archive is the only copy of the data."
  - test: "Revoke Supabase PATs ziko-cutover-phase6 and ziko-decom-phase7 and rotate the Vercel Protection Bypass secret"
    expected: "Tokens gone from the Supabase dashboard; bypass secret rotated on web and API"
    why_human: "Dashboard actions only the user can do. The user answered 'not now' (block 07-19)."
---

# Phase 7: Monitoring & Decommission Verification Report

**Phase goal:** ziko is retired and deleted only after a monitored rollback window (waived), full per-table/per-bucket verification, and a second, separate human confirmation.
**Status:** human_needed. No goal-blocking defects. Two items rest with the user.
**Re-verification:** No (initial)

## Success criteria

| # | Criterion | Status | Evidence checked in the repo |
|---|-----------|--------|------------------------------|
| 1 | Rollback window | PASSED (override) | The waiver is recorded in four places: REQUIREMENTS.md line 57 (DECOM-01 left `[ ]`, marked WAIVED) and traceability line 109 ("WAIVED"); ROADMAP.md SC1 and phase status ("rollback window waived"); 07-AUTHORIZATIONS block 07-01 citing CONTEXT D-01; 07-DELETION-LOG "DECOM-01 is not recorded as complete". It is not misrepresented as done. ROADMAP's Phase 7 checkbox is `[x]`, which means closed, not a pass for DECOM-01. |
| 2 | Cold backup, confirmed restorable | VERIFIED | decom-backup-manifest.json: encrypted archive (.tar.gpg), 207,273,907 bytes, sha256 1732e313..., per-table row counts. decom-restore-proof.json: passed=true on wiped scratch. 99 tables equal on count and row md5; 144 FKs validated with 0 orphans; RLS, policy, trigger and function inventories equal; 2,699 objects sha256-equal across archive, scratch and ziko. The 3 deviations are documented in the report: same-name evaluators instead of 06/09 scripts, auth proven by data restore plus fingerprints (GoTrue DDL not replayed), `--no-privileges` (GRANT/ACL not replayed). These weaken the proof of auth DDL and grants only. The data-level proof is complete. |
| 3 | Full verification, no sampling | VERIFIED | decom-verify.json matches the claim: passed=true, 99/99 tables, failed [], 20,717 rows compared, 0 mismatched, 8 buckets / 2,699 objects with 0 missing and 0 unexplained, integrity/auth/tenants all PASS. Disclosed limitation: `ziko_user_inventory` and `ziko_user_plugins` were not content-compared (no timestamp column and counts differ). Those tables are covered only by count and PK-level checks, and by the md5 comparison in the restore proof for the ziko-to-scratch copy. The limitation appears in REQUIREMENTS and the deletion log. |
| 4 | Separate explicit confirmation | VERIFIED | 07-AUTHORIZATIONS block "07-17 D-15 confirmation" is its own heading with the line `Confirmation: yes (delete ziko slkobhavpwsubnsmuhya)`, Timestamp 2026-10-06T13:56:46Z, Reply "yes". It sits in a different block and on a different date from the cutover sign-off (Phase 6, closed 2026-10-04) and from the scratch-deletion approval (07-16, 2026-10-05). The gate file's `confirmation_yes` is stamped 13:57:08Z, after the block. The tests in 24-decom-delete.test.mjs refuse a missing block, "yes but wait", and an abort line. |
| 5 | Deleted only after 1-4, logged as final action | VERIFIED | decom-delete.json: DELETE at 13:59:22Z, confirmed gone 13:59:33Z. This is 2m36s after the D-15 block, and after every other gate. decom-gates.json has 9 PASS and `ci_token_revoked` "waived", with a recorded waiver block (07-15, reply "I will not revoke it"). Git order: 306beccf (delete requested), 6f65aff0 (confirmed gone), then the 07-19 and 07-20 docs. 00fe2e67 "deletion log (final milestone action)" is the HEAD commit. Commit order shows 07-19 credential retirement and the 07-20 docs close came between deletion and the log, so "final action" holds for the log, not for all activity after the delete. |

## Cross-checks

- **Evidence hashes:** I recomputed sha256 for the 7 evidence reports named in the deletion log. All 7 match.
- **Fail-closed delete:** `24-decom-delete.mjs` calls `assertDeleteAllowed` and `assertCommittedSafe`. The tests cover refusals for portfolio or unknown project, wrong or missing confirm-ref, a modified or missing evidence file, a missing D-15 block, pre-delete GET mismatch or 404, and token failure. The happy path sends exactly one DELETE.
- **No literal refs in production code:** zero matches for the ziko and scratch refs in `18`-`24` decom scripts and `lib-decom*`. The only literals are in `18-decom-guard.test.mjs`, which asserts equality with `PROJECTS`.
- **No secrets or PII committed:** no `sbp_` or `eyJ` tokens and no emails in decom reports, the gates file, or the authorization and deletion logs. The only UUIDs in Phase 7 docs are zero-pattern fakes in plans and patterns. No `.tar.gpg` or passphrase file is tracked.
- **Tests:** `node --test "scripts/portfolio-migration/*.test.mjs" "scripts/auth-merge/*.test.mjs"` gave 608 tests, 608 pass, 0 fail.
- **Not run (by constraint):** no remote API calls. I could not confirm that ziko is gone from the Supabase side. I rely on decom-delete.json, which records the confirm-gone check, portfolio ACTIVE_HEALTHY, and api and web returning 200.

## Residual risks (non-blocking, disclosed in the repo)

1. The backup is the only copy of the ziko data. The passphrase file is still local and no decrypt check has been confirmed (see human item 1).
2. PATs `ziko-cutover-phase6` and `ziko-decom-phase7` are not revoked. The second was pasted into chat. The user answered "not now".
3. The Vercel Protection Bypass for Automation secret has not been rotated.
4. The waived `ziko-ci-portfolio` token is still live. It showed "Never used" at the decision.
5. The portfolio login-role sweep has not been run, and Phase 6 credential retirement (06-20 Task 3) is still open.
6. The restore proof has the 3 deviations above, and 2 tables were not content-compared in the verify report.
7. The dashboard-leftover check was done by Claude through the read-only Vercel CLI, not by the user.
8. Deferred to milestone close-out: API crons returning 401, iOS release, Play Console state of Android 1.5.0, Anthropic balance and AI chat never verified on portfolio, an orphan test PNG in the ziko-coach-exercises bucket, backup retention review by 2027-04-06 (GDPR), CI remote verify specs disabled, leftover Vercel redis and Neon resources, and PRs #44 and #46 open.
9. Working tree is not clean: modified `.planning/config.json` and `active-workstream`, and untracked `scripts/portfolio-migration/supabase/` and `portfolio-baseline-precutover.json`. None is part of the Phase 7 evidence.

## Gaps

None against the goal. Status is `human_needed` only because items 1 and 2 can only be confirmed or done by the user.

_Verifier: Claude (gsd-verifier)_
