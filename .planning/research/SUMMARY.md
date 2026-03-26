# Project Research Summary

**Project:** Ziko Platform — Marketing Site (ziko-web)
**Domain:** Next.js marketing site with FR/EN i18n, French legal compliance, and RGPD self-service account deletion
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

The Ziko marketing site is a standalone Next.js 15 / App Router project deployed on Vercel, completely separate from the existing Turborepo monorepo. This is the correct decision: NativeWind (used in the mobile app) requires Tailwind v3, while modern Next.js projects should use Tailwind v4 — a hard version conflict that makes colocation impossible. The site is a static marketing and compliance asset: a hero section, a plugin showcase, legal pages, and a RGPD-compliant self-service account deletion form. There is no user authentication, no blog, no CMS, and no dynamic runtime content in Milestone 1.

The recommended approach is a maximally static architecture where every page — including legal pages and the account deletion shell — is statically generated at build time and served from Vercel's CDN edge. The only server-side computation at runtime is the `deleteAccount` Server Action, which calls the Supabase admin API with a service role key that must never reach the client bundle. The `next-intl` v4 library handles FR/EN routing with French as the default locale and clean (prefix-free) French URLs. All text is externalized into translation files from day one — retrofitting i18n later is prohibitively expensive.

The dominant risks are legal (not technical): three French law pages are legally mandatory under penalty of up to €375,000 and the RGPD self-service deletion endpoint must exist before the app goes public. On the technical side, the single highest-severity risk is the Supabase service role key being accidentally bundled into client JavaScript — prevented by adding `import 'server-only'` to the admin client module and never using a `NEXT_PUBLIC_` prefix on the key. The second-highest risk is `setRequestLocale` being omitted from one or more route segments, which silently forces the entire site into dynamic rendering and drives up Vercel function costs.

## Key Findings

### Recommended Stack

The site bootstraps with `create-next-app` using Next.js 15 (not 16 — the ecosystem for next-intl, shadcn, and tooling is more battle-tested against v15), React 19, TypeScript 5, and Tailwind v4. The CSS-first configuration in Tailwind v4 (`@theme` directive in `globals.css`, no `tailwind.config.js`) maps cleanly to Ziko's design tokens (`#FF5C1A` primary, `#F7F6F3` background). `next-intl` v4 is the de-facto standard for App Router i18n; v4 is ESM-only, has strict locale typing, and no longer requires the `messages` prop to be manually passed to `NextIntlClientProvider`. Supabase `@supabase/supabase-js` v2 is used only in a server action via the service role key — `@supabase/ssr` is deferred to Milestone 2 (coach CRM). `react-hook-form` + `zod` + `@hookform/resolvers` covers the single interactive form in the site. No state management library, no CMS, no ORM, no auth library.

**Core technologies:**
- Next.js 15 (App Router): framework — stable, ecosystem aligned, SSG-first
- Tailwind CSS v4: styling — CSS-first config, 70% smaller production CSS, design tokens in `globals.css`
- next-intl v4: FR/EN i18n routing — App Router native, strict locale typing, auto-inherited messages
- `@supabase/supabase-js` v2 (server-only): account deletion — admin API requires service role key, server-side only
- react-hook-form v7 + zod v3: deletion form — lightweight, uncontrolled, shared client/server validation

**Critical version requirements:**
- `next-intl` must be v4.x (v3 and earlier do not support Next.js 15 / React 19 properly)
- Do NOT use `@supabase/auth-helpers-nextjs` — deprecated, replaced by `@supabase/ssr`
- Do NOT add `framer-motion` (40+ KB bundle cost on a 5-page marketing site)
- Do NOT add `shadcn/ui` for Milestone 1 — reserve for Milestone 2 coach CRM dashboard

### Expected Features

