---
phase: 03-auth-merge
plan: 09
subsystem: auth-migration
tags: [supabase, auth-config, management-api, uri_allow_list, scratch]
requires: ["03-07"]
provides: [a1-verdict, portfolio-allow-list-preview, redacted-config-snapshots]
affects: [03-12-portfolio-config-apply]
key-files:
  created:
    - scripts/auth-merge/config/rkirvurggtgjlkeuhded-before.redacted.json
    - scripts/auth-merge/config/rkirvurggtgjlkeuhded-before-seeded.redacted.json
    - scripts/auth-merge/config/rkirvurggtgjlkeuhded-after.redacted.json
    - scripts/auth-merge/config/slkobhavpwsubnsmuhya-before.redacted.json
    - scripts/auth-merge/config/ubxllsvanurkwkohzxau-before.redacted.json
  modified:
    - .planning/workstreams/supabase-portfolio-migration/phases/03-auth-merge/03-09-PLAN.md
decisions:
  - "A1 verdict: PATCH uri_allow_list replaces the list wholesale; the tool's read-merge-write preserves existing entries because it sends the full union."
  - "Secret-grep gate tightened: sha256 (64-hex) digest of smtp_pass is allowed."
metrics:
  tasks: 2
  completed: 2026-10-01
---

# Phase 3 Plan 09: Auth config rehearsal on scratch Summary

Management API token supplied (Project Settings + Auth Config read-write, 7 day expiry, never printed or committed). The additive allow-list merge was rehearsed on scratch only; portfolio and ziko were only read.

## A1 verdict (RESEARCH assumption A1)

Scratch's allow-list was empty, so a sentinel `https://sentinel.example.invalid/**` was seeded on scratch (direct PATCH, scratch ref only), re-snapshotted, then the tool ran `--plan`, `--apply` (extras `ziko://**` plus ziko site_url `https://ziko-app.com` added automatically), and `--diff`.

- Result: allow-list became `[sentinel, ziko://**, https://ziko-app.com]`. Sentinel survived, `--diff` PASS (no removed URI, no changed key vs the seeded snapshot).
- Wholesale replacement confirmed: the restore PATCH with an empty value emptied the list. So the API does replace the list, and safety depends entirely on the tool sending the full union. It does.
- site_url (`http://localhost:3000` on scratch) unchanged by the merge.

## Scratch restore and one observation

Scratch `uri_allow_list` was restored to empty (PATCH with empty string, HTTP 200). Diff of the restored state against the original pre-seed snapshot reports one changed key, `custom_oauth_max_providers` (3 -> 32767). It is not caused by our body, which only contains `uri_allow_list`: it changed on the first successful PATCH (digest already differs in the before-seeded snapshot, identical in the after snapshot). Ziko and portfolio already report 32767 and the merge diff is PASS against the seeded snapshot, so this looks like a platform-side normalization of a stale scratch default on first write. Implication for Plan 12: portfolio already holds 32767, so no equivalent change is expected; take the `before-apply` snapshot immediately before apply as planned.

## Portfolio preview (read-only `--plan`, nothing written)

- Portfolio site_url (kept): `https://sevalys.com`
- Ziko site_url (to be added to allow-list per D-10): `https://ziko-app.com`
- Existing portfolio allow-list entries: 0; merged entries after apply: 2
- URIs to add: `ziko://**`, `https://ziko-app.com`
- Email templates, providers, rate limits untouched (D-10); ziko enables only the email provider, nothing to add.

Note: the portfolio list is currently empty, so wholesale replacement has no existing entries to lose, but Plan 12 must still re-run the drift check inside `--apply`.

## Deviations from Plan

**1. [Rule 1 - Bug in gate] Secret-grep gate false positive.** The plan's regex matched the sha256 digest of `smtp_pass` in every redacted snapshot. Tightened to: no `sbp_`/JWT patterns, and every `smtp_pass` value must be 64-hex. All five files pass. Commit a069dac6.

**2. Extra snapshot** `rkirvurggtgjlkeuhded-before-seeded` added (needed to prove A1 against the seeded state).

## Auth gates

Task 1 (token) was a human-action checkpoint. The first token lacked `project_admin_write` (HTTP 403 on PATCH); the orchestrator replaced it. Normal flow.

## Verification

- Scratch `--diff` against the seeded snapshot: PASS.
- No raw snapshots tracked (they live in the OS temp dir); `.access-token` is ignored and untracked.
- No PATCH sent to portfolio or ziko.
- The only `sbp_` hit in tracked files is a pre-existing test fixture (`apps/web/test/purge/purge-export.test.ts`), unrelated.

## Known Stubs

None.

## Self-Check: PASSED
