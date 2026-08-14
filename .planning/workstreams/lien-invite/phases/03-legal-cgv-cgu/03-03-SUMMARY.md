---
phase: 03-legal-cgv-cgu
plan: 03
subsystem: legal-content
tags: [legal, gdpr, erasure, app_config, migration, counsel-briefing]
dependency-graph:
  requires:
    - apps/web/src/content/legal/founder-offer.ts (WAITLIST_RETENTION_YEARS, ERASURE_REQUEST_STATEMENT — plans 01/02)
    - supabase/migrations/20260812_waitlist_founder_offer.sql (app_config table, anonymize_waitlist_signup RPC — Phase 1)
  provides:
    - "supabase/migrations/20260815_waitlist_retention_config.sql — app_config.waitlist_retention_years = 3"
    - "scripts/waitlist-erasure/erase.mjs + RUNBOOK.md — human-triggered erasure procedure"
    - ".planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-COUNSEL-BRIEFING.md — D-02 deliverable"
  affects:
    - backend/api/test/rls/waitlist-config-rpc.spec.ts
tech-stack:
  added: []
  patterns:
    - "app_config seed row idempotent via ON CONFLICT (key) DO NOTHING, in a new dated migration — never edits the existing production migration"
    - "erasure script mirrors scripts/purge-test-accounts/lib.mjs's standalone admin-client idiom, deliberately lighter-weight (no dry-run export, no hashed manifest, no two-person rule) for a single-row, non-destructive, non-cascading RPC call"
    - "counsel-briefing package quotes every open question verbatim from its source with citation, paired with the exact drafted clause it applies to — never paraphrased, never answered on counsel's behalf"
key-files:
  created:
    - supabase/migrations/20260815_waitlist_retention_config.sql
    - apps/web/test/legal/retention-config.test.ts
    - scripts/waitlist-erasure/erase.mjs
    - scripts/waitlist-erasure/RUNBOOK.md
    - apps/web/test/legal/erasure-script.test.ts
    - .planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-COUNSEL-BRIEFING.md
  modified:
    - backend/api/test/rls/waitlist-config-rpc.spec.ts
decisions:
  - "erasure script deliberately carries none of Phase 2's purge ceremony (no dry-run export, no hashed manifest, no two-person rule) — the RPC it calls is a single-row, non-destructive, anonymising UPDATE with no cascade, so that rigor would be disproportionate (03-RESEARCH.md Open Question 2's own recommendation)"
  - "erase.mjs never normalizes or lowercases the email address client-side — normalize_waitlist_email() already runs inside the RPC, and a second client-side normalization would silently diverge if the SQL definition ever changes"
  - "counsel-briefing package's seven questions are ordered exactly as the plan specified (à vie enforceability, abusive-clause framework, erasure-vs-founder-spot, existing-premium-user re-consent, CGU §9 consistency, [TBD] notice period, CGU jurisdiction placeholder) with a closing section naming what is explicitly out of scope for counsel's time"
metrics:
  duration: ~35min
  completed: 2026-08-14
actuals:
  tokens: 10500
  tasks: 3
  commits: 3
status: complete
---

# Phase 3 Plan 03: Retention config, erasure procedure, counsel briefing Summary

Made the retention period and the erasure right real rather than merely stated: seeded the
retention value into `app_config` through a new additive migration (LEGAL-08), gave support a
written, credential-gated procedure for running Phase 1's `anonymize_waitlist_signup()` RPC on
request (LEGAL-09), and assembled the counsel-briefing package that makes plan 04's blocking
checkpoint answerable (D-02).

## What Was Built

**Task 1 — Additive migration seeding the retention period into `app_config`:**
- `supabase/migrations/20260815_waitlist_retention_config.sql` — a new, additive, ~15-line
  migration that inserts `('waitlist_retention_years', '3')` into `app_config`, guarded by
  `ON CONFLICT (key) DO NOTHING`. No DDL, no `GRANT`, no policy — `app_config`'s deny-all RLS
  posture from Phase 1 covers this row for free. `20260812_waitlist_founder_offer.sql` was never
  touched.
