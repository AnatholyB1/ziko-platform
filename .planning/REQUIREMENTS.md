# Requirements: Ziko Web

**Defined:** 2026-03-26
**Core Value:** A potential user lands on the site and understands what Ziko does, feels compelled to download the app, and trusts it enough to create an account.

## v1 Requirements

### Foundation

- [x] **FOUND-01**: Project is bootstrapped as standalone Next.js 15 App Router repo with Tailwind v4 and TypeScript
- [x] **FOUND-02**: FR/EN i18n routing works via next-intl v4 — French is default (clean URLs), English uses `/en/` prefix
- [x] **FOUND-03**: Ziko design tokens (primary `#FF5C1A`, bg `#F7F6F3`, text `#1C1A17`, border `#E2E0DA`) applied globally via Tailwind v4 `@theme` directive
- [x] **FOUND-04**: All pages are statically generated (`generateStaticParams` for both locales, `setRequestLocale` in every route segment)
- [x] **FOUND-05**: Fonts are self-hosted via `next/font` (no Google CDN, CNIL-compliant)
- [x] **FOUND-06**: Vercel project created with `SUPABASE_SERVICE_ROLE_KEY` scoped to server-only (no `NEXT_PUBLIC_` prefix)
- [x] **FOUND-07**: Footer visible on every page with links to all 3 legal pages (LCEN requirement)

### Marketing

- [ ] **MKTG-01**: Hero section displays headline, app screenshot in device frame, and App Store + Play Store CTA buttons in Ziko orange
- [ ] **MKTG-02**: Plugin showcase groups all 17 plugins into 4–5 categories with icon, name, and 1-sentence description per plugin (in both FR and EN)
- [ ] **MKTG-03**: Pricing section shows free tier card with "Download free" CTA

### RGPD & Legal

- [ ] **RGPD-01**: User can enter their email to request account deletion and receive a success response (RGPD Art. 17)
- [ ] **RGPD-02**: Account deletion is processed server-side via Supabase admin API — service role key never in client bundle
- [ ] **RGPD-03**: Deletion action is rate-limited per IP (prevents account enumeration abuse)
- [ ] **RGPD-04**: Mentions légales page is live with all legally-required fields (legal entity, SIRET, address, publication director, hosting provider details)
- [ ] **RGPD-05**: Politique de confidentialité page documents all personal data processing (health data, GPS, AI coaching — with Anthropic named as a data processor)
- [ ] **RGPD-06**: CGU page documents terms of use and AI health advice liability disclaimer

### SEO & Performance

- [ ] **SEO-01**: `metadataBase` is set to production domain — OG images and canonical URLs use production URLs, not Vercel preview URLs
- [ ] **SEO-02**: `next build` output shows all `[locale]/*` routes as `○` (static), not `ƒ` (dynamic)
- [ ] **SEO-03**: Sitemap and `robots.txt` are auto-generated and accessible at `/sitemap.xml` and `/robots.txt`
- [ ] **SEO-04**: Hero image uses `next/image` with `priority` and correct `sizes` prop; Core Web Vitals pass Lighthouse audit on production URL

## v2 Requirements

### Coach Platform

- **COACH-01**: Authenticated `/coach` section accessible via Supabase session
- **COACH-02**: Coach dashboard with overview of assigned clients
- **COACH-03**: Client management — view client profiles, workout history, AI coaching logs
- **COACH-04**: Session tracking — log and review coaching sessions

### Analytics

- **ANLT-01**: Privacy-first analytics (Plausible recommended) with no cookie consent banner required
- **ANLT-02**: Conversion tracking on App Store / Play Store CTA clicks

### Social Proof

- **SOCL-01**: Testimonials section with real user reviews
- **SOCL-02**: App Store / Play Store rating badges

## Out of Scope

| Feature | Reason |
|---------|--------|
| Blog / content marketing | Static content for v1; high ongoing maintenance cost with low immediate ROI |
| Dark mode | Ziko light sport theme only — no dark mode by design |
| Individual plugin landing pages | High content work; SEO benefit is long-term, not needed for launch |
| Interactive AI coaching demo | Significant engineering investment; marketing site, not product demo |
| Cookie consent banner | Only needed if cookie-based analytics added; Plausible sidesteps this entirely |
| Backend API changes (Hono) | Account deletion calls Supabase directly; Hono API untouched in Milestone 1 |
| Native mobile integration | Marketing site only — no deep links or SDK integration |
| Framer Motion animations | 40+ KB bundle cost on a 5-page marketing site; CSS transitions are sufficient |
| `@supabase/ssr` package | Only needed for Milestone 2 coach CRM (cookie-based user sessions); overkill for marketing site |

## Traceability

Populated by roadmapper. Each requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| FOUND-07 | Phase 1 | Complete |
| MKTG-01 | Phase 3 | Pending |
| MKTG-02 | Phase 3 | Pending |
| MKTG-03 | Phase 3 | Pending |
| RGPD-01 | Phase 2 | Pending |
| RGPD-02 | Phase 2 | Pending |
| RGPD-03 | Phase 2 | Pending |
| RGPD-04 | Phase 2 | Pending |
| RGPD-05 | Phase 2 | Pending |
| RGPD-06 | Phase 2 | Pending |
| SEO-01 | Phase 4 | Pending |
| SEO-02 | Phase 4 | Pending |
| SEO-03 | Phase 4 | Pending |
| SEO-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20 (roadmap complete)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 — traceability populated by roadmapper*
