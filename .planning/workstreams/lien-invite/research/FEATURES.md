# Feature Research: Waitlist / Early-Access Landing Page with Founder Offer

**Domain:** Public waitlist / early-access landing page, dual-audience (athlete + coach), founder lifetime-deal mechanic
**Researched:** 2026-08-12
**Confidence:** MEDIUM overall (web-search-sourced, cross-corroborated across 3+ independent sources per claim; no single-source claims presented as fact — see confidence notes per section)

---

## 0. Benchmark — Real, Named Examples

All examples below are documented in multiple independent secondary sources (case-study aggregators, press, or founder retrospectives). None were fabricated or recalled from memory alone — each is backed by the cited URLs. Confidence is MEDIUM (web aggregator sources, cross-corroborated, not primary company blog posts in most cases) unless noted.

| Product | Structure / above-the-fold | Fields | CTA | Post-submit | Counter / social proof | Result |
|---|---|---|---|---|---|---|
| **Superhuman** (email client) | Single value headline, single email field | 1 (email) — then a **qualification survey** sent later (email habits, current client) that could get you rejected | "Request access" | Delayed: screening survey, then manual review; existing users could refer/vouch to move applicants up the queue | No public counter; scarcity came from referral-gated access + rejection, not a number | ~180K waitlist before general availability. [Superhuman case study — waitlister.me](https://waitlister.me/growth-hub/case-studies/superhuman), [How Superhuman Grows](https://www.howtheygrow.co/p/how-superhuman-grows) |
| **Robinhood** (fintech) | Single headline + single email field, no nav | 1 (email) | Implicit "Join" | Immediate: shown **exact live queue position**; referring friends moved you up the queue (leaderboard-style), reward = free stock | Queue position number per-user (not an aggregate "spots claimed" counter) | 1M signups before launch; ~3 referred signups/user on average. [Prefinery](https://www.prefinery.com/blog/referral-programs/prelaunch-campaign/robinhood/), [Viral Loops](https://viral-loops.com/blog/how-robinhoods-referral-built-a-1m-user/) |
| **Arc Browser** (The Browser Company) | Manifesto pattern: a bold provocative question + short founder's letter — **no feature list, no screenshot required** | 1 (email) | "Join the waitlist" | Invite-only rollout, staged over 1+ year, phased "we're onboarding more each week" emails | No numeric counter shown publicly; exclusivity communicated via "invite-only" framing, not a live count | ~350K names before v1.0 GA. [Flowjam](https://www.flowjam.com/blog/waitlist-landing-page-examples-10-high-converting-pre-launch-designs-how-to-build-yours), [TechCrunch](https://techcrunch.com/2023/07/25/arc-browser-is-now-available-to-download-for-everyone) |
| **Linear** (issue tracker) | Single-screen "aesthetic-as-proof": one opinionated headline ("Linear is a better way to build products"), tight sub-head, one field — deliberately austere to pre-filter for a design-literate B2B audience | 1 (email) | Minimal, understated | Closed beta ~1 year, funneled accepted users into a private Slack for feedback before public GA | No counter; positioning itself (design quality, tone) *was* the social proof | 10K+ waitlist, largely via founder's public-building on Twitter/X. [Eleken case study](https://www.eleken.co/blog-posts/linear-app-case-study) |
| **Clubhouse** (social audio) | Invite-only from day one — no public signup page at all, only a waitlist request; access required being invited by an existing member | 1 (request to join) | "Request an invite" | Applicants sat on a waitlist and got in when invited by a member (not a first-come queue) | No counter; scarcity was structural (invite-gated), status-signaling was the driver, not a number | 600K → 10M waitlist in weeks during Jan 2021, zero paid marketing. [Waitlister case study](https://waitlister.me/growth-hub/case-studies/club-house), [9to5Mac](https://9to5mac.com/2021/07/21/clubhouse-no-longer-invite-only-as-waitlist-reportedly-nears-10-million-people/) |
| **Perplexity Comet** (AI browser) | Product page + waitlist form asking a couple of qualifying details (OS, browsing habits) rather than just email | 2–3 (email + OS + use-case) | "Join waitlist" | Invite rollout by priority tier; PayPal/Venmo users were later offered a **skip-the-waitlist** partnership perk (free Pro subscription) | No public aggregate counter; access communicated as "priority given to waitlist" | Rolling invite-only launch. [TechCrunch](https://techcrunch.com/2025/07/09/perplexity-launches-comet-an-ai-powered-web-browser/), [PayPal Newsroom](https://newsroom.paypal-corp.com/2025-09-03-Skip-the-Waitlist-PayPal-and-Venmo-Users-Offered-Early-Access-to-Perplexitys-New-Comet-Browser-with-Free-Perplexity-Pro-Subscription) |
| **Dia Browser** (The Browser Company) | Public beta waitlist page ahead of a platform-specific release (Windows) | 1 (email) | "Join the waitlist" | Staged platform rollout (Mac first, then Windows beta) | Not documented publicly | [Ground News summary](https://ground.news/article/perplexity-employee-who-worked-on-comet-launches-an-ai-browser-aimed-at-knowledge-work) |
| **WHOOP** ("new experience" waitlist) | Product-teaser hero + waitlist form, positioned as early access to a platform refresh for an existing user base | 1 (email, tied to existing account) | "Join the waitlist" | Staged rollout to existing subscriber base as spots open | Not documented publicly | Live at whoop.com/waitlist. [whoop.com/eu/en/waitlist](https://www.whoop.com/eu/en/waitlist/) — LOW confidence, single source, not independently corroborated |
| **Fitness "founding member" studios** (FASE Lagree, Reclaim Fitness) | Landing section (not a full page) inside an existing marketing site — plain statement of the deal | 1 (email or direct purchase) | "Claim your spot" / "Become a founding member" | Immediate purchase or waitlist entry, no drip sequence documented | Explicit **hard cap stated up front** ("Founding 100," "limited to the first 100 members") — cap communicated as a promise, not shown as a live-updating counter | [FASE Lagree Founding 100](https://faselagree.com/founding-100/), [Reclaim Fitness](https://reclaimfitnessstudio.com/founding-members-1) |

**Pattern across every credible example:** the *field count is 1* (email only) on the page that captures the lead; qualification, role, or preference data is gathered **after** signup (survey, onboarding, or none at all), not before. The two viral outliers (Robinhood, Superhuman) both used a referral/queue mechanic — explicitly **out of scope for this milestone** per the brief, but worth flagging to the roadmapper as a natural v2 lever once volume exists. The two design-forward outliers (Arc, Linear) used **zero numeric social proof** and leaned entirely on brand voice/positioning — this is the most directly transferable pattern for a page launching from zero.

---

## 1. Page Anatomy / UX

### Section order that converts (synthesized from CXL, GetResponse, LaunchList, Flowjam benchmarking posts — MEDIUM confidence, consistent across 5+ independent sources)

1. **Hero / above-the-fold** — headline + subhead + the single capture form + primary CTA button, visible with zero scrolling on mobile. No site navigation in the hero (nav creates an escape hatch before the pitch lands).
2. **Founder offer block** — immediately below or integrated into the hero (see §3): the lifetime-premium hook, stated precisely, with the scarcity mechanic.
3. **What it is / how it works** — 3–4 short beats (not a full feature list) answering "what am I getting early access to."
4. **Proof / trust block** — see §4 for the counter decision; can otherwise be founder credibility, press mentions, or "as seen in the app already live for X" if applicable.
5. **Secondary CTA repeat** — the same form (or a scroll-to-top-form button), placed after the pitch has landed, for readers who scrolled past the hero without acting.
6. **FAQ** (optional but consistent with the existing `/coachs` page pattern in this codebase — `CoachsFAQ.tsx`) — answers "when do I get access," "what does lifetime mean," "is this really free," "what happens to my data."
7. **Footer** — legal links (existing site pattern, `FooterClient.tsx`), no distraction.

### Above-the-fold rules
- One CTA above the fold; if the page is long, repeat it at each major scroll stop (sources report 20–35% lift for multi-CTA long pages vs single-CTA). [Apexure](https://www.apexure.com/blog/landing-page-call-to-action-button-tips), [LandingPageFlow](https://www.landingpageflow.com/post/best-cta-placement-strategies-for-landing-pages)
- Headline pattern that outperforms generic ones: **outcome-driven, answers "what's in it for me," not a feature description.** For this page: lead with the *access* framing ("early access" / "founding member"), not a generic product tagline — the existing home hero already carries the product tagline; this page's job is the offer.
- Hero visual: for a page whose asset is "the product already exists and is live," a **short looping product screen-capture or 3–5 static screenshots** (mobile app + coach dashboard, since this page serves both audiences) outperforms an illustrative/abstract hero — it substitutes for the "the product is real, not vaporware" trust signal that pure pre-launch pages (Arc, Linear) had to earn through copy alone. Ziko has this asset advantage; use it.

### Form placement and field count — the athlete/coach question
This is the one explicit design tension in the brief: a single page must ask "athlete or coach" without tanking conversion. Every extra field measurably drops conversion (CXL, GetResponse, LaunchList — MEDIUM confidence, consistent finding). The mitigating pattern documented across segmentation sources (Klaviyo, ActiveCampaign) is:

- **Make the role choice the interaction itself, not an added field.** Two large visually-equal buttons/cards ("Je suis athlète" / "Je suis coach") *precede* the email field rather than sitting inside a form as a dropdown or radio group. The user's tap IS the segmentation event; the email field only appears (or is revealed) after the choice, which reads as *progressive disclosure* (a UX pattern that reduces perceived form length) rather than *one more field to fill*.
- This also means the CTA copy and even the founder-offer copy underneath can be role-specific ("lifetime premium" resonates differently — athlete: free AI coach forever; coach: free CRM/branding forever) without needing a second page.
- Concretely for this codebase: this is a client-side toggle state in a single client component (matches the existing `CoachsHeroClient.tsx` / `HeroClient.tsx` server-wrapper pattern), not a route split — avoids doubling the page (and doubling OG metadata, translations, maintenance) for what is fundamentally one offer.

### CTA copy that outperforms "Submit"/"Join"
Documented pattern: action verb + 2–5 words, plus an urgency/exclusivity word when it's truthful. [GetResponse](https://www.getresponse.com/blog/waitlist-landing-page), [Apexure](https://www.apexure.com/blog/landing-page-call-to-action-button-tips)
- Good: "Get early access", "Claim my spot", "Become a founding member", "Réserver ma place fondateur"
- Avoid: "Submit", "Join", "S'inscrire" alone — too transactional, doesn't carry the offer.
- Recommendation for this page: CTA should name the *offer*, not the *action* — e.g. "Devenir membre fondateur" rather than "Rejoindre la liste d'attente." The lifetime deal is the differentiator; the CTA should sell it, not the waitlist mechanic.

### Trust signals available to Ziko specifically
Unlike every pure-vaporware benchmark above, Ziko is a **live, shipped product** (v1.0–v1.8 already shipped, existing users, existing `/coachs` page with founder story). Trust signals to reuse rather than invent:
- The existing founder story/quote already built for `/coachs` (`CoachsFounderSection.tsx` / `founder.quote`, `founder.story`) — same founder-authenticity pattern Arc and Linear leaned on, and Ziko already has the asset.
- Real product screenshots (not mockup illustrations) — the "aesthetic-as-proof" trust signal Linear earned through design polish, Ziko can earn through "this is a real, working app" honesty.
- Legal credibility — CGU/mentions légales/politique de confidentialité already exist and are linked in the footer; keep the footer link pattern.

### Post-submit success state
Cross-source pattern (LaunchList, Waitlister, KickoffLabs — MEDIUM confidence): confirmation + a "what's next" signal + (optionally) a share ask. **This milestone explicitly excludes referral, queue position, and confirmation email**, so the inline success state must do more work with less:
- **Say clearly:** "You're in — you'll hear from us when your wave opens." Avoid implying a specific date or position (no data to back either up in this milestone).
- **Reinforce the founder offer status:** if they claimed one of the 200 spots, confirm it explicitly ("You've secured founder pricing — lifetime premium, free.") — this is the one piece of information this milestone *can* give immediately and it's the single highest-value line on the whole page.
- **No confirmation email in this milestone** means the inline state is the *only* touchpoint — it must not feel like a dead end. A single soft next-step link (e.g. back to the app stores, or "read how it works") prevents the page reading as a black hole. Do not add a fake progress bar, fake position number, or a share prompt — none of these are truthful without backend support that's out of scope.

---

## 2. The Founder / Lifetime-Deal Mechanic

### Framing that works vs. framing that reads as manipulative
- **Works:** a stated, fixed, verifiable cap ("first 200 members") tied to a real one-time action (signing up now, before public launch) with a plainly stated permanent benefit ("lifetime premium — no monthly fee, ever"). This is exactly the FASE Lagree / Reclaim Fitness pattern: cap stated as a promise up front, not manufactured urgency layered onto an unlimited offer. [FASE Lagree](https://faselagree.com/founding-100/)
- **Reads as manipulative:** countdown timers that reset, "limited spots" language with no actual cap enforced anywhere in the product, or a counter that contradicts itself (e.g., shows 3 different numbers across page reloads). Cross-source consensus (Waitlister, ProblemPop, Unicorn Platform — MEDIUM confidence): fake urgency is detected instantly by users and actively destroys trust in the brand, not just this offer. [wisernotify.com exit-intent testing](https://wisernotify.com/blog/exit-intent-popup-examples/)

### What the offer must state precisely to be credible
The offer needs to answer, on the page itself, without requiring the user to hunt for it:
1. **What "lifetime" covers** — which tier (`user_profiles.tier = 'premium'`), and confirmation it never reverts/expires or requires renewal. Given there is no CGV yet, this page's offer copy is doing legal-adjacent work; it should be conservative and match what the product can actually honor (this is a flag for the roadmapper/legal reviewer, not something to resolve in research).
2. **Exactly who counts toward the 200** — is it 200 total across both athlete and coach, or 200 per audience? This must be decided before copy is written, because "200" appearing twice with different real meanings is the single fastest way to erode the trust this mechanic depends on.
3. **What happens at #201** — the page should not need to explain this (a waitlist without a stated fallback is fine — "early access" is inherently different from "lifetime deal"), but internally the team needs a plan so the counter doesn't silently keep incrementing past the promised cap.
4. **No CGV yet is a real gap** — a "lifetime" commercial offer is exactly the kind of thing CGV (terms of sale) exist to protect both sides on. This is a pitfall to flag to the roadmapper: either fast-follow a minimal CGV addendum, or keep the on-page offer language deliberately narrow (a promise, not a contract) until CGV exists.

### Known risks — post-mortems from founders
Consistent findings across founder retrospectives on lifetime deals (thebootstrappedfounder.com, f3fundit.com, saasclub.io — MEDIUM confidence, 3 independent sources): [The Bootstrapped Founder](https://thebootstrappedfounder.com/lifetime-deals-and-saas-businesses/), [SaaS Club](https://saasclub.io/playbooks/george-georgiadis-lifetime-deals-framework/)
- **Support-cost asymmetry:** lifetime/deal-driven users generate disproportionately more support tickets and feature requests relative to revenue, because there's no recurring relationship forcing prioritization.
- **Refund/regret rates:** ~16–17% refund rates are typical on deal marketplaces (AppSumo average); even without a marketplace, expect a non-trivial share of founder members to be low-intent deal-seekers rather than long-term product fans.
- **Financial risk compounds at scale:** a lifetime-premium commitment is a permanent AI-cost liability against Ziko's existing credit system (`user_ai_credits`, per-call cost logging in `ai_cost_log`). 200 people is small and bounded — this is precisely why the benchmarked examples that survived lifetime deals kept the cap hard and small ("Founding 100," "limited to 25 users" for the Aura fitness app example) rather than open-ended. **Recommendation: the 200 cap is the right order of magnitude — do not let it be soft or extendable without a deliberate, separate decision.**
- **Reputational risk:** founders who ran open-ended or repeatedly-extended lifetime deals report it became a recurring expectation ("just wait for the next lifetime deal") that trained users not to pay full price — reinforces why the cap must be real and permanent, and never re-run.

---

## 3. The Public Counter — Firm Recommendation

**Question posed:** does showing "3/200 spots claimed" when the number is genuinely low hurt conversion, and what should Ziko do for a page launching from zero?

**Finding:** Cross-source evidence is consistent though not from a single authoritative study — evidence is directional and MEDIUM confidence, triangulated across scarcity-psychology sources (suebehaviouraldesign.com, wisernotify.com), social-proof landing page guides (provesrc.com, unicornplatform.com), and the "cold start" social-proof guidance found for pages with no numeric traction yet:
- Live/dynamic counters **outperform** vague or absent proof **only when the number itself is impressive or credibly framed** — an ascending small number ("3 claimed") reads as *failure/unpopularity*, the opposite of the intended signal, because readers benchmark it against the stated cap (3 out of 200 looks abandoned, not exclusive).
- Descending scarcity framing ("X remaining" out of a fixed pool) tests better than ascending "claimed" framing at the same underlying number, because it frames the same fact through loss-aversion rather than social-proof — and loss-aversion doesn't require a large absolute number to work (losing 1 of a stated few available things is meaningful regardless of how many total exist).
- For zero-traction cold starts specifically, the recommended substitute proof is **not a number at all** — founder credibility, product screenshots, and the precision of the offer itself carry the trust load until real traction exists.

**Recommendation for this page, launching from zero:**

1. **Do not show a live ascending "X / 200 claimed" counter at launch.** At low numbers it actively signals the opposite of exclusivity.
2. **Do not show a fake or seeded number.** Every anti-pattern source is unanimous that fabricated numbers are both an ethical problem and a detectable, trust-destroying tactic the moment a user reloads the page or compares it to reality.
3. **Ship the offer with the cap stated as a fact, not a live meter:** "The first 200 members get lifetime premium — free, forever." This is truthful, requires no live data, and is exactly the framing the credible fitness-studio founder-offer examples used (FASE Lagree: "limited to the first 100... will never be offered again").
4. **Add a live counter only once it crosses a believable threshold.** A concrete, actionable rule for the roadmap: **introduce the live counter once signups pass roughly 10–15% of the cap (≈20–30 of 200)**, and frame it as **"X spots remaining"** (descending from 200), never "X claimed" (ascending from 0). This is a reasoned inference from the loss-aversion + unpopularity-signal findings above, not a number found in a single source — flag it to the roadmapper as MEDIUM confidence, and treat the exact threshold as tunable, not sacred.
5. **Practical implementation implication:** this means the counter is not a v1 requirement of the page itself — it's a feature-flagged element the team can toggle on once real numbers justify it. Build the data model (a count of confirmed founder signups) from day one regardless, since it costs nothing extra and unblocks turning the counter on later without a schema change.
6. **Alternative that's safe at any volume, if a live-feeling element is wanted from day one:** recent-signup activity ("Marie just became a founding member" style toast) is a different mechanic than an aggregate counter — it doesn't expose the absolute number, so a single signup doesn't look bad. This is explicitly **out of scope for this milestone** (no such infra exists yet) but worth flagging as a natural v2 addition once the count is real.

---

## 4. Entry Points — Where to Link to This Page

This is an explicit requirement; recommendations are concrete and file-specific, based on the actual codebase structure read for this research.

| Entry point | Placement | File(s) touched | Priority |
|---|---|---|---|
| **Home page nav** | Header CTA button — currently points to `/coach/dashboard` (`cta` prop in `HeaderClient.tsx`). During the waitlist period this is the single highest-visibility slot on the whole site and should point to the waitlist page instead of a dashboard the public can't use yet. | `apps/web/src/components/layout/Header.tsx`, `HeaderClient.tsx` | P1 |
| **Home page hero** | `HeroClient.tsx` already has 3 CTA props (`ctaAppStore`, `ctaPlayStore`, `ctaCoach`) — since the app is gated, app-store CTAs should route through (or alongside) the waitlist page rather than a live store listing, and `ctaCoach` should point to the waitlist page (role preselected to coach) instead of wherever it currently resolves. | `apps/web/src/components/marketing/Hero.tsx`, `HeroClient.tsx` | P1 |
| **`/coachs` page CTA(s)** | `CoachsHeroClient.tsx` (`cta`/`ctaNote`) and `CoachsCtaFooter.tsx` at the bottom of the page both currently drive to a coach signup flow that assumes open access — during the gated period these should route to the waitlist page with the coach role preselected (`?role=coach` or equivalent client state). | `apps/web/src/components/marketing/CoachsHero.tsx`/`CoachsHeroClient.tsx`, `CoachsCtaFooter.tsx`/`CoachsCtaFooterClient.tsx` | P1 |
| **Sticky banner (new)** | A thin, dismissible top banner across the marketing site ("Ziko ouvre ses portes par vagues — devenez membre fondateur") is a proven low-cost, high-visibility entry point pattern; not present in the codebase today, would be a new shared component in the `(marketing)` layout. | New component, likely `apps/web/src/app/[locale]/(marketing)/layout.tsx` | P2 — nice-to-have, not required for launch |
| **Footer** | `FooterClient.tsx` currently only has legal links — add one product link to the waitlist page alongside (not replacing) the legal nav, so it's discoverable from every marketing/coach-adjacent page without competing with the primary CTAs. | `apps/web/src/components/layout/Footer.tsx`, `FooterClient.tsx` | P2 |
| **App store listings** | Since the product is gated, App Store / Play Store descriptions and screenshots should direct prospective downloaders to the waitlist URL (can't be automated from this codebase — operational task, but the URL needs to exist and be short/memorable before store copy is written). | N/A (external, store console) | P1 (blocks store copy) |
| **Social profiles (bio links)** | Single canonical waitlist URL in Instagram/TikTok/LinkedIn bio link slots — same URL as everywhere else, no UTM-fragmented duplicate pages. | N/A (external) | P2 |
| **Email signature** | Team email signatures linking to the waitlist page during the gated period — low effort, non-zero reach given this is a founder-led product. | N/A (external, email client config) | P3 |
| **OG / Twitter card metadata** | The `/coachs` page already establishes the pattern to copy exactly (`generateMetadata` with `openGraph.images`, `alternates.languages` for fr/en, canonical per locale) — the waitlist page needs its own dedicated `og-waitlist.png` (or reuse `og-coachs.png` styling) showing the founder-offer hook visually, since link shares (social, Discord, Slack) are a primary distribution channel for a waitlist and the card is the only "hero" most viewers will ever see. | New route's `page.tsx` `generateMetadata`, new `public/og-waitlist.png` asset | P1 |
| **QR code (physical/offline)** | For any physical presence (gym partnerships, events, printed material — consistent with a founder-led fitness product), a QR code encoding the canonical waitlist URL. Generate once the URL is finalized; point it at the root waitlist URL, not a UTM-heavy variant, so it stays valid if campaigns change. Not a codebase change — an asset to produce once the route exists. | N/A (external asset) | P3 |

### Route naming recommendation
Given this is a French-primary bilingual site (existing pattern: FR clean URLs via `next-intl`, EN gets an `/en/` prefix — confirmed in `PROJECT.md` v1.0 requirements and the `/coachs` page's `alternates.languages: { fr: '/fr/coachs', en: '/en/coachs' }` pattern):

- **Recommended: `/fondateurs`** (FR) / `/en/founders` (EN, if next-intl route translation is configured) — or simply `/fondateurs` for both locales if the codebase doesn't translate route segments (need to check `next-intl` routing config for whether pathnames are localized; the existing `/coachs` route does **not** appear to have a translated segment, e.g. `/coachs` not `/coachs-fr` vs `/coaches`, suggesting route slugs are kept in French even on `/en/` prefixed URLs).
- **Why not `/waitlist`:** English jargon on a French-primary consumer marketing URL is inconsistent with the site's established convention (`/coachs`, `/mentions-legales`, `/politique-de-confidentialite`, `/cgu` are all French).
- **Why not `/acces-anticipe`:** technically accurate ("early access") but undersells the actual hook — the founder/lifetime offer is the conversion driver, not the "early access" framing, and the URL itself is free real estate to reinforce that. `/fondateurs` (founders) directly names the offer.
- **Should this replace the home hero, or be a separate route?** **Separate route**, not a home-hero replacement. Reasoning: (a) the home page already serves a dual job of pitching the product broadly and driving coach signups via `/coachs` — collapsing everything into one gated hero would break the existing `/coachs` funnel and the app-store CTAs that still need to say something coherent once access opens; (b) a dedicated route is what every credible benchmark used (Arc, Linear, Robinhood, Superhuman all had a distinct page, not a home-page takeover) — it's also what makes a clean, dedicated OG card and QR code possible; (c) it keeps the "gated" state reversible — killing the waitlist page after founder-wave signups close is a one-route change, not a home-page revert.

---

## 5. Categorization: Table Stakes / Differentiators / Anti-Features

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Single-field-first email capture (role selector as a UI interaction, not a form field) | Every credible benchmark reduces the ask to essentially one field; the codebase's dual-audience requirement is met by presentation, not by asking for more data | LOW | Client toggle state, matches existing `HeroClient`-style pattern |
| Above-the-fold CTA, no site nav distraction in the capture zone | Universal pattern across every source reviewed | LOW | New route can omit the sticky `Header` (compare `(marketing)` layout precedent already isolating coach routes from the header) |
| Mobile-first responsive layout | Table stakes for any 2026 marketing page; existing site is already responsive | LOW | Reuse existing Tailwind v4 token system |
| FR/EN i18n via `next-intl`, SSG (`generateStaticParams` + `setRequestLocale`) | Established site-wide convention (`/coachs` pattern), non-negotiable per `PROJECT.md` constraints | LOW–MEDIUM | Directly copy `coachs/page.tsx` structure |
| OG/Twitter card metadata per locale | Required for any link shared socially; `/coachs` page already sets the precedent | LOW | Copy `generateMetadata` pattern, new `og-fondateurs.png` |
| Inline post-submit success state confirming the offer was claimed | Users need to know the action worked; explicitly in scope per milestone brief | LOW | No email/queue-position infra needed — pure UI state |
| Footer legal links (CGU, mentions légales, politique de confidentialité) | Site-wide requirement, RGPD/LCEN compliance already established | LOW | Reuse existing `Footer`/`FooterClient` |
| Stated, fixed cap for the founder offer ("first 200") | Every credible lifetime-offer example states the cap as fact; a vague or moving cap is read as dishonest | LOW | Copy-only if counter itself is deferred (see §3) |

### Differentiators (Where This Page Can Win)

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Real product screenshots/short clip as hero visual (not an illustration) | Ziko is a live, shipped product — most benchmarks (Arc, Linear, Superhuman) had to fake credibility with copy alone because they had no product yet; Ziko can show the real mobile app + coach dashboard, which is a stronger trust signal than any of them had access to | LOW–MEDIUM | Reuse assets from mobile UX v2 (v1.7) screens |
| Role-aware offer copy under a single toggle (athlete vs coach framing of "lifetime premium") | Personalizes the pitch without a second page or extra field; directly addresses the milestone's core UX tension | MEDIUM | Client-side copy swap keyed to the role toggle state |
| Founder story reuse from `/coachs` (`CoachsFounderSection`) | Authenticity signal already built and proven for the coach audience; extending it to a general audience costs little and reinforces one consistent founder voice across the site | LOW | Content reuse, may need broader (non-coach-specific) framing |
| "X spots remaining" counter, introduced only past a believable threshold | Turns the scarcity mechanic into a real, honest lever once it can work in Ziko's favor instead of against it | LOW (data model) / feature-flag to reveal | See §3 — build the count field now, gate the UI reveal |
| Dedicated `/fondateurs` route with its own OG card and QR-friendly short URL | Enables clean, durable link-sharing across every entry point (stores, socials, print) without depending on the home page's more complex, multi-purpose OG story | LOW | New route + new asset |

### Anti-Features (Seem Good, Actually Backfire)

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Ascending "X / 200 claimed" live counter at launch | Feels like transparent, real-time social proof | At low real numbers (the actual state at launch) it signals unpopularity, not exclusivity — directly undermines the founder-offer pitch it sits next to | Static "first 200" cap statement now; live "X remaining" counter only past a believable threshold (§3) |
| Fake or seeded counter numbers | Tempting shortcut to avoid the cold-start problem | Universally flagged across sources as trust-destroying the moment a user notices inconsistency (reload, screenshot compare); also a straightforward reputational/ethical risk for a founder-led brand | Ship without a number; lean on the stated cap + founder credibility + real product screenshots instead |
| Fake/reused countdown timer (e.g., a timer that resets on reload) | Classic urgency lever, "everyone does it" | Detected instantly by users, actively destroys brand trust; this milestone has no real time-bound event to anchor a truthful countdown to (waves are access-based, not date-based) | No countdown; scarcity comes from the fixed 200-seat cap alone, which is real and doesn't need a clock |
| Forced social share to advance in queue / unlock access | Robinhood/Superhuman-style referral virality is proven to work at scale | Explicitly out of scope this milestone (no referral system); building it now adds infra (queue position tracking, referral attribution) the brief deliberately deferred — premature complexity | Ship the flat single-wave signup now; revisit referral mechanics as an explicit future milestone once there's a real user base to reference |
| Exit-intent popup on the waitlist page itself | "Catch abandoning visitors" — cited to recover up to 15% of otherwise-lost signups in isolated tests | On a page whose entire purpose already is the capture form, a popup competing with the primary CTA is redundant friction, and a generic "don't miss out" popup with no new information reads as noise, not help, especially layered onto an already-clear offer | If needed at all, use a single well-placed inline CTA repeat further down the page instead — not an interruption pattern |
| Asking for extra data upfront (name, phone, fitness goals, etc., beyond role + email) | "More data = better segmentation for launch" | Every extra field measurably reduces conversion; this milestone explicitly scopes to "store the email" only — anything more is unvalidated scope creep at the exact moment friction matters most (cold, unproven offer) | Email + role only now; collect richer profile data during onboarding once the user is actually let into the product |
| A second, separate page/route per role (`/fondateurs/athlete`, `/fondateurs/coach`) | Feels like cleaner separation of concerns per audience | Doubles translation, OG metadata, and maintenance burden for zero benefit — the milestone brief is explicit that this is meant to be **one page** with a selector, not two funnels | Single route, client-side role toggle (see §1 form placement) |
| Confirmation email in this milestone | Feels incomplete without one | Explicitly out of scope per brief; building transactional email now (templates, deliverability, `@ziko/email` wiring) is real infra the milestone deliberately deferred | Inline success state carries the full confirmation; email is a clean, well-bounded fast-follow later |

---

## 6. Feature Dependencies

```
Role selector (athlete/coach toggle)
    └──precedes──> Email capture field (progressive disclosure)
                       └──feeds──> Signup record with role (data model, not UI)

Founder-offer cap statement (static copy: "first 200")
    └──requires──> Signup count field in data model (even if UI is hidden)
                       └──unlocks (later, feature-flagged)──> Live "X remaining" counter

Dedicated /fondateurs route
    └──requires──> OG metadata + og-fondateurs.png asset
                       └──enables──> QR code generation, social bio links, store descriptions pointing at a stable URL

Home header CTA + Hero CTAs + /coachs CTAs repointed to /fondateurs
    └──conflicts with──> Leaving /coach/dashboard or open coach-signup flows live during the gated period
                              (if access truly is gated, existing open signup paths must be redirected or disabled, not left dangling)
```

### Dependency Notes

- **Role selector precedes email capture:** this ordering (not a same-screen dropdown) is what makes a 2-field form feel like a 1-field form — sequencing, not field count, is the lever.
- **Founder-offer cap statement requires a signup count field in the data model even if the UI counter is deferred:** building the count field now costs nothing and avoids a schema migration later purely to enable a UI toggle — this should be a P1 build decision even though the counter *UI* itself is P2/deferred.
- **Repointing existing CTAs conflicts with leaving old flows live:** since coach signup (`/coach/dashboard`, `/coach/onboarding`) currently exists and presumably still works, gating access via a waitlist page only works if those entry points are actually redirected during the gated period — otherwise the waitlist page is bypassable and the founder-offer scarcity is undermined by a live back door. This is a cross-cutting concern the roadmapper needs to resolve explicitly (redirect vs. feature-flag vs. leave-as-is-because-still-only-known-to-existing-users).

---

## 7. MVP Definition

### Launch With (v1 — this milestone)

- [ ] Dedicated `/fondateurs` (or equivalent FR-first) route, single page, FR/EN via `next-intl`, SSG
- [ ] Role toggle (athlete/coach) preceding a single email field — progressive disclosure, not a multi-field form
- [ ] Founder offer stated as a fixed fact ("first 200 members, lifetime premium, free forever") — no live counter UI
- [ ] Signup count persisted in the data model (even though the counter UI is deferred) — cheap now, expensive to retrofit
- [ ] Inline post-submit success state confirming email stored + offer status, no email/queue infra
- [ ] Real product screenshots as hero visual (mobile + coach dashboard)
- [ ] OG/Twitter card metadata + dedicated share image
- [ ] Header CTA, Hero CTA(s), and `/coachs` CTA(s) repointed to the new route
- [ ] Footer link to the new route

### Add After Validation (v1.x)

- [ ] Live "X spots remaining" counter, revealed once signups cross a believable threshold (~10–15% of cap) — feature-flag toggle on top of the v1 data model
- [ ] Recent-signup activity toast ("Marie just became a founding member") as a lower-risk alternative/complement to an aggregate counter
- [ ] Confirmation email (transactional, via existing `@ziko/email` package pattern)
- [ ] Minimal CGV addendum specifically covering the lifetime-premium commercial promise

### Future Consideration (v2+)

- [ ] Referral/queue-jump mechanic (Robinhood/Superhuman pattern) — high leverage but real infra (queue position, attribution, leaderboard) and explicitly deferred by the brief
- [ ] Sticky site-wide banner promoting the founder offer across all marketing pages
- [ ] QR code + printed/offline distribution assets
- [ ] Post-qualification survey (Superhuman pattern) if the founder wave needs finer-grained screening than role alone

---

## 8. Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Single-page role toggle + email capture | HIGH | LOW | P1 |
| Static founder-offer cap statement | HIGH | LOW | P1 |
| Signup count data model (UI hidden) | MEDIUM (unlocks P2 later) | LOW | P1 |
| Real product screenshots hero | HIGH | LOW–MEDIUM | P1 |
| OG/Twitter metadata + share image | HIGH (distribution) | LOW | P1 |
| Repoint existing CTAs (Header, Hero, /coachs) | HIGH (this is the whole "entry points" requirement) | LOW | P1 |
| Inline success state | MEDIUM | LOW | P1 |
| Live "X remaining" counter (threshold-gated) | MEDIUM | LOW (flag on existing data) | P2 |
| Sticky banner | MEDIUM | LOW | P2 |
| Footer link | LOW | LOW | P2 |
| QR code | LOW | LOW (external asset) | P3 |
| Confirmation email | MEDIUM | MEDIUM | P3 (post-milestone) |
| Referral/queue mechanic | HIGH (long-run growth) | HIGH | P3 (future milestone) |

---

## Sources

**Benchmark case studies (cross-corroborated, MEDIUM confidence):**
- [Superhuman Waitlist Case Study — Waitlister](https://waitlister.me/growth-hub/case-studies/superhuman)
- [How Superhuman Grows — Jaryd Hermann](https://www.howtheygrow.co/p/how-superhuman-grows)
- [Superhuman's Go-To-Market Brilliance — Mike Marg](https://earlygtm.substack.com/p/superhumans-go-to-market-brilliance)
- [Robinhood Referral Program — Prefinery](https://www.prefinery.com/blog/referral-programs/prelaunch-campaign/robinhood/)
- [How Robinhood's Referral Program Built a Million-User Waiting List — Viral Loops](https://viral-loops.com/blog/how-robinhoods-referral-built-a-1m-user/)
- [How Robinhood Got a Million People on Their Waitlist — Waitlister](https://waitlister.me/growth-hub/case-studies/robinhood)
- [Arc Browser waitlist / launch — Flowjam](https://www.flowjam.com/blog/waitlist-landing-page-examples-10-high-converting-pre-launch-designs-how-to-build-yours)
- [What Is the Arc Browser — CMSWire](https://www.cmswire.com/digital-experience/what-is-the-arc-browser-and-can-it-replace-chrome/)
- [Arc Browser is now available to download for everyone — TechCrunch](https://techcrunch.com/2023/07/25/arc-browser-is-now-available-to-download-for-everyone)
- [Linear App Case Study — Eleken](https://www.eleken.co/blog-posts/linear-app-case-study)
- [This Startup Went from 10,000 Waitlist Signups to a $400M Valuation — Growth Letter](https://www.growth-letter.com/p/this-startup-had-10000-people-on)
- [How Clubhouse Built a 10M-Person Waitlist — Waitlister](https://waitlister.me/growth-hub/case-studies/club-house)
- [Clubhouse no longer invite-only — 9to5Mac](https://9to5mac.com/2021/07/21/clubhouse-no-longer-invite-only-as-waitlist-reportedly-nears-10-million-people/)
- [Perplexity launches Comet — TechCrunch](https://techcrunch.com/2025/07/09/perplexity-launches-comet-an-ai-powered-web-browser/)
- [Skip the Waitlist: PayPal/Venmo x Perplexity Comet — PayPal Newsroom](https://newsroom.paypal-corp.com/2025-09-03-Skip-the-Waitlist-PayPal-and-Venmo-Users-Offered-Early-Access-to-Perplexitys-New-Comet-Browser-with-Free-Perplexity-Pro-Subscription)
- [Dia Browser coming to Windows — Ground News](https://ground.news/article/perplexity-employee-who-worked-on-comet-launches-an-ai-browser-aimed-at-knowledge-work)
- [WHOOP waitlist page](https://www.whoop.com/eu/en/waitlist/) — LOW confidence, single source
- [FASE Lagree Founding 100](https://faselagree.com/founding-100/)
- [Reclaim Fitness Studio Founding Members](https://reclaimfitnessstudio.com/founding-members-1)

**Page anatomy / conversion patterns (MEDIUM confidence, 5+ independent sources cross-checked):**
- [How To Design A High-Converting Waitlist Landing Page — GetResponse](https://www.getresponse.com/blog/waitlist-landing-page)
- [15 Waitlist Landing Page Examples That Convert — LaunchList](https://getlaunchlist.com/blog/waitlist-landing-page-examples-that-convert)
- [Waitlist Landing Page Examples: 7 That Convert at 20% — Flowjam](https://www.flowjam.com/blog/waitlist-landing-page-examples-10-high-converting-pre-launch-designs-how-to-build-yours)
- [How to Build a High-Converting Landing Page — CXL](https://cxl.com/blog/how-to-build-a-high-converting-landing-page/)
- [Landing Page CTA Button: 15 Tips That Convert — Apexure](https://www.apexure.com/blog/landing-page-call-to-action-button-tips)
- [The Best CTA Placement Strategies For 2026 Landing Pages — LandingPageFlow](https://www.landingpageflow.com/post/best-cta-placement-strategies-for-landing-pages)
- [How to Build a Waitlist Landing Page That Converts — FreeWaitlists](https://freewaitlists.com/blog/waitlist-landing-page-best-practices)

**Counter / scarcity psychology (MEDIUM confidence, triangulated, no single authoritative study found):**
- [The Psychology Behind a Waitlist That Converts — GetWaitlist](https://getwaitlist.com/blog/psychology-behind-waitlist-that-converts)
- [Waitlist-Landing Pages in 2026 — Unicorn Platform](https://unicornplatform.com/blog/waitlist-landing-page/)
- [Scarcity principle at work: when "3 spots left" backfires — Sue Behavioural Design](https://www.suebehaviouraldesign.com/en/blog/scarcity-principle-at-work/)
- [How Limited Seats Available Messages Rapidly Boost Sales — WiserNotify](https://wisernotify.com/blog/limited-seating-available/)
- [Social Proof: Definition, Types, Examples — CXL](https://cxl.com/blog/is-social-proof-really-that-important/)
- [Social Proof on Landing Pages — ProveSource](https://provesrc.com/blog/social-proof-landing-pages-best-practices/)

**Anti-patterns (MEDIUM confidence, consistent across sources):**
- [I Tested 14 Exit Intent Popups — WiserNotify](https://wisernotify.com/blog/exit-intent-popup-examples/)
- [How to Write a Waitlist Page That Actually Builds Hype — ProblemPop](https://www.problempop.io/blog-posts/how-to-write-a-waitlist-page-that-actually-builds-hype)
- [Waitlist-Landing Pages in 2026: A Practical System — Unicorn Platform](https://unicornplatform.com/blog/waitlist-landing-page/)

**Lifetime deal post-mortems (MEDIUM confidence, 3 independent founder-authored sources):**
- [Lifetime Deals and SaaS Businesses — The Bootstrapped Founder](https://thebootstrappedfounder.com/lifetime-deals-and-saas-businesses/)
- [AppSumo Lifetime Deals: Worth It or Revenue Killer? — F³ Fund It](https://f3fundit.com/appsumo-lifetime-deals-worth-it-or-revenue-killer/)
- [Turn Lifetime Deals Into an Asset, Not a Liability — SaaS Club](https://saasclub.io/playbooks/george-georgiadis-lifetime-deals-framework/)

**Codebase sources read for this research:**
- `.planning/PROJECT.md`
- `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx`
- `apps/web/src/components/marketing/CoachsHero.tsx`, `CoachsFounderSection.tsx`, `Hero.tsx`
- `apps/web/src/components/layout/HeaderClient.tsx`, `FooterClient.tsx`

---
*Feature research for: public waitlist / early-access landing page, dual-audience, founder lifetime offer*
*Researched: 2026-08-12*