- `apps/web/test/legal/retention-config.test.ts` (5 tests) — the credential-free structural proof:
  the migration file exists, its comment-stripped SQL contains the insert/conflict-guard/key, the
  seeded literal `'3'` matches `WAITLIST_RETENTION_YEARS` exactly via regex extraction, no
  `GRANT`/`CREATE POLICY`/`DROP`/`ALTER TABLE` appears anywhere, and the prior migration's byte
  length (13749) and sha256 are pinned as a fixture — proving the append-only rule as an enforced
  check rather than a convention (T-03-13).
- Extended `backend/api/test/rls/waitlist-config-rpc.spec.ts` with two live-database assertions
  inside the existing `describe.skipIf(!RUN_DB)` block: the admin client reads exactly one
  `waitlist_retention_years` row with value 3, and the anon client reads zero rows for the same
  key — the deny-all posture holding for the new row exactly as it does for the threshold row.
  No `afterAll` restore needed since this suite never mutates the row.

**Task 2 — Human-triggered erasure procedure (script + runbook):**
- `scripts/waitlist-erasure/erase.mjs` — exports `parseErasureArgs`, `createErasureAdminClient`,
  `runErasure`, and `writeErasureLog`, plus a small guarded `main()`. `parseErasureArgs` requires
  `--email` and `--confirm`, accepts optional `--log`, throws descriptively on a missing address,
  a malformed (non-single-`@`) address, or a missing `--confirm`; the address is trimmed of
  surrounding whitespace only, never lowercased or otherwise normalized. `runErasure` calls
  `client.rpc('anonymize_waitlist_signup', { p_email: email })` and maps the result to
  `{ ok, anonymized, error }`, treating `anonymized: false` (no matching row) as a legitimate
  outcome, not a failure. The admin client reads `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` only,
  exits 1 naming whichever is missing, and never falls back to a publishable or anon key.
  `writeErasureLog` appends one JSON line (timestamp, email, outcome, operator) to a path defaulting
  under `os.tmpdir()`, never inside the repository.
