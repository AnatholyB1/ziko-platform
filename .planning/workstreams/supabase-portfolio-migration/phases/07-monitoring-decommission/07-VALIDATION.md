---
phase: 7
slug: monitoring-decommission
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-04
---

# Phase 7 — Validation Strategy

> Per-phase validation contract. Source of truth for the full requirement-to-test map: `07-RESEARCH.md` section "Validation Architecture".

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

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| DECOM-01 | Waiver recorded as WAIVED, not done | doc check | script test reading REQUIREMENTS.md | ❌ W0 | ⬜ pending |
| DECOM-02 | Freeze snapshot/replay symmetric; measured T0==T1 | unit + live | `node --test .../19-decom-freeze.test.mjs` | ❌ W0 | ⬜ pending |
| DECOM-02 | Backup manifest complete, archive decrypts and re-hashes | unit + live | `node --test .../20-decom-backup.test.mjs` | ❌ W0 | ⬜ pending |
| DECOM-02 | Restore proof on wiped scratch (same-name count+md5, object sha256) | unit + live | `node --test .../21-decom-restore-proof.test.mjs` | ❌ W0 | ⬜ pending |
| DECOM-03 | Delta evaluator: portfolio>=ziko, ziko-only PK fails, rh_/gecko_ regression fails | unit + live read-only | `node --test .../22-decom-verify.test.mjs` | ❌ W0 | ⬜ pending |
| DECOM-04 | Delete refuses without `confirmation_yes` gate | unit | `node --test .../24-decom-delete.test.mjs` | ❌ W0 | ⬜ pending |
| DECOM-05 | Delete refuses portfolio/scratch ref, wrong name, any gate false; post-delete GET + log | unit + live | same + `--confirm-gone` | ❌ W0 | ⬜ pending |
| D-12 | No env scope or CI secret points at ziko/scratch; scratch deleted | live read-only | `node .../23-decom-env-audit.mjs --all` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [ ] `18-decom-guard`, `19-decom-freeze`, `20-decom-backup`, `21-decom-restore-proof`, `22-decom-verify`, `23-decom-env-audit`, `24-decom-delete` scripts, each with `.test.mjs`
- [ ] pg client tools installed (human-gated) and a dump/restore probe on scratch
- [ ] Read-only probe of the ziko project via Management API (name, status, org, Vercel integration state)
- [ ] Freeze coverage probe on scratch (anon/authenticated/service_role writes, SECURITY DEFINER function, storage upload, signup)
- [ ] `.gitignore` entries for backup paths and `.tmp-decom-*`

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Explicit deletion confirmation | DECOM-04 | Must be a genuine, separate human "yes" | Dedicated checkpoint after backup proof and verification report are shown |
| Dashboard deletion fallback (if Vercel-managed project refuses API delete) | DECOM-05 | Outward-facing, irreversible | User deletes in dashboard; Claude runs `--confirm-gone` and writes the log |
| PAT revocation, Vercel bypass rotation | D-14 | Account-level action | User revokes at the Supabase tokens page, replies `revoked` |

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] No 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
