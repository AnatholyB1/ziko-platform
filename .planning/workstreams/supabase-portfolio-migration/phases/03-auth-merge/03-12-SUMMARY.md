---
phase: 03-auth-merge
plan: 12
subsystem: auth-migration
tags: [supabase, auth-config, uri_allow_list, management-api, token-retirement]
requires: ["03-10"]
provides: [portfolio-allow-list-merged, redacted-before-apply-and-after-snapshots]
key-files:
  created:
    - scripts/auth-merge/config/ubxllsvanurkwkohzxau-before-apply.redacted.json
    - scripts/auth-merge/config/ubxllsvanurkwkohzxau-after.redacted.json
decisions:
  - "Config PATCH ran under typed authorization option-approve-instance-fix; uri_allow_list only."
metrics:
  tasks: 2
  completed: 2026-10-01
---

# Phase 3 Plan 12: Portfolio auth config merge and token retirement Summary

Portfolio `uri_allow_list` went from 0 to 2 entries (`ziko://**`, `https://ziko-app.com`) via a read-merge-write PATCH of that single key. `--diff` against the before-apply raw snapshot passed.

## Task 1: Gate, snapshot, PATCH, diff

- Gate: `03-10-SUMMARY.md` matched `^Typed authorization: approve ubxllsvanurkwkohzxau option-(approve|approve-instance-fix)$` (count 1, option-approve-instance-fix). It ran before any network call.
- Fresh before-apply snapshot taken; `--plan` matched the 03-09/03-10 preview exactly (site_url kept `https://sevalys.com`, existing 0, merged 2, adds `ziko://**` and `https://ziko-app.com`).
- `--apply` with `--confirm-ref ubxllsvanurkwkohzxau` and explicit `--snapshot-raw`: `patched uri_allow_list: added=2`.
- `--diff --before-raw`: `DIFF: PASS` (no removed URIs, no other changed keys, so site_url, templates, providers equal). Exit 0.
- After snapshot written. Secret grep (`sbp_`, `eyJ`) on both committed files: 0. No raw snapshot or token tracked.
- Commit: 0fe93198.

## Task 2: Token retirement

- `scripts/auth-merge/.access-token` removed with PowerShell `Remove-Item`; `test ! -f` confirmed.
- Dashboard revocation is NOT done by this executor. The orchestrator must revoke both tokens: `ziko-auth-merge-temp` and `ziko-auth-merge-temp-2`. Pending until the orchestrator confirms.

## Deviations from Plan

**1. [Minor] Public settings check not performed.** The unauthenticated GET of `/auth/v1/settings` returned a body without an `external` field (likely requires the apikey header), so the provider check was not run separately. Provider and disable_signup equality is covered by the `--diff` PASS (all non-uri_allow_list keys equal).

Files were staged individually; REQUIREMENTS.md untouched per instruction (AUTHMIG-04 not marked complete).

## Self-Check: PASSED

Both redacted snapshots exist and are committed (0fe93198); token file absent.
