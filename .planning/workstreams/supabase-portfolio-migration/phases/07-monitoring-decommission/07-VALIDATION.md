---
phase: 7
slug: monitoring-decommission
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-04
---

# Phase 7 — Validation Strategy

> Per-phase validation contract. Full requirement-to-test map: `07-RESEARCH.md` section "Validation Architecture".

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (repo pattern for `scripts/portfolio-migration/*.test.mjs`) |
| **Config file** | none (run by path) |
| **Quick run command** | `node --test scripts/portfolio-migration/18-decom-guard.test.mjs scripts/portfolio-migration/24-decom-delete.test.mjs` |
| **Full suite command** | `node --test scripts/portfolio-migration/ scripts/auth-merge/` |
| **Estimated runtime** | ~30 seconds (mocked fetch/runSql, no network) |

## Sampling Rate

- **After every task commit:** run the touched script's `node --test` file
- **After every plan wave:** run the full suite command (existing suites must stay green)
- **Before `/gsd:verify-work`:** full suite green and every live gate command exits 0
- **Max feedback latency:** 60 seconds

## Per-Task Verification Map

Paths abbreviated: `pm/` = `scripts/portfolio-migration/`. Checkpoint tasks are human gates (see Manual-Only); each is followed by an auto task with an automated verify.

