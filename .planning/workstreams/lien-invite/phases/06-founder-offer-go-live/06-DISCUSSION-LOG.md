# Phase 6: Founder Offer Go-Live - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-18
**Phase:** 6-Founder Offer Go-Live
**Areas discussed:** Go-live execution model, Deploy scope, Account-purge precondition, Waitlist QA-row cleanup method, Reveal-threshold value at launch

---

## Go-live execution model

| Option | Description | Selected |
|--------|-------------|----------|
| RUNBOOK + rehearsal, human fires it for real | Mirrors Phase 2's D-03: build a RUNBOOK.md with exact ordered steps, rehearse against a fixture/test project where possible, end on a blocking human checkpoint for the real run. | ✓ |
| Direct execution this session, assuming prod creds arrive | Plan as if a future session holds real production credentials and runs steps directly. | |
| Hybrid — script does the safe parts, human does the destructive parts | A script handles read-only confirmation checks now; destructive steps stay manual. | |

**User's choice:** RUNBOOK + rehearsal, human fires it for real.
**Notes:** Matches the pattern every other credentialed step in this milestone has followed (account purge, counsel approval, CRED-01's production count) — no Claude session in this project has held real production Supabase credentials.

---

## Deploy scope

| Option | Description | Selected |
|--------|-------------|----------|
| In scope — Phase 6 owns merge + deploy verification | RUNBOOK includes merging to main, confirming CI applies missing migrations, confirming Vercel deploy picked up new backend code, as explicit checkable steps. | ✓ |
| Out of scope — assume merge/deploy happens separately | Phase 6 only covers the activation checklist, assumes merge/deploy happens through a separate process. | |

**User's choice:** In scope — Phase 6 owns merge + deploy verification.
**Notes:** Discovered live during this discussion (via Supabase MCP against `slkobhavpwsubnsmuhya`): only Phase 1's migration is applied to production; Phase 3's and Phase 4's migrations were never applied. The live backend still runs the old unconditional premium bypass.

---

## Account-purge precondition

| Option | Description | Selected |
|--------|-------------|----------|
| Re-run the dry-run check live as part of go-live, record 0 found, done | RUNBOOK re-runs Phase 2's dry-run export against production immediately before launch. | ✓ |
| Treat Phase 2 as already satisfied, no re-check needed | Skip re-verifying Phase 2 in Phase 6 since it's already marked complete in ROADMAP. | |

**User's choice:** Re-run the dry-run check live as part of go-live, record 0 found, done.
**Notes:** Live query during this discussion found 0 `@ziko-app.com` accounts on production right now — Phase 2's real deletion may have nothing to do, but the RUNBOOK re-verifies rather than assumes.

---

## Waitlist QA-row cleanup method

| Option | Description | Selected |
|--------|-------------|----------|
| Add a small TRUNCATE step to the RUNBOOK, run by the same human right before launch | One explicit `TRUNCATE`/`reset_waitlist_founder_sequence(1)` pair in the RUNBOOK after the go-live smoke test. | ✓ |
| Build a small admin script/RPC to do it | A new SECURITY DEFINER RPC that truncates + resets in one call. | |
| Skip the smoke test — trust the RLS/concurrency tests from Phase 1 | Don't insert any real row during go-live; rely entirely on Phase 1's test suite. | |

**User's choice:** Add a small TRUNCATE step to the RUNBOOK, run by the same human right before launch.
**Notes:** `reset_waitlist_founder_sequence()` only resets the sequence, not rows — confirmed by reading its migration comment, which names Phase 6 as consumer but doesn't cover row deletion. `waitlist_signups` is at 0 rows right now, but the go-live smoke test itself will create at least one row.

---

## Reveal-threshold value at launch

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 30 | No change — counter stays hidden until 170/200 claimed, as Phase 1 shipped it. | ✓ |
| Change it — specify a new value | Pick a different reveal threshold for real launch. | |

**User's choice:** Keep 30.
**Notes:** Confirmed live: `app_config.waitlist_reveal_threshold = 30` is already seeded correctly on production.

---

## Claude's Discretion

- Exact RUNBOOK file location/naming (likely `scripts/founder-offer-go-live/RUNBOOK.md`).
- Exact wording/format of post-deploy confirmation queries and entry-point/conversion verification steps.
- Whether the migration-apply confirmation is a manual SQL query or a small script.

## Deferred Ideas

- Rollback/kill-switch procedure — not raised as a blocking gray area; planner may include a brief note at its own discretion.
- The pre-existing `anon`-executable RPC security hole (`is_coach_of()`, `redeem_invitation_code()`, `peek_invitation()`) — explicitly out of scope per STATE.md.
- The founder-to-`tier='premium'` redemption flow — deferred per Phase 4's D-04.
