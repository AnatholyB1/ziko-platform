# Phase 5: Waitlist Page & Entry Points - Research

**Researched:** 2026-08-16
**Domain:** Public Next.js marketing page + Server Action + Route Handler, wired to Phase 1's shipped Supabase RPCs, with dual entry-point routing changes
**Confidence:** HIGH — every architectural claim below is grounded in files read directly in this worktree this session (migration SQL, the shipped Server Action, the shipped consent-copy module, and every component this phase touches). Feature/stack recommendations from the milestone-level research are carried forward and re-verified against current `apps/web/package.json` and the npm registry.

## Summary

This phase is almost entirely **integration and UI work**, not new architecture — the milestone-level
research (`research/ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md`, `SUMMARY.md`, `FEATURES.md`) already
settled the stack, the data model, and the abuse-mitigation layering, and none of that has changed.
What *has* changed since that research was written on 2026-08-12 is that Phases 1, 3, and 4 have since
shipped real code, and in one important respect the shipped code diverges from what
`research/ARCHITECTURE.md` §2 assumed: **the two RPCs this page calls are `service_role`-only**, not
anon-executable. `apps/web/src/actions/waitlist.ts` (`claimWaitlistSpot`) already exists, already calls
`claim_waitlist_signup` via `createAdminClient()` (service-role), and already implements the D-03/D-04
non-disclosure filter. Phase 5 **extends this existing Server Action** — it does not create a new one —
adding rate limiting, disposable-domain rejection, bot protection, and consent recording, none of which
exist in it yet (its own header comment defers rate limiting explicitly to "phase 5"). The counter's
Route Handler must use the same admin client for the same reason: `get_waitlist_founder_status()` is
`service_role`-only, and its migration comment says so explicitly, correcting the milestone research's
original anon-key assumption. `CONTEXT.md`'s canonical-refs section still cites the old anon-key guidance
— the planner must follow the shipped RPC grants, not that stale citation.

The second genuinely new finding is that `waitlist_signups.consent_given_at` / `consent_version` exist
as columns (Phase 1) and the exact copy to write into them exists as frozen constants
(`apps/web/src/content/legal/founder-offer.ts`, Phase 3) — but no code path writes them yet, and
`claim_waitlist_signup()`'s RPC signature has no consent parameters. Since RPC/schema changes are
explicitly out of scope for this phase (per `05-CONTEXT.md`), the Server Action must record consent via
a **follow-up `UPDATE`** through the same admin client (which bypasses RLS by virtue of the service-role
key, no new RPC required), not by extending the RPC call itself.

Everything else — page structure, entry-point files, sitemap/OG conventions, the bot-protection stack —
matches what the milestone research already documented. This RESEARCH.md's job is to hand the planner
the corrected, currently-true version of that guidance plus the exact file/line targets Phase 5 touches.

**Primary recommendation:** Build `/fondateurs` as a new SSG route under `(marketing)/`, isolate the
counter in a Client Component hitting a new admin-client-backed Route Handler, and **extend** (not
replace) `apps/web/src/actions/waitlist.ts` with rate limiting, `mailchecker`, `botid` + a hidden
honeypot field, and a consent-recording `UPDATE` — all using the admin/service-role client throughout,
consistent with how Phase 1 already built the write path.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page rendering (`/fondateurs`, FR+EN, mostly static) | Frontend Server (SSR/SSG) | — | Matches every other marketing page (`coachs`, `cgu`, `cgv`) — `generateStaticParams` + `setRequestLocale`, no server state per request |
| Profile picker + progressive email field | Browser / Client | — | Pure client interaction state (role toggle, field reveal), no server round-trip until submit |
| Email submission (`claim_waitlist_signup`) | API / Backend (Server Action, service-role) | — | Already built (Phase 1) as a Next.js Server Action calling a `SECURITY DEFINER` RPC via the admin client — not a client-side Supabase call, not a Hono backend route |
| Rate limiting, disposable-domain check, bot check | API / Backend (same Server Action) | — | Must run server-side before the RPC call; client-side checks are trivially bypassed |
| Consent recording (`consent_given_at`/`consent_version`) | API / Backend (same Server Action, follow-up `UPDATE`) | Database / Storage | Write happens server-side via admin client; the columns and RLS deny-all posture live in the database |
| Counter read (`get_waitlist_founder_status`) | API / Backend (new Route Handler, service-role) | Database / Storage | RLS denies all direct reads; the RPC is the only door, and it is `service_role`-only — the Route Handler is the isolation boundary that keeps the rest of the page static |
| Entry-point routing (Header/Footer/Hero/`/coachs` CTAs) | Frontend Server (SSR) + Browser | — | Server-rendered nav links and CTA `href`s; no new server logic, just link-target and copy changes in existing client components |
| Sitemap / robots / OG metadata | Frontend Server (SSG, build-time) | — | `generateMetadata` + `sitemap.ts`, both build/request-time functions with no runtime backend involvement |
| Analytics / conversion tracking (ENTRY-06) | Browser / Client (`@vercel/analytics`) | Database / Storage (UTM columns, queryable) | `track()` fires client-side on success; the already-stored `utm_source`/`utm_campaign` columns are a server-side/database-level alternative or complement |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Coexistence with existing coach signup**

- **D-01:** The two existing `/coachs` CTAs (`CoachsHeroClient.tsx`, `CoachsCtaFooterClient.tsx`),
  which currently link to `/${locale}/coach/onboarding`, are **redirected to `/${locale}/fondateurs`**
  with the coach profile preselected. This resolves the open gap flagged in
  `research/SUMMARY.md` ("Must existing coach signup routes be gated during the waitlist period, or can
  they coexist?") — new coach signups now funnel through the waitlist as a single message, no split
  funnel between "sign up now" and "join the waitlist."
  — **Reversibility:** reversible — a link-target change, not a route/schema commitment.

- **D-02:** `/coach/onboarding` itself receives **no code change** — it keeps working for anyone who
  reaches it directly (a bookmarked link, an existing invitation flow, etc.). It is simply no longer
  linked from `/coachs`. This keeps the diff small and avoids touching a route this milestone doesn't
  otherwise need to change.

- **D-03:** The site header's CTA (`HeaderClient.tsx`, links to `/coach/dashboard`) is **unchanged** —
  it's an existing-coach login entry point, not a new-signup funnel, and is out of scope for the
  waitlist redirect.

- **D-04:** ENTRY-03's required header/footer founders link is a **plain nav link** (e.g. "Fondateurs"),
  matching the visual weight of existing footer links (`Mentions légales`, `CGU`, `CGV`, etc.) and the
  header's existing locale-switcher-adjacent text style — not a highlighted/badged pill competing with
  the primary CTA button.

**Entry-point prominence**

- **D-05:** The homepage gets a **dedicated founders section**, not just a nav link — placed
  **immediately after `<Hero />`**, before `<HowItWorks />`. This is the milestone's flagship growth
  push (ENTRY-01); a footer link alone was judged insufficient to move signups for a time-limited offer.
  — **Reversibility:** reversible — a new homepage section, no schema/route impact.

- **D-06:** `/coachs` does **not** get a duplicate dedicated section — the CTA redirect (D-01) is judged
  sufficient there, since the whole page is already coach-focused end to end and both existing CTAs now
  point at `/fondateurs`.

**Athlete vs. coach page content**

- **D-07:** The `/fondateurs` page tells **one shared narrative** for both audiences — "first 200
  founders get lifetime premium" — rather than branching value-prop content blocks per audience (the
  way `/coachs` branches its own message from the homepage). Only the profile picker and the
  post-submission confirmation are audience-aware. Simpler to build, keeps FOND-01's fact-statement
  framing unified, and audience-specific pitches already exist elsewhere (homepage, `/coachs`).
  — **Reversibility:** reversible — a copy/content-structure choice, not an architectural one.

