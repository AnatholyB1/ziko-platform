---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: Waitlist Fondateurs & Accès Anticipé
current_phase: 04
current_phase_name: Credit-Gate Alignment
status: executing
stopped_at: Phase 5 context gathered
last_updated: "2026-08-16T20:19:34.741Z"
last_activity: 2026-08-16
last_activity_desc: Phase 04 execution started
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 14
  completed_plans: 14
---

# Project State — v1.16 Waitlist Fondateurs & Accès Anticipé

## Project Reference

See: .planning/workstreams/lien-invite/PROJECT.md context inherited from root .planning/PROJECT.md

**Core value:** Capturer les emails des personnes intéressées par l'accès anticipé à Ziko, athlètes
comme coachs, et tenir une promesse « premium à vie » pour les 200 premiers qui soit vraie dans le
contrat comme dans le code.
**Current focus:** Phase 04 — Credit-Gate Alignment
dependency on Phase 1 and can start immediately per ROADMAP.md

## Current Position

Phase: 04 (Credit-Gate Alignment) — EXECUTING
Plan: 1 of 2
Status: Executing Phase 04
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
Last activity: 2026-08-16 — Phase 04 execution started
REQUIREMENTS.md. ROADMAP.md Phase 1 checkbox marked done.

Progress: [██████████] 100% (1/6 phases complete, Phase 1 — 4/4 plans)

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 — Data Foundation | 4/4 | ~3h 20min | ~50min |
| 2 | 4 | - | - |

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02-test-account-purge P01 | ~10min | 2 tasks | 4 files |
| Phase 02-test-account-purge P02 | ~25min | 2 tasks | 3 files |
| Phase 02-test-account-purge P03 | ~20min | 2 tasks | 3 files |
| Phase 03-legal-cgv-cgu P02 | ~30min | 3 tasks | 5 files |
| Phase 03-legal-cgv-cgu P03 | ~35min | 3 tasks | 7 files |
| Phase 03-legal-cgv-cgu P04 | ~25min | 2 tasks | 6 files |
| Phase 04-credit-gate-alignment P02 | ~35min | 3 tasks | 9 files |

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

- [Phase ?]: Task-level TDD RED/GREEN commits for cross-link surface completion (02-01 Task 2): committed 6 failing tests before extending fetchCrossLinks/writeReport
- [Phase ?]: 02-02: last_sign_in_at CSV column always empty — no source in 02-01's DryRunReport.to_delete shape (id/email/created_at only); read defensively via candidate.last_sign_in_at ?? '' so a future report augmentation auto-populates it
- [Phase ?]: 02-02: writeExport always overwrites manifest.export_csv with the exact path it wrote the CSV to, making the manifest-points-at-a-real-file guarantee unconditional
- [Phase ?]: [Phase 2] 02-03: runDelete receives no client and no enumeration function, only manifest.candidate_ids and an injected deleteAccount fake — re-deriving a candidate set at delete time is structurally impossible (D-02, T-02-21)
- [Phase ?]: [Phase 2] 02-03: fetchOrphanRows scans all 8 (table,column) pairs from the plan's own interfaces table, not 7 as the action prose miscounted — completeness matters more for an orphan scan than matching a wrong prose count
- [Phase ?]: [Phase 2] 02-03: checkAccountConservation is the only post-purge check able to detect a real account destroyed by an over-broad criterion — asserts surviving count never falls below scanned minus manifest size (Pitfall 13 step 7)
- [Phase ?]: [Phase 3] 03-02: CGU imports AI_CREDIT_CAP_SENTENCE from founder-offer.ts rather than restating it — LEGAL-04 drift made structurally impossible, not merely tested-for
- [Phase ?]: [Phase 3] 03-02: COLLECTION_POINT_NOTICE built via template-literal interpolation of WAITLIST_RETENTION_YEARS — the point-of-collection retention figure can never independently drift from RETENTION_STATEMENT's
- [Phase ?]: [Phase 3] 03-02: no draft-pending-review banner on the privacy-policy waitlist section — it restates an existing retention period + statutory GDPR right, not new contractual terms; banner stays reserved for CGV/CGU
- [Phase ?]: [Phase 3] 03-03: erasure script carries none of Phase 2's purge ceremony (no dry-run export, hashed manifest, two-person rule) — anonymize_waitlist_signup is a single-row, non-destructive, non-cascading RPC, disproportionate for that rigor
- [Phase ?]: [Phase 3] 03-03: erase.mjs never normalizes/lowercases the email client-side — normalize_waitlist_email() already runs inside the RPC, avoiding silent divergence if the SQL definition changes
- [Phase ?]: [Phase 3] 03-03: backend/api test:rls could not be executed this session — sandbox denies read/write on backend/api/.env* paths, so setup.ts's unconditional required-env-var check (ahead of the RUN_DB guard) could not be satisfied even with a placeholder
- [Phase ?]: [Phase 3] 03-04: Task 2's counsel-approval gate (D-01) resolved to approved-as-drafted by the real user outside this session — recorded verbatim in 03-COUNSEL-APPROVAL.md, not re-derived; approving lawyer's name withheld at their own request, Q6 notice period resolved to 90 days
- [Phase ?]: [Phase 3] 03-04: draft-pending-review banner removed from /cgv and /cgu together with its guarding test assertion, in one commit (T-03-19) — Phase 3 complete, 4/4 plans, LEGAL-01 through LEGAL-09 all Complete, Phase 4 unblocked per LEGAL-05
- [Phase ?]: [Phase 4] 04-02: mirrored 028's ledger-first/GET DIAGNOSTICS/early-return ordering for grant_premium_credits(), not 026's naive increment-then-insert or the RESEARCH.md/PATTERNS.md skeletons that omit the partial-index WHERE predicate on ON CONFLICT
- [Phase ?]: [Phase 4] 04-02: the monthly grant cron runs unconditionally regardless of CRED-05's activation flag (D-02/D-03) — funding is separate from enforcement, so Phase 6's flip meets an already-funded premium tier instead of instantly 402-ing everyone

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

Last session: 2026-08-16T20:19:34.565Z
Stopped at: Phase 5 context gathered
6 phases total (Data Foundation ✓, Test-Account Purge, Legal, Credit-Gate Alignment, Waitlist Page
& Entry Points, Founder Offer Go-Live). Phase 2 and Phase 3 have no dependency on Phase 1 and are
both unblocked — either can start next via `/gsd-discuss-phase 2` or `/gsd-discuss-phase 3`.
Resume file: /home/user/ziko-platform/.planning/workstreams/lien-invite/phases/05-waitlist-page-entry-points/05-CONTEXT.md
