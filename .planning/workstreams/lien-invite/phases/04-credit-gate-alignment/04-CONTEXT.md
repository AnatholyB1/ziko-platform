# Phase 4: Credit-Gate Alignment - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 deletes the unconditional `tier === 'premium'` bypass in `creditGate.ts` and lets premium
users flow through the same quota/balance system as free users, funded by a monthly credit grant
(`grant_premium_credits()` RPC + Vercel cron), behind an `app_config` feature flag that defaults off.
It also adds `user_profiles.is_lifetime_premium` as a provenance flag so a future subscription-lapse
downgrade can never silently strip a founder's benefit.

**In scope:** the CRED-01 production audit (now resolved — see D-01), deleting the bypass, the grant
RPC + cron, the feature flag, the `is_lifetime_premium` column, and confirming CRED-06 (no regression
at `branding/page.tsx`'s `isPro` check).

**Out of scope:** the mechanism that actually converts a founder's waitlist win into a real
`user_profiles.tier='premium'` row (D-03 — no such flow exists anywhere in this milestone's roadmap;
deferred, matching the ENG-01–05 precedent); flipping the feature flag in production (Phase 6); the
waitlist UI (Phase 5); anything in `apps/mobile` or `plugins/**` (research confirmed zero references
to `tier==='premium'`/`creditPassThrough` outside `backend/api/src/middleware/creditGate.ts` and the
unrelated `branding/page.tsx` `isPro` check).

</domain>

<decisions>
## Implementation Decisions

### CRED-01 — the blocking production audit

- **D-01: RESOLVED, not deferred.** Ran `SELECT count(*) FROM public.user_profiles WHERE tier =
  'premium'` directly against the `ziko` Supabase project (`slkobhavpwsubnsmuhya`) during this
  discussion, per the user's explicit confirmation that this project is production (superseding
  STATE.md's earlier "test project" label, which was correct for Phase 1's RLS/RPC proof work but not
  for this check). **Result: 0.** A-01 ("no real user affected") is confirmed true, not merely
  assumed. No grandfathering decision is needed, and the bypass can be deleted outright rather than
  tier-branched. This resolution should be cited directly in the phase's plan/verification — CRED-01
  does not need its own runtime check re-run at execution time; the count is a point-in-time
  production fact recorded here.
  — **Note for the planner:** if meaningful time passes between this discussion and execution, a
  cheap re-verification (`SELECT count(*) ...` again) is worth a single planning-time task before
  deleting the bypass, since new premium users could theoretically appear between now and execution
  (e.g., via a manual admin action) — but the finding itself does not need to be re-litigated.

### Credit allowance

- **D-02:** The monthly premium AI-credit allowance is **300 credits/month**, added as a new named
  constant in `backend/api/src/config/credits.ts` (matching the existing `CREDIT_COSTS`/
  `DAILY_QUOTAS`/`MONTHLY_QUOTAS` single-source-of-truth convention). Chosen as roughly 10x a
  fully-engaged free user's chat volume (~90/month) — generous enough to read as a genuine premium
  benefit, finite enough to cap worst-case cost exposure. Easy to raise later since it's one constant.
  — **Reversibility:** reversible — a config value, not a schema commitment.

### Bypass removal strategy

- **D-03:** Follow `research/ARCHITECTURE.md` §4's recommended redesign exactly: **delete** the
  `tier === 'premium'` bypass branch in `creditGate.ts` (lines ~53-63 per research, verify against
  current file), rather than adding a parallel tier-branching path. Premium users fall through to the
  existing `getQuotaStatus`/`deductCredits` logic unmodified — funded by a larger balance via the
  monthly grant, not a request-time special case. `credits.ts` and `creditService.ts` need no
  tier-awareness changes; they're already tier-agnostic by construction.

### Founder → premium conversion (scope boundary)

- **D-04:** The mechanism that actually sets a real founder's `user_profiles.tier = 'premium'` (and
  `is_lifetime_premium = true`) once they claim/redeem their spot is **out of scope for this
  milestone** — nothing in Phases 1–6 builds a "redeem your founder spot" flow; it's deferred like
  ENG-01–05. Phase 4 builds the grant mechanism and the provenance flag so they're ready whenever that
  future flow ships, but does not build the flow itself. This does not block Phase 4 or Phase 6 — the
  credit-gate change and its activation are independent of how any given user arrives at
  `tier='premium'`.
  — **Reversibility:** reversible — a scope decision, not a technical commitment; a future milestone
  can add the redemption flow without touching anything Phase 4 ships.

### Claude's Discretion

- Exact migration filename/numbering for `grant_premium_credits()` and `is_lifetime_premium` (dated
  form, per house convention).
