---
phase: 03-auth-merge
plan: 03
subsystem: auth-migration
tags: [email, react-email, resend, relogin-notice, dry-run]
requires: ["03-01"]
provides: [relogin-notice-template, notify-relogin-script]
affects: [06-cutover]
tech-stack:
  added: []
  patterns: [dry-run default with explicit --send, UUID-keyed idempotent send log, single if/else-if bucket chain, pure helpers tested with node:test]
key-files:
  created:
    - packages/email/src/templates/ReloginNotice.tsx
    - packages/email/dist/ReloginNotice.mjs
    - packages/email/dist/ReloginNotice.cjs
    - packages/email/dist/ReloginNotice.d.ts
    - packages/email/dist/ReloginNotice.d.cts
    - scripts/auth-merge/07-notify-relogin.mjs
    - scripts/auth-merge/07-notify-relogin.test.mjs
  modified:
    - packages/email/tsup.config.ts
    - packages/email/package.json
decisions:
  - "Template takes pre-formatted FR/EN dates; no locale logic and no links/CTA (nothing to link to yet, lowers phishing look-alike risk)."
  - "Buckets use precedence test_domain > deleted_or_banned > unconfirmed > already_sent, so counts are disjoint and always sum to the total."
  - "Send log stores UUIDs only and is rewritten after each successful send; dry-run never reads-for-write or writes it."
requirements-completed: []
requirements-partial:
  - "AUTHMIG-05: partial - tooling + dry-run delivered, send is a Phase 6 task"
metrics:
  tasks: 2
  files: 9
  completed: 2026-10-01
---

# Phase 3 Plan 03: Re-login notice template and send script Summary

Bilingual (FR primary, EN second) ReloginNotice React Email template plus `07-notify-relogin.mjs`, which builds the recipient list live from ziko `auth.users` in memory, defaults to dry-run, and sends via Resend only with `--send`, logging UUIDs only for idempotency.

## Commits
- 9e43b4c9: ReloginNotice template, tsup entry, package export, built dist (dist is gitignored, so the new files were force-added like the existing ones)
- 42eb5206: send script and tests

## Verification
- `npm run build -w @ziko/email` succeeds; `@ziko/email/templates/ReloginNotice` imports as a function.
- `node --test "scripts/auth-merge/*.test.mjs"`: 60 pass, 0 fail (10 new). RED confirmed first (module missing).
- Wrong ref (`--source-ref` = portfolio) exits 2.
- Live ziko dry-run (read-only, `--cutover-date 2026-11-15` as a rendering sample only): total=39, test_domain=0, deleted_or_banned=0, unconfirmed=0, already_sent=0, to_send=39, excluded sum 0. Render check passed (FR text, EN text, both dates). Output contained no unmasked email; no `notify-log.json` was created; the temp preview HTML was deleted afterwards.
- No email was sent and nothing was written to ziko or portfolio.

## Deviations from Plan
None. Plan executed as written. Note: `packages/email/dist/WeeklyDigest.*` was rebuilt by tsup but those pre-existing working-tree modifications were deliberately not staged.

## AUTHMIG-05 status
Partial only. Template, live recipient list and send script are delivered and dry-run proven; the actual send (date chosen in Phase 6, passed via `--cutover-date`) is pending. Success criterion 5 ("Ziko users have been informed") is deferred to Phase 6. REQUIREMENTS.md was not updated for AUTHMIG-05.

## Known Stubs
None.

## Self-Check: PASSED
Files and commits 9e43b4c9, 42eb5206 verified present.
