# Project Research Summary

**Project:** Ziko Platform — workstream `lien-invite`, milestone v1.16 "Waitlist Fondateurs & Accès Anticipé"
**Domain:** Public early-access waitlist / lead capture, with a capped lifetime-premium founder offer, on a live French B2C+B2B fitness platform
**Researched:** 2026-08-12
**Confidence:** MEDIUM-HIGH

> **Provenance note.** This summary was written by the orchestrator, not by the synthesizer agent.
> The `gsd-research-synthesizer` run completed its analysis but was blocked from writing this file
> by a tool-level restriction, and did not return the full document inline. The reconciliations,
> risks and open questions below are taken from what that agent and the four researchers actually
> reported. **The four detailed documents in this directory are the authoritative source** — they
> carry the citations, code line references and full reasoning. Consult them before planning any phase.

## Executive Summary

Ziko is adding a single public page that captures emails for gated early access, serving both
audiences (athletes and coaches) from one route, and promoting a founder offer: the first 200
members receive lifetime premium. The research converged on a strong conclusion — **almost nothing
new needs to be added to the stack**. Supabase, Upstash rate limiting, Resend and Zod are already
wired and paid for, the marketing route group and its server/client component convention already
exist, and the credit schema already reserves the exact transaction type this feature needs. The
work is integration and policy, not new infrastructure.

The single largest finding is not about the waitlist page at all. `backend/api/src/middleware/creditGate.ts`
(lines 53-63) currently bypasses the credit gate entirely for `tier === 'premium'`, so premium today
means **unlimited AI**. The milestone intends to publish CGU/CGV stating the opposite. That makes this
a policy change with legal exposure, not a copy change: real production users may already hold that
entitlement, and removing it silently is a consumer-law risk, not merely a UX regression.

The main risks are therefore legal and sequencing risks rather than technical ones. The "à vie"
wording in the CGV must not read as an unlimited unilateral-modification right; the CGU/CGV must go
live *before or with* the credit-gate change, never after; the public counter must be a real,
unfudged, non-decreasing figure; and the test-account purge is a one-way cascading delete that needs
a dry run and human review before it touches production. None of these are blockers — they are
constraints that must shape the phase order.

## Key Findings

### Recommended Stack

The recommendation is deliberately minimal and matches what `apps/web` already does. Forms in this
codebase are hand-rolled with Server Actions; the research explicitly rejected adding a form library.
Every proposed package was checked against npm registry `peerDependencies` for React 19 / Next.js 15
App Router compatibility rather than from memory.

**Core technologies:**
- **Native `useActionState` + Server Action + Zod `safeParse`** — email capture; matches the existing pattern in `DeleteAccountForm.tsx`, `LoginForm.tsx` and the coach wizard. `react-hook-form` rejected as inconsistent and friction-prone with `useActionState`.
- **Zod v4 `z.email()` + `mailchecker`** — syntax validation plus disposable-domain rejection. No MX/SMTP verification: disproportionate latency and cost for lead capture.
- **Honeypot + existing `@upstash/ratelimit` + `botid`** — layered bot protection. Visible CAPTCHA (Turnstile) held in reserve only, because it costs conversion.
- **`@vercel/analytics`** — conversion measurement. Confirmed genuinely absent from the codebase. Note: `PROJECT.md` claims Plausible is in use; nothing is actually wired. That doc claim is wrong and should be corrected separately.

**Explicitly rejected:** third-party waitlist SaaS (Waitlist.email, LaunchList, GetWaitlist), Typeform
and Mailchimp embeds — Supabase, Resend and Upstash already cover this and keep the data first-party.

### Expected Features

Nine named, cited benchmarks were studied (Superhuman, Robinhood, Arc, Linear, Clubhouse, Perplexity
Comet, Dia, WHOOP, and fitness "founding member" studios). The dominant pattern is unambiguous.

**Must have (table stakes):**
- **A single-field capture form — email only.** Every credible benchmark qualifies users *after* signup, never by adding form fields.
- **Athlete/coach segmentation as progressive disclosure** — two large role cards, then the email field appears. Segments without breaking the one-field feel.
- **A dedicated route, `/fondateurs`** — consistent with the site's French URL convention (`/coachs`, `/mentions-legales`), and a separate page rather than a replacement of the home hero, matching every benchmark.
- **Truthful, explicit offer copy** and a designed "200/200 complet" end state.
- **RGPD-compliant capture** — unchecked, separable consent checkbox; Article 13 notice at the point of collection, not merely linked in the footer; a defined retention ceiling.