- `scripts/waitlist-erasure/RUNBOOK.md` — the support-agent procedure: the `support@ziko-app.com`
  intake, the mandatory requester-identity verification step (the one control against a third
  party erasing someone else's entry), the exact invocation, how to read the three outcomes
  (erased / no matching row / error), the Article 12 one-month deadline, and the note that
  anonymization intentionally preserves `founder_rank`/`is_founder` per Phase 1's D-07 — with the
  fate of a claimed-but-erased spot flagged as Q3 in the counsel briefing, not settled here.
- `apps/web/test/legal/erasure-script.test.ts` (13 tests, hand-rolled fakes) — proves
  `parseErasureArgs`' full argument-parsing contract including the log-path default, `runErasure`'s
  exact RPC-call shape and verbatim (unnormalized) address pass-through, all three result-mapping
  shapes, `writeErasureLog`'s JSONL output, the source-level absence of
  `SUPABASE_PUBLISHABLE_KEY`/`ANON_KEY` in `erase.mjs`, and the RUNBOOK's required content markers.
  No network, no credentials, no real address in any fixture.

**Task 3 — Counsel-briefing package (D-02):**
- `.planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-COUNSEL-BRIEFING.md` — a
  self-contained document for a French lawyer with no access to this repository. Opens with a
  one-page orientation (who Ziko is, the founder offer in three sentences, enclosed documents and
  their live routes, governing-language note, provisional-drafting status citing
  `03-RESEARCH.md` Assumptions Log A4). Seven numbered sections (Q1–Q7), each quoting its source
  verbatim with citation and pairing it with the exact drafted clause: Q1 "à vie" enforceability
  (Pitfall 7 / R.212-1), Q2 abusive-clause black-list/grey-list applicability to a free benefit
  (Pitfall 8), Q3 erasure vs. claimed founder spot (Pitfall 4), Q4 existing-premium-user
  re-consent (Pitfall 9), Q5 the pre-existing CGU §9 amendment clause's consistency
  (`03-RESEARCH.md` Open Question 3, clause quoted verbatim and left unmodified), Q6 the
  `[TBD]` shutdown-notice day count (`03-UI-SPEC.md`), Q7 the CGU's `[A COMPLÉTÉ]`
  jurisdiction placeholder. Closes with what is explicitly out of scope for counsel's time
  (engineering choices, the retention figure, the Article 13 field checklist) and restates the
  provisional-drafting status.

## Verification

- `cd apps/web && npx vitest run test/legal` — 6 files, 52 tests, all green (includes this plan's
  `retention-config.test.ts` and `erasure-script.test.ts` alongside plans 01/02's four suites).
- `cd apps/web && npm run test` — 17 files passed, 1 skipped (DB-gated, unaffected), 218 tests
  passed, 4 skipped, no regressions in `test/purge`, `test/actions`, or `safe-next` suites.
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — zero errors in either file this plan
  created (`test/legal/retention-config.test.ts`, `test/legal/erasure-script.test.ts`). The
  pre-existing `.mjs`-module-type-inference errors in `test/purge/*.test.ts` are untouched by this
  plan, matching plans 01/02's documented out-of-scope boundary.
- `git diff --stat supabase/migrations/` (across this plan's three commits) — exactly one file
  added (`20260815_waitlist_retention_config.sql`), zero files modified.
- The counsel-briefing verify command
  (`node -e "..."` from the plan) printed `counsel briefing OK, 7 questions`.
- `git status --porcelain scripts/waitlist-erasure/` — no `.log`/`.jsonl`/`.csv` file staged.

## Verification Gap (documented, pre-existing, out of scope)

`cd backend/api && npm run test:rls` could **not** be run in this session: `backend/api/test/setup.ts`
throws unconditionally (before the `RUN_DB` guard is ever evaluated) when `.env.test` is absent,
and this sandboxed environment's permission settings block both reading and writing any
`backend/api/.env*` path — so a placeholder `.env.test` could not be created to get past the
unconditional presence check. This is the same, already-documented gap STATE.md and 01-04-SUMMARY.md
record for `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_TEST_URL`: the suite's logic (including this
plan's extension) is correct and self-verified by direct code review against the file's existing
`RUN_DB`-gated pattern, but the literal command's exit code was not observed in this session. CI
(`.github/workflows/test-rls.yml`) is expected to actually run it on the next PR, where the real
secrets exist.

## Deviations from Plan

**1. [Documented environment gap, not a Rule 1-3 auto-fix]** `cd backend/api && npm run test:rls`
could not be executed to confirm exit 0, for the reason above — the sandbox denies read/write
access to any `backend/api/.env*` file, so even a placeholder `.env.test` could not be created to
satisfy `test/setup.ts`'s unconditional required-env-var check ahead of the `RUN_DB` guard. This
mirrors the pre-existing, already-accepted gap this workstream's STATE.md records for Phase 1
(no live `SUPABASE_SERVICE_ROLE_KEY` in any session so far). No code change was made to work around
it — the extension to `waitlist-config-rpc.spec.ts` follows the file's own proven pattern exactly.

No other deviations — the plan's three tasks were executed as written.

## Known Stubs

None. `SHUTDOWN_MODIFICATION_CLAUSE`'s `[TBD — nombre de jours à confirmer par le conseil]`
placeholder (carried from plan 01) is explicitly the subject of this plan's Q6, not a stub this
plan should have resolved — resolving it without counsel input would violate the plan's own
prohibition against inventing a legally-binding figure.

## Self-Check: PASSED

All 6 created/modified files verified present on disk:
- `supabase/migrations/20260815_waitlist_retention_config.sql` (FOUND)
- `apps/web/test/legal/retention-config.test.ts` (FOUND)
- `backend/api/test/rls/waitlist-config-rpc.spec.ts` (FOUND, modified)
- `scripts/waitlist-erasure/erase.mjs` (FOUND)
- `scripts/waitlist-erasure/RUNBOOK.md` (FOUND)
- `apps/web/test/legal/erasure-script.test.ts` (FOUND)
- `.planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-COUNSEL-BRIEFING.md` (FOUND)

All 3 commits verified in `git log`: `c31184d` (Task 1), `e92b328` (Task 2), `153d5f5` (Task 3).
