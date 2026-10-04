# Phase 7: Monitoring & Decommission - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-04
**Phase:** 7-Monitoring & Decommission
**Areas discussed:** Rollback window & read-only, Cold backup & restore proof, Full verification gate, Carried items & deletion protocol

---

## Rollback window & read-only

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 30 days + Android confirmed | Ends at flip+30d and Play state confirmed | |
| Fixed 14 days | Shorter, no real users | initially ✓ (superseded) |
| Binary adoption threshold | Needs telemetry that likely doesn't exist | |
| Manual call only | No automatic end | |

**User's choice:** Fixed 14 days, then superseded: "No need for rollback we can delete today if everything is clean".
**Notes:** Window waived (DECOM-01 recorded WAIVED). Read-only: "Revoke writes via DB role" chosen over intent-only and Supabase pause. After the waiver, "Waive window; brief write-freeze for backup" chosen over skipping read-only entirely or a 24-48h freeze. Mid-window extension question: "Window stays fixed; stragglers are accepted".

---

## Cold backup & restore proof

| Option | Description | Selected |
|--------|-------------|----------|
| Full: pg_dump + auth + storage + config | Whole DB, storage export with checksums, manifest | ✓ |
| DB dump + storage only | No config manifest | |
| DB dump only | Skip storage export | |

**User's choice:** Full backup; local encrypted archive + off-machine copy; restore into scratch + run verify scripts; keep indefinitely, review at 6 months.
**Notes:** Alternatives considered for location: local-only, portfolio storage bucket. For restore proof: local Postgres restore, archive integrity only. Retention alternative: 90 days then destroy.

---

## Full verification gate

| Option | Description | Selected |
|--------|-------------|----------|
| Frozen ziko vs portfolio, accounting for post-flip writes | Differences must be explained post-flip portfolio writes | ✓ |
| Strict equality vs Phase 4/5 baseline | Misses post-flip data | |
| Row counts only | Not the full checklist | |

**User's choice:** Frozen ziko vs portfolio with post-flip delta; blockers = any data/storage gap or RLS/FK regression.
**Notes:** Waived mobile checks do not block (alternative "also block on waived mobile checks" rejected).

---

## Carried items & deletion protocol

| Option | Description | Selected |
|--------|-------------|----------|
| Env scopes still on ziko | Preview/Development scopes, SUPABASE_PUBLISHABLE_KEY on ziko-web | ✓ |
| Scratch project + stale CI token | Delete scratch, revoke old token, repoint CI secrets | ✓ |
| Credential retirement (Task 3) | Revoke PAT, delete token files | not selected (moved after deletion) |
| Defer: crons 401, iOS, Play Console, Anthropic | Non-blocking | ✓ |

**User's choice:** Env scopes and scratch/CI token resolved before deletion; the rest deferred. Confirmation: simple yes at a dedicated checkpoint (typed phrase rejected). Execution: Claude deletes via API (dashboard-click alternative rejected).
**Notes:** Claude resolved an interaction: the PAT is needed for the API delete, so credential retirement runs after deletion. The answer text said "after the typed phrase" but the confirmation choice was a plain "yes"; recorded as a plain explicit "yes" at its own checkpoint.

---

## Claude's Discretion

Freeze mechanism details, backup archive format and encryption tool, delete-call helper, and how post-flip deltas are computed.

## Deferred Ideas

Cron 401 fix, iOS release, Play Console confirmation, Anthropic balance, orphan test PNG, backup retention review at 6 months.
