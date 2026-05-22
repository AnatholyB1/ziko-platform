# Phase 31: Public Marketing /coachs — Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Milestone:** v1.5 — Coach Platform & CRM
**Depends on:** Phase 24 (coach onboarding URL stable); parallel with Phases 25–30

<domain>
## Phase Boundary

Phase 31 delivers a **static FR+EN marketing landing page** at `/coachs` (FR) and `/en/coachs` (EN) on ziko-app.com. Target audience: fitness coaches who have never heard of Ziko. Goal: explain the coach offer and convert to a private beta signup.

**In scope (MKT-01..06):**
- `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx` + `generateStaticParams`
- Hero section with headline + subtitle + CTA + pricing badge
- 4 feature blocks (CRM, AI, Programs, ERP roadmap)
- Placeholder video section (branded frame + play icon)
- Comparison table vs Trainerize / TrueCoach (3 feature rows)
- Founder / mission section (placeholder with TODO for real content)
- FAQ section
- Existing marketing layout (Header/Footer already provided)
- `next-intl` keys for all copy (FR + EN)
- OG metadata + `setRequestLocale`

**Out of scope:**
- Actual 60s demo video (deferred — placeholder ships instead)
- Testimonials (no social proof yet in beta)
- Pricing page (no pricing in v1.5 beta)
- Backend changes (pure static page, no new routes)

</domain>

<decisions>
## Implementation Decisions

### Hero Section
- **D-01 — Headline: "La CRM coaching à l'IA" (FR) / "The AI-powered coaching CRM" (EN).**  
  Direct product positioning — coaches immediately know what it is. Subtitle explains the ERP roadmap and beta context.

- **D-02 — Pricing callout in hero, not in comparison table.**  
  "Rejoindre la bêta privée — 100% gratuit" / "Join the private beta — 100% free" as a badge or subtitle near the CTA button. Pricing visible without a price-war table. No pricing column in the comparison table.

- **D-03 — CTA links to `/coach/onboarding` (existing route from Phase 24).**  
  No new route needed. Button text: "Rejoindre la bêta privée" (FR) / "Join the private beta" (EN).

### Feature Blocks
- **D-04 — 4 feature blocks in this order:**
  1. **Client CRM** — Browse roster, drill into client data (sessions, measurements, sleep, nutrition, RPE, habits, cardio) read-only. Core differentiation.
  2. **AI-powered analysis** — Ask the AI to analyze a client, generate a coaching program, or flag at-risk clients. Built-in coach intelligence.
  3. **Coaching programs** — Build multi-week templates, assign to linked clients, track weekly compliance. The operational core for serious coaches.
  4. **From CRM to coaching ERP** — Forward-looking block. Ziko starts as a full modular AI-native CRM. Coming: scheduling, billing, business management. Built to grow with your coaching business.

### Demo Video Section
- **D-05 — Placeholder frame at launch. Real video not ready.**  
  Branded placeholder: dark/orange gradient frame (`#FF5C1A` primary), centered Ziko logo, play button icon, caption "Démo bientôt disponible" (FR) / "Demo coming soon" (EN). Section exists in the page; easy swap when the real video is produced.

### Comparison Table
- **D-06 — Honest + direct tone. Competitors named explicitly.**  
  Name Trainerize and TrueCoach in column headers. Be factual, not snarky.

- **D-07 — 3 feature rows in the comparison table:**
  1. **AI-native tools** — Ziko: ✓ (client analysis + program generation built-in) | Trainerize: ✗ | TrueCoach: ✗
  2. **Client data depth** — Ziko: ✓ (sleep, nutrition, RPE, cardio, habits — automatic from athlete app) | Trainerize: manual input | TrueCoach: manual input
  3. **Integrated athlete mobile app** — Ziko: ✓ (full-featured, included) | Trainerize: ✓ (basic) | TrueCoach: limited

### Founder / Mission Section
- **D-08 — Real content intended but not yet provided by user.**  
  Implementation MUST ship a placeholder (name, photo placeholder, one-liner quote) with a clear `// TODO: replace with real founder content` comment. User said they'll provide the real name, story, and photo before the page goes live. The section MUST exist in the DOM — do not skip it.

- **D-09 — Section copy anchor: "Built by athletes, for coaches."**  
  This is the mission tagline. The founder story should connect to personal experience as an athlete and why they built Ziko.

### Page Architecture
- **D-10 — New file: `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx`.**  
  Uses existing `(marketing)` layout (Header + Footer already provided). No new layout file needed.

