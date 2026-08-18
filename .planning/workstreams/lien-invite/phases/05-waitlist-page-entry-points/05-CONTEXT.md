# Phase 5: Waitlist Page & Entry Points - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the public, bilingual `/fondateurs` page — a mostly-static marketing page where a
visitor picks their profile (athlete or coach), submits one email, sees the founder-offer pitch and a
live "spots remaining" counter, and gets an inline success state — plus every entry point that routes
visitors to it: a new homepage section, redirected `/coachs` CTAs, and header/footer nav links.

**In scope:** the `/fondateurs` page itself (FR+EN, static except the counter), the profile-picker →
email-only form wired to Phase 1's `claim_waitlist_signup()` Server Action, the counter Route Handler
consuming `get_waitlist_founder_status()`, the pre-reveal / counter-visible / complete page states, the
consent checkbox + RGPD notice UI (using Phase 3's already-drafted copy), disposable-domain + bot
protection on the form, a new homepage founders section, redirecting the two existing `/coachs` CTAs to
`/fondateurs`, new header/footer nav links, OG/Twitter card metadata, sitemap entry, and an analytics
mechanism for ENTRY-06.

**Out of scope:** any change to the waitlist backend/RPCs/schema (Phase 1, already shipped); the
CGV/CGU text and consent-copy wording itself (Phase 3, already drafted — Phase 5 only wires it in); the
credit-gate behavior (Phase 4, already shipped); gating or redirecting `/coach/onboarding` itself
(explicitly decided against below — it stays live, just unpromoted); flipping any feature flag or
activating the offer in production (Phase 6); a founder-to-`tier='premium'` redemption flow (out of
scope for the whole milestone per Phase 4 D-04).

</domain>

<decisions>
## Implementation Decisions

### Coexistence with existing coach signup

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

### Entry-point prominence

- **D-05:** The homepage gets a **dedicated founders section**, not just a nav link — placed
  **immediately after `<Hero />`**, before `<HowItWorks />`. This is the milestone's flagship growth
  push (ENTRY-01); a footer link alone was judged insufficient to move signups for a time-limited offer.
  — **Reversibility:** reversible — a new homepage section, no schema/route impact.

- **D-06:** `/coachs` does **not** get a duplicate dedicated section — the CTA redirect (D-01) is judged
  sufficient there, since the whole page is already coach-focused end to end and both existing CTAs now
  point at `/fondateurs`.

### Athlete vs. coach page content

- **D-07:** The `/fondateurs` page tells **one shared narrative** for both audiences — "first 200
  founders get lifetime premium" — rather than branching value-prop content blocks per audience (the
  way `/coachs` branches its own message from the homepage). Only the profile picker and the
  post-submission confirmation are audience-aware. Simpler to build, keeps FOND-01's fact-statement
  framing unified, and audience-specific pitches already exist elsewhere (homepage, `/coachs`).
  — **Reversibility:** reversible — a copy/content-structure choice, not an architectural one.

- **D-08:** When a visitor arrives via the `/coachs` redirect (D-01), the page loads with **coach
  pre-picked** — highlighted/selected, email field already visible — but **still changeable** to
  athlete. No separate locked landing view; the picker stays interactive regardless of entry point.

### "Complete" state (FOND-05)

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
  installed in `apps/web`; the UTM columns Phase 1 already stores on every signup row (D-14,
  `01-CONTEXT.md`) are also directly queryable and may be sufficient on their own. Planner decides
  which (or both) to wire in.
- Bot-protection stack composition (`mailchecker` + `botid` + existing Upstash limiter) — already fully
  specified in `research/STACK.md` and `research/ARCHITECTURE.md` §2, not re-litigated here.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone specs
- `.planning/workstreams/lien-invite/phases/05-waitlist-page-entry-points/05-RESEARCH.md` — **read this
  first, and let it override ARCHITECTURE.md §2/§3 below wherever they conflict.** It confirms both
  waitlist RPCs shipped `service_role`-only (not anon-executable as ARCHITECTURE.md §2/§3 originally
  assumed), that `apps/web/src/actions/waitlist.ts` (`claimWaitlistSpot`) already exists and is already
  tested — this phase **extends** it, not creates it — and it carries the `## Validation Architecture`
  section this project's Nyquist gate requires.
- `.planning/workstreams/lien-invite/REQUIREMENTS.md` — WAIT-01→08, FOND-01→06, ENTRY-01→06 are this
  phase's requirements.
