---
phase: 3
slug: auth-merge
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-01
---

# Phase 3 — Validation Strategy

> Per-phase validation contract. Source: `03-RESEARCH.md` § Validation Architecture.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node `node:test` (pure helpers) + `06-verify.mjs` live-SQL assertions |
| **Config file** | none — Wave 0 creates `scripts/auth-merge/` |
| **Quick run command** | `node --test scripts/auth-merge/` |
| **Full suite command** | `node scripts/auth-merge/06-verify.mjs --project-ref <ref>` |
| **Estimated runtime** | ~30 seconds |

## Sampling Rate

- **After every task commit:** `node --test scripts/auth-merge/`
- **After every plan wave:** rehearsal on scratch + `06-verify.mjs` against scratch
- **Before `/gsd:verify-work`:** `06-verify.mjs` against portfolio all green
- **Max feedback latency:** 60 seconds

## Per-Requirement Verification Map

| Req | Behavior | Test Type | Automated Command | Status |
|-----|----------|-----------|-------------------|--------|
| AUTHMIG-01 | 38 ziko ids imported with identical hash/metadata/timestamps; collision id absent; GoTrue accepts rows | live-SQL + integration | `06-verify.mjs --check users` / `--check gotrue` | ⬜ pending |
| AUTHMIG-02 | identities present for all 39, collision identity re-pointed to portfolio UUID | live-SQL | `06-verify.mjs --check identities` | ⬜ pending |
| AUTHMIG-03 | exactly 2 `ziko_` triggers on `auth.users`; unflagged signup → 0 Ziko rows, flagged → profile+credits | live-SQL (rolled-back probe) | `06-verify.mjs --check triggers` | ⬜ pending |
| AUTHMIG-04 | `uri_allow_list` superset of snapshot; other config fields equal | API diff | `node scripts/auth-merge/05-auth-config-merge.mjs --diff` | ⬜ pending |
| AUTHMIG-05 | recipient count == non-test ziko users; FR+EN render | dry-run | `node scripts/auth-merge/07-notify-relogin.mjs --dry-run` | ⬜ pending |
| SC6 | `ziko_waitlist_founder_seq` equals ziko live `last_value`/`is_called` | live-SQL | `06-verify.mjs --check sequence` | ⬜ pending |
| Regression | portfolio pre-existing users and `rh_*/gecko_*` counts unchanged | live-SQL | `06-verify.mjs --check tenants` | ⬜ pending |

## Wave 0 Requirements

- [ ] `scripts/auth-merge/lib.mjs` + helper unit tests (mask, column intersection, URL-list union)
- [ ] Baseline snapshot of portfolio (tenant row counts, hashes of existing user rows, auth config) BEFORE any write
- [ ] Scratch project seeded from a ziko export (PII to scratchpad only)

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Instructions |
|----------|-------------|------------|--------------|
| Management API access token | AUTHMIG-04 | No token in-session | User supplies PAT or dashboard values |
| Real send of re-login notice | AUTHMIG-05 | Date chosen in Phase 6 | Dry-run only in Phase 3 |

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity maintained
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
