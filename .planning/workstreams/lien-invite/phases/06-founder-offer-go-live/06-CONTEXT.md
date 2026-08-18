# Phase 6: Founder Offer Go-Live - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 is the milestone's single convergence/activation phase. It claims no requirement not
already owned by Phases 1–5 — instead it verifies and executes the production-activation state of
CRED-01, CRED-05, LEGAL-05, PURGE-01–05, and FOND-06 together, safely, in the correct order.

**In scope:**
- Merging the milestone's work to `main` and confirming the automatic CI migration-apply step
  (`.github/workflows/ci.yml` / Vercel integration) actually lands Phase 3's and Phase 4's
  migrations on the production Supabase project — confirmed missing as of this discussion (see
  `<specifics>`).
- Confirming the Vercel deploy picks up Phase 4's credit-gate code change (the live API currently
  still runs the old unconditional premium bypass, since nothing has deployed yet).
- Re-running Phase 2's dry-run purge check live against production immediately before launch, to
  turn "PURGE-05 was rehearsed" into "PURGE-05 is confirmed true right now" — see D-02.
- A go-live RUNBOOK: ordered steps, exact SQL/commands, and a blocking human-execution checkpoint,
  mirroring Phase 2's D-03 rehearse-then-human-fires pattern (D-01).
- A live end-to-end smoke test of `claim_waitlist_signup()` against production, followed by a
  `TRUNCATE waitlist_signups` + `reset_waitlist_founder_sequence(1)` step in the same RUNBOOK before
  the page goes public (D-03).
- Confirming `waitlist_reveal_threshold` is 30 at launch (already seeded correctly — no action
  needed, D-04).
- Flipping `premium_credit_cap_enabled` to `true` only after confirming the CGU/CGV pages are live
  in production (LEGAL-05/CRED-05 ordering).
- Confirming all Phase 5 entry points route real traffic and conversions record from first visit.

**Out of scope:** any new requirement not already in REQUIREMENTS.md; any UI/backend/schema change
beyond what Phases 1–5 already built; the founder-to-`tier='premium'` redemption flow (deferred
per `04-CONTEXT.md` D-04); the pre-existing unrelated `anon`-executable security hole on
`is_coach_of()` / `redeem_invitation_code()` / `peek_invitation()` flagged in STATE.md — explicitly
noted there as "not something to fold into the waitlist phase."

</domain>

<decisions>
## Implementation Decisions

### Go-live execution model

- **D-01:** Phase 6 follows the same rehearse-then-human-fires pattern as Phase 2 (D-03) and every
  other credentialed step in this milestone. Claude builds a go-live RUNBOOK with exact ordered
  steps/commands and rehearses what it can (dry-run checks, read-only queries), but the destructive
  or irreversible steps — the real migration deploy, the real purge dry-run against production, the
  `TRUNCATE`, the feature-flag flip — end on a blocking human checkpoint where a person with real
  production access runs them (or the results are pasted back for verification). No Claude session
  in this milestone has held real production credentials; planning around that reality rather than
  assuming it changes.
  — **Reversibility:** reversible — a process/ceremony choice, not a technical commitment.

### Deploy scope

- **D-02:** Merging to `main` and confirming the migration deploy is **in scope** for Phase 6, not
  assumed to happen separately. Verified during this discussion: production (`slkobhavpwsubnsmuhya`)
  has only Phase 1's `waitlist_founder_offer` migration applied (via several manual "reapply_check"
  variants from Phase 1's own testing) — Phase 3's `20260815_waitlist_retention_config` and Phase
  4's `20260816_premium_credit_flag` / `20260816_premium_credit_grant` have never been applied here.
  `app_config` currently holds only `waitlist_reveal_threshold`; no `premium_credit_cap_enabled`, no
  `waitlist_retention_years`, no `is_lifetime_premium` column, no `grant_premium_credits()` RPC. The
  live Vercel-deployed backend still runs the old unconditional premium bypass. Phase 6's RUNBOOK
  must include explicit, checkable steps for: merge → CI migration apply → Vercel deploy →
  post-deploy confirmation (query `app_config`, confirm the new columns/RPCs exist) — before any
  activation checklist item is meaningful.
  — **Reversibility:** costly — a botched or partial migration apply against a live database is
  expensive to unwind; the RUNBOOK should confirm each migration applied cleanly before proceeding
  to the next step.

### Account-purge precondition (PURGE-01–05)

