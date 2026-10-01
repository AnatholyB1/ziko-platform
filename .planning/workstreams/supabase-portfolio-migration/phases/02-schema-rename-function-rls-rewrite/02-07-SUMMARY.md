---
phase: 02-schema-rename-function-rls-rewrite
plan: 07
subsystem: database
tags: [supabase, migration, portfolio, rls]
requires:
  - phase: 02-05
  - phase: 02-06
provides:
  - ziko_-prefixed schema live on portfolio (SCHEMA-01..05)
key-decisions:
  - "Applied the same migration files as scratch (byte-identical; only the webhook secret substituted at apply time from Vercel ziko-api WEBHOOK_SECRET)"
  - "Applied via supabase db query --linked --project-ref ubxllsvanurkwkohzxau -f (no db push, no migration-history changes)"
  - "Smoke test (04-rls-smoke-test.js) NOT run on portfolio: it creates throwaway users in the shared auth pool, whose existing auth.users triggers could cause cross-tenant side effects. Coverage rests on structural parity with scratch where it passed."
requirements-completed: [SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05]
completed: 2026-10-01
---

# Phase 2 Plan 07: Apply to portfolio Summary

Bootstrap, schema and functions migrations applied to portfolio with zero errors.

## Evidence
- **Objects:** 99 ziko_ tables (RLS on all, 0 without), 33 ziko_ functions, 18 triggers (incl. the 2 push triggers, secret substituted), pg_net and unaccent installed.
- **Parity with ziko:** 176 policies md5 4c9ebc89..., 921 columns md5 dcf6a505..., identical to ziko live and to scratch.
- **Zero regression on existing tenants:** table, policy and trigger fingerprints for non-ziko objects unchanged before/after; auth.users count unchanged (6).
- **Only side effect on existing objects:** the unaccent extension added 4 functions to `public` (unaccent, unaccent_init, unaccent_lexize and a second unaccent overload). Existing 5 non-ziko functions unchanged. `ziko_search_users_fuzzy` pins `public, extensions, pg_temp`, so it works with this placement. Optional follow-up: `ALTER EXTENSION unaccent SET SCHEMA extensions;`.
- **03-run-verify.mjs:** all PASS except stale_function_refs, the same 4 documented false positives (names appear only in RAISE messages and comments).
- **RPC:** `ziko_is_coach_of(uuid, uuid)` returns false without error.

## Carry-forward
- Phase 3: set `ziko_waitlist_founder_seq` to ziko's live value (87 on 2026-10-01).
- Phase 3: the two `auth.users` triggers (handle_new_user, handle_new_user_credits) were deliberately not created; they must be scoped to ziko signups only.
- No data copied yet (Phase 4).