- `.planning/workstreams/lien-invite/ROADMAP.md` — Phase 5 goal, 5 success criteria, and the "UI hint:
  yes" note requiring a UI-SPEC design contract before implementation.
- `.planning/workstreams/lien-invite/research/ARCHITECTURE.md` §2 "RLS for a Public, Unauthenticated
  INSERT" and §3 "The Public Counter" — the `SECURITY DEFINER` RPC + deny-all RLS call path, and the
  counter's Route Handler + 30s revalidate pattern (do not make the whole page dynamic) still hold.
  **Superseded:** its recommendation to call both RPCs via the **anon key** — the shipped migration
  grants `service_role` only; use `createAdminClient()` for both the claim action and the counter Route
  Handler, per `05-RESEARCH.md`.
- `.planning/workstreams/lien-invite/research/STACK.md` — the exact package list (`mailchecker`,
  `botid`, `@marsidev/react-turnstile` held in reserve, `@vercel/analytics`, `@vercel/speed-insights`),
  version-verified against npm registry, with integration points for each.
- `.planning/workstreams/lien-invite/research/PITFALLS.md` Pitfall 12 — bot/disposable-email/enumeration
  abuse on a public unauthenticated write endpoint, and the layered mitigation this phase must implement.
- `.planning/workstreams/lien-invite/research/SUMMARY.md` "Research Flags" and "Gaps to Address" — the
  `/coach/onboarding` coexistence gap this phase's D-01→D-03 resolve, and confirmation that Phase D
  (this phase) needs no deeper research beyond what's already written.

### Prior-phase decisions this phase builds on
- `.planning/workstreams/lien-invite/phases/01-data-foundation/01-CONTEXT.md` D-03/D-04 — success
  response shows founder rank only for genuinely-new signups; duplicates get the same neutral success
  state. This is the exact contract the page's success UI must render against.
- `.planning/workstreams/lien-invite/phases/01-data-foundation/01-CONTEXT.md` D-06 — the counter RPC
  returns `{ should_display, remaining, is_full }`, already threshold-arbitrated in the database; the
  page never computes or receives the raw pre-reveal count.
- `.planning/workstreams/lien-invite/phases/01-data-foundation/01-CONTEXT.md` D-13 — only a minimal
  format `CHECK` exists at the DB layer; disposable-domain rejection (WAIT-04) is explicitly this
  phase's responsibility, at the form layer.
- `.planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-CONTEXT.md` D-07 — Phase 3 delivered
  **final FR+EN copy only** for the consent checkbox and collection-point notice; this phase builds the
  actual form UI that renders that copy — do not draft new legal text.
- `supabase/migrations/20260812_waitlist_founder_offer.sql` — the live schema, RPCs, and the seeded
  `waitlist_reveal_threshold = 30` (i.e., counter becomes visible at 170/200 claimed) this phase's
  counter UI must respect but never hardcode.

### Codebase idioms this phase must follow
- `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx` and `cgu/page.tsx` — the SSG pattern
  (`generateStaticParams` + `setRequestLocale`) every marketing page in this app follows; `/fondateurs`
  follows the same shape except for the counter's isolated Client Component.
- `apps/web/src/app/api/credits/balance/`, `apps/web/src/app/api/storage/upload-url/` — existing
  Next.js Route Handler convention under `apps/web/src/app/api/`; the counter's Route Handler
  (`apps/web/src/app/api/waitlist/count/route.ts` per research) follows this shape.
- `apps/web/src/lib/ratelimit.ts` — existing Upstash lazy-singleton limiter pattern
  (`rolePromotionRatelimit`, `kycUploadRatelimit`) to mirror for the waitlist Server Action.
