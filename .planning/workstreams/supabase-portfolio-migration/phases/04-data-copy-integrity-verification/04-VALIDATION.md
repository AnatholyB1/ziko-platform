---
phase: 4
slug: data-copy-integrity-verification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-02
---

# Phase 4 — Validation Strategy

> Per-phase validation contract. Full detail: `04-RESEARCH.md` § Validation Architecture.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node 26, glob form) |
| **Config file** | none — Wave 0 installs `pg`, `pg-copy-streams` |
| **Quick run command** | `node --test "scripts/portfolio-migration/*.test.mjs"` |
| **Full suite command** | `node scripts/portfolio-migration/<verify>.mjs --check all` (against scratch, then portfolio) |
| **Estimated runtime** | ~30 seconds (unit) / ~2 minutes (live verify) |

## Sampling Rate

- **After every task commit:** quick run command
- **After every plan wave:** full unit suite; live `--check all` once scratch/portfolio loaded
- **Before `/gsd:verify-work`:** live `--check all` green on portfolio
- **Max feedback latency:** 120 seconds

## Per-Task Verification Map

| Task | Requirement | Automated command |
|------|-------------|-------------------|
| 04-01 T1 | DATA-01 | package.json pin check + `import pg / pg-copy-streams` + `git check-ignore` |
| 04-01 T2 | DATA-01 | `node --test "scripts/portfolio-migration/lib-data.test.mjs"` |
| 04-02 T1 | DATA-03, DATA-04 | `node --test "scripts/portfolio-migration/lib-verify.test.mjs"` |
| 04-02 T2 | DATA-02, DATA-05 | `node --test "scripts/portfolio-migration/lib-verify.test.mjs"` (incl. static no-nextval scan) |
| 04-03 T1 | DATA-01 | `node --test "scripts/portfolio-migration/lib-conn.test.mjs"` |
| 04-03 T2 | DATA-01, DATA-02 | full unit suite + local refusal commands (ziko target, portfolio without --confirm-ref) |
| 04-04 T1 | DATA-03..05 | unit suite + live `06-verify-data --check rls/fk/orphans` on scratch |
| 04-04 T2 | DATA-05 | RUNBOOK grep (section, typed phrase, no UUID) |
| 04-05 T1 | DATA-01 | token present + gitignored (human-action) |
| 04-05 T2 | DATA-01 | `06-verify --check users` + `05-load-data --plan` + `--probe` on scratch |
| 04-05 T3 | DATA-01..05 | `06-verify-data --check all` on scratch + report PII grep |
| 04-06 T1 | DATA-03, DATA-04 | auto-chain false + `--plan` + `--check fk` on portfolio + baseline PII grep |
| 04-06 T2 | DATA-01 | typed-authorization line grep (checkpoint) |
| 04-07 T1 | DATA-01..05 | gate grep + `06-verify-data --check all --baseline` on portfolio + report PII grep |
| 04-07 T2 | — | `test ! -f scripts/auth-merge/.access-token` |

## Wave 0 Requirements

- [ ] `pg` and `pg-copy-streams` installed
- [ ] node:test stubs for loader and verify suite
- [ ] Scratch re-seeded with collision state for rehearsal

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New PAT / DB credential supply | DATA-01 | No secrets in session | Human checkpoint |
| Typed-phrase authorization before first portfolio write | DATA-01 | Shared production project | Checkpoint |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] No 3 consecutive tasks without automated verify
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