- **D-08:** When a visitor arrives via the `/coachs` redirect (D-01), the page loads with **coach
  pre-picked** — highlighted/selected, email field already visible — but **still changeable** to
  athlete. No separate locked landing view; the picker stays interactive regardless of entry point.

**"Complete" state (FOND-05)**

- **D-09:** Once all 200 founder spots are claimed, the page offers a **general waitlist for updates**
  — the form keeps working, submissions still go through `claim_waitlist_signup()` (now always returning
  `is_founder=false`), copy is honest that lifetime premium is no longer available. This satisfies
  FOND-05's "continues accepting signups without founder status" directly, using the exact mechanism
  Phase 1 already built — no new backend work.

- **D-10:** In the complete state, the counter widget is **replaced by a clear "complete" message**
  (e.g. "Les 200 places fondateurs sont prises") rather than displaying "0 restantes" — reads as a
  distinct state change per FOND-05's wording, not an anticlimactic zero.

### Claude's Discretion

- Exact visual layout of the profile picker, the homepage founders section, and the complete-state
  message — content structure is decided above (D-05 through D-10); visual execution belongs to the
  UI-SPEC phase (`/gsd-ui-phase 5`, expected per ROADMAP.md's "UI hint: yes").
- Exact copy/wording within the D-07 shared-narrative constraint and the D-09/D-10 complete-state
  framing — tone and phrasing, not structure.
- Which analytics mechanism satisfies ENTRY-06 ("conversions measurable") — research
  (`research/STACK.md`) already recommends `@vercel/analytics` + `@vercel/speed-insights`, not currently
  installed in `apps/web`; the UTM columns Phase 1 already stores on every signup row are also directly
  queryable and may be sufficient on their own. Planner decides which (or both) to wire in.
- Bot-protection stack composition (`mailchecker` + `botid` + existing Upstash limiter) — already fully
  specified below, not re-litigated here.

### Deferred Ideas (OUT OF SCOPE)

- **Redirecting or gating `/coach/onboarding` itself** — considered and explicitly rejected (D-02); it
  stays live and functional, just unpromoted.
- **A dedicated founders section on `/coachs`** — considered and explicitly rejected (D-06); the CTA
  redirect is judged sufficient.
- **Branching page content per audience** — considered and explicitly rejected (D-07) in favor of one
  shared narrative; could be revisited post-launch if conversion data suggests audience-specific pitches
  would help, but that's future work, not this phase.
- **Visible CAPTCHA (Turnstile)** — held in reserve per `research/STACK.md`; only added if BotID's
  invisible layer proves insufficient after launch. Not built in this phase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAIT-01 | Dedicated bilingual founders page | SSG pattern verified against `coachs/page.tsx`; new `(marketing)/fondateurs/` route, `next-intl` `[locale]` routing already configured for un-translated route slugs |
| WAIT-02 | Profile chosen before email field appears | FEATURES.md §1 progressive-disclosure pattern (two role cards, then reveal email); D-08 fixes the `/coachs`-redirect pre-pick behavior |
| WAIT-03 | Single-field form (email only) | Confirmed no other field required; `claimWaitlistSpot` already accepts only `email`/`audience`/`locale` |
| WAIT-04 | Reject malformed / disposable-domain email | `z.email()` (Zod v4, workspace-hoisted) for syntax + `mailchecker@6.0.21` for disposable domains — layered in the Server Action before the RPC call |
| WAIT-05 | Inline success state, shows founder status if assigned | `claimWaitlistSpot`'s existing `WaitlistState` return shape (`status`/`isFounder`/`founderRank`/`message`) already carries everything WAIT-05 needs — UI consumes it via `useActionState` |
| WAIT-06 | Duplicate email gets identical success state | Already implemented and proof-tested in `claimWaitlistSpot` (D-03/D-04 filter) and covered by `test/actions/waitlist.concurrency.test.ts` — Phase 5 must not regress this when adding rate-limit/bot/consent logic |
| WAIT-07 | Matches light sport theme / Tailwind v4 tokens | Reuse `text-primary`/`bg-background`/`border-border`/`text-muted` tokens, no new tokens needed |
| WAIT-08 | Page stays static except the counter | Isolate counter in a Client Component hitting a Route Handler with `revalidate`; page itself uses `generateStaticParams` + `setRequestLocale`, same as `coachs/page.tsx` |
| FOND-01 | Offer stated as fact below threshold, no counter | `get_waitlist_founder_status()` already returns `should_display=false` below threshold — page renders the static claim only in that branch |
| FOND-02 | Descending "remaining" count above threshold | `get_waitlist_founder_status().remaining` is pre-computed server-side (`200 - claimed`), never derived client-side |
| FOND-03 | Number is always a real query, never fabricated | Counter Route Handler must call the RPC on every request (short-TTL cache only), never hardcode/offset |
| FOND-04 | Number can never increase visibly | `founder_rank`/`is_founder` are never touched by erasure (`anonymize_waitlist_signup` leaves them alone per its own comment) — monotonicity is a database guarantee already proven, not something Phase 5 must build |
| FOND-05 | Distinct "complete" state, keeps accepting signups | D-09/D-10 — `is_full` field from the same RPC call drives a UI branch; form keeps calling the unchanged `claim_waitlist_signup()` |
| FOND-06 | Reveal threshold configurable without redeploy | Already implemented — `app_config.waitlist_reveal_threshold` (seeded `30`), read inside `get_waitlist_founder_status()`; Phase 5 must never hardcode `30` anywhere in the frontend |
| ENTRY-01 | Reachable from homepage | New founders section between `<Hero />` and `<HowItWorks />` per D-05 |
| ENTRY-02 | Reachable from `/coachs` | Both CTA link targets changed per D-01 |
| ENTRY-03 | Reachable from header + footer | New plain nav link in `FooterClient.tsx`; `HeaderClient.tsx` CTA is explicitly unchanged (D-03) — confirm with planner whether ENTRY-03's "header" half is satisfied by a secondary link, since the primary header CTA stays `/coach/dashboard` |
| ENTRY-04 | Correct OG/Twitter card on share | `generateMetadata` pattern copied from `coachs/page.tsx`, new `og-fondateurs.png` asset |
| ENTRY-05 | Indexable + in sitemap | New entry in `apps/web/src/app/sitemap.ts`'s `pages` array — note this file currently omits `/coachs` and `/cgv` too (pre-existing gap, not this phase's to fix, but confirms nothing auto-discovers routes) |
| ENTRY-06 | Conversions measurable | `@vercel/analytics` `track('waitlist_signup', {...})` and/or the already-stored `utm_source`/`utm_campaign` columns — planner's discretion per CONTEXT.md |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- This phase is `apps/web`-only — none of the mobile (`Alert.alert`, Ionicons, `paddingBottom: 100`) or
  backend (`.js` import extensions) conventions apply. Confirmed: no `backend/api` route is touched by
  this phase (the write path is a Next.js Server Action + Route Handler, not a Hono route).