**Should have (competitive):**
- Entry-point CTAs mapped to specific files: `HeaderClient.tsx`, `Hero.tsx`/`HeroClient.tsx`, `CoachsHeroClient.tsx`, `CoachsCtaFooterClient.tsx`, `FooterClient.tsx`.
- OG/Twitter card metadata for link sharing, copying the `generateMetadata` pattern already used by `/coachs`.
- Off-code entry points: app store listings, social profiles, QR codes.

**Defer (v2+):**
- Referral mechanics and queue position (deliberately out of scope; `053_referral_schema.sql` exists if revisited).
- Automatic confirmation email (`@ziko/email` + Resend are ready when wanted).

**Anti-features — do not build:** fake or ascending-at-launch counters, countdown timers, forced
social sharing to advance in the queue, exit-intent popups, extra upfront fields, and a split
per-role route.

### Architecture Approach

The design keeps all atomicity in Postgres and exposes nothing directly to anonymous clients. It
reuses idioms already proven in this codebase rather than introducing new ones.

**Major components:**
1. **`waitlist_signups` table with RLS enabled and zero policies** — deny-all for every role. Mirrors nothing being directly reachable; all access is mediated.
2. **Two `SECURITY DEFINER` RPCs** — `claim_waitlist_signup` and `get_waitlist_founder_count`. This is the house idiom already used by `deduct_ai_credits`, `earn_ai_credits` and `is_coach_of()`. Anon-INSERT policies and service-role bypass were both considered and rejected.
3. **A Postgres `SEQUENCE` + `nextval()` for founder rank** — not `COUNT(*)`, not `SELECT ... FOR UPDATE`. Atomic and lock-free, and provably caps at exactly 200 under any concurrency because `nextval()` cannot issue the same value twice.
4. **Counter delivery** — a Route Handler wrapping the count RPC as the isolation boundary, keeping the marketing page static, with synchronous `revalidatePath`/`revalidateTag` fired from the signup action for immediate correctness.
5. **Credit-gate change** — delete the `tier === 'premium'` bypass outright rather than adding tier-branching, and fund premium generosity through a new monthly `grant_premium_credits()` RPC.
6. **`user_profiles.is_lifetime_premium BOOLEAN`** — a provenance flag so a future paid-subscription lapse can never strip a founder's perk. `tier` remains the single value all existing call sites read, so those need no changes.

**Notable finding:** `ai_credit_transactions.type` has accepted `'premium_grant'` in its CHECK
constraint since migration 026 (line 36) but no code has ever used it. The schema anticipated exactly
this feature, which makes the monthly-grant design both the lowest-risk and the most idiomatic path.

### Critical Pitfalls

1. **"Premium à vie" CGV wording risks being an abusive clause** — if the right to modify or cap the offer is drafted too broadly it falls under the Code de la consommation Art. R.212-1 black list. Highest-severity item. **Requires counsel before the page ships.**
2. **Existing `tier='premium'` users would be silently downgraded** when the bypass is removed. Requires a production audit (`SELECT COUNT(*) FROM user_profiles WHERE tier='premium'`) and an explicit grandfather-or-notify decision *before* `creditGate.ts` is touched.
3. **Legal text must not lag the code.** CGU/CGV describing the AI-credit cap must be live before or with the credit-gate change. A feature flag is recommended to decouple deploy from activation.
4. **The counter is regulated.** DGCCRF has made artificial-scarcity counters a 2025-2028 enforcement priority. Any displayed count must be a real, live, unfudged query that never decreases.
5. **The test-account purge is a one-way cascading delete** rooted at `auth.users`, with `ON DELETE CASCADE` confirmed across 31 migration files. Use the `admin.auth.admin.deleteUser()` pattern already proven in `account.ts:84-85` — never raw bulk SQL — gated by a written allowlist, a dry-run export, a backup/PITR checkpoint and two-person review.
6. **The public endpoint needs anti-enumeration treatment** equivalent to the constant-time `INVALID_OR_EXPIRED` envelope this codebase already built for invitation codes. A scarce reward is a far stronger abuse magnet than a newsletter, which also argues for double opt-in.

## Implications for Roadmap

Suggested phase structure, following the build order the architecture research proposed.

### Phase A: Data foundation
**Rationale:** Everything else depends on the table, the sequence and the RPCs; the concurrency guarantee must exist before any UI can claim a spot.
**Delivers:** `waitlist_signups` migration, RLS deny-all, `SEQUENCE`, `claim_waitlist_signup` and `get_waitlist_founder_count` RPCs, `user_profiles.is_lifetime_premium`.
**Avoids:** the 200-spot race condition; anonymous read access to captured emails.

