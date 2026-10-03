---
phase: 02-schema-rename-function-rls-rewrite
plan: 05
subsystem: database
tags: [supabase, migration, dry-run, scratch, rls]
requires:
  - phase: 02-03
    provides: ziko_-prefixed schema + functions migrations
  - phase: 02-04
    provides: verification tooling
provides:
  - SCHEMA-05 dry-run evidence on scratch project rkirvurggtgjlkeuhded
key-files:
  created:
    - scripts/portfolio-migration/00-bootstrap-supabase-functions.sql
key-decisions:
  - "Migrations moved to supabase/portfolio-migrations/ so CI (ci.yml migrate-supabase, test-rls.yml) never applies them to ziko's own project"
  - "Applied via `supabase db query --linked --project-ref` (not db push) to avoid ziko's ~90 historical migrations; the repo's linked project is ziko PRODUCTION, so --project-ref is always passed explicitly"
  - "X-Webhook-Secret substituted at apply time from Vercel ziko-api WEBHOOK_SECRET into a throwaway copy; never written to the repo"
  - "supabase_functions.http_request bootstrapped (absent on scratch and portfolio) from ziko's live definition"
requirements-completed: [SCHEMA-05]
completed: 2026-10-01
---

# Phase 2 Plan 05: Scratch Dry Run Summary

Bootstrap + schema + functions migrations applied to scratch with zero errors.

## Verification evidence
- **Structural parity, ziko vs scratch:** 176 policies, identical md5 (names and predicates normalised for the `ziko_` prefix); 921 columns, identical md5; 99 tables, RLS enabled on all.
- **03-run-verify.mjs:** stale_policy_refs, stale_trigger_refs, rls_not_enabled and table_count PASS. stale_function_refs flagged 4 functions, all FALSE POSITIVES: old names appear only inside RAISE messages and SQL comments (create_form_instances_for_trigger, increment_community_stat, athlete_goals/athlete_state/grant_premium_credits, rls_auto_enable). No executable stale reference.
- **04-rls-smoke-test.js:** 4 reported failures, all matching original ziko behaviour (policies identical in ziko). ziko_coach_profiles, ziko_community_posts and ziko_community_user_stats are readable by design. ziko_exercises_merge_backup has RLS on and no policies in both projects. Many tables were skipped (seed FK/check constraints, or no user_id); the policy fingerprint above covers them.
- **RPC check:** `ziko_is_coach_of(uuid, uuid)` returns false without error.

## Notes for Plans 06/07
- Target portfolio with `--linked --project-ref ubxllsvanurkwkohzxau`. Read-only checks show: no `supabase_functions.http_request`, no `ziko_*` tables, extensions include pg_cron but not pg_net/unaccent.
- Apply order: `00-bootstrap-supabase-functions.sql`, schema migration, functions migration (secret substituted).
- Phase 3 owns setting `ziko_waitlist_founder_seq` to ziko's live value (87).
