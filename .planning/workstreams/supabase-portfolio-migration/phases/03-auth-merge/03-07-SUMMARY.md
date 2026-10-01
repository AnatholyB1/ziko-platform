---
phase: 03-auth-merge
plan: 07
subsystem: auth-migration
tags: [supabase, auth, management-api, redirect-allow-list, runbook]
requires: ["03-01"]
provides: [auth-config-merge-cli, phase3-runbook]
affects: [03-08-rehearsal, 03-10-portfolio-run]
tech-stack:
  added: []
  patterns: [read-merge-write with drift abort, raw secrets in os.tmpdir with redacted form for git, pure helpers tested with node:test]
key-files:
  created:
    - scripts/auth-merge/05-auth-config-merge.mjs
    - scripts/auth-merge/05-auth-config-merge.test.mjs
    - scripts/auth-merge/RUNBOOK.md
decisions:
  - "Extra allow-list URIs derived from code: only the mobile scheme (ziko://** from apps/mobile/app.json). No emailRedirectTo/redirectTo auth origins exist in apps/ or backend/ (web redirectTo values are in-app relative paths), so none added. ziko's site_url is appended only if absent."
  - "--apply runs assertWriteAllowed before reading the token or touching the network."
  - "Drift check on --apply treats any difference vs the before snapshot (including uri_allow_list) as abort."
requirements-completed: []
metrics:
  tasks: 2
  files: 3
  completed: 2026-10-01
---

# Phase 3 Plan 07: Auth config merge tool and runbook Summary

Built `05-auth-config-merge.mjs` (snapshot / plan / apply / diff against the Management API, PATCHing only `uri_allow_list`) with tested pure helpers, and the Phase 3 operator RUNBOOK covering rehearsal, portfolio run, final delta sync and the D-11 session consequence. No Management API call was made; no token exists yet and nothing was written anywhere.

## Commits
- 25f930c7: config merge tool and tests
- 024771b9: RUNBOOK.md

## Verification
- `node --test "scripts/auth-merge/*.test.mjs"`: 50 pass, 0 fail (6 new for buildMergedAllowList / redactConfig / rawSnapshotPath).
- `--help` works; `--apply` against portfolio without `--confirm-ref` fails on the confirm check before any token or network use.
- Greps: no "config push" outside comments, exactly one `method: 'PATCH'`, no timestamp in raw path construction, `tmpdir` and `overwrite` present.
- RUNBOOK: 6 sections, 8 `--confirm-ref ubxllsvanurkwkohzxau` lines, `apply-password-updates` documented, no `ls -t`, no email addresses.

## Deviations from Plan
None. The tests were written before the implementation but committed together with it in one commit rather than as separate RED/GREEN commits.

## Notes for downstream plans
- Extra URIs and the `--plan` output must be reviewed by a human in the Plan 10 checkpoint before any portfolio PATCH (T-3-31).
- Flags for `07-notify-relogin.mjs` in the RUNBOOK are taken from 03-03-PLAN (script not yet present in the tree when this ran).
- Live behavior of the Management API (including that PATCH replaces `uri_allow_list` wholesale, assumption A1) is unverified until the scratch config rehearsal.

## Known Stubs
None.

## Self-Check: PASSED