- `SUPABASE_SERVICE_ROLE_KEY` is explicitly **web-server/tests only** and **forbidden from
  `backend/api/src/**`** — irrelevant as a restriction here since nothing in this phase touches
  `backend/api`, but it does confirm `apps/web`'s existing use of `createAdminClient()` (already the
  house pattern in `account.ts`, and now in `waitlist.ts`) is the correct, sanctioned place for
  service-role usage.
- Design tokens: `#F7F6F3` background / `#FFFFFF` surface / `#E2E0DA` border / `#FF5C1A` primary /
  `#1C1A17` text / `#6B6963` muted — already available as Tailwind v4 semantic classes
  (`bg-background`, `border-border`, `text-primary`, `text-text`, `text-muted`) in
  `apps/web/src/app/globals.css`. No new tokens needed.
- GSD workflow: this phase is a "UI phase" (`ui_phase`/`ui_safety_gate` both `true` in
  `.planning/config.json`) — a UI-SPEC design contract (`/gsd-ui-phase 5`) is expected before
  implementation.
- `nyquist_validation: true` in `.planning/config.json` — a `## Validation Architecture` section is
  required in this file (below) so the planner can build `05-VALIDATION.md`.

## Standard Stack

### Core
No new framework-level dependency — Next.js 15.5.14 App Router (Server Actions + Route Handlers) +
Zod (workspace-hoisted) are sufficient, matching every other form in this codebase
(`DeleteAccountForm.tsx`, `LoginForm.tsx`).

### Supporting
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `mailchecker` | `6.0.21` [VERIFIED: npm registry, `npm view mailchecker version` run this session] | Reject disposable-domain emails (WAIT-04) | Actively maintained (55k+ domain DB), already vetted in `research/STACK.md` against `disposable-email-domains` (4-yr-stale alternative) |
| `botid` | `1.5.11` [VERIFIED: npm registry, `npm view botid version` run this session] | Invisible bot detection on the Server Action / Route Handler | Zero visible friction on a conversion-sensitive page; official first-party Vercel package (maintainer list includes `rauchg` and `vercel-release-bot`, confirmed via `npm view botid maintainers` this session — see Package Legitimacy Audit for why the automated seam still flags it `SUS`) |
| `zod` | `^4.3.6` [VERIFIED: root `package.json:44`, read this session] | `z.email()` syntax validation | Already a hoisted workspace dependency; `z.string().email()` is deprecated in v4 |
| `@vercel/analytics` | `2.0.1` [VERIFIED: npm registry, this session] | ENTRY-06 conversion tracking (if chosen over/alongside UTM columns) | Confirmed genuinely absent from `apps/web` this session (no import anywhere in `apps/web/src`); Next 15 / React 19 peer-compatible |
| `@vercel/speed-insights` | `2.0.0` [VERIFIED: npm registry, this session] | Core Web Vitals on the new page | Optional, same root layout as analytics |

**Not a new dependency — hand-rolled:** a hidden honeypot field (a `name`/`website`-style input, visually
hidden, rejected server-side if filled) referenced in `research/SUMMARY.md`/`ROADMAP.md` as part of the
bot-protection layering. No library covers this — it's a ~5-line server-side check in the same Server
Action, alongside `botid`'s `checkBotId()`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `useActionState` + Server Action + Zod | `react-hook-form` | Rejected — inconsistent with every existing form in this codebase, friction-prone with `useActionState` per `research/STACK.md`'s cited community consensus |
| `mailchecker` | MX/SMTP verification | Rejected — latency/cost disproportionate for lead capture, explicitly out of scope per `REQUIREMENTS.md` "Vérification MX/SMTP des adresses" |
| `botid` (invisible) | `@marsidev/react-turnstile` (visible CAPTCHA) | Held in reserve per D (Deferred Ideas) — only if BotID proves insufficient post-launch |
| ISR/Route Handler polling for the counter | Supabase Realtime | Rejected — over-engineering for a 200-row ceiling, per `research/ARCHITECTURE.md` §3 |

**Installation:**
```bash
# From apps/web/
npm install mailchecker botid
# Only if the planner chooses @vercel/analytics for ENTRY-06:
npm install @vercel/analytics @vercel/speed-insights
```

**Version verification:** All four package versions above were re-confirmed against the npm registry
this session (2026-08-16), matching `research/STACK.md`'s 2026-08-12 figures exactly — no drift in four
days, as expected for a subsequent-milestone research pass.

## Package Legitimacy Audit

