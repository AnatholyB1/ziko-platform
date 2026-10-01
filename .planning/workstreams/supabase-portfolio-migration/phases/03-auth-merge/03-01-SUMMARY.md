---
phase: 03-auth-merge
plan: 01
subsystem: auth-merge-tooling
tags: [supabase, auth, migration, safety, baseline]
requires: []
provides:
  - scripts/auth-merge/lib.mjs shared helpers (explicit-ref transport, write guards, PII redaction)
  - scripts/auth-merge/00-baseline-snapshot.mjs (collectBaseline reusable by 06-verify.mjs)
  - scripts/auth-merge/baseline/portfolio-baseline.json (pre-write portfolio baseline)
affects: [03-02 through 03-13]
tech-stack:
  added: []
  patterns: [node:test for pure helpers, supabase db query --linked --project-ref transport, OS-tmpdir SQL files]
key-files:
  created:
    - scripts/auth-merge/lib.mjs
    - scripts/auth-merge/lib.test.mjs
    - scripts/auth-merge/00-baseline-snapshot.mjs
    - scripts/auth-merge/baseline/portfolio-baseline.json
  modified:
    - .gitignore
    - .planning/workstreams/supabase-portfolio-migration/phases/03-auth-merge/03-VALIDATION.md
key-decisions:
  - "Volatile auth columns defined once in lib.mjs; baseline hashes also exclude encrypted_password and instance_id (tracked via has_password / instance_id_null) so approved D-03 guarded fills stay distinguishable"
requirements-completed: [AUTHMIG-01, AUTHMIG-04]
duration: ~20 min
completed: 2026-10-01
---

# Phase 3 Plan 01: Auth-merge foundation Summary

Shared, unit-tested helper module (explicit project refs, ziko never writable, portfolio needs confirm-ref, PII redaction) plus a read-only baseline of portfolio taken before any Phase 3 write.

## Tasks

| Task | Commits |
|------|---------|
| 1 (TDD): lib.mjs + lib.test.mjs | RED `test(03-01)` then GREEN `feat(03-01)` (see git log) |
| 2: baseline tool, gitignore, baseline, VALIDATION | `32c44ee1` |

## Live baseline (portfolio, read-only)

- 34 tenant (non-`ziko_`) public tables: 27 `rh_`/`gecko_` plus 7 portfolio-site tables (albums, album_photos, categories, orders, portfolio_photos, products, prospects)
- 6 auth.users (1 with no password and NULL instance_id, the collision account), 4 auth.identities
- 0 triggers on auth.users
- `ziko_waitlist_founder_seq`: last_value 1, is_called false

All match RESEARCH expectations. Baseline contains only UUIDs, booleans, md5 digests, counts (grep for emails and bcrypt prefixes: 0).

## Deviations from Plan

**1. [Rule 3 - Blocking] Test command form.** `node --test scripts/auth-merge/` (directory argument) fails on Node v26.4.0 (treated as a module path). Tests run with `node --test "scripts/auth-merge/*.test.mjs"` (11 pass). Later plans/VALIDATION.md quick-run command should use the glob form. Not edited in VALIDATION.md to keep scope tight.

**2. Acceptance grep note.** The plan's email-literal grep has an unescaped dot, so it matches JSDoc `@param` and "@example.com value"; every actual email literal in lib.mjs/lib.test.mjs uses reserved `example.com`/`example.invalid`.

Otherwise executed as written.

## Known Stubs

None.

## Threat Flags

None. No writes to any project; only SELECT queries against portfolio.

## Self-Check: PASSED

Files lib.mjs, lib.test.mjs, 00-baseline-snapshot.mjs, portfolio-baseline.json exist; commits present in git log.
