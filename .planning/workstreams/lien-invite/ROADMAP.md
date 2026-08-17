# Roadmap: Waitlist Fondateurs & Accès Anticipé

**Workstream:** `lien-invite`
**Milestone:** v1.16

## Overview

Ziko is adding one public page (`/fondateurs`, FR+EN) that captures athlete and coach emails for
early access and promotes a hard-capped offer — the first 200 signups get lifetime premium. The
work is almost entirely integration against existing infrastructure (Supabase RPCs, Upstash,
Resend, the marketing route group), but it carries two hard constraints that shape phase order
more than any technical concern: the credit-gate behavior change cannot ship ahead of the CGU/CGV
text that describes it, and it cannot ship at all until a production audit confirms no real user
is silently downgraded. A one-time test-account purge must also complete before the public counter
can be trusted. Six phases: a data foundation everything else claims against, two independent
tracks (purge, legal) that start immediately in parallel with it, two build tracks (credit-gate,
waitlist UI) that fork off the foundation once it lands, and a final activation phase that gates on
all five.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Data Foundation** - Atomic, RLS-locked waitlist schema, sequence-backed founder cap, and the RPCs everything else calls
- [x] **Phase 2: Test-Account Purge** - Dry-run-reviewed, backed-up removal of dev/QA accounts so the founder counter is credible (completed 2026-08-14)
- [x] **Phase 3: Legal — CGV & CGU** - Bilingual CGV + revised CGU describing the capped premium offer, counsel-reviewed, live ahead of the code change it describes (completed 2026-08-15)
- [x] **Phase 4: Credit-Gate Alignment** - Premium AI access becomes generous-but-finite, gated on a production audit and a feature flag (completed 2026-08-16)
- [ ] **Phase 5: Waitlist Page & Entry Points** - The public `/fondateurs` page, its counter, and every CTA that routes visitors to it
- [ ] **Phase 6: Founder Offer Go-Live** - Safe production activation once data, purge, legal, and credit-gate are all confirmed ready

## Phase Details

### Phase 1: Data Foundation

**Goal**: The waitlist has an atomic, secure, dedupe-safe capture backend that guarantees the
200-founder cap under any concurrency, with zero direct read/write surface for any client.
**Depends on**: Nothing (first phase — parallel track A, alongside Phase 2 and Phase 3)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07
**Success Criteria** (what must be TRUE):

  1. Two simultaneous signups submitted near spot 200 never both receive founder status — at most
     exactly 200 rows ever hold a founder rank, under any concurrency (DATA-02, DATA-03)

  2. A repeat signup with the same email (case-insensitive) is accepted without creating a
     duplicate row or consuming a second founder rank (DATA-04)

  3. Querying `waitlist_signups` directly with the anon or authenticated key returns zero rows —
     no policy grants read or write access to any role (DATA-05)

  4. Every stored signup carries email, audience, timestamp, and founder rank, captured only
     through a `SECURITY DEFINER` RPC matching the `deduct_ai_credits` / `is_coach_of()` idiom
     (DATA-01, DATA-06)

  5. Submitting an already-registered email never discloses that address's founder status — a
     genuinely new signup receives its rank, every other case receives a neutral confirmation
     (DATA-07, revised during phase 1 discussion; see `01-CONTEXT.md` D-04)
**Plans**: 4 plans
Plans:
**Wave 1**

- [ ] 01-01-PLAN.md — Tracer: one signup end to end (migration core, `claimWaitlistSpot`, round-trip proof)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Threshold-arbitrated counter, `app_config`, erasure, sequence reset, blocking schema push

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — Deny-all RLS proof across anon and authenticated, plus normalized-dedupe proof
- [ ] 01-04-PLAN.md — 200-cap concurrency proof, founder-status non-disclosure proof, CI wiring

**Research**: Not needed at plan time — the `SECURITY DEFINER` RPC + deny-all RLS idiom is already
proven in this codebase (`deduct_ai_credits`, `is_coach_of()`); the `SEQUENCE`-based founder-rank
design is fully specified in `research/ARCHITECTURE.md` Section 1.

### Phase 2: Test-Account Purge

