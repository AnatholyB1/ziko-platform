---
phase: 02-schema-rename-function-rls-rewrite
verified: 2026-10-01T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 2 Verification

**Goal:** every ziko schema object exists in portfolio under a `ziko_` prefix, functionally identical, with zero stale unprefixed references.

Evidence comes from read-only queries against portfolio (`ubxllsvanurkwkohzxau`) and the repo files. SUMMARY claims were not taken as proof.

| # | Success criterion | Status | Evidence |
|---|---|---|---|
| 1 | New migration series creates all tables under `ziko_`; ziko history untouched | VERIFIED | `supabase/portfolio-migrations/` holds 2 files (99 CREATE TABLE in schema, plus functions). Portfolio has 99 `ziko_*` tables, matching the rename map (99 tables, 33 functions). `supabase/migrations/` is unmodified in git status. The series sits outside the CI path. |
| 2 | SECURITY DEFINER functions execute against renamed tables | VERIFIED | 33 `ziko_*` functions live (29 SECURITY DEFINER, 0 without a pinned search_path). `ziko_deduct_ai_credits`, `ziko_is_coach_of`, `ziko_record_athlete_decision` exist. No unprefixed originals remain. |
| 3 | RLS enabled with policies on all `ziko_*` tables | VERIFIED | 99 tables, 0 without RLS, 176 policies (same fingerprint as ziko and scratch per 02-05/07). 18 triggers present. |
| 4 | Automated grep finds zero unprefixed refs in `pg_policies`/`pg_proc` | VERIFIED | My independent regex check for unprefixed table names in policies and function bodies returned 0 rows. `03-run-verify.mjs` flags only the 4 accepted false positives (names in RAISE messages and comments). |
| 5 | Full dry run on scratch before portfolio | VERIFIED | Scratch project `rkirvurggtgjlkeuhded` was applied with zero errors (02-05). Human gate approved (02-06). Portfolio apply used the same files. |

## Other checks
- Webhook secret: 0 triggers on portfolio contain the `{{X_WEBHOOK_SECRET}}` placeholder, so it was substituted. The repo files keep the placeholder and no real secret was found in them.
- Existing tenants: the 7 non-ziko tables (`album_photos`, `albums`, `categories`, `orders`, `portfolio_photos`, `products`, `prospects`) are portfolio's own, outside the ziko prefix.
- Auth triggers `handle_new_user` and `handle_new_user_credits` were deliberately not created. Phase 3 owns them.

## Accepted items (not gaps)
- 4 `stale_function_refs` false positives.
- Smoke test not run on portfolio (shared auth pool). Coverage rests on the scratch run plus identical policy/column fingerprints.
- `unaccent` installed into `public` on portfolio. Optional follow-up: `ALTER EXTENSION unaccent SET SCHEMA extensions;`.
- `ziko_waitlist_founder_seq` value deferred to Phase 3 (ROADMAP Phase 3 SC6).

## Gaps
None.

## Human verification
None required. SCHEMA-01..05 are satisfied.
