---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: Waitlist Fondateurs & Accès Anticipé
current_phase: 1
current_phase_name: Data Foundation
status: executing
stopped_at: "Phase 1 plan 01-01 — DB layer proven live; a critical pre-existing security bug found and flagged; Server Action's own vitest run still needs SUPABASE_SERVICE_ROLE_KEY"
last_updated: "2026-08-12T18:05:00.000Z"
last_activity: 2026-08-12
last_activity_desc: Migration applied to the live ziko test project and verified via direct SQL; fixed a critical anon-execute bug; same bug confirmed live in production on is_coach_of/redeem_invitation_code/peek_invitation
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
Plan: 01-01 of 4 — executed, database layer **proven live**, `status: halted` only because
the Server Action's own vitest run hasn't executed (needs SUPABASE_SERVICE_ROLE_KEY)
Status: Migration applied + verified against ziko test project (slkobhavpwsubnsmuhya).
Round-trip, dedupe, normalization, RLS deny-all, and grants all confirmed live via
mcp__Supabase__execute_sql. See 01-01-SUMMARY.md "Next Phase Readiness" for the one
remaining step.
Last activity: 2026-08-12 — **found and fixed a critical security bug**: REVOKE EXECUTE
FROM PUBLIC does not block anon/authenticated on this project (ALTER DEFAULT PRIVILEGES
grants them EXECUTE directly at function-creation time). Fixed for the two new waitlist
RPCs. The SAME bug is confirmed live in PRODUCTION today on is_coach_of(),
redeem_invitation_code(), and peek_invitation() — see Blockers/Concerns below.

Progress: [░░░░░░░░░░] 0% (0/4 plans complete — plan 01-01's DB layer proven, TS Server Action's own test run still pending)

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

- **URGENT, pre-existing, outside this phase's scope (found 2026-08-12): `is_coach_of()`,
  `redeem_invitation_code()`, and `peek_invitation()` are anon-executable in PRODUCTION today.**
  Confirmed live via `has_function_privilege('anon', <fn>, 'EXECUTE') = true` on all three, despite
  each carrying its own `REVOKE EXECUTE ... FROM PUBLIC`. Root cause: this Supabase project has
  `ALTER DEFAULT PRIVILEGES` on schema `public` granting EXECUTE to `anon`/`authenticated` directly
  at `CREATE FUNCTION` time — a grant separate from `PUBLIC` that a `PUBLIC`-only revoke never
  removes. This affects the exact functions this codebase's own research treated as "the proven
  SECURITY DEFINER idiom." Practical exposure: `is_coach_of(coach_uuid, client_uuid)` takes two
  UUIDs directly, so anyone with the public anon key could enumerate coach-client relationships by
  brute-forcing UUID pairs, no authentication required. `redeem_invitation_code`/`peek_invitation`
  at least require guessing a live 6-char code. **Fixing this needs a NEW migration** (never edit
  the existing ones) that explicitly `REVOKE EXECUTE ... FROM anon, authenticated` on all three —
  this is a deliberate security response, not something to fold into the waitlist phase.

- **Plan 01-01's database layer is now proven** (was previously the blocker here): the migration
  applied cleanly to the live `ziko` test project (`slkobhavpwsubnsmuhya`), the same anon-execute
  bug above was found and fixed for the two NEW waitlist functions, and round-trip/dedupe/
  normalization/RLS/grants were all confirmed via direct SQL. What remains: the Server Action's own
  `npx vitest run` command needs `SUPABASE_SERVICE_ROLE_KEY`, not obtainable via the MCP tools
  available in this session (only publishable/anon keys are exposed). See 01-01-SUMMARY.md §
  "Next Phase Readiness."

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
