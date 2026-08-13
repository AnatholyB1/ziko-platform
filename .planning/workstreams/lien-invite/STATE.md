---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: Waitlist Fondateurs & Accès Anticipé
current_phase: 1
current_phase_name: Data Foundation
status: executing
stopped_at: "Phase 1 plan 01-01 halted — DB round-trip unverified, blocked on Supabase access"
last_updated: "2026-08-12T17:20:00.000Z"
last_activity: 2026-08-12
last_activity_desc: Plan 01-01 code written and structurally verified; live-DB acceptance criteria could not run in this environment
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 4
  completed_plans: 0
---

# Project State — v1.16 Waitlist Fondateurs & Accès Anticipé

## Project Reference

See: .planning/workstreams/lien-invite/PROJECT.md context inherited from root .planning/PROJECT.md

**Core value:** Capturer les emails des personnes intéressées par l'accès anticipé à Ziko, athlètes
comme coachs, et tenir une promesse « premium à vie » pour les 200 premiers qui soit vraie dans le
contrat comme dans le code.
**Current focus:** Phase 1 — Data Foundation

## Current Position

Phase: 1 of 6 (Data Foundation)
Plan: 01-01 of 4 — executed, **halted** (not complete)
Status: Blocked on live Supabase access — see 01-01-SUMMARY.md "Next Phase Readiness"
Last activity: 2026-08-12 — migration + Server Action + test written; every acceptance
criterion checkable without a database passes (14 static checks, tsc clean, skip-guard
verified — this run caught and fixed a real bug in the skip guard itself); the two
DB-dependent criteria (round-trip test passing, migration re-apply idempotency) did not
run — no Supabase MCP/CLI/connection string was available in this session

Progress: [░░░░░░░░░░] 0% (0/4 plans complete — plan 01-01 executed but not verified complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Full decision log lives in `.planning/PROJECT.md` (root) once merged; workstream-local decisions
so far, from research and roadmap creation:

- Postgres `SEQUENCE` + `nextval()` for founder rank, not `COUNT(*)`/row-lock — atomic under any
  concurrency, matches the class of race the credit system already paid down once (Phase 1)

- `waitlist_signups` — RLS enabled, zero policies; only door in is two `SECURITY DEFINER` RPCs,
  same idiom as `deduct_ai_credits`/`is_coach_of()` (Phase 1)

- `user_profiles.is_lifetime_premium` provenance flag added now, even though subscriptions don't
  exist yet — protects founders from a future subscription-lapse downgrade (Phase 1/4)

- Delete the `tier==='premium'` bypass outright rather than tier-branching the gate; fund premium
  generosity via a monthly `grant_premium_credits()` RPC reusing the already-reserved
  `premium_grant` transaction type (Phase 4)

- Legal phase (3) has no dependency and starts immediately — longest lead time (external counsel);
  Phase 4 depends on Phase 3 so LEGAL-05's ordering constraint is enforced structurally

- Phase 6 (Go-Live) claims no net-new requirements — it verifies the production-activation state of
  CRED-01/CRED-05, LEGAL-05, PURGE-01–05, and FOND-06 together

### Pending Todos

None yet.

### Blockers/Concerns

- **No live Supabase access in this execution environment (new, 2026-08-12)**: plan 01-01's
  migration and Server Action are written and pass every check that doesn't require a database,
  but the tracer's actual round-trip proof and the migration's idempotent-reapply check have not
  run. Supabase MCP was declined, the `supabase` CLI is not installed, and no connection string is
  reachable. Plan 01-01 is `status: halted`, not `complete` — plans 01-02/01-03/01-04 depend on it
  and should not be treated as building on a proven foundation until a session with real DB access
  runs the two remaining checks (see 01-01-SUMMARY.md § Next Phase Readiness) and flips the status.

- **CRED-01 (A-01) unverified**: assumption that zero real production users hold `tier='premium'`
  must be confirmed by a live count before Phase 4 starts any code change — if false, work stops
  and the grandfather decision escalates to the user (see ROADMAP.md Phase 4, criterion 1)

- **Phase 3 needs outside counsel**, not more research — the "à vie" CGV clause (Pitfall 7/8) is
  the single highest-severity legal item in the milestone and gates Phase 4 per LEGAL-05

- **Phase 5 is a UI phase** (`ui_phase`/`ui_safety_gate` both on) — a UI-SPEC design contract is
  expected before implementation begins

## Deferred Items

Items acknowledged and carried forward from requirements definition:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | ENG-01–05 (confirmation email, double opt-in, referral, queue rank, wave admin) | Deferred to v2 | Requirements (2026-08-12) |

## Session Continuity

Last session: 2026-08-12T16:24:44.279Z
Stopped at: Phase 1 context gathered
6 phases (Data Foundation, Test-Account Purge, Legal, Credit-Gate Alignment, Waitlist Page & Entry
Points, Founder Offer Go-Live). Ready to begin Phase 1 discussion/planning.
Resume file: .planning/workstreams/lien-invite/phases/01-data-foundation/01-CONTEXT.md