- `apps/web/src/lib/supabase/admin.ts` `createAdminClient()` — the service-role client both the claim
  Server Action and the counter Route Handler must use; both RPCs shipped `service_role`-only, per
  `05-RESEARCH.md` (corrects this file's earlier anon-key guidance).
- `apps/web/src/components/layout/HeaderClient.tsx`, `FooterClient.tsx` — existing nav link patterns
  (`AnimatedLink`, locale-aware `Link` from `@/i18n/navigation`) the new founders nav link follows.
- `apps/web/src/components/marketing/CoachsHeroClient.tsx:83-89`,
  `CoachsCtaFooterClient.tsx:31-37` — the exact two CTA link targets this phase's D-01 changes.
- `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts` — existing sitemap/robots pattern
  ENTRY-05 requires extending with the new `/fondateurs` route.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/lib/supabase/admin.ts` `createAdminClient()` — service-role client, required for both
  waitlist RPCs (corrected from an earlier anon-key assumption — see `05-RESEARCH.md`).
- `apps/web/src/actions/waitlist.ts` (`claimWaitlistSpot`) — already exists, already calls
  `claim_waitlist_signup` via the admin client, already proven by
  `apps/web/test/actions/waitlist.concurrency.test.ts`. This phase extends it (rate limiting,
  `mailchecker`, `botid`, honeypot, consent recording) rather than building a new Server Action.
- `apps/web/src/lib/ratelimit.ts` — Upstash limiter already configured and used elsewhere in
  `apps/web`; same pattern applies to the new Server Action.
- `next-intl` FR/EN routing (`apps/web/src/i18n/`) — no new i18n infrastructure needed.
- `apps/web/src/components/seo/JsonLd.tsx` — existing structured-data helper, used on the homepage;
  reusable for `/fondateurs`'s schema.org markup if desired.
- Phase 3's drafted consent-checkbox and collection-notice copy — ready to wire into the form, not to
  be re-drafted.

### Established Patterns
- Marketing pages are SSG (`generateStaticParams` + `setRequestLocale`) with metadata via
  `generateMetadata` (OG image, Twitter card, canonical + alternate-language links) — every existing
  marketing page (`coachs/page.tsx`, homepage `page.tsx`) follows this exact shape; `/fondateurs`
  should match it, isolating only the counter into a small Client Component per
  `research/ARCHITECTURE.md` §3.
- Tailwind v4 semantic tokens (`text-primary`, `bg-background`, `border-border`, `text-muted`) — no
  new design tokens needed.
- Server Actions live under `apps/web/src/actions/`, following `account.ts`'s generic-response
  anti-enumeration philosophy — Phase 1 already built the Server Action calling `claim_waitlist_signup`;
  confirm it lives there and matches this convention.

### Integration Points
- `apps/web/src/app/[locale]/(marketing)/` — new `fondateurs/` directory sits alongside `coachs/`,
  `cgu/`, `cgv/`, etc.
- `apps/web/src/app/api/` — new `waitlist/count/route.ts` Route Handler.
- `apps/web/src/components/marketing/` — new homepage founders section component(s), following the
  existing `Hero.tsx`/`HeroClient.tsx` server/client split pattern used throughout this directory.
- `apps/web/src/components/layout/HeaderClient.tsx`, `FooterClient.tsx` — new nav link additions.
- `apps/web/src/app/sitemap.ts`, `robots.ts` — new route entries.

### Naming note for the planner
`apps/web/src/components/marketing/CoachsFounderSection.tsx` already exists — it's an unrelated
testimonial/mission section about the company's human founder, not this milestone's "founder offer."
Avoid naming new components ambiguously close to this (e.g. prefer `WaitlistFounderBanner` /
`FoundersOfferSection` over anything that could be confused with `CoachsFounderSection`).

</code_context>

<specifics>
## Specific Ideas

- The `/coachs` → `/fondateurs` redirect should feel seamless: coach preselected, email field already
  visible, but the visitor can still switch to athlete if they landed there by mistake (D-08).
- The complete-state message should read as a genuine state change ("places prises"), not a
  discouraging "0 remaining" — the tone should still invite the general waitlist signup underneath it
  (D-09/D-10).

</specifics>

<deferred>
## Deferred Ideas

- **Redirecting or gating `/coach/onboarding` itself** — considered and explicitly rejected (D-02); it
  stays live and functional, just unpromoted.
- **A dedicated founders section on `/coachs`** — considered and explicitly rejected (D-06); the CTA
  redirect is judged sufficient.
- **Branching page content per audience** — considered and explicitly rejected (D-07) in favor of one
  shared narrative; could be revisited post-launch if conversion data suggests audience-specific pitches
  would help, but that's future work, not this phase.
- **Visible CAPTCHA (Turnstile)** — held in reserve per `research/STACK.md`; only added if BotID's
  invisible layer proves insufficient after launch. Not built in this phase.

</deferred>

---

*Phase: 5-Waitlist Page & Entry Points*
*Context gathered: 2026-08-16*