- **D-03 (purge):** Verified during this discussion: `SELECT count(*) FROM auth.users WHERE email
  LIKE '%@ziko-app.com'` returns **0** on production right now — Phase 2's real deletion may have
  nothing to do. Rather than assuming this from the live count and treating PURGE-05 as satisfied
  by inference, the RUNBOOK re-runs Phase 2's dry-run export (`scripts/purge-test-accounts/`) live
  against production immediately before launch, one more time, and records the result. If it still
  finds 0, that's a real, freshly-verified confirmation of PURGE-05, not a stale one. If it finds
  test accounts that appeared since Phase 2's rehearsal, the full reviewed delete procedure
  (`RUNBOOK.md`, two-person rule) runs before launch.
  — **Reversibility:** reversible — a verification-timing choice, not a technical commitment.

### Waitlist QA-row cleanup mechanism

- **D-04 (smoke test + cleanup):** Verified during this discussion: `waitlist_signups` is at 0 rows
  on production right now. Phase 6's RUNBOOK still needs to prove `claim_waitlist_signup()` actually
  works end-to-end against the live (post-migration-deploy) production RPC before opening the page —
  this smoke test creates at least one real row. Cleanup is a plain SQL pair added to the RUNBOOK,
  run by the same human immediately after the smoke test and before the page goes public:
  `TRUNCATE waitlist_signups; SELECT reset_waitlist_founder_sequence(1);` — no new RPC or script.
  This matches `reset_waitlist_founder_sequence(p_next_value)`'s own migration comment
  (`20260812_waitlist_founder_offer.sql:244-250`), which names Phase 6 as its consumer but only
  resets the sequence; row deletion needed a separate answer, resolved here.
  — **Reversibility:** one-way for the TRUNCATE step itself — it must run before any real visitor
  signup, never after; the RUNBOOK must state this ordering explicitly as a warning, not just a step.

### Reveal-threshold value at launch (FOND-06)

- **D-05:** `waitlist_reveal_threshold` stays at **30** (counter appears once 170/200 spots are
  claimed) — confirmed correct as already seeded by Phase 1's migration. No config change needed.
  A-02's "reasoned inference, not sourced" caveat stands, but the user chose not to revise it at
  this point.

### Activation ordering (already established by Phases 3/4, reconfirmed here)

- **D-06:** The feature flag (`premium_credit_cap_enabled`) flips to `true` only after confirming
  (not assuming) the CGU/CGV pages are live in production — this is LEGAL-05/CRED-05's ordering
  constraint, verified as an explicit RUNBOOK step (e.g., an HTTP check against the live `/cgv` and
  `/cgu` routes) rather than inferred from Phase 3 being marked complete in ROADMAP.md.

### Claude's Discretion

