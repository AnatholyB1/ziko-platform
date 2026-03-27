# Roadmap: Ziko Web — v1.0 Landing Page

## Overview

Five phases take the Ziko web marketing site from an empty repo to a publicly-launched product. Phase 1 installs the technical foundation — i18n routing, design tokens, and the static rendering architecture — so that nothing built afterward needs to be retrofitted. Phase 2 ships all RGPD and French legal requirements before any marketing content, because the legal pages have an external blocking dependency (operator business identity data) that must be surfaced early. Phase 3 builds the three marketing sections (Hero, Plugin Showcase, Pricing) on top of the verified foundation. Phase 4 hardens SEO metadata and performance after content exists. Phase 5 throws the switch: custom domain live, final checklist passed, site public.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Next.js scaffold, i18n routing, design tokens, static rendering architecture, and Vercel infra baseline
- [ ] **Phase 2: RGPD Compliance** - Account deletion Server Action, all three French legal pages, and footer legal links
- [ ] **Phase 3: Marketing Content** - Hero section, Plugin Showcase, and Pricing section with Ziko brand and bilingual copy
- [ ] **Phase 4: SEO + Performance** - Metadata, sitemap, static rendering verification, and Core Web Vitals pass
- [ ] **Phase 5: Launch** - Custom domain live on Vercel, final pre-launch checklist verified, site publicly accessible

## Phase Details

### Phase 1: Foundation
**Goal**: A statically-rendered, bilingual Next.js site is live on Vercel with correct i18n routing, Ziko design tokens, and a secure admin Supabase client — ready for content and features to be built on top without rework
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07
**Success Criteria** (what must be TRUE):
  1. Visiting `/` serves the French homepage and visiting `/en/` serves the English homepage — locale routing works end-to-end with no 404s
  2. `next build` output lists all `[locale]/*` routes as `○` (static), not `ƒ` (dynamic)
  3. Page fonts load from Vercel's own CDN with no outbound requests to Google Fonts
  4. A footer is visible on every page with working links to all three legal page URLs (even if those pages are stubs at this point)
  5. The `SUPABASE_SERVICE_ROLE_KEY` env var is scoped server-only in Vercel — no `NEXT_PUBLIC_` prefix, and the admin Supabase client file contains `import 'server-only'`
**Plans**: 2 plans
Plans:
- [x] 01-01-PLAN.md — Bootstrap Next.js 15 project with Tailwind v4 tokens and next-intl v4 i18n routing
- [x] 01-02-PLAN.md — Pages, Footer, Supabase admin client, and static build verification
**UI hint**: yes

### Phase 2: RGPD Compliance
**Goal**: All French legal obligations are satisfied — the three mandatory legal pages are live with real operator data, and users can delete their account via a secure server-side form before the app goes public
**Depends on**: Phase 1
**Requirements**: RGPD-01, RGPD-02, RGPD-03, RGPD-04, RGPD-05, RGPD-06
**Success Criteria** (what must be TRUE):
  1. A user can enter their email on the account deletion page, submit the form, and receive a success confirmation — the account is deleted via the Supabase admin API on the server
  2. The deletion endpoint rejects more than 5 requests per minute from the same IP (rate limiting active)
  3. The Mentions Légales page is live and contains all legally-required fields: legal entity name, SIRET, physical address, publication director name, and Vercel hosting details
  4. The Politique de Confidentialité page names Anthropic as a data processor and documents processing of health data, GPS data, and AI coaching interactions
  5. The CGU page is live and includes an AI health advice liability disclaimer
**Plans**: 3 plans
Plans:
- [x] 02-01-PLAN.md — Infrastructure: fix admin.ts, install Upstash, create rate limiter and deletion Server Action
- [x] 02-02-PLAN.md — Deletion page UI: DeleteAccountForm client component, page route, footer link
- [x] 02-03-PLAN.md — Legal pages: Mentions légales, Politique de confidentialité, CGU with full French content
**UI hint**: yes

### Phase 3: Marketing Content
**Goal**: A visitor landing on the site understands what Ziko does, sees all 17 plugins organized clearly, and can tap a CTA to download the app — all copy present in both French and English
**Depends on**: Phase 2
**Requirements**: MKTG-01, MKTG-02, MKTG-03
**Success Criteria** (what must be TRUE):
  1. The hero section displays a headline, an app screenshot in a device frame, and working App Store and Play Store CTA buttons styled in Ziko orange (#FF5C1A)
  2. The plugin showcase presents all 17 plugins grouped into 4-5 categories — each plugin shows an icon, its name, and a one-sentence description in both French and English
  3. The pricing section shows a free tier card with a "Download free" CTA
**Plans**: 3 plans
Plans:
- [ ] 03-01-PLAN.md — Install react-icons and write all bilingual translation strings (Header, Home, Plugins, Pricing)
- [ ] 03-02-PLAN.md — Sticky Header and Hero section components with layout integration
- [ ] 03-03-PLAN.md — Plugin Showcase, Pricing section, and homepage assembly
**UI hint**: yes

### Phase 4: SEO + Performance
**Goal**: Every page is confirmed static, Open Graph metadata resolves to production URLs, a sitemap and robots.txt are accessible, and the hero image passes Core Web Vitals on a Lighthouse audit
**Depends on**: Phase 3
**Requirements**: SEO-01, SEO-02, SEO-03, SEO-04
**Success Criteria** (what must be TRUE):
  1. OG image URLs and canonical links in page `<head>` use the production domain, not Vercel preview URLs
  2. `next build` output shows all `[locale]/*` routes as `○` (static) — no regressions from Phase 3 content work
  3. `/sitemap.xml` and `/robots.txt` return valid responses and are accessible at those paths
  4. Lighthouse audit on the production URL shows Core Web Vitals passing — hero image loads with `priority`, and `sizes` prop is set correctly on all `next/image` usages
**Plans**: 3 plans
Plans:
- [x] 04-01-PLAN.md — OG metadata, metadataBase, generateMetadata on all pages, translation strings, and OG image
- [x] 04-02-PLAN.md — Sitemap and robots.txt auto-generation via Next.js file conventions
- [ ] 04-03-PLAN.md — Hero next/image with placeholder PNG and final static build verification gate
**UI hint**: no

### Phase 5: Launch
**Goal**: The site is publicly accessible on the production custom domain with HTTPS, all pre-launch checklist items verified, and a decision made on analytics
**Depends on**: Phase 4
**Requirements**: (no new v1 requirements — this phase verifies and activates all prior work)
**Success Criteria** (what must be TRUE):
  1. The site is reachable at the production custom domain over HTTPS with no certificate warnings
  2. All internal links and CTA buttons on the live domain resolve correctly (no broken links, no localhost or preview-URL leakage)
  3. A decision on analytics has been made and acted on (Plausible installed cookieless, or analytics explicitly deferred)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/2 | In Progress|  |
| 2. RGPD Compliance | 2/3 | In Progress|  |
| 3. Marketing Content | 0/3 | Not started | - |
| 4. SEO + Performance | 2/3 | In Progress|  |
| 5. Launch | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-26 — Milestone v1.0 Landing Page*