- **D-11 — SSG: `generateStaticParams` + `setRequestLocale`.**  
  Same pattern as all other marketing pages. Two locales: `['fr', 'en']`.

- **D-12 — `next-intl` keys namespace: `coachs.*`.**  
  All user-facing strings extracted to translation files. Planner should specify all keys in the plan.

### Claude's Discretion
- Exact Tailwind layout, spacing, and typography within the existing marketing site aesthetic
- FAQ questions and answers (standard coach tool FAQ: "What data does my client need to share?", "Is it free?", "What platforms does the athlete app run on?", etc.)
- OG metadata title/description copy
- Section ordering (hero → video → feature blocks → comparison → founder → FAQ → CTA footer) — planner can reorder for conversion optimization

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + Requirements
- `.planning/ROADMAP.md` §Phase 31 — 4 success criteria, MKT-01..06 mapping
- `.planning/REQUIREMENTS.md` §Public Marketing (MKT-01..06)

### Existing Marketing Pages (clone pattern)
- `apps/web/src/app/[locale]/(marketing)/page.tsx` — home page: SSG pattern, `generateStaticParams`, `setRequestLocale`, existing section components to reuse or extend
- `apps/web/src/app/[locale]/(marketing)/layout.tsx` — marketing layout providing Header + Footer automatically

### Coach Routes (CTA target)
- `apps/web/src/app/[locale]/(coach)/coach/onboarding/page.tsx` — target of "Rejoindre la bêta privée" CTA; confirm the route is stable

### Design Reference
- `.planning/mockups/Ziko-Onboarding.html` — Phase 24 canonical mockup; establishes the design language for coach-facing surfaces (colors, typography, card style)

### i18n
- `apps/web/messages/fr.json` — add `coachs.*` namespace keys here
- `apps/web/messages/en.json` — add `coachs.*` namespace keys here

### Architecture
- `.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-CONTEXT.md` — D-15: `force-dynamic` is NOT needed on static (marketing) pages; SSG is the correct pattern here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/app/[locale]/(marketing)/page.tsx` — full SSG marketing page; `coachs/page.tsx` is a sibling file with the same shell (imports, `generateStaticParams`, `setRequestLocale`, metadata export)
- `apps/web/src/app/[locale]/(marketing)/layout.tsx` — provides Header + Footer; new page inherits both for free, no layout changes needed
- Existing Tailwind classes and design tokens from the marketing homepage apply directly — no new CSS needed

### Established Patterns
- **SSG:** `export async function generateStaticParams() { return [{locale: 'fr'}, {locale: 'en'}] }` + `setRequestLocale(locale)` at top of component
- **Metadata:** `export async function generateMetadata({ params })` — async, reads locale, returns `{ title, description, openGraph }` with self-hosted image
- **`next-intl`:** `const t = useTranslations('coachs')` — all copy via `t('key')`; no hardcoded strings

### Integration Points
- **`apps/web/messages/fr.json` + `en.json`** — add `"coachs": { ... }` namespace; planner should enumerate all keys
- **`/coach/onboarding` route** — CTA target; no changes needed, just link to it
- **No backend changes** — purely static marketing page

</code_context>

<specifics>
## Specific Ideas

- Hero badge: small pill badge above the headline — "Bêta privée · 100% gratuit" in `#FF5C1A` background, white text — draws the eye before the headline
- Comparison table: Ziko column highlighted with `#FF5C1A` left border or subtle orange background to make it stand out
- Feature block 4 (ERP roadmap): use a "Coming soon" or "Roadmap" tag on the block to be honest about what's future state — avoids overpromising
- Video placeholder: `aspect-video` container, `bg-gradient-to-br from-gray-900 to-orange-900`, centered Ziko logo at 64px, play icon circle with 50% opacity white, caption below in `text-sm text-gray-400`
- Founder section: `<blockquote>` styled with a large left orange border — quote on the left, founder photo (64px circle avatar placeholder) + name + title on the right

</specifics>

<deferred>
## Deferred Ideas

- **Real demo video** — user will produce a 60s CRM demo video; placeholder ships now, video is swapped in when ready
- **Testimonials section** — no social proof in private beta; add in v1.6 when first coaches have shipped results
- **Pricing page** — no pricing model finalized for post-beta; CTA says "free in beta" only
- **Founder photo** — user to provide name, story, and photo before go-live; placeholder avatar ships in Phase 31

</deferred>

---

*Phase: 31-public-marketing-coachs*
*Context gathered: 2026-05-22*
