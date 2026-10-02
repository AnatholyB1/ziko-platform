---
phase: 4
slug: data-copy-integrity-verification
status: draft
nyquist_compliant: false
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

Filled by the planner per task (requirements DATA-01..DATA-05; checks: counts parity, replication-role/trigger state, FK validate/orphans, sequences, UUID-remap zero-occurrence, RLS enabled).

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] No 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