| Package | Registry | Age (last publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|--------------|--------------|---------|-------------|
| `mailchecker` | npm | published 2026-07-18 (routine domain-list update; package itself has existed for years) | 337,255 | `git://github.com/FGRibreau/mailchecker.git` | `SUS` (seam reason: "too-new" — a false positive on *release* recency, not package age) | **Kept, checkpoint required** |
| `botid` | npm | published 2026-03-03 | 551,044 | not declared in `package.json` (seam reason: "no-repository") | `SUS` (seam reason: "no-repository") | **Kept, checkpoint required** |
| `@vercel/analytics` | npm | published 2026-03-12 | 4,795,544 | `git+https://github.com/vercel/analytics.git` | `OK` | Approved |
| `@vercel/speed-insights` | npm | published 2026-03-10 | 3,252,632 | `git+https://github.com/vercel/speed-insights.git` | `OK` | Approved |

**Packages removed due to `[SLOP]` verdict:** none.

**Packages flagged as suspicious `[SUS]`:** `mailchecker`, `botid` — the automated seam (`gsd-tools query
package-legitimacy check`) flagged both. Manual verification this session found both signals to be false
positives specific to this seam's heuristics, not evidence of a hallucinated or malicious package:
- `mailchecker` [WARNING: flagged as suspicious — verify before using.] — "too-new" fired on the *latest
  release* timestamp (a routine disposable-domain-list refresh), not the package's creation date; it has
  337K weekly downloads and an active, long-standing GitHub repo (`FGRibreau/mailchecker`). This exact
  package was already the explicit recommendation in `research/STACK.md`, cross-checked there against
  its 4-year-stale alternative `disposable-email-domains`.
- `botid` [WARNING: flagged as suspicious — verify before using.] — "no-repository" fired because
  `package.json` omits a `repository` field, not because the package is illegitimate. `npm view botid
  maintainers` (run this session) lists `rauchg` (Vercel's co-founder/CEO) and `vercel-release-bot`
  among the maintainers, and Vercel's own official docs (`vercel.com/docs/botid`) document this exact
  package as their first-party bot-protection product, confirmed by WebSearch this session.

Per the Package Legitimacy Protocol, both packages are **kept** (their `SUS` verdict is not `SLOP`), but
the planner **must** insert a `checkpoint:human-verify` task before `npm install mailchecker botid` runs,
even though this session's manual diligence supports both as legitimate — the protocol's rule applies
regardless of how strong that manual case is.

*Both packages were discovered via the milestone-level `research/STACK.md` (itself sourced from the npm
registry directly, not WebSearch/training data alone) and are re-verified this session against the
registry — treat their version numbers as `[VERIFIED: npm registry]`, but their overall legitimacy
determination as `SUS`, gated behind the required checkpoint above.*

## Architecture Patterns

### System Architecture Diagram

```
Visitor (browser)
   │
   ├─▶ GET /fr/fondateurs (or /en/fondateurs)
   │     Next.js App Router — SSG shell (generateStaticParams + setRequestLocale)
   │     Renders: hero copy, role picker, form skeleton, static "first 200" claim
   │     (FOND-01 branch) OR delegates counter render to the Client Component below
   │
   ├─▶ Counter Client Component (mounted client-side, isolated from the static shell)
   │     fetch('/api/waitlist/count', { next: { revalidate: 30 } })
   │           │
   │           ▼
   │     Route Handler (apps/web/src/app/api/waitlist/count/route.ts)
   │           │  uses createAdminClient() — service-role, NOT anon
   │           ▼
   │     Supabase RPC get_waitlist_founder_status()   [service_role-only]
   │           │  reads app_config.waitlist_reveal_threshold + COUNT(is_founder)
   │           ▼
   │     { should_display, remaining, is_full }  ◀── FOND-02/03/04/05/06 all
   │                                                   arbitrated INSIDE the DB
   │
   └─▶ User picks role, types email, submits form (useActionState)
         │
         ▼
       claimWaitlistSpot Server Action (apps/web/src/actions/waitlist.ts — EXTEND, not replace)
         │
         ├─ 1. Honeypot check (new, hand-rolled)               ─┐
         ├─ 2. botid checkBotId() (new)                          │ Phase 5 additions,
         ├─ 3. Rate limit — Upstash sliding window (new)         │ all before the RPC
         ├─ 4. Zod z.email() syntax check (new)                  │ call, all server-side
         ├─ 5. mailchecker disposable-domain check (new)        ─┘
         │
         ▼
       admin.rpc('claim_waitlist_signup', {...})  [service_role-only, unchanged from Phase 1]
         │
         ├─▶ new email → INSERT, nextval() assigns rank, is_founder = rank <= 200
         └─▶ duplicate  → SELECT existing row, is_new=false
         │
         ▼
       D-03/D-04 non-disclosure filter (unchanged, already proven)
         │
         ▼
       6. Consent UPDATE (new) — admin.from('waitlist_signups')
                                    .update({ consent_given_at, consent_version })
                                    .eq('email', <normalized identity used by the RPC>)
         │
         ▼
       WaitlistState returned → inline success UI (WAIT-05/06)
```

### Recommended Project Structure
```
apps/web/src/
├── app/[locale]/(marketing)/
│   └── fondateurs/
│       └── page.tsx              # new — SSG shell, generateMetadata, mirrors coachs/page.tsx
├── app/api/waitlist/
│   └── count/route.ts            # new — admin-client Route Handler, revalidate: 30
├── actions/
│   └── waitlist.ts               # EXTEND — rate limit, mailchecker, botid, honeypot, consent UPDATE
├── components/marketing/
│   ├── FoundersOfferSection.tsx  # new — homepage section (D-05), NOT "CoachsFounderSection"-named
│   ├── FoundersOfferSectionClient.tsx
│   ├── WaitlistFounderBanner.tsx # new (or similar) — /fondateurs hero + role picker + form
│   └── WaitlistCounterClient.tsx # new — the one Client Component consuming the Route Handler
├── components/layout/
│   ├── HeaderClient.tsx          # UNCHANGED (D-03) — confirm during planning, don't touch
│   └── FooterClient.tsx          # EXTEND — add one plain nav link (D-04)
├── content/legal/
│   └── founder-offer.ts          # READ ONLY — consume CONSENT_CHECKBOX_LABEL,
│                                  #   COLLECTION_POINT_NOTICE, CONSENT_VERSION; do not re-draft
├── lib/ratelimit.ts              # EXTEND — add `waitlistRatelimit` export, same lazy-singleton pattern
└── app/sitemap.ts                # EXTEND — add /fondateurs entry
```

### Pattern 1: Server Action extension, not replacement
**What:** `apps/web/src/actions/waitlist.ts` already exports `claimWaitlistSpot` and `WaitlistState`,
proven end-to-end (round-trip, 200-cap race, non-disclosure) by
`apps/web/test/actions/waitlist.concurrency.test.ts`. Phase 5 must add rate limiting, disposable-domain
rejection, bot checks, and consent recording **inside this existing function**, preserving its exact
signature (`(prevState, formData) => Promise<WaitlistState>`) so `useActionState` wiring and the existing
concurrency tests keep working unmodified.
**When to use:** Any change to the waitlist submission path.
**Example (current shipped code, to extend):**
```typescript
// Source: apps/web/src/actions/waitlist.ts (read in full this session)
'use server';
import { createAdminClient } from '@/lib/supabase/admin';

export type WaitlistState = {
  status: 'idle' | 'success' | 'error';
  isFounder: boolean;
  founderRank: number | null;
  message: string;
};

export async function claimWaitlistSpot(
  _prevState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const audience = formData.get('audience') as string | null;
  const locale = (formData.get('locale') as string | null) ?? null;

  if (!email || !audience) {
    return { status: 'error', isFounder: false, founderRank: null, message: 'Formulaire invalide.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_waitlist_signup', {
    p_email: email,
    p_audience: audience,
    p_locale: locale,
  });
  // ... D-03/D-04 filter below, unchanged
}
```
The header comment ("rate limiting is phase 5's ... would break the concurrency proof") is a load-bearing
constraint: any new import (e.g. `next/headers` for IP extraction, needed for per-IP rate limiting) must
not break this file's importability from a plain Vitest process — verify the existing
`vi.mock('server-only', ...)` shim in the concurrency test still works after Phase 5's edits, or the
existing test suite silently stops proving what it claims to prove.

### Pattern 2: Consent recording via follow-up UPDATE, not RPC signature change
**What:** `waitlist_signups.consent_given_at`/`consent_version` exist (Phase 1) and
`CONSENT_VERSION = 'waitlist-consent-v1'` is frozen (Phase 3), but `claim_waitlist_signup()`'s signature
has no consent parameters, and RPC/schema changes are out of scope for this phase.
**When to use:** Immediately after the RPC call succeeds, before returning `WaitlistState`.
**Example:**
```typescript
// Pattern only — not yet in the codebase; RPC insert stores email as lower(trim(p_email))
// per supabase/migrations/20260812_waitlist_founder_offer.sql:120-123, read this session.
import { CONSENT_VERSION } from '@/content/legal/founder-offer';

await admin
  .from('waitlist_signups')
  .update({
    consent_given_at: new Date().toISOString(),
    consent_version: CONSENT_VERSION,
  })
  .eq('email', email.toLowerCase().trim());
```
**Open design question for the planner:** should this `UPDATE` run only for genuinely new signups
(`is_new === true`) or on every submission including duplicates? Recording it on every submission is
simpler (no extra branch) and arguably the more defensible evidentiary position (captures the visitor's
most recent expressed consent), but re-writes a row that a genuinely new signup already touched via the
RPC. Flagged in Open Questions below — no existing decision in `05-CONTEXT.md` settles this.

### Pattern 3: Route Handler counter, admin client only
**What:** `get_waitlist_founder_status()` is `GRANT`ed to `service_role` only (confirmed by reading the
migration's `REVOKE`/`GRANT` lines this session) — the anon key cannot call it. This corrects
`research/ARCHITECTURE.md` §3's original assumption (written before Phase 1 shipped) that this would be
anon-callable.
**When to use:** The counter's Route Handler, and nowhere else — never call this RPC from a Client
Component directly.
**Example:**
```typescript
// apps/web/src/app/api/waitlist/count/route.ts — new, follows the existing
// apps/web/src/app/api/credits/balance/route.ts convention for Route Handler shape.
import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 30;

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_waitlist_founder_status');
  if (error || !data?.[0]) {
    return Response.json({ shouldDisplay: false, remaining: null, isFull: false }, { status: 200 });
  }
  const row = data[0] as { should_display: boolean; remaining: number; is_full: boolean };
  return Response.json({ shouldDisplay: row.should_display, remaining: row.remaining, isFull: row.is_full });
}
```

### Pattern 4: Rate limiter extension
**What:** `apps/web/src/lib/ratelimit.ts` already exports `ratelimit`, `rolePromotionRatelimit`,
`kycUploadRatelimit` — all lazy singletons over the same no-op-when-unconfigured pattern.
**When to use:** Add a new named export, do not create a second file or a new pattern.
**Example:**
```typescript
// Pattern to add to apps/web/src/lib/ratelimit.ts, mirroring the existing three exports
// (full file read this session — lines 1-56).
let _waitlistRatelimit: Ratelimit | null = null;

export const waitlistRatelimit = {
  limit: async (identifier: string) => {
    if (!isUpstashConfigured()) return noopLimiter.limit(identifier);
    if (!_waitlistRatelimit) _waitlistRatelimit = makeRatelimit(Ratelimit.slidingWindow(5, '60 s'), 'ziko:waitlist');
    return _waitlistRatelimit.limit(identifier);
  },
};
```

### Anti-Patterns to Avoid
- **Calling `get_waitlist_founder_status()` or `claim_waitlist_signup()` with the anon-key
  `createServerSupabase()` client:** both RPCs are `service_role`-only; an anon-key call fails outright
  (permission denied). Use `createAdminClient()` for both, exactly as the shipped `waitlist.ts` already
  does for the claim path.
- **Adding a consent parameter to `claim_waitlist_signup()`'s signature:** this requires a new migration,
  which `05-CONTEXT.md` places out of scope. Use the follow-up `UPDATE` pattern instead.
- **Hardcoding `30` (the reveal threshold) or `200` (the founder cap) anywhere in `apps/web/src`:** `30`
  is intentionally mutable via `app_config` (FOND-06) — read it only through
  `get_waitlist_founder_status()`'s `should_display`/`remaining` fields, never re-derive it client-side.
  `200` is a locked business constant per the RPC's own comment, safe to reference in copy but never to
  recompute.
- **Replacing `claimWaitlistSpot` with a new Server Action:** breaks the existing, already-proven
  concurrency test suite's import path and re-introduces risk the Phase 1 tests already retired.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Disposable-domain rejection | A custom blocklist | `mailchecker` | 55K+ actively maintained domain list vs. a hand-maintained list that goes stale immediately |
| Bot detection | A custom heuristic (timing, UA sniffing) | `botid` + honeypot | Vercel's own product for exactly this; a hand-rolled heuristic is both weaker and a maintenance burden |
| Founder-rank atomicity | Any new counting logic | Already built — `nextval()` on `waitlist_founder_seq`, proven race-safe by Phase 1's own test suite | Re-deriving this in Phase 5 (e.g. a client-side "spots left" computation) reintroduces the exact TOCTOU race Phase 1 already eliminated |
| Consent evidentiary logging | A new consent-tracking table | The existing `consent_given_at`/`consent_version` columns | Purpose-built for this in Phase 1, just unwritten — no new schema needed |

**Key insight:** every "don't hand-roll" item in this phase already has its solution either installed
(via `research/STACK.md`'s vetted packages) or already shipped in the database (Phase 1's RPCs/columns).
The discipline required is *not adding new mechanisms* where Phase 1/3 already built one.

## Common Pitfalls

### Pitfall 1: Calling the counter/claim RPCs with the wrong Supabase client
**What goes wrong:** Using `createServerSupabase()` (anon key) for either RPC call fails with a Postgres
permission-denied error, because both `claim_waitlist_signup()` and `get_waitlist_founder_status()` are
`REVOKE`d from `anon`/`authenticated` and `GRANT`ed to `service_role` only.
**Why it happens:** `research/ARCHITECTURE.md` §2/§3 (written before Phase 1 shipped) recommended the
anon key; `05-CONTEXT.md`'s canonical_refs section still cites that guidance verbatim. A planner reading
only `CONTEXT.md` without cross-checking the migration would follow stale advice.
**How to avoid:** Always use `createAdminClient()` for both RPC calls, matching what `waitlist.ts`
already does and what the migration's own inline comment instructs for the counter
("phase 5's Route Handler must call this through the admin client, not the anon client").
**Warning signs:** Any new code importing `createServerSupabase` in the waitlist submission or counter
path.

### Pitfall 2: Consent columns silently stay `NULL`
**What goes wrong:** The consent checkbox renders and gates form submission client-side, but nothing
writes `consent_given_at`/`consent_version` to the database, because `claim_waitlist_signup()`'s RPC
signature was never designed to accept them (by design — see Pattern 2). LEGAL-06/07's evidentiary
requirement (GDPR Article 7(1) — "demonstrate consent") is then unmet even though the UI looks correct.
**Why it happens:** The RPC call "looks complete" (it returns success, the founder rank, everything the
UI needs) — the missing consent write has no visible symptom until an actual GDPR audit or DSAR.
**How to avoid:** Add the follow-up `UPDATE` (Pattern 2) as an explicit, tested step; add a Nyquist test
asserting the columns are non-null after a real submission (see Validation Architecture below).
**Warning signs:** No test queries `consent_given_at`/`consent_version` after calling `claimWaitlistSpot`.

### Pitfall 3: `mailchecker`/`botid` breaking the existing concurrency test's importability
**What goes wrong:** `waitlist.concurrency.test.ts` imports `claimWaitlistSpot` directly into a plain
Vitest/Node process via `vi.mock('server-only', () => ({}))`. If `botid`'s `checkBotId()` or any new
import pulls in `next/headers` or another Next.js-runtime-only module without an equivalent mock, the
test file stops being importable outside a real Next.js request context, silently disabling the
200-cap-race and non-disclosure proofs this phase depends on staying green.
**Why it happens:** `botid`'s server-side check typically needs request headers, which in a Server Action
are available via the implicit request context, not an explicit parameter — easy to reach for
`next/headers` directly.
**How to avoid:** Follow the same pattern the file's own header comment already establishes — mock or
inject anything Next.js-runtime-specific rather than importing it unconditionally at module scope.
**Warning signs:** `npx vitest run test/actions/waitlist.concurrency.test.ts` starts failing to import
after adding bot-detection code.

### Pitfall 4: Sitemap silently missing the new route (repeats a pre-existing gap)
**What goes wrong:** `apps/web/src/app/sitemap.ts` currently lists only 4 static pages (home,
mentions-légales, politique-de-confidentialité, cgu) — `/coachs` and `/cgv` are **already missing** from
it. If Phase 5 doesn't add `/fondateurs` explicitly, ENTRY-05 fails silently (no build error, no lint
error — just an absent sitemap entry).
**Why it happens:** The `pages` array is a hand-maintained literal list, not auto-derived from the route
tree; nothing enforces new routes appearing in it.
**How to avoid:** Add `/fondateurs` to the `pages` array explicitly; this phase is not responsible for
fixing the pre-existing `/coachs`/`/cgv` omissions, but should not repeat the same mistake.
**Warning signs:** `curl $SITE_URL/sitemap.xml | grep fondateurs` returns nothing after deploy.

### Pitfall 5: FOND-04 "never increases" monotonicity broken by a naive counter implementation
**What goes wrong:** A tempting shortcut is to compute "remaining" as `200 - COUNT(*)` directly in the
Route Handler (bypassing the RPC) for "simplicity" — this reintroduces exactly the anon-read problem
Section 2/3 of the milestone architecture research already solved, and loses the RPC's threshold
arbitration (FOND-01/06), since the raw count would need to be fetched and compared client-side or in
the Route Handler, exposing the exact-below-threshold count the RPC is designed to withhold.
**How to avoid:** Always call `get_waitlist_founder_status()` as a whole — never `SELECT count(*)` or any
other raw query against `waitlist_signups` from application code.
**Warning signs:** Any `.from('waitlist_signups').select(...)` call outside of test fixtures/cleanup code.

## Runtime State Inventory

*Not applicable — this is a greenfield feature-addition phase (new page, new components, extended
Server Action), not a rename/refactor/migration phase. No runtime state inventory required.*

## Code Examples

### Progressive-disclosure role picker (pattern, not yet in codebase)
```typescript
// Pattern per research/FEATURES.md §1 "Form placement and field count" — client-side toggle state,
// mirrors the existing CoachsHeroClient.tsx / HeroClient.tsx server-wrapper split already used
// throughout apps/web/src/components/marketing/ (files read this session).
'use client';
import { useState } from 'react';

export function WaitlistRoleForm({ preselected }: { preselected?: 'athlete' | 'coach' }) {
  const [role, setRole] = useState<'athlete' | 'coach' | null>(preselected ?? null);
  // ... two role cards; email field renders only once `role` is non-null (WAIT-02)
}
```

### useActionState wiring (established house pattern)
```typescript
// Source: apps/web/src/components/account/DeleteAccountForm.tsx (read in full this session) —
// the exact idiom to mirror for the waitlist form's success/error branching.
'use client';
import { useActionState } from 'react';
import { claimWaitlistSpot, WaitlistState } from '@/actions/waitlist';

const initialState: WaitlistState = { status: 'idle', isFounder: false, founderRank: null, message: '' };

export function WaitlistForm() {
  const [state, formAction, pending] = useActionState(claimWaitlistSpot, initialState);
  if (state.status === 'success') {
    // WAIT-05/06 — identical branch whether isFounder is true or false
    return <div>{state.message}</div>;
  }
  return <form action={formAction}>{/* ... */}</form>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `research/ARCHITECTURE.md`'s anon-key assumption for both RPCs | `service_role`-only grants, admin client required | Phase 1 (shipped 2026-08-16 window) | Every Phase 5 write/read against these RPCs must use `createAdminClient()`, not `createServerSupabase()` |
| No `claimWaitlistSpot` Server Action existed | `apps/web/src/actions/waitlist.ts` fully exists, proven by a concurrency test suite | Phase 1 | Phase 5 extends, does not create |
| Consent copy undrafted | `CONSENT_CHECKBOX_LABEL`/`COLLECTION_POINT_NOTICE`/`CONSENT_VERSION` frozen in `content/legal/founder-offer.ts` | Phase 3 | Phase 5 renders this copy verbatim; does not draft new legal text |
| `waitlist_reveal_threshold` unset | Seeded to `30` in `app_config`, live in production migration | Phase 1 | Threshold is real, not a placeholder — Phase 5's UI must actually call the RPC to know when to reveal, never assume a fixed early-launch value |

**Deprecated/outdated:** `research/ARCHITECTURE.md` §2's specific recommendation to call the write RPC
via the anon-key `createServerSupabase()` client is now superseded by the shipped `service_role`-only
grants — treat that one paragraph of the milestone research as stale; everything else in it remains
accurate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Consent should be recorded via a follow-up `UPDATE` after every submission (new or duplicate), not gated to `is_new === true` only | Architecture Patterns, Pattern 2 | If the planner instead decides duplicates should not re-write consent, the implementation is a one-line conditional difference — low risk, but must be an explicit planning decision, not an accident |
| A2 | ENTRY-03's "header" requirement is satisfiable by a secondary link near the locale switcher (not the primary CTA button, which D-03 keeps pointed at `/coach/dashboard`) | Phase Requirements table, ENTRY-03 row | If the planner/UI-SPEC instead reads ENTRY-03 as requiring the primary header CTA to change, that directly conflicts with locked decision D-03 — needs explicit reconciliation before implementation, flagged here rather than silently resolved either way |
| A3 | `mailchecker` and `botid`, despite `SUS` verdicts from the automated legitimacy seam, are safe to install after a `checkpoint:human-verify` — based on this session's manual registry/maintainer inspection, not a second independent authoritative source beyond `npm view` and one WebSearch | Package Legitimacy Audit | If either package is later found compromised, the checkpoint is the only safety net — do not skip it even though this research supports both packages |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Does ENTRY-03's "header" half require changing the primary header CTA, or is a secondary nav link
   sufficient?**
   - What we know: D-03 explicitly keeps `HeaderClient.tsx`'s CTA pointed at `/coach/dashboard`; D-04
     says the founders link is "a plain nav link... not a highlighted/badged pill."
   - What's unclear: `HeaderClient.tsx` currently has no secondary nav slot besides the locale switcher
     and the one CTA button — adding a new plain-text link changes its layout, which wasn't explicitly
     scoped in D-04 (D-04's footer-link-weight comparison was written primarily about the footer).
   - Recommendation: UI-SPEC phase should render both the header and footer treatments explicitly; flag
     to the user during `/gsd-ui-phase 5` if the header layout needs a genuinely new slot.

2. **Should the consent `UPDATE` (Pattern 2) run for duplicate submissions?**
   - What we know: the columns and the copy exist; the RPC's duplicate branch already returns
     `is_new: false` distinctly from a fresh signup.
   - What's unclear: whether re-consenting an already-registered visitor should refresh
     `consent_given_at`/`consent_version`, or whether that field should reflect only the original
     signup's consent event.
   - Recommendation: default to updating on every submission (simpler, arguably better evidentiary
     coverage) unless the planner or a future legal reviewer specifies otherwise — see Assumption A1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Upstash Redis (`UPSTASH_REDIS_REST_URL`/`TOKEN`) | Rate limiting on the Server Action | ✓ (already configured for other `apps/web` limiters) | — | `ratelimit.ts`'s existing no-op fallback if env vars are absent locally |
| Supabase project (service-role key) | Both RPCs, consent `UPDATE` | ✓ (already used by `waitlist.ts`, `account.ts`) | — | none needed — already required infrastructure |
| Vercel project (for `botid`/`@vercel/analytics`) | Bot detection, analytics | ✓ (app already deployed on Vercel per `CLAUDE.md`) | — | none needed |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — all required infrastructure is already provisioned.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v3.2.4 [VERIFIED: apps/web/package.json:53, read this session] |
| Config file | `apps/web/vitest.config.ts` (read this session — `environment: 'node'`, `environmentMatchGlobs: [['**/*.test.tsx', 'happy-dom']]`, `passWithNoTests: true`) |
| Quick run command | `cd apps/web && npx vitest run test/actions/waitlist.concurrency.test.ts` |
| Full suite command | `cd apps/web && npm run test` (`vitest run --passWithNoTests`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAIT-01 | `/fondateurs` renders FR+EN, matches `generateStaticParams` pattern | unit/smoke | `npx vitest run test/app/fondateurs.metadata.test.ts` | ❌ Wave 0 |
| WAIT-02 | Email field hidden until role chosen | component (happy-dom) | `npx vitest run test/components/WaitlistRoleForm.test.tsx` | ❌ Wave 0 |
| WAIT-03 | Form submits only `email`+`audience`+`locale` (no extra required fields) | component | same file as above | ❌ Wave 0 |
| WAIT-04 | Malformed / disposable-domain email rejected with a clear message | unit | `npx vitest run test/actions/waitlist.validation.test.ts` | ❌ Wave 0 |
| WAIT-05/WAIT-06 | Success state identical for new vs. duplicate signup | integration (DB-gated, `RUN_DB`) | `npx vitest run test/actions/waitlist.concurrency.test.ts` | ✅ (existing suite; extend, don't replace) |
| WAIT-07/WAIT-08 | Page uses theme tokens, stays static except counter | manual/visual (UI-SPEC gate) + smoke test on `revalidate` export | `npx vitest run test/app/fondateurs.metadata.test.ts` | ❌ Wave 0 (same file as WAIT-01) |
| FOND-01–FOND-06 | Threshold arbitration, monotonicity, complete state | integration (DB-gated) | `npx vitest run test/app/api/waitlist-count.test.ts` | ❌ Wave 0 |
| ENTRY-01/02 | Homepage section + `/coachs` CTAs link to `/fondateurs` | component | `npx vitest run test/components/entry-points.test.tsx` | ❌ Wave 0 |
| ENTRY-03 | Header/footer nav links present | component | same file as above | ❌ Wave 0 |
| ENTRY-04 | OG/Twitter metadata correct | unit | same file as WAIT-01 (`fondateurs.metadata.test.ts`) | ❌ Wave 0 |
| ENTRY-05 | `/fondateurs` present in `sitemap.ts` output | unit | `npx vitest run test/app/sitemap.test.ts` | ❌ Wave 0 |
| ENTRY-06 | Conversion tracked (analytics call or UTM columns populated) | unit/integration | depends on planner's ENTRY-06 mechanism choice | ❌ Wave 0 |
| Consent recording (Pitfall 2) | `consent_given_at`/`consent_version` non-null after a real submission | integration (DB-gated) | extend `test/actions/waitlist.concurrency.test.ts` | ✅ (extend existing file) |

### Sampling Rate
- **Per task commit:** `cd apps/web && npx vitest run <touched test file>`
- **Per wave merge:** `cd apps/web && npm run test` (full suite, `passWithNoTests: true` so new/empty
  suites don't fail the run)
- **Phase gate:** Full suite green before `/gsd-verify-work`; DB-gated suites (`RUN_DB`-guarded) require
  `SUPABASE_TEST_URL`/`SUPABASE_SERVICE_ROLE_KEY` to actually execute — same known gap Phase 1 already
  carries forward (never executed with real secrets in a session so far, per `STATE.md`'s Blockers
  section). Flag to the user if this phase also cannot run the DB-gated suites live.

### Wave 0 Gaps
- [ ] `test/app/fondateurs.metadata.test.ts` — covers WAIT-01, WAIT-07/08, ENTRY-04
- [ ] `test/components/WaitlistRoleForm.test.tsx` — covers WAIT-02, WAIT-03
- [ ] `test/actions/waitlist.validation.test.ts` — covers WAIT-04 (mailchecker/Zod rejection paths)
- [ ] `test/app/api/waitlist-count.test.ts` — covers FOND-01 through FOND-06
- [ ] `test/components/entry-points.test.tsx` — covers ENTRY-01, ENTRY-02, ENTRY-03
- [ ] `test/app/sitemap.test.ts` — covers ENTRY-05
- [ ] Extend `test/actions/waitlist.concurrency.test.ts` — add rate-limit/bot/consent assertions without
  breaking its existing `vi.mock('server-only', ...)` importability (Pitfall 3)
- [ ] Framework install: none — Vitest already configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | This page is unauthenticated by design (public capture form) |
| V3 Session Management | No | No session created by this flow |
| V4 Access Control | Yes | RLS deny-all + `service_role`-only RPC grants (already enforced by Phase 1's migration, not new work this phase) |
| V5 Input Validation | Yes | `z.email()` (syntax) + `mailchecker` (disposable domain) + the DB's own minimal format `CHECK` constraint (defense in depth, already shipped) |
| V6 Cryptography | No | No new cryptographic material introduced |
| V11 Business Logic | Yes | The 200-cap monotonicity and non-disclosure guarantees (already proven by Phase 1's RPC design) must not be weakened by any Phase 5 addition — see Anti-Patterns |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Bot/script mass-claiming founder spots | Denial of Service / Spoofing | `botid` + honeypot + `waitlistRatelimit` (per-IP sliding window), layered per `research/PITFALLS.md` Pitfall 12 |
| Email enumeration via response-shape/timing difference | Information Disclosure | Already solved — `claimWaitlistSpot`'s D-03/D-04 filter returns an identical `WaitlistState` for new vs. duplicate; Phase 5 must not add any new field or timing difference to this response |
| Disposable-email spot-wasting | Business logic abuse | `mailchecker` domain check before the RPC call |
| Anon-key direct RPC invocation attempt (bypassing the app) | Elevation of Privilege | Not exploitable — both RPCs are `REVOKE`d from `anon`/`authenticated` at the database level, confirmed by reading the migration this session; no application-layer control could compensate if this weren't true, but it is |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260812_waitlist_founder_offer.sql` — full file read this session; RPC
  signatures, GRANT/REVOKE statements, `app_config` seed value, sequence-reset RPC
- `supabase/migrations/20260815_waitlist_retention_config.sql` — full file read this session
- `apps/web/src/actions/waitlist.ts` — full file read this session (existing Server Action)
- `apps/web/src/content/legal/founder-offer.ts` — full file read this session (frozen consent copy)
- `apps/web/test/actions/waitlist.concurrency.test.ts` — full file read this session (existing test
  pattern, `RUN_DB` gating convention)
- `apps/web/src/lib/ratelimit.ts`, `apps/web/src/lib/supabase/admin.ts`, `apps/web/src/lib/supabase/server.ts`
  — full files read this session
- `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx`, `CoachsHeroClient.tsx`,
  `CoachsCtaFooterClient.tsx`, `apps/web/src/components/layout/HeaderClient.tsx`, `FooterClient.tsx`,
  `apps/web/src/app/[locale]/(marketing)/page.tsx`, `apps/web/src/components/marketing/Hero.tsx` — read
  this session
- `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts` — read this session
- `apps/web/src/i18n/routing.ts` — read this session (`localePrefix: 'always'`, no route-segment
  translation)
- npm registry (`npm view mailchecker version`, `npm view botid version`, `npm view @vercel/analytics
  version`, `npm view @vercel/speed-insights version`, `npm view botid maintainers`) — run this session
- `.planning/workstreams/lien-invite/phases/01-data-foundation/01-CONTEXT.md`,
  `01-04-SUMMARY.md`; `.planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-02-SUMMARY.md` — read
  this session for D-13/D-15/D-16 provenance and consent-copy handoff confirmation

### Secondary (MEDIUM confidence)
- WebSearch: "botid npm package Vercel bot protection official" — corroborates `botid`'s first-party
  Vercel status (vercel.com/docs/botid, vercel.com/blog/introducing-botid)
- `.planning/workstreams/lien-invite/research/{ARCHITECTURE,STACK,PITFALLS,FEATURES,SUMMARY}.md` —
  milestone-level research from 2026-08-12, re-verified against current codebase state this session;
  treated as accurate except where explicitly corrected above (anon-key vs. service-role)

### Tertiary (LOW confidence)
- None new this session — all claims either verified against files/registry or explicitly carried
  forward from the already-graded milestone research with its original confidence level preserved.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions re-verified against npm registry this session, unchanged from
  milestone research
- Architecture: HIGH — every RPC/grant/client claim verified by reading the actual shipped migration and
  Server Action this session, correcting one stale assumption in the milestone research
- Pitfalls: HIGH for the two new findings (RPC client mismatch, unwritten consent columns), MEDIUM-HIGH
  for the carried-forward legal/abuse pitfalls (unchanged confidence from `research/PITFALLS.md`)

**Research date:** 2026-08-16
**Valid until:** 2026-09-15 (30 days — stable domain, but re-verify RPC grants if any further Phase 1/3
migration lands before Phase 5 executes)