- `app_config` key name for CRED-05's feature flag (e.g. `premium_credit_cap_enabled`), default value
  `false`, read via the same direct service-role `SELECT` pattern `creditGate.ts` already uses for
  `user_profiles.tier` — no new RPC needed per research (backend already runs as `service_role`).
- Cron schedule/route naming for the monthly grant job (research suggests `0 0 1 * *`, an 8th
  `vercel.json` entry alongside the existing 7, matching the existing job-naming style).
- Idempotency key format for the grant ledger row (research suggests
  `'premium_grant_' || to_char(now(), 'YYYY-MM')` reusing the existing partial unique index).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone specs
- `.planning/workstreams/lien-invite/REQUIREMENTS.md` — CRED-01→06 are this phase's requirements;
  CRED-01 is now resolved per D-01 above, not merely "pending."
- `.planning/workstreams/lien-invite/ROADMAP.md` — Phase 4 goal and success criteria; note the
  "Depends on" line already records Phase 1 (`app_config`) and Phase 3 (legal text live, now
  satisfied — Phase 3 is complete).
- `.planning/workstreams/lien-invite/research/ARCHITECTURE.md` §4 "The Credit-Gate Change —
  Exhaustive Impact List" — the full verified grep of every `tier`/`premium`/`creditPassThrough` call
  site, the recommended redesign, and the exact new-code checklist (grant RPC, cron, migration). §5
  "Lifetime Premium vs the Existing `tier` Column" — the `is_lifetime_premium` provenance-flag design
  and its rationale (protects against a future subscription-lapse downgrade silently stripping
  founders, given v1.12 DA Coach's planned €29/mo Pro tier will also set `tier='premium'`).
- `.planning/workstreams/lien-invite/research/SUMMARY.md` "Research Flags" — flagged the monthly
  allowance as a product decision needing `ai_cost_log` modeling; resolved by D-02 above.
- `.planning/workstreams/lien-invite/phases/01-data-foundation/01-CONTEXT.md` D-08 — the `app_config`
  table this phase's feature flag reuses (deny-all RLS, service_role-only, no generic RPC).
- `.planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-CONTEXT.md` D-03/D-04 — the CGV's
  AI-credit-cap parity language this phase's behavior must actually match in production.

### Codebase idioms this phase must follow
- `backend/api/src/middleware/creditGate.ts` — the exact bypass to delete (lines ~53-63 per research;
  re-verify current line numbers at plan time).
- `supabase/migrations/026_ai_credits.sql:36,47-49` — the `premium_grant` transaction type (already in
  the CHECK constraint, zero prior usages) and the partial unique index for idempotency.
- `backend/api/src/services/creditService.ts:87-146` — the existing `deductCredits`/`earnCredits`
  wrapper shape `grantMonthlyPremiumCredits` should match.
- `backend/api/vercel.json:6-35` — the 7 existing cron job entries; this phase adds an 8th.
- `backend/api/src/config/credits.ts` — single-source-of-truth constant convention for the new
  monthly-allowance value (D-02).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `user_ai_credits` + `ai_credit_transactions` ledger system — already tier-agnostic, needs no
  changes beyond the new grant RPC writing to it.
- `app_config` table (Phase 1) — ready to hold CRED-05's flag with zero new migration machinery
  beyond an `INSERT ... ON CONFLICT DO NOTHING` row.
- Existing cron pattern in `backend/api/vercel.json` — new monthly job follows the same shape.

### Established Patterns
- Single-source-of-truth config constants in `backend/api/src/config/credits.ts`.
- `SECURITY DEFINER` + `REVOKE ... FROM PUBLIC` + `GRANT ... TO service_role` idiom for the new RPC.
- Service-role direct table reads (not RPCs) for backend-internal checks like `creditGate.ts`'s
  existing `user_profiles.tier` read — the feature-flag read follows the same pattern.

### Integration Points
- `branding/page.tsx`'s `isPro` check reads `tier` independently of the credit path — confirmed
  unaffected by research, but CRED-06 still wants an explicit no-regression check at plan/verify time.
- Phase 6 reads this phase's feature flag state as part of its go-live convergence checklist.

</code_context>

<specifics>
## Specific Ideas

- The CRED-01 production count (0) is a real, verified fact as of this discussion (2026-08-15), not
  an assumption carried forward — cite it directly rather than re-deriving it.

</specifics>

<deferred>
## Deferred Ideas

- The founder-to-`tier='premium'` redemption flow (D-04) — out of scope for this milestone, future
  work.
- Flipping the feature flag in production — Phase 6's job.

</deferred>

---

*Phase: 4-Credit-Gate Alignment*
*Context gathered: 2026-08-15*