**Goal**: Production no longer contains dev/QA test accounts, removed through an audited,
backed-up, two-person-reviewed procedure — so the founder counter that later goes live counts only
genuine signups.
**Depends on**: Nothing (parallel track alongside Phase 1 and Phase 3; must complete before Phase 6)
**Requirements**: PURGE-01, PURGE-02, PURGE-03, PURGE-04, PURGE-05
**Success Criteria** (what must be TRUE):

  1. A written, human-reviewed list of exact test-account IDs/emails exists before any deletion
     runs — no deletion criterion is a bare pattern match used as the executed filter (PURGE-01)

  2. A dry-run export lists precisely the accounts that would be deleted, including any cross-links
     to real (non-candidate) accounts flagged for manual review, with zero rows actually removed
     at that point (PURGE-02)

  3. A restorable backup/PITR checkpoint exists and its timestamp is recorded before the real
     deletion executes (PURGE-03)

  4. Every deletion runs through the same Admin API path already proven in `account.ts`
     (`admin.auth.admin.deleteUser()`), never a raw bulk SQL statement (PURGE-04)

  5. After deletion, re-running the original match query returns zero rows, and no orphaned row
     remains in any linked table (PURGE-05)
**Plans**: 4/4 plans executed
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Tracer: end-to-end dry-run (criterion, Admin API enumeration, cross-link exclusion, review report)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Unconditional pre-delete row export, hashed manifest, live PITR status read

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Guarded Admin API deletion of the reviewed manifest set, plus post-purge reconciliation and orphan scan

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — RUNBOOK with the written criterion, end-to-end rehearsal, blocking human review

> **Scope note (D-03, recorded during phase 2 planning).** This phase builds and rehearses the full
> purge; it deliberately does **not** execute the real deletion against production. Criteria 3 and 5
> above complete during that separate, explicitly human-triggered run, which happens outside phase 2
> once production credentials are in hand and the dry-run row set has been reviewed.

**Research**: Not needed at plan time — the Admin API deletion path is already proven in
`apps/web/src/actions/account.ts:84-85`; `research/ARCHITECTURE.md` Section 6 and
`research/PITFALLS.md` Pitfall 13 give the full reviewed procedure.

### Phase 3: Legal — CGV & CGU

**Goal**: A published, bilingual legal framework accurately and safely describes the founder offer
and the AI-credit cap, reviewed by outside counsel before anything it describes is active in code.
**Depends on**: Nothing (parallel track alongside Phase 1 and Phase 2 — longest lead time in the
milestone; must complete before Phase 4 starts, per LEGAL-05)
**Requirements**: LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05, LEGAL-06, LEGAL-07, LEGAL-08, LEGAL-09
**Success Criteria** (what must be TRUE):

  1. A public CGV page exists in French and English, stating that premium unlocks all features but
     AI credits remain capped (LEGAL-01, LEGAL-02)

  2. The CGV precisely scopes the "à vie" language to the service's operating lifetime, with no
     unconditional or unilaterally-revisable modification clause, and the CGU is revised to state
     the identical AI-credit cap with no contradiction between the two documents — both reviewed
     by counsel before publish (LEGAL-03, LEGAL-04)

  3. This legal text is live in production before or exactly when the credit-gate change activates
     — never after (LEGAL-05); this phase's completion is a hard precondition of Phase 4

  4. The waitlist form shows an unchecked, standalone consent checkbox, separate from the submit
     action, plus a point-of-collection RGPD notice (purpose, controller, retention) rather than
     only a footer link (LEGAL-06, LEGAL-07)

  5. A documented retention period governs stored addresses, and a registrant can request and
     receive erasure of their entry (LEGAL-08, LEGAL-09)
**Plans**: 4/4 plans executed
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Tracer: bilingual CGV route end to end (footer link → locale-branched clause module → rendered page), then the full ten-section contract

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — CGU states the identical AI-credit cap by shared import, privacy-policy retention + erasure section, consent/notice copy frozen for Phase 5
- [x] 03-03-PLAN.md — Additive `app_config` retention migration, human-triggered erasure script + runbook over Phase 1's RPC, counsel-briefing package

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-04-PLAN.md — Blocking counsel-approval gate (D-01), approval record, revisions applied, draft-pending banner cleared

**Research**: Needs deeper work at plan time, but it is legal drafting requiring outside counsel,
not further searching — `research/PITFALLS.md` Pitfalls 1, 2, 3, 4, 6, 7, 8, 10 lay out every
open question already flagged for lawyer review (the "à vie" black-list-clause risk is the single
highest-severity item in the whole milestone).

### Phase 4: Credit-Gate Alignment