| Task | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|------|------|------|-------------|-----------|-------------------|--------|
| 07-01-T1 | 07-01 | 1 | DECOM-04, DECOM-05 | unit (TDD) | `node --test pm/18-decom-guard.test.mjs` | ⬜ pending |
| 07-01-T2 | 07-01 | 1 | DECOM-04, DECOM-05 | unit + file check | `node --test pm/18-decom-guard.test.mjs` + `18-decom-guard --status` + `git check-ignore` on backup paths | ⬜ pending |
| 07-02-T1 | 07-02 | 1 | DECOM-01 | doc check | grep REQUIREMENTS: DECOM-01 carries WAIVED by user, never ticked/Complete | ⬜ pending |
| 07-02-T2 | 07-02 | 1 | DECOM-01 | doc check | grep RUNBOOK `## Phase 7` section + secret grep gate | ⬜ pending |
| 07-03-T1 | 07-03 | 2 | DECOM-02 | unit (TDD) | `node --test pm/19-decom-freeze.test.mjs` | ⬜ pending |
| 07-03-T2 | 07-03 | 2 | DECOM-02 | unit (TDD) | `node --test pm/19-decom-freeze.test.mjs` + `--help` (PATCH-before-REVOKE, probe-auth-config tests) | ⬜ pending |
| 07-04-T1 | 07-04 | 2 | DECOM-02 | unit (TDD) | `node --test pm/lib-decom-storage.test.mjs pm/08-copy-storage.test.mjs pm/lib-storage.test.mjs` | ⬜ pending |
| 07-04-T2 | 07-04 | 2 | DECOM-02 | unit + local gpg round-trip | `node --test pm/20-decom-backup.test.mjs pm/lib-decom-storage.test.mjs` | ⬜ pending |
| 07-06-T1 | 07-06 | 2 | DECOM-05 | unit (TDD) | `node --test pm/23-decom-env-audit.test.mjs pm/17-env-switch.test.mjs` | ⬜ pending |
| 07-06-T2 | 07-06 | 2 | DECOM-05 | unit (TDD) | `node --test pm/23-decom-env-audit.test.mjs` + `--help` | ⬜ pending |
| 07-07-T1 | 07-07 | 2 | DECOM-04, DECOM-05 | unit (TDD) | `node --test pm/24-decom-delete.test.mjs` | ⬜ pending |
| 07-07-T2 | 07-07 | 2 | DECOM-04, DECOM-05 | unit (TDD) | `node --test pm/24-decom-delete.test.mjs pm/18-decom-guard.test.mjs` + `--help` | ⬜ pending |
| 07-05-T1 | 07-05 | 3 | DECOM-03 | unit (TDD) | `node --test pm/22-decom-verify.test.mjs` | ⬜ pending |
| 07-05-T2 | 07-05 | 3 | DECOM-03 | unit (TDD) | `node --test pm/22-decom-verify.test.mjs` (content digest + report) | ⬜ pending |
| 07-08-T1 | 07-08 | 3 | DECOM-02 | unit (TDD) | `node --test pm/21-decom-restore-proof.test.mjs` | ⬜ pending |
| 07-08-T2 | 07-08 | 3 | DECOM-02 | unit (TDD) | `node --test pm/21-decom-restore-proof.test.mjs` + `--help` | ⬜ pending |
| 07-21-T1 | 07-21 | 3 | DECOM-02 | unit (TDD) | `node --test pm/20-decom-backup.test.mjs` + `--help` | ⬜ pending |
| 07-21-T2 | 07-21 | 3 | DECOM-02 | unit (TDD) | `node --test pm/20-decom-backup.test.mjs pm/lib-decom-storage.test.mjs` + `--help` | ⬜ pending |
| 07-09-T1 | 07-09 | 4 | DECOM-02 | checkpoint:decision | manual (tool install approval) | ⬜ pending |
| 07-09-T2 | 07-09 | 4 | DECOM-02, DECOM-05 | live probe | report checks: ziko name, `auth_config_patch: ok`, pg_dump/pg_restore present; PII grep gate | ⬜ pending |
| 07-09-T3 | 07-09 | 4 | DECOM-02 | live probe (scratch) | freeze report + `19-decom-freeze --target scratch --status` + unit tests | ⬜ pending |
| 07-22-T1 | 07-22 | 4 | DECOM-03 | unit (TDD) | `node --test pm/22-decom-verify.test.mjs` + `--help` | ⬜ pending |
| 07-22-T2 | 07-22 | 4 | DECOM-03 | unit (TDD) | `node --test pm/22-decom-verify.test.mjs` (SELECT-only assertion) | ⬜ pending |
| 07-10-T1 | 07-10 | 5 | DECOM-02 | live | `19-decom-freeze --target ziko --status` + snapshot grep gate | ⬜ pending |
| 07-10-T2 | 07-10 | 5 | DECOM-02 | live | T0 snapshot key-count check + grep gate | ⬜ pending |
| 07-11-T1 | 07-11 | 6 | DECOM-02 | live + gate | gates `freeze_proven` + `backup_encrypted` PASS, no plaintext work dir, PII grep gate | ⬜ pending |
| 07-11-T2 | 07-11 | 6 | DECOM-02 | checkpoint:human-action | manual (passphrase custody, second copy) | ⬜ pending |
| 07-11-T3 | 07-11 | 6 | DECOM-02 | file + gate check | gate `backup_second_copy` PASS + `### 07-11 second copy` block | ⬜ pending |
| 07-12-T1 | 07-12 | 7 | DECOM-02 | live (scratch) | wipe report `passed` + grep gate | ⬜ pending |
| 07-12-T2 | 07-12 | 7 | DECOM-02 | live (scratch) + gate | gate `restore_proven` PASS + proof report passed with deviations + grep gate | ⬜ pending |
| 07-13-T1 | 07-13 | 8 | DECOM-03 | live read-only | decom-verify.json exists, 99 tables, PII grep gate | ⬜ pending |
| 07-13-T2 | 07-13 | 8 | DECOM-03 | gate check | report.passed + `verify_pass` gate | ⬜ pending |
| 07-14-T1 | 07-14 | 9 | DECOM-05 | live read-only | before-audit exists + grep gate | ⬜ pending |
| 07-14-T2 | 07-14 | 9 | DECOM-05 | checkpoint:decision | manual (remediation approval + integration-unlinked/no-integration) | ⬜ pending |
| 07-14-T3 | 07-14 | 9 | DECOM-05 | live + gate | `Integration:` line grep + `env_scopes_clean` gate + after-audit passed | ⬜ pending |
| 07-15-T1 | 07-15 | 10 | DECOM-05 | live (CI) | ci.yml free of scratch secrets + decom-ci-offscratch.json conclusion success | ⬜ pending |
| 07-15-T2 | 07-15 | 10 | DECOM-05 | checkpoint:human-action | manual (stale token revocation) | ⬜ pending |
| 07-15-T3 | 07-15 | 10 | DECOM-05 | gate check | gate `ci_token_revoked` PASS | ⬜ pending |
| 07-16-T1 | 07-16 | 11 | DECOM-05 | checkpoint:decision | manual (scratch deletion approval) | ⬜ pending |
| 07-16-T2 | 07-16 | 11 | DECOM-05 | live + gate | gate `scratch_deleted` PASS + report `confirmed_gone_at` + grep gate | ⬜ pending |
| 07-17-T1 | 07-17 | 12 | DECOM-04 | live read-only | freeze recheck passed + `18-decom-guard --status --require ziko --except confirmation_yes` | ⬜ pending |
| 07-17-T2 | 07-17 | 12 | DECOM-04 | checkpoint:decision | manual (D-15 plain "yes") | ⬜ pending |
| 07-17-T3 | 07-17 | 12 | DECOM-04 | file + gate check | `18-decom-guard --status --require ziko` + exactly one D-15 block | ⬜ pending |
| 07-18-T1 | 07-18 | 13 | DECOM-05 | live | decom-delete.json exists, names ziko ref only (never portfolio), grep gate | ⬜ pending |
| 07-18-T2 | 07-18 | 13 | DECOM-05 | checkpoint:human-verify | manual (dashboard check / fallback deletion) | ⬜ pending |
| 07-18-T3 | 07-18 | 13 | DECOM-05 | live | report `confirmed_gone_at` + method api/dashboard + API /health 200 | ⬜ pending |
| 07-19-T1 | 07-19 | 14 | DECOM-05 | file check | credential, bypass, passphrase and temp files absent | ⬜ pending |
| 07-19-T2 | 07-19 | 14 | DECOM-05 | checkpoint:human-action | manual (PAT revocation, bypass rotation) | ⬜ pending |
| 07-19-T3 | 07-19 | 14 | DECOM-05 | file check | `Revoked: ziko-cutover-phase6` line in 07-AUTHORIZATIONS.md | ⬜ pending |
| 07-20-T1 | 07-20 | 15 | DECOM-01..05 | doc check | grep REQUIREMENTS: DECOM-01 WAIVED and unticked, DECOM-02..05 ticked | ⬜ pending |
| 07-20-T2 | 07-20 | 15 | DECOM-05 | file check | 07-DELETION-LOG.md names ziko ref + evidence report paths, PII grep gate | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [ ] `18-decom-guard`, `19-decom-freeze`, `20-decom-backup` (primitives 07-04, CLI 07-21), `21-decom-restore-proof`, `22-decom-verify` (evaluators 07-05, CLI 07-22), `23-decom-env-audit`, `24-decom-delete` scripts, each with `.test.mjs`
- [ ] pg client tools installed (human-gated) and a dump/restore probe on scratch; failure STOPs the phase (no COPY-as-data-of-record fallback)
- [ ] Read-only probe of the ziko project via Management API (name, status, org, Vercel integration state) plus a no-op `disable_signup` PATCH probe before any REVOKE
- [ ] Freeze coverage probe on scratch (anon/authenticated/service_role writes, SECURITY DEFINER function, storage upload, signup)
- [ ] `.gitignore` entries for backup paths and `.tmp-decom-*`

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PostgreSQL client tools install approval | DECOM-02 | Machine change | 07-09 Task 1 checkpoint |
| Passphrase custody and second off-machine copy | DECOM-02 (D-06) | Physical/off-machine action | 07-11 Task 2 checkpoint |
| Env remediation approval and integration unlink confirmation | DECOM-05 (D-12a) | Dashboard action, outward-facing | 07-14 Task 2 checkpoint; reply must carry `integration-unlinked` or `no-integration` |
| Stale CI token revocation | DECOM-05 (D-12b) | Account-level action | 07-15 Task 2 checkpoint |
| Scratch deletion approval | DECOM-05 | Irreversible | 07-16 Task 1 checkpoint |
| Explicit deletion confirmation | DECOM-04 | Must be a genuine, separate human "yes" | 07-17 Task 2, after backup proof and verification report are shown |
| Dashboard deletion fallback (if Vercel-managed project refuses API delete) | DECOM-05 | Outward-facing, irreversible | User deletes in dashboard; Claude runs `--confirm-gone` and writes the log |
| PAT revocation, Vercel bypass rotation | D-14 | Account-level action | User revokes at the Supabase tokens page, replies `revoked` |

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies (every auto task has `<automated>`; checkpoints are manual-only above)
- [x] No 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner sign-off 2026-10-04 (revision 1)
