---
phase: 1
slug: inventory-pre-flight-audit
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — this phase produces a documentation artifact (`INVENTORY.md`), not application code. Verification is confirming each live query ran and its output was captured, not running a test suite. |
| **Config file** | none |
| **Quick run command** | `supabase db query --linked --project-ref <ref> "<SQL>"` (per-query check: non-error JSON response) |
| **Full suite command** | Re-run every query in `01-RESEARCH.md` "Code Examples" against both `ziko` (slkobhavpwsubnsmuhya) and `portfolio` (ubxllsvanurkwkohzxau), diff against captured figures |
| **Estimated runtime** | ~5 minutes (network round-trips to two live Supabase projects) |

---

## Sampling Rate

- **Per query:** confirm the JSON response has no `error` field and `rows` is non-empty (or explicitly expected-empty, e.g. realtime publication)
- **Phase gate:** all 5 verification rows below must show a captured, non-placeholder value in `INVENTORY.md` before `/gsd:verify-work` runs for this phase — a "TBD" or "assumed" value in any INV section fails the gate, since CONTEXT.md decisions D-01/D-02/D-03 require exact figures for their stop/escalate logic to function

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INV-01 | T-01-01 | Live ziko inventory (tables/RLS/functions/triggers/buckets/extensions/realtime) captured, non-placeholder | manual+query | `supabase db query --linked --project-ref slkobhavpwsubnsmuhya "<SQL>"` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | INV-02 | T-01-01 | Live portfolio inventory captured, non-placeholder | manual+query | `supabase db query --linked --project-ref ubxllsvanurkwkohzxau "<SQL>"` | ✅ | ⬜ pending |
| 01-02-01 | 01 | 1 | INV-03 | T-01-02 | Collision report committed with masked identifiers only, no raw emails in git history | manual review | Diff review of `INVENTORY.md` before commit | ✅ | ⬜ pending |
| 01-02-02 | 01 | 1 | INV-04 | — | Postgres version + extension diff documented for both projects | query | `SELECT version();` + `SELECT extname,extversion FROM pg_extension;` | ✅ | ⬜ pending |
| 01-02-03 | 01 | 1 | INV-05 | — | DB size/storage/connections captured; plan-tier ceiling confirmed or explicitly flagged `checkpoint:human-verify` | query+manual | `pg_database_size`, bucket storage sum, `SHOW max_connections` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Task IDs above are provisional pending the planner's actual task numbering — the planner must map its real task IDs to these 5 requirement rows.

---

## Wave 0 Requirements

None — this phase has no code test suite to bootstrap. The "tests" are the live queries themselves, all demonstrated working in `01-RESEARCH.md`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Portfolio's exact plan-tier storage/connection quota ceiling | INV-05 | Not exposed via SQL or any tested CLI subcommand — billing/plan-tier data lives in the Supabase/Vercel-marketplace dashboard only | Check Supabase project settings → Billing/Usage for `portfolio`; record the ceiling in `INVENTORY.md`; if genuinely unconfirmable, flag explicitly as an open item rather than assuming sufficiency |
| Collision report contains no raw PII | INV-03 | Automated diffing was done in an ephemeral, gitignored scratch location and deleted — the final commit must be manually reviewed to confirm no raw email/identity data leaked into the tracked file | Review `git diff --staged` for `INVENTORY.md` before committing; confirm only counts and masked identifiers (e.g. `u***@***.com`) appear |

---

## Validation Sign-Off

- [x] All tasks have manual or query-based verify (no automated test framework applicable to this phase)
- [x] Sampling continuity: every task has its own verification method (no 3 consecutive unverifiable tasks)
- [x] Wave 0 covers all MISSING references (none needed)
- [x] No watch-mode flags
- [x] Feedback latency < 60s per query
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-22