**Goal**: Premium access to AI is generous but finite, activated only after confirming no real
production user is silently downgraded, and decoupled from deploy via a feature flag.
**Depends on**: Phase 1 (needs the shared `app_config` table introduced in phase 1 — CRED-05's
feature flag lives there rather than in a second configuration mechanism), Phase 3 (legal text must
already be live per LEGAL-05)
> **Drift corrected 2026-08-12 during phase 1 planning.** This line previously also claimed phase 1
> delivers `grant_premium_credits()` and `user_profiles.is_lifetime_premium`. It does not:
> `phases/01-data-foundation/01-CONTEXT.md`'s domain boundary scopes phase 1 to `app_config` only,
> and neither symbol is in any phase-1 plan. Phase 4 must plan both itself.
**Requirements**: CRED-01, CRED-02, CRED-03, CRED-04, CRED-05, CRED-06
**Success Criteria** (what must be TRUE):

  1. Before any code change, a production count of `tier='premium'` users confirms the "no real
     user affected" assumption (A-01) — if the count is nonzero, work stops here and the
     grandfather question is escalated to the user rather than shipped silently (CRED-01)

  2. A premium user's AI requests are checked against a real, finite monthly balance instead of
     bypassing the credit gate unconditionally (CRED-02, CRED-03)

  3. A founder who later subscribes to and cancels a paid plan keeps their lifetime premium access,
     because it is tracked independently of any subscription tier flip (CRED-04)

  4. The new capped behavior stays off by default and only takes effect once a feature flag is
     explicitly flipped, decoupled from when the code deploys (CRED-05)

  5. Every existing caller reading `tier` (e.g. `branding/page.tsx`'s `isPro` check) continues to
     behave exactly as before — no regression (CRED-06)
**Plans**: 1/2 plans executed

Plans:

- [x] 04-01-PLAN.md — CRED-01 production re-audit, the `app_config` cap flag and `is_lifetime_premium` migration, and the flag-driven `creditCheck` (wave 1)
- [x] 04-02-PLAN.md — `grant_premium_credits()` RPC, the 300-credit allowance constant, its service wrapper, and the monthly Vercel cron route (wave 2)

**Research**: Resolved. The monthly allowance is locked at 300 credits/month by 04-CONTEXT.md D-02
(≈10x a fully-engaged free user's chat volume); `04-RESEARCH.md` re-verified every call site against
current code. Two plan-time corrections were made to that research and are recorded in the plans:
the flag-off branch must keep its `tier` condition (a flag-only pass-through would give every *free*
user unlimited AI), and the grant RPC must mirror `028_fix_earn_rpc_and_quota_tracking.sql` rather
than `026_ai_credits.sql` (partial-index `ON CONFLICT` predicate, ledger claim before funding).

### Phase 5: Waitlist Page & Entry Points

**Goal**: A visitor from either audience can discover the founder offer, submit only an email after
choosing their profile, and see a truthful, on-brand bilingual page — reachable from every intended
entry point on the site.
**Depends on**: Phase 1 (RPCs must exist)
**Requirements**: WAIT-01, WAIT-02, WAIT-03, WAIT-04, WAIT-05, WAIT-06, WAIT-07, WAIT-08, FOND-01, FOND-02, FOND-03, FOND-04, FOND-05, FOND-06, ENTRY-01, ENTRY-02, ENTRY-03, ENTRY-04, ENTRY-05, ENTRY-06
**Success Criteria** (what must be TRUE):

  1. A visitor reaches a dedicated, bilingual founders page matching the existing light sport theme
     and Tailwind v4 tokens, statically rendered except for the counter (WAIT-01, WAIT-07, WAIT-08)

  2. The visitor picks athlete or coach before an email field appears, then submits only that one
     email; a malformed or disposable-domain address is rejected with a clear message (WAIT-02,
     WAIT-03, WAIT-04)

  3. After submitting, the visitor always sees the same inline success state — whether their email
     was new or already registered, and whether or not a founder spot was assigned — with no way
     to detect a prior registration from the response (WAIT-05, WAIT-06)

  4. The page states "first 200 = lifetime premium" as fact with no visible counter below the
     reveal threshold, then shows a real, never-inflated, never-increasing "spots remaining" count
     above it, and a distinct "complete" state once all 200 are claimed — with the reveal threshold
     itself adjustable without a redeploy (FOND-01, FOND-02, FOND-03, FOND-04, FOND-05, FOND-06)

  5. A visitor reaches the page from the homepage, `/coachs`, the header, and the footer; a shared
     link renders a correct social preview; the page is indexable and present in the sitemap; and
     its signups are measurable as conversions (ENTRY-01, ENTRY-02, ENTRY-03, ENTRY-04, ENTRY-05,
     ENTRY-06)
**Plans**: 5/6 plans executed
Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Tracer: `/fondateurs` end to end (bilingual copy surface, SSG route, role picker → email → real Server Action → localized confirmation, social preview + metadata)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Package legitimacy gate, then honeypot/bot/rate-limit/syntax/disposable-domain guards, consent recording, and UTM attribution on the submission path
- [x] 05-03-PLAN.md — Counter Route Handler over the service-role RPC, and the three-state counter widget mounted on the founders hero

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-04-PLAN.md — Homepage founders section (D-05) and both `/coachs` CTAs redirected with coach pre-selected (D-01)
- [x] 05-05-PLAN.md — Header and footer nav links (D-04), sitemap entry, and the cookieless conversion event

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 05-06-PLAN.md — Full-phase gate run on the merged tree, validation record completed, blocking UI/entry-point human verification

**Research**: Not needed at plan time — `useActionState` + Server Action + Zod, the honeypot +
Upstash + botid layering, and the Route Handler counter pattern are all well-established in this
codebase; see `research/SUMMARY.md` Research Flags and `research/ARCHITECTURE.md` Sections 2–3.
`05-RESEARCH.md` corrects one stale assumption carried by the milestone-level research: both waitlist
RPCs shipped `service_role`-only, so the counter route and the claim action both use the admin client.
**UI hint**: yes — a UI-SPEC design contract is expected before implementation, per this project's
`ui_phase`/`ui_safety_gate` configuration and prior UI-phase precedent (v1.8 Sport Dashboards,
`custom-widget` Phases 03–04).

### Phase 6: Founder Offer Go-Live

**Goal**: The founder offer is safely and legally activated in production only once every upstream
gate — data integrity, clean data, live legal text, and the credit-gate audit — is confirmed
satisfied. This is a convergence/activation phase; it claims no requirement not already owned by
Phases 1–5, and instead verifies their production-activation state together.
**Depends on**: Phase 2, Phase 3, Phase 4, Phase 5 (all must be complete)
**Requirements**: None net-new — verifies the activation conditions of CRED-01, CRED-05, LEGAL-05,
PURGE-01–05, and FOND-06 (all already mapped to their owning phases above)
**Success Criteria** (what must be TRUE):

  1. The public founder counter reflects only genuine post-launch signups — any QA/test signups
     made while building Phase 5 have been cleared (waitlist table truncated + sequence reset, per
     `research/ARCHITECTURE.md` Section 1) before the page opens to the public

  2. The credit-gate feature flag is flipped only after the CGU/CGV pages describing the AI-credit
     cap are already live — confirming CRED-05 and LEGAL-05 together, never flag-before-text

  3. The founder's chosen reveal-threshold state (static offer vs. decreasing count) at the moment
     of launch matches what was actually intended — confirming FOND-06 was applied, not just built

  4. All mapped entry points route real traffic to the now-public page, and its conversions begin
     recording from the first live visit
**Plans**: TBD
**Research**: Not needed — pure activation/launch checklist, no new technical surface.

## Progress

**Execution Order:**
Phase 1 first. Phases 2 and 3 run in parallel with Phase 1 from the start (no dependency on it).
Phases 4 and 5 fork off Phase 1 once it lands and can run in parallel with each other; Phase 4 also
waits on Phase 3. Phase 6 is the single convergence point, gating on Phases 2, 3, 4, and 5 all
being complete.

| Phase | Plans Complete | Status | Completed |
|-------|-----------------|--------|-----------|
| 1. Data Foundation | 0/4 | Planned | - |
| 2. Test-Account Purge | 4/4 | Complete    | 2026-08-14 |
| 3. Legal — CGV & CGU | 4/4 | Complete    | 2026-08-15 |
| 4. Credit-Gate Alignment | 2/2 | Complete    | 2026-08-16 |
| 5. Waitlist Page & Entry Points | 5/6 | In Progress|  |
| 6. Founder Offer Go-Live | 0/TBD | Not started | - |
