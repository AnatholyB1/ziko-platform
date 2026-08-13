# Phase 2: Test-Account Purge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 2-Test-Account Purge
**Areas discussed:** Test criteria, Execution scope, Backup method, Cross-links, Allowlist timing

---

## Test criteria

| Option | Description | Selected |
|--------|-------------|----------|
| I'll provide the list | You already know (or can compile) the exact emails/user IDs of dev/QA accounts — Claude builds the dry-run and purge tooling around that fixed allowlist. | ✓ |
| Generate candidates for review | Claude runs a read-only pattern-based query to produce a candidate list, which you then review and approve/reject. | |
| Both | Start from whatever list you already have, then generate additional pattern-based candidates to catch anything missed. | |

**User's choice:** I'll provide the list
**Notes:** No existing marker (no `is_test` column, no test-domain convention) exists anywhere in the schema per Phase 1's research — the allowlist has to come from the user, not an inferred pattern. See CONTEXT.md D-01.

---

## Execution scope

| Option | Description | Selected |
|--------|-------------|----------|
| Build + rehearse only | Deliver the criteria doc, dry-run export, backup step, and delete script — fully tested/verified — but the actual irreversible run against production is a separate, explicitly human-triggered step outside this phase's auto tasks. | ✓ |
| Execute end-to-end | This phase also runs the real deletion against production. Requires a production `SUPABASE_SERVICE_ROLE_KEY`, not available via any tool this session has used so far. | |

**User's choice:** Build + rehearse only (the recommended option)
**Notes:** Phase 2's target is production, not the `ziko` test project Phase 1 used against. Given the irreversibility and the missing production service-role key, this phase stops at rehearsal-ready. See CONTEXT.md D-03.

---

## Backup method

| Option | Description | Selected |
|--------|-------------|----------|
| Both PITR + explicit export | Confirm Supabase PITR is enabled on the production project and note the restore timestamp, AND export the exact affected rows (pg_dump/CSV) right before deleting. | ✓ |
| Rely on PITR only | Confirm Point-in-Time Recovery is enabled on the production plan and note the timestamp — no separate export step. | |
| Explicit export only | Export the exact affected rows to CSV/pg_dump immediately before deleting, regardless of PITR. | |

**User's choice:** Both PITR + explicit export (the recommended option)
**Notes:** Matches Pitfall 13's "how to avoid" step 3 verbatim, taken as the union rather than either safety net alone. See CONTEXT.md D-04.

---

## Cross-links

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-exclude from this run | Any flagged pair is automatically dropped from the delete set for this purge — purge only the unambiguous candidates now, revisit flagged pairs manually later. | ✓ |
| Surface for case-by-case decision | Each flagged pair is presented to you individually during the dry-run review, and you decide per-pair before the real deletion runs. | |

**User's choice:** Auto-exclude from this run (the recommended option)
**Notes:** Targets the "one real hazard" `research/ARCHITECTURE.md` §6 names — a real athlete cross-linked to a test coach via `coach_client_links`/`coach_vocal_feedbacks`. See CONTEXT.md D-05.

---

## Allowlist timing

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking checkpoint in the plan | CONTEXT.md notes the allowlist as pending; the plan's first task is a blocking checkpoint asking for the exact list before any dry-run/delete tooling executes against real data. | ✓ |
| I have it ready now | Share the emails/IDs in this conversation now, and Claude captures them directly into CONTEXT.md as the locked allowlist. | |

**User's choice:** Blocking checkpoint in the plan (the recommended option)
**Notes:** The allowlist is not available yet as of this discussion — the plan must stop and ask before any downstream task touches real data. See CONTEXT.md D-02.

---

## Claude's Discretion

- Exact shape/location of the dry-run export tool and the delete script (one-off Node/tsx script under `scripts/`, following the existing `scripts/*.js` pattern, vs. some other form).
- Exact SQL/query shape for any candidate-generation layered on top of the user-provided allowlist.
- Whether the backup export step is a manual `pg_dump` invocation documented in a runbook, or a small script — as long as both PITR confirmation and an explicit row export happen.

## Deferred Ideas

- **`waitlist_signups` QA-row reset** — distinct from `auth.users` test accounts; the RPC already exists from Phase 1 (`reset_waitlist_founder_sequence()`); timing belongs with Phase 6's go-live convergence checks.
- **Resolving cross-linked flagged pairs** — excluded from this purge run by design; revisited manually later, outside this phase.
- **The actual production deletion run** — this phase builds and rehearses; the real execution is a separate, explicitly human-triggered step, once the user has production credentials ready and has supplied the allowlist.