### Phase B: Test-account purge
**Rationale:** Independent of the page; can run in parallel from the start. Must complete before any counter is shown so the figure is credible.
**Delivers:** identification criteria, dry-run export, reviewed allowlist, backup checkpoint, then deletion via the Admin API.
**Avoids:** cascading destruction of real user data.

### Phase C: Credit-gate alignment
**Rationale:** Gated on the legal text (Phase E) being ready, and on the production audit of existing premium users.
**Delivers:** removal of the `PREM-02` bypass, `grant_premium_credits()` RPC, feature flag, grandfathering decision applied.
**Avoids:** silent downgrade of existing entitlements; marketing/code contradiction.

### Phase D: Waitlist page and entry points
**Rationale:** Can proceed in parallel with C once A lands.
**Delivers:** `/fondateurs` route, role cards + single-field capture, RGPD consent and Article 13 notice, success state, counter component, CTAs in the mapped files, OG metadata.
**Uses:** `useActionState` + Server Action + Zod, honeypot + Upstash + botid, Route Handler counter.

### Phase E: Legal — CGV and CGU
**Rationale:** Parallel from the start, and a gate on Phase C and on go-live. Needs external counsel, so it has the longest lead time.
**Delivers:** new CGV page, revised CGU, both stating premium unlocks all features with capped AI credits.

### Phase F: Go-live
**Rationale:** Gates on all of the above.
**Delivers:** analytics, sitemap/robots, launch checks, counter reveal decision applied.

### Phase Ordering Rationale

- Phase A first because the concurrency guarantee is structural and everything claims against it.
- E starts immediately despite gating late — legal review is the longest pole and cannot be compressed.
- C is gated on E and on the production audit, since shipping it early creates the exposure described in Pitfall 2.
- B runs early and independently so the counter has clean data whenever it is switched on.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase E:** legal drafting is outside what this research can settle — counsel required, not more searching.
- **Phase C:** the numeric monthly premium allowance is a product decision that needs modelling against `ai_cost_log`.

Phases with standard patterns (research can be skipped):
- **Phase D:** the component and Server Action patterns are well established in this codebase.
- **Phase A:** the `SECURITY DEFINER` RPC idiom is already proven in the credit system.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry peerDependencies, not memory |
| Features | MEDIUM | Web-sourced, cross-corroborated across 3+ independent sources per claim; no MCP research providers were available |
| Architecture | HIGH | Every claim grounded in files read in this worktree; no invented APIs or guessed line numbers |
| Pitfalls | MEDIUM-HIGH | HIGH for RGPD/CNIL and French consumer-law citations; MEDIUM for lifetime-deal financial post-mortems |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Is the 200-spot cap shared across both audiences, or 200 per audience?** Blocks copy and the data model. Must be decided before Phase A.
- **Must existing coach signup routes (`/coach/onboarding`, `/coach/dashboard`) be gated during the waitlist period,** or can they coexist? Affects Phase D and F.
- **Whether to show the counter at launch at all.** The user explicitly asked for a visible count of members already holding lifetime premium; the features and pitfalls research both favour deferring an ascending counter until roughly 10-15% of the cap and then showing spots *remaining*. Both are compatible with the architecture — build the count regardless. **This is an open product decision, deliberately not decided here.** The ~10-15% threshold is a reasoned inference, not a sourced number.
- **The numeric monthly premium AI-credit allowance** — mechanism designed, number undecided.
- **Whether real (non-test) users already hold `tier='premium'` in production** — blocks the Pitfall 2 assessment. Read-only count required.
- **For lawyer review:** whether a claimed founder spot survives an erasure request, and whether the abusive-clause framework applies to a free lifetime perk.

## Sources

The detailed citations live in the four research documents in this directory. This summary
deliberately does not restate them, to avoid transcription drift.

### Primary (HIGH confidence)
- `ARCHITECTURE.md` — grounded in files read directly in this worktree, with verified line references (`creditGate.ts:53-63`, migration 026 line 36, `account.ts:84-85`)
- `STACK.md` — npm registry `peerDependencies` checked per package for React 19 / Next.js 15 compatibility

### Secondary (MEDIUM confidence)
- `PITFALLS.md` — CNIL and GDPR material, Code de la consommation Art. R.212-1, DGCCRF enforcement priorities
- `FEATURES.md` — nine named product benchmarks, cross-corroborated across independent sources

### Tertiary (LOW confidence)
- The counter-reveal threshold (~10-15% of cap) — reasoned inference, explicitly not sourced; treat as tunable

---
*Research completed: 2026-08-12*
*Ready for roadmap: yes — subject to the open decisions listed under Gaps to Address*