The MVP is defined by French legal requirements as much as product requirements. Three legal pages (mentions légales, politique de confidentialité, CGU) and a self-service account deletion form are mandatory for any French commercial site. Missing mentions légales alone carries a penalty of up to €375,000. The RGPD self-service deletion form is required before app launch (droit à l'effacement, Art. 17).

**Must have (table stakes / legally required):**
- Hero section: headline, app mockup, App Store + Play Store CTAs — converts visitors
- Plugin showcase: 17 plugins grouped in 4-5 categories (not a flat list) — informs visitors
- Pricing section: free tier card with "Download free" CTA — removes friction
- FR/EN i18n (next-intl): stated requirement; cannot be retrofitted cheaply post-launch
- Mentions légales page: legally mandatory under LCEN 2004; penalty up to €375,000
- Politique de confidentialité (RGPD): legally mandatory when processing personal data
- CGU page: strongly recommended; required before any account creation in app
- Self-service account deletion: RGPD Art. 17 compliance; must be live before app launch
- Footer with links to all legal pages: LCEN requires accessibility from every page
- Vercel deployment + custom domain: prerequisite to "going live"

**Should have (competitive / polish):**
- Social proof / testimonials — add once real user reviews exist
- Animated scroll reveals (CSS transitions, not Framer Motion) — polish post-launch
- Cookie consent banner — only if cookie-based analytics are added; use Plausible to avoid this

**Defer (v2+):**
- Individual plugin landing pages (SEO) — high content work, low immediate ROI
- Blog / content marketing — explicitly out of scope per PROJECT.md
- Coach CRM under `/coach` — Milestone 2 per PROJECT.md
- Interactive AI demo — significant engineering investment, not worth it for marketing

### Architecture Approach

The site is entirely static except for one POST endpoint. All pages — homepage, legal pages, the account deletion page shell — are Server Components statically generated at build time via `generateStaticParams` returning `[{ locale: 'fr' }, { locale: 'en' }]`. The account deletion page's HTML is also static; only the form POST invokes the `deleteAccount` Server Action at runtime. The locale routing uses `localePrefix: 'as-needed'` so French URLs are clean (`/politique-de-confidentialite`) while English gets the prefix (`/en/privacy`). A single admin Supabase client in `lib/supabase/admin.ts` guarded with `import 'server-only'` handles the deletion lookup and call.

**Major components:**
1. `middleware.ts` (project root) — locale detection via next-intl; must use exact matcher pattern to exclude static assets
2. `src/app/[locale]/` — all pages and layouts; every segment calls `setRequestLocale(locale)` for static rendering
3. `src/actions/account.ts` (Server Action) — Zod validation → Supabase admin lookup → `deleteUser`; rate limiting per IP
4. `src/lib/supabase/admin.ts` — `createAdminClient()` with `import 'server-only'`; only imported in server action
5. `src/components/account/DeleteAccountForm.tsx` (Client Component) — `useActionState(deleteAccount, ...)` for form state
6. `messages/fr.json` + `messages/en.json` — all translated strings; externalizing from day one is non-negotiable
7. `src/i18n/routing.ts` / `request.ts` / `navigation.ts` — single source of truth for locale config

### Critical Pitfalls

1. **Service role key in client bundle** — add `import 'server-only'` to `lib/supabase/admin.ts`; never prefix the env var with `NEXT_PUBLIC_`; verify the built `.next/` artifacts do not contain the key value. Recovery is high cost (key rotation + redeploy).

2. **`setRequestLocale` missing on any route segment** — causes the entire site to fall back to dynamic rendering; Vercel function invocations spike; visible in `next build` output (`ƒ` vs `○`). Call it as the first line in every `[locale]/layout.tsx` and `[locale]/page.tsx`, and always pair with `generateStaticParams`.

3. **`useTranslations` called in async Server Components** — use `getTranslations` (from `'next-intl/server'`) in async components; use `useTranslations` only in sync server components and client components. Establish this pattern in Phase 1.

4. **Account deletion action without rate limiting** — server actions are public POST endpoints; without IP-based rate limiting an attacker can enumerate accounts. Add Upstash/Vercel KV rate limiting (5 requests/min per IP) from day one.

5. **Mentions légales with incomplete legal data** — the page requires real SIRET, physical address, publication director name, and Vercel's hosting details. It cannot be finished without the operator providing this data. Identify this as a blocking dependency in Phase 2.

6. **Middleware matcher misconfigured** — if the matcher is too broad, locale middleware intercepts `/favicon.ico`, `/_next/static/`, and API routes; use the exact next-intl recommended pattern unchanged.

7. **Google Fonts from Google CDN** — transmitting user IPs to Google without consent is a CNIL violation; use `next/font` which self-hosts fonts from Vercel automatically.

## Implications for Roadmap

Based on research, the architecture research itself proposes a 5-phase build order that is strongly validated by the pitfalls and feature dependencies. It is adopted directly here with commentary.

### Phase 1: Foundation — Project Scaffold + i18n + Infra

**Rationale:** All pitfalls in the "Phase 1" category (service role key exposure, `setRequestLocale` missing, middleware matcher, `useTranslations` in async components, Google Fonts CDN) must be resolved before any content or features are built. Getting i18n right at the start is mandatory — all four research files agree that retrofitting i18n is the most expensive technical mistake possible. Setting up the admin Supabase client with `import 'server-only'` now prevents the highest-severity security pitfall before any code touches it.

**Delivers:** Working locale routing (FR default, EN with `/en/` prefix), empty translated pages at `/` and `/en/`, admin Supabase client factory with `server-only` guard, Vercel project created with correct env var scopes, middleware with correct matcher, fonts self-hosted via `next/font`, `next build` output showing all `[locale]/*` routes as `○` (static).

**Addresses:** FR/EN i18n requirement, Vercel deployment foundation.
**Avoids:** Pitfalls 1 (service role key), 3 (`useTranslations` async), 4 (`setRequestLocale`), 8 (middleware matcher), Google Fonts CDN issue, env var scope mistakes.
**Research flag:** Standard patterns — skip `research-phase`. next-intl official docs are thorough and HIGH confidence.

### Phase 2: RGPD Compliance — Account Deletion + Legal Pages

**Rationale:** Legal compliance is a hard blocker for public launch. The deletion flow is the riskiest technical component (admin API, security surface, rate limiting) and must be validated against Supabase staging before building the marketing UI — this is explicitly recommended in ARCHITECTURE.md. Legal pages require business identity data from the operator (SIRET, address, publication director) which may take time to gather; starting this phase early surfaces that dependency early.

**Delivers:** `/account/delete` page with `DeleteAccountForm` Client Component + `deleteAccount` Server Action (Zod validation, admin lookup, rate limiting, anti-enumeration); trois legal pages (mentions légales, politique de confidentialité, CGU) fully populated with real legal data; footer with links to all legal pages; `metadataBase` set correctly for OG URLs.

**Addresses:** RGPD Art. 17 account deletion, LCEN mentions légales, RGPD privacy policy, CGU, footer legal links.
**Uses:** `@supabase/supabase-js` admin client, react-hook-form + zod, `useActionState`.
**Implements:** Server Action pattern, DeleteAccountForm Client Component, LegalLayout shared wrapper.
**Avoids:** Pitfalls 2 (account deletion security + rate limiting), 7 (incomplete mentions légales), 5 (`metadataBase`).
**Blocking dependency:** Operator must provide SIRET, physical address, publication director name, and email before legal pages can be finalized. Flag this as an external blocker.
**Research flag:** Account deletion security (rate limiting with Upstash/Vercel KV) may benefit from brief `research-phase` to confirm integration pattern. Legal page content is standard, no research needed.

### Phase 3: Marketing Content — Hero + Plugin Showcase + Pricing

**Rationale:** UI-only work with no external dependencies or security concerns. By this point the routing, translations, and Vercel deployment are verified, so content can be built with confidence. This phase requires real app screenshots from the Expo mobile app — identify and capture those before starting.

**Delivers:** Hero section (headline, app mockup in iPhone frame, App Store + Play Store CTA buttons using Ziko orange); plugin showcase (17 plugins in 4-5 category tabs, 3-column card grid, icon + name + 1-sentence description per plugin, all copy in both languages); pricing section (free tier card, "Download free" CTA); Open Graph metadata with production domain.

**Addresses:** Hero section, plugin showcase, pricing section, brand coherence with mobile app.
**Implements:** `Hero.tsx`, `Features.tsx`, `Pricing.tsx` landing components, `AppStoreBadge.tsx` UI component.
**Avoids:** Plugin list cognitive overload (grouping strategy), video background temptation, framer-motion bloat.
**Blocking dependency:** Real app screenshots required before hero mockup can be finalized. Plugin copy (17 names × 1-sentence description × 2 languages = 34 strings) must be written before this phase ships.
**Research flag:** Standard patterns — skip `research-phase`. Static marketing components are well-understood.

### Phase 4: SEO + Performance Hardening

**Rationale:** After content exists, verify performance characteristics and complete SEO metadata. This is validation work, not new features. Core Web Vitals (LCP from hero image, CLS from `next/image` without `sizes`, TTI from unnecessary Client Components) are all pitfall categories identified in research.

**Delivers:** `next/image` with correct `sizes` props and `priority` on hero; all pages verified as `○` static in build output; OG images confirmed using production domain URL; sitemap and robots.txt; all pages reviewed for unnecessary `'use client'` usage; Lighthouse score baseline established.

**Addresses:** Core Web Vitals, SEO discoverability.
**Avoids:** Pitfalls 5 (`metadataBase`), `next/image` `sizes` trap, LCP hero image not prioritized, forced dynamic rendering.
**Research flag:** Standard patterns — skip `research-phase`.

### Phase 5: Launch + Post-Launch Polish

**Rationale:** Final pre-launch checklist verification, custom domain DNS, and conditional post-launch polish. Cookie consent banner is only added if analytics are included — the recommendation is Plausible (cookieless) to avoid CNIL cookie banner complexity entirely.

**Delivers:** Custom domain live on Vercel with HTTPS; all items in the "Looks Done But Isn't" checklist from PITFALLS.md verified; decision made on analytics (Plausible recommended); social proof section scaffolded for when real reviews exist.

**Addresses:** Vercel deployment, custom domain, optional social proof.
**Avoids:** Pitfall 6 (CNIL Reject All button if analytics cookies are added), pre-consent analytics cookies firing.
**Research flag:** Standard patterns — skip `research-phase`.

### Phase Ordering Rationale

- i18n before content because retrofitting is the most expensive mistake possible (all four research files agree)
- Account deletion before marketing UI because it is the riskiest technical piece and must be validated against Supabase staging early
- Legal pages in Phase 2 (not last) because they have an external blocking dependency on operator-provided business identity data
- Marketing content in Phase 3 because it has its own external blocker (real app screenshots) that can be resolved in parallel with Phase 2
- SEO and performance hardening after content exists so there is something real to measure and optimize
- Launch verification last as a gate, not a phase of new development

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (account deletion rate limiting):** Upstash Redis / Vercel KV integration pattern for server actions may need a focused research pass. Not blocking but worth verifying the current recommended approach before implementing.

Phases with standard well-documented patterns (skip `research-phase`):
- **Phase 1:** next-intl App Router setup, Tailwind v4, Next.js 15 scaffold — all HIGH confidence official docs
- **Phase 3:** Static marketing components, `next/image` — standard React/Next.js patterns
- **Phase 4:** Core Web Vitals, SEO metadata — documented Next.js patterns
- **Phase 5:** Vercel domain setup, Plausible analytics — standard deployment steps

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified against official Next.js, next-intl, Supabase, and Tailwind docs. Version choices (Next.js 15, next-intl v4, Tailwind v4) are current and stable. |
| Features | HIGH | Legal requirements sourced from official CNIL and economie.gouv.fr guidance. Marketing feature patterns from industry analysis (Moosend, Unbounce). Legal penalties verified from primary French law sources. |
| Architecture | HIGH | All patterns sourced from official Next.js 15 and next-intl docs. Server Action patterns, `setRequestLocale`, and `generateStaticParams` confirmed in official references. |
| Pitfalls | HIGH | All critical pitfalls verified against official sources (Vercel blog, Next.js security docs, Supabase docs, CNIL guidance). `import 'server-only'` pattern for admin key confirmed in Next.js official security guidance. |

**Overall confidence:** HIGH

### Gaps to Address

- **Legal page content requires operator data:** Mentions légales cannot be finalized without SIRET, physical address, publication director name, phone number, and email from the business operator. This is an external dependency, not a research gap. Raise it explicitly in Phase 2 planning.

- **App screenshots not yet captured:** Hero mockup and plugin showcase rely on real screenshots from the Expo mobile app. These must be captured before Phase 3 content work begins. Plan a screenshot session as a Phase 3 prerequisite.

- **Plugin marketing copy not written:** 17 plugins × 1-sentence description × 2 languages = 34 strings must be authored before the plugin showcase can be populated. This is a content writing task, not an engineering task. Budget time for it in Phase 3.

- **Anthropic data processing agreement:** The RGPD privacy policy must disclose Anthropic as a data processor (AI coaching processes personal data). Confirm whether a Data Processing Agreement (DPA) with Anthropic exists or needs to be established before the privacy policy can be finalized.

- **Production domain:** The custom domain for the marketing site is not specified in research. Must be known before `NEXT_PUBLIC_SITE_URL` can be set in Vercel and before OG metadata is finalized.

- **Rate limiting choice (Phase 2):** The research recommends Upstash Redis or Vercel KV for server action rate limiting. A brief validation of the current recommended integration pattern (Vercel KV vs. Upstash) is warranted before Phase 2 implementation starts.

## Sources

### Primary (HIGH confidence)
- [next-intl.dev — App Router setup](https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing) — i18n routing, setRequestLocale, middleware, static rendering
- [next-intl v4.0 release blog](https://next-intl.dev/blog/next-intl-4-0) — breaking changes, ESM-only, auto-inherited messages
- [Supabase docs — auth.admin.deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) — admin API, service role key requirement
- [Supabase docs — service_role in server actions](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa) — import 'server-only' pattern
- [Tailwind CSS v4 + Next.js guide](https://tailwindcss.com/docs/guides/nextjs) — @tailwindcss/postcss setup, @theme directive
- [Next.js 15 stable release](https://nextjs.org/blog/next-15) — React 19, App Router stable
- [Next.js Server Actions security](https://nextjs.org/blog/security-nextjs-server-components-actions) — server action security patterns
- [CNIL — Droit à l'effacement](https://www.cnil.fr/fr/comprendre-mes-droits/le-droit-leffacement-supprimer-vos-donnees-en-ligne) — RGPD Art. 17 requirements
- [economie.gouv.fr — Mentions légales obligations](https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter) — LCEN mandatory fields and penalties
- [Vercel — Common mistakes with Next.js App Router](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them) — dynamic rendering, env vars, metadata

### Secondary (MEDIUM confidence)
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — reason to stay on 15 for ecosystem stability
- [CNIL — cookie consent RGPD en pratique](https://www.cnil.fr/fr/rgpd-en-pratique-communiquer-en-ligne) — cookie banner Reject All requirements
- [martin.avocat.fr — CGU/CGV/mentions légales differences](https://martin.avocat.fr/cgv-cgu-mentions-legales-differences/) — CGU required content
- [Makerkit — Next.js Server Actions vulnerabilities](https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions) — rate limiting, auth confirmation patterns
- [Pagepro — Common Next.js mistakes Core Web Vitals](https://pagepro.co/blog/common-nextjs-mistakes-core-web-vitals/) — image optimization, LCP pitfalls

### Tertiary (LOW confidence)
- [Supabase discussions #23144](https://github.com/orgs/supabase/discussions/23144) — admin deleteUser from server action pattern (community, needs verification at implementation)

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
