# Phase 2: Test-Account Purge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 2-Test-Account Purge
**Areas discussed:** Test-account criteria, Backup mechanism, Cross-link / real-user exposure, Review & execution process

> **Note on provenance:** The first three areas below were discussed in an earlier session whose
> answers were captured in an interrupted `02-DISCUSS-CHECKPOINT.json` that was never committed —
> discovered only after this session had independently re-derived (less specific) answers to the
> same questions. The checkpoint's answers are authoritative and are what's recorded here and in
> CONTEXT.md; this session's own earlier, more conservative draft (a "provide the list later"
> blocking checkpoint, and "both PITR + export always") has been superseded and is not reflected
> in CONTEXT.md. The fourth area was genuinely still open (`areas_remaining` in the checkpoint) and
> was completed in this session.

---

## Test-account criteria

**From the earlier, interrupted session (checkpoint), in order:**

| Question | Answer |
|----------|--------|
| How do you actually identify which auth.users accounts are dev/QA test accounts? | Known email list/domain |
| What's the actual email pattern/list for your test accounts? | all mail with ziko-app domain, others are ok (real) |
| Confirming the exact domain and whether any exceptions exist | ziko-app.com, no exceptions — every account with an @ziko-app.com email is test/dev, everything else is real |

**Locked criterion:** every `@ziko-app.com` address is test/dev; every other domain is real, no exceptions. See CONTEXT.md D-01/D-02.

---

## Backup mechanism

**From the earlier, interrupted session (checkpoint):**

| Question | Answer |
|----------|--------|
| Is PITR enabled on this project's Supabase plan? | Not sure / need to check — becomes a verification task at execution time, not guessed here |
| Should the plan always export affected rows regardless of PITR, or only if PITR is unavailable? | Always export, regardless of PITR — export restores just the affected rows fast; PITR (if available) is a secondary, more disruptive fallback |

**Locked decision:** unconditional row export is the primary safety net; PITR status is checked but not assumed and does not gate the export. See CONTEXT.md D-04.

---

## Cross-link / real-user exposure

**From the earlier, interrupted session (checkpoint):**

| Question | Answer |
|----------|--------|
| If a candidate @ziko-app.com test account is linked to a genuine outside account, what should happen to that pairing? | Auto-exclude from this purge — any candidate cross-linked to a non-candidate (real) account is pulled from the delete list automatically, surfaced in the dry-run report for manual review, never auto-deleted |

**Locked decision:** auto-exclude flagged pairs from this run. See CONTEXT.md D-05.

---

## Review & execution process

*This was the one area left open in the earlier session (`areas_remaining`). Completed in this session:*

| Option | Description | Selected |
|--------|-------------|----------|
| Build + rehearse only | Deliver the criteria doc, dry-run export, backup step, and delete script — fully tested/verified — but the actual irreversible run against production is a separate, explicitly human-triggered step outside this phase's auto tasks. | ✓ |
| Execute end-to-end | This phase also runs the real deletion against production. Requires a production `SUPABASE_SERVICE_ROLE_KEY`, not available via any tool this session has used so far. | |

**User's choice:** Build + rehearse only (the recommended option)
**Notes:** Phase 2's target is production, not the `ziko` test project Phase 1 used against. Given the irreversibility and the missing production service-role key, this phase stops at rehearsal-ready — the real delete happens later, once the user is ready to run it personally with production credentials. See CONTEXT.md D-03.

---

## Claude's Discretion

- Exact query form for applying the `@ziko-app.com` criterion (case sensitivity, whitespace handling).
- Exact shape/location of the dry-run export tool and the delete script (one-off Node/tsx script under `scripts/`, following the existing `scripts/*.js` pattern, vs. some other form).
- Whether the backup export step is a manual `pg_dump` invocation documented in a runbook, or a small script — as long as the unconditional row export happens and PITR status is checked.

## Deferred Ideas

- **`waitlist_signups` QA-row reset** — distinct from `auth.users` test accounts; the RPC already exists from Phase 1 (`reset_waitlist_founder_sequence()`); timing belongs with Phase 6's go-live convergence checks.
- **Resolving cross-linked flagged pairs** — excluded from this purge run by design; revisited manually later, outside this phase.
- **The actual production deletion run** — this phase builds and rehearses; the real execution is a separate, explicitly human-triggered step, once the user has production credentials ready and has reviewed the dry-run output.
