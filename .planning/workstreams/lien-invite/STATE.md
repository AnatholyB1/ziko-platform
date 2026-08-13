---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: Waitlist Fondateurs & Accès Anticipé
current_phase: 1
current_phase_name: Data Foundation
status: executing
stopped_at: Phase 2 context gathered
last_updated: "2026-08-13T22:16:02.029Z"
last_activity: 2026-08-13
last_activity_desc: Phase 1 accepted at plan 01-04 Task 3's blocking checkpoint. DATA-01..07 all Complete in REQUIREMENTS.md.
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 9
  completed_plans: 4
---

# Project State — v1.16 Waitlist Fondateurs & Accès Anticipé

## Project Reference

See: .planning/workstreams/lien-invite/PROJECT.md context inherited from root .planning/PROJECT.md

**Core value:** Capturer les emails des personnes intéressées par l'accès anticipé à Ziko, athlètes
comme coachs, et tenir une promesse « premium à vie » pour les 200 premiers qui soit vraie dans le
contrat comme dans le code.
**Current focus:** Phase 1 complete — Phase 2 (Test-Account Purge) and Phase 3 (Legal) have no
dependency on Phase 1 and can start immediately per ROADMAP.md

## Current Position

Phase: 1 of 6 (Data Foundation) — **COMPLETE**, approved 2026-08-13
Plan: 4 of 4 complete (01-01, 01-02, 01-03, 01-04)
Status: All database objects (waitlist_signups, app_config, waitlist_founder_seq, 5
SECURITY DEFINER RPCs) applied to the live ziko test project (slkobhavpwsubnsmuhya)
and proven correct via direct SQL — round-trip, dedupe, normalization, RLS deny-all
(anon + authenticated), all-five-RPCs-closed-to-anon, threshold arbitration, erasure
monotonicity, sequence reset, the 200-cap concurrency race, and founder-status
non-disclosure. Three real bugs found and fixed along the way. CI wired
(.github/workflows/test-rls.yml) to apply the migration and run both waitlist
suites on future PRs.
**Known, accepted gap:** the literal `npm run test:rls` / `npx vitest run` commands
and an actual green CI run never executed in this session (no SUPABASE_SERVICE_ROLE_KEY,
no path to open/observe a real PR). The user explicitly approved Phase 1 at the
01-04 Task 3 checkpoint with this gap acknowledged — see 01-04-SUMMARY.md.
Last activity: 2026-08-13 — Phase 1 accepted. DATA-01..07 marked Complete in
REQUIREMENTS.md. ROADMAP.md Phase 1 checkbox marked done.

Progress: [██░░░░░░░░] 17% (1/6 phases complete, Phase 1 — 4/4 plans)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 — Data Foundation | 4/4 | ~3h 20min | ~50min |

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

- **Phase 1 database layer proven, real CI run still outstanding.** All four plans' SQL/RPC/RLS
  behavior is confirmed via direct SQL against `ziko` (`slkobhavpwsubnsmuhya`), including 3 real
  bugs found and fixed. The literal `npm run test:rls` / `npx vitest run` commands and an actual
  green GitHub Actions run never happened (no `SUPABASE_SERVICE_ROLE_KEY`, no way to open/observe
  a real PR from this session). Recommend running the full suite for real, with a real service-role
  key, at the earliest opportunity — see 01-04-SUMMARY.md § "Next Phase Readiness." Also confirm
  `SUPABASE_TEST_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` secrets are actually configured in the
  repository before relying on the new CI migration-apply steps in `test-rls.yml`.

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

Last session: 2026-08-13T21:03:01.849Z
Stopped at: Phase 2 context gathered
6 phases total (Data Foundation ✓, Test-Account Purge, Legal, Credit-Gate Alignment, Waitlist Page
& Entry Points, Founder Offer Go-Live). Phase 2 and Phase 3 have no dependency on Phase 1 and are
both unblocked — either can start next via `/gsd-discuss-phase 2` or `/gsd-discuss-phase 3`.
Resume file: .planning/workstreams/lien-invite/phases/02-test-account-purge/02-CONTEXT.md