- Exact RUNBOOK file location/naming (likely `scripts/founder-offer-go-live/RUNBOOK.md`, mirroring
  `scripts/purge-test-accounts/RUNBOOK.md`'s structure).
- Exact wording/format of the post-deploy confirmation queries (D-02) and the entry-point/conversion
  verification steps (ROADMAP criterion 4) — content is decided above, execution detail is the
  planner's job.
- Whether the migration-apply confirmation is a manual SQL query the human runs, or a small script —
  no strong preference expressed; follow the lightest-weight option consistent with D-01's "human
  fires the real thing" model.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone specs
- `.planning/workstreams/lien-invite/REQUIREMENTS.md` — Phase 6 owns no requirement directly; it
  verifies CRED-01, CRED-05, LEGAL-05, PURGE-01–05, FOND-06 (all "Complete" per their owning
  phases, but see D-02/D-03 — "complete" there means rehearsed/built, not yet live in production).
- `.planning/workstreams/lien-invite/ROADMAP.md` Phase 6 section — goal, "Depends on" (Phases 2, 3,
  4, 5 all complete), and the 4 success criteria this phase's RUNBOOK must satisfy for real.
- `.planning/workstreams/lien-invite/STATE.md` "Blockers/Concerns" — records the real production
  purge as still outstanding as of 2026-08-18 (confirmed this discussion: 0 test accounts found live,
  but D-03 re-verifies rather than assumes), and the unrelated `anon`-executable RPC security hole
  explicitly excluded from this phase's scope.

### Prior-phase decisions this phase builds on
- `.planning/workstreams/lien-invite/phases/01-data-foundation/01-CONTEXT.md` — D-06 (counter RPC
  shape), D-08 (`app_config` reused by Phase 4's flag), D-09 (monotonic-floor counter cache).
- `.planning/workstreams/lien-invite/phases/02-test-account-purge/02-CONTEXT.md` D-03 and
  `02-04-SUMMARY.md` — the rehearse-then-human-fires pattern D-01 above mirrors exactly; confirms
  the real deletion was explicitly deferred outside Phase 2, and that `scripts/purge-test-accounts/`
  (lib.mjs, dry-run.mjs, export.mjs, pitr.mjs, delete.mjs, verify-purge.mjs, RUNBOOK.md) is the
  existing toolkit D-03 (this file) re-runs live.
- `.planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-CONTEXT.md` — D-01 (counsel-approval
  checkpoint, already cleared), the CGV/CGU routes D-06 (this file) verifies are actually live.
- `.planning/workstreams/lien-invite/phases/04-credit-gate-alignment/04-CONTEXT.md` — D-01 (CRED-01's
  production count, resolved 0 as of 2026-08-15 — should be re-verified if meaningful time has
  passed, per that file's own note), D-02 (300 credits/month allowance), D-03 (bypass deletion
  strategy — the code this phase's deploy step must confirm is actually live).
- `.planning/workstreams/lien-invite/phases/05-waitlist-page-entry-points/05-CONTEXT.md` — the full
  set of entry points (homepage, `/coachs`, header, footer) and the analytics mechanism
  (`@vercel/analytics` + UTM columns) this phase's criterion 4 verifies are recording real traffic.

### Codebase — exact mechanisms this phase's RUNBOOK operates
- `supabase/migrations/20260812_waitlist_founder_offer.sql:244-269` — `reset_waitlist_founder_sequence(p_next_value)`,
  the RPC whose own comment names Phase 6 as its consumer; resets the sequence only, does not
  delete rows (D-04 supplies the missing `TRUNCATE` step).
- `supabase/migrations/20260816_premium_credit_flag.sql` — the `premium_credit_cap_enabled` flag
  migration, confirmed NOT YET applied to production as of this discussion (D-02).
- `supabase/migrations/20260815_waitlist_retention_config.sql`,
  `supabase/migrations/20260816_premium_credit_grant.sql` — also confirmed not yet applied (D-02).
- `scripts/purge-test-accounts/RUNBOOK.md` — the exact ordered dry-run → review → export →
  PITR-check → confirmed-delete → post-verify procedure D-03 re-runs live.
- `.github/workflows/ci.yml`, `.github/workflows/test-rls.yml` — the CI path that should apply
  migrations on push to `main`; D-02's RUNBOOK step confirms this actually ran, rather than assuming
  it from a green CI badge alone.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/purge-test-accounts/*.mjs` (Phase 2) — the entire purge toolkit, reused live by D-03
  rather than rebuilt.
- `reset_waitlist_founder_sequence()` (Phase 1) — reused by D-04, paired with a new `TRUNCATE`.
- `apps/web/src/lib/supabase/admin.ts` `createAdminClient()` — the service-role client the smoke
  test (D-04) and any verification queries call through.

### Established Patterns
- Every previous phase's most sensitive step ended on a blocking human checkpoint
  (`gate=blocking, autonomous:false`) rather than an automated pass/fail — Phase 6's RUNBOOK
  checkpoint follows the identical shape.
- `app_config` deny-all-RLS + `SECURITY DEFINER` RPC read pattern — the flag-flip and threshold
  checks this phase runs use the same read path `creditGate.ts` already uses for `user_profiles.tier`.

### Integration Points
- CI (`.github/workflows/ci.yml`) — migration auto-apply on push to `main` touching
  `supabase/migrations/**`; D-02's deploy-scope decision routes through this existing pipeline
  rather than a manual `apply_migration` call, so the same path production will rely on going
  forward is the one actually exercised at go-live.
- Vercel — API + web deploy via GitHub integration; D-02's confirmation step checks the deployed
  API actually reflects Phase 4's code, not just that the migration landed.

</code_context>

<specifics>
## Specific Ideas

- Live production state as of this discussion (2026-08-18, verified via Supabase MCP against
  `slkobhavpwsubnsmuhya`): `waitlist_signups` = 0 rows; `auth.users` matching `%@ziko-app.com`
  = 0; `app_config` contains only `waitlist_reveal_threshold = 30`. This is the starting point the
  planner should treat as current fact, not re-derive.
- The RUNBOOK should read like Phase 2's — usable by a human with no memory of this discussion,
  organized around exact commands, not prose.

</specifics>

<deferred>
## Deferred Ideas

- Rollback/kill-switch procedure (flip the flag back to `false`, or take `/fondateurs` down) if a
  problem is found post-launch — not raised as a blocking gray area this discussion; the planner
  may include a short rollback note in the RUNBOOK at its own discretion, but it wasn't asked for
  explicitly and shouldn't expand phase scope beyond the 4 ROADMAP success criteria.
- The pre-existing `anon`-executable RPC security hole (`is_coach_of()`, `redeem_invitation_code()`,
  `peek_invitation()`) — explicitly out of scope per STATE.md's own note; a future, separate
  security-response phase.
- The founder-to-`tier='premium'` redemption flow — deferred per `04-CONTEXT.md` D-04, unaffected
  by this phase.

</deferred>

---

*Phase: 6-Founder Offer Go-Live*
*Context gathered: 2026-08-18*
