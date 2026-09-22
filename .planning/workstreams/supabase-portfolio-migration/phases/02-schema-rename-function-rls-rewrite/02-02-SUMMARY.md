---
phase: 02-schema-rename-function-rls-rewrite
plan: 02
subsystem: infra
tags: [supabase, postgres, cli, migration-tooling]

requires:
  - phase: 01-inventory-pre-flight-audit
    provides: org-type confirmation (Vercel-Marketplace-managed), Postgres version baseline (17.6.1.084/.105)
provides:
  - A linked, live scratch Supabase project (rkirvurggtgjlkeuhded) for the SCHEMA-05 dry run
  - scripts/portfolio-migration/RUNBOOK.md documenting provisioning, this execution's project ref, and the phase's dry-run-then-real-apply sequencing gate
  - Corrected finding: supabase projects create works for this Vercel-Marketplace-managed org, contradicting 02-RESEARCH.md Pitfall 1
affects: [02-05, 02-06, 02-07]

tech-stack:
  added: []
  patterns: ["scripts/<task-name>/RUNBOOK.md convention (matches scripts/waitlist-erasure/RUNBOOK.md)"]

key-files:
  created:
    - scripts/portfolio-migration/RUNBOOK.md
  modified: []

key-decisions:
  - "D-03 mechanics corrected: scratch project provisioning IS automatable via `supabase projects create` for this org — empirically re-verified, not assumed. The underlying D-03 intent (new throwaway project, not local `supabase start`) is unchanged; only the 'Vercel dashboard only' mechanism claim was wrong."
  - "Password captured explicitly on project (re)creation to avoid an unrecoverable-password scratch project — first attempt (ref agrkkwqhgdiunovcpeju) was deleted and recreated when its password wasn't captured."

patterns-established: []

requirements-completed: [SCHEMA-05]

duration: ~15min (Task 2, post-checkpoint)
completed: 2026-09-22
---

# Phase 02: Schema Rename & Function/RLS Rewrite — Plan 02 Summary

**Scratch Supabase project (rkirvurggtgjlkeuhded) provisioned via CLI, linked, and live-verified; RUNBOOK.md documents the corrected provisioning path and the phase's sequencing gate**

## Performance

- **Duration:** ~15 min for Task 2 (Task 1's checkpoint interaction spanned the orchestrator's back-and-forth, not agent compute time)
- **Completed:** 2026-09-22
- **Tasks:** 2/2
- **Files modified:** 1 created (`scripts/portfolio-migration/RUNBOOK.md`)

## Accomplishments
- Scratch Supabase project `rkirvurggtgjlkeuhded` (`ziko-migration-scratch`) provisioned in `portfolio`'s org (`vercel_icfg_y5brWcl0o23xn4A50p4NAUFG`), region `eu-west-3`, status `ACTIVE_HEALTHY`
- Linked locally via `supabase link --project-ref rkirvurggtgjlkeuhded`; connectivity confirmed live with `SELECT version()` → `PostgreSQL 17.6`, matching `ziko`/`portfolio`'s build family per `01-INVENTORY.md`
- `scripts/portfolio-migration/RUNBOOK.md` created documenting the corrected provisioning path, this execution's project details, and the Plan 05 → 06 → 07 sequencing gate
- Independently re-verified the project's existence and org membership via `supabase projects list` (not taken solely on the provisioning command's own output)

## Task Commits

1. **Task 1: Provision the scratch Supabase project** — checkpoint reached, then resolved directly by the orchestrator (see Deviations) rather than via the originally-planned Vercel dashboard click-through
2. **Task 2: Link the scratch project locally and document the runbook** — `16a3ac4a` (feat)

## Files Created/Modified
- `scripts/portfolio-migration/RUNBOOK.md` - Documents corrected provisioning mechanism, this execution's scratch project details, the phase's dry-run/real-apply sequencing gate, and teardown notes

## Decisions Made
- **Task 1's provisioning mechanism was corrected from "Vercel dashboard only" to "supabase projects create via CLI"**, contradicting the plan's own `must_haves.truths` D-03 wording ("never via `supabase projects create`"). This reverses a locked-decision mechanics claim, not the underlying decision (new throwaway project, not local Supabase). Rationale: the user directly instructed trying CLI/MCP/browser automation before falling back to manual dashboard steps; CLI creation succeeded and was independently verified via `supabase projects list` before being trusted.
- The password for the final scratch project (`rkirvurggtgjlkeuhded`) was captured explicitly at creation time and used directly for `supabase link --password`. An earlier attempt (ref `agrkkwqhgdiunovcpeju`) generated a password that wasn't captured; rather than risk an unlinkable scratch project, it was deleted (`supabase projects delete agrkkwqhgdiunovcpeju --yes`) and recreated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 — architectural/process change, escalated and resolved] Checkpoint mechanism reversal on D-03**
- **Found during:** Task 1 (scratch project provisioning checkpoint)
- **Issue:** The plan's `checkpoint:human-action` for Task 1 assumed provisioning was unautomatable for this org (per `02-RESEARCH.md` Pitfall 1, sourced from Supabase's own docs). The user directly instructed the orchestrator to try CLI/MCP/browser automation first.
- **Resolution:** This is a genuine reversal of a locked `must_haves.truths` mechanics claim (D-03), which the plan's own executor (this agent, on its first pass) correctly identified as outside auto-fix scope and re-raised as a checkpoint rather than accepting a relayed instruction from an intermediate coordinator message — it explicitly declined to trust an unverifiable relay for a locked-decision reversal plus live credential handling. The orchestrator (with direct user authorization already in hand, and having created the credential file itself) then completed Task 1 and Task 2 directly rather than re-relaying, and documented the corrected finding transparently in `RUNBOOK.md` rather than silently overwriting `02-RESEARCH.md`'s original claim.
- **Files modified:** `scripts/portfolio-migration/RUNBOOK.md` (documents both the original claim and the correction, with dates)
- **Verification:** Scratch project existence and org membership independently confirmed via `supabase projects list` (not just the creation command's own claimed success); live `SELECT version()` query succeeded post-link
- **Committed in:** `16a3ac4a` (Task 2 commit — RUNBOOK.md)

---

**Total deviations:** 1 (process/mechanics correction, escalated appropriately before being resolved)
**Impact on plan:** No scope creep — the underlying D-03 decision (new throwaway project vs. local Supabase) is unchanged. Only the provisioning *mechanism* claim was corrected, with the correction traceable in `RUNBOOK.md` rather than silently overwritten.

## Issues Encountered
- First scratch-project creation attempt (`agrkkwqhgdiunovcpeju`) generated a DB password that wasn't captured by the orchestrator's shell command; rather than proceed with an unlinkable project, it was deleted and recreated with the password explicitly captured. No lasting impact — the discarded project was empty and never linked.

## User Setup Required
None — no external service configuration required beyond what this plan itself completed.

## Next Phase Readiness
- Scratch project `rkirvurggtgjlkeuhded` is linked and live-verified — ready for Plan 05's `[BLOCKING]` apply + verify (SCHEMA-05 dry run)
- `RUNBOOK.md` is the canonical reference for anyone re-running this phase; it documents the sequencing gate Plan 06's human checkpoint enforces before `portfolio` is ever touched
- No blockers for Plan 03/04 (Wave 2), which do not depend on this plan's scratch project directly — only Plan 05 (Wave 3) consumes it

---
*Phase: 02-schema-rename-function-rls-rewrite*
*Completed: 2026-09-22*
