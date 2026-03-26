# Feature Research

**Domain:** Fitness app marketing/landing site with French legal compliance
**Researched:** 2026-03-26
**Confidence:** HIGH (legal requirements from official sources; marketing patterns from industry analysis)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist on any fitness app marketing site. Missing these = product feels untrustworthy or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hero section with headline + subheadline | Every app marketing site has one; first thing a visitor sees | LOW | Headline ~5–8 words benefit-focused, not feature-focused. E.g. "Your AI coach, always in your pocket." |
| App Store + Play Store CTA buttons | Any mobile app landing page has download links above the fold | LOW | Static badge images with links. No integration needed. Both stores or just one if only one is live. |
| App mockup / screenshot in hero | Visitors need to see what they're downloading | LOW–MEDIUM | Requires real screenshots from the app. iPhone frame mockup is standard. Can be static image or CSS frame. |
| Features section | Visitors need to understand what the app does | MEDIUM | 17 plugins = risk of overwhelming; needs grouping strategy (see below). |
| Pricing section | Visitors want to know cost before downloading | LOW | Free tier only. "Download free" CTA. No payment logic needed. |
| Footer with legal links | French law mandates permanently accessible legal links | LOW | Mentions légales, CGU, Politique de confidentialité — all three required. |
| Mentions légales page | Legally mandatory for any French commercial site (Loi pour la Confiance en l'Économie Numérique, 2004) | LOW | Static page. Penalty for absence: up to 375 000 € for companies. |
| Politique de confidentialité (RGPD) | Legally mandatory when processing personal data (RGPD Art. 13/14) | LOW–MEDIUM | Must detail what data is collected, why, for how long, and user rights. |
| CGU page | Strongly recommended (quasi-mandatory for apps with accounts) | LOW | Defines acceptable use, IP ownership, liability limits, governing law (French law). |
| Self-service account deletion | RGPD Art. 17 (droit à l'effacement) — users can demand deletion | MEDIUM | Form: email input + confirmation. Server-side Supabase admin delete. Must respond within 1 month. |
| FR/EN language switcher | FR default + EN for international reach; stated requirement | MEDIUM | `next-intl` routing. `/fr/` and `/en/` prefixes or locale subdomain. |
| Mobile-responsive design | >60% of traffic is mobile; users previewing the app are on phones | LOW | Tailwind CSS handles this natively if used correctly. |
| Contact / support link | Users have questions; legally required for commercial operators | LOW | Can be email link in footer. No contact form needed for v1. |

### Differentiators (Competitive Advantage)

Features that make this landing page stand out vs generic fitness app pages. Aligned with Ziko's core value: AI coaching + plugin ecosystem.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI coach demo / teaser | Ziko's main differentiator is Claude AI coaching — landing page must make this tangible | MEDIUM | Short copy + screenshot of an AI conversation. No live demo needed for v1. |
| Plugin ecosystem showcase (not just a feature list) | 17 plugins = breadth; presenting them as a "build your own fitness app" concept is unique | MEDIUM | Tabbed or filtered grid by category (training, health, coaching, nutrition). Avoids wall-of-text. |
| Brand coherence with mobile app | Same orange (#FF5C1A) + light sport aesthetic builds trust that what you see is what you download | LOW | Design tokens directly from CLAUDE.md: #FF5C1A primary, #F7F6F3 background. |
| GPS tracking / Strava-like teaser | Cardio plugin with route visualization is unusual for an indie fitness app; worth highlighting | LOW | Screenshot from CardioDashboard. One dedicated callout, not buried in the plugin grid. |
| Social proof section | Trust signal — even a single quote or rating if available | LOW–MEDIUM | Testimonials if available. If not, defer to v1.x once real users exist. |
| Animated scroll reveals | Modern feel; fitness apps compete on energy and motivation | MEDIUM | Framer Motion or CSS transitions. Feature cards fade in on scroll. Not required but increases perceived quality. |
| Cookie consent banner | Required under French ePrivacy law for analytics/tracking cookies | LOW–MEDIUM | Only mandatory if analytics (GA4, Plausible) are added. If no cookies used = not needed. Recommend Plausible (cookieless) to avoid complexity. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Live AI chat demo on landing page | "Show don't tell" for the AI coach | Requires live API calls, auth, cost per visitor, latency — not worth it for marketing | Static screenshot of a conversation + copy describing the AI coach |
| User login / auth on landing page | "Users should log in from the website" | Scope creep — auth belongs in the mobile app. Website is marketing only (v1). | Deep-link to app login or App Store. Keep website stateless. |
| Blog / content marketing | SEO, thought leadership | CMS adds complexity (Contentlayer, Sanity, etc.); explicitly out of scope per PROJECT.md | Static content for v1; add blog in v2 if SEO is a priority |
| Video background in hero | High energy, visually impressive | Heavy bandwidth, autoplay restrictions on mobile, complex responsive behavior | Static app mockup + strong typography is sufficient and faster |
| Cookie consent popup with full preference center | Legally thorough | Complex to implement correctly (TCF v2 compliance); unnecessary if using cookieless analytics | Use Plausible Analytics (no cookies = no consent required) or Simple Analytics |
| Waitlist / email capture form | Build audience before launch | Adds backend dependency (email service: Resend, Mailchimp, etc.); not in scope | Just App Store / Play Store CTA. Email capture is a v1.x differentiator if needed. |
| Dark mode | Modern standard | Conflicts with Ziko's light sport theme identity; creates maintenance burden | Single light theme only — consistent with mobile app |
| 17 individual plugin pages | Deep SEO per plugin | Massive content work; overkill for v1 | Single features section with grouped plugins. Individual plugin pages = v2 SEO effort. |

---

## Feature Dependencies

```
Self-service account deletion
    └──requires──> Server-side Supabase admin client (SUPABASE_SERVICE_ROLE_KEY in env)
                       └──requires──> Next.js Server Action or API route (never expose key to client)

FR/EN i18n
    └──requires──> next-intl setup with locale routing
                       └──requires──> All page content in translation files (fr.json, en.json)
                                          └──enhances──> Legal pages (must exist in both FR and EN)

Legal pages (mentions légales, CGU, politique de confidentialité)
    └──requires──> Site editor identity (SIRET, address, hosting provider details)
    └──requires──> Data inventory (what Supabase collects, why, how long)

Hero section
    └──requires──> Real app screenshots (from existing mobile app)

Plugin showcase
    └──requires──> Plugin metadata (names, descriptions, icons — available in plugin manifests)

Cookie consent banner
    └──requires──> Decision: cookieless analytics (Plausible) vs cookie-based (GA4)
    └──conflicts──> No-cookie approach (use Plausible → banner not needed)
```

### Dependency Notes

- **Account deletion requires service role key:** `supabase.auth.admin.deleteUser()` must be called from a Next.js Server Action. The `SUPABASE_SERVICE_ROLE_KEY` must never appear in the client bundle. This is a hard security requirement.
- **Legal pages require business identity data:** The developer/company must provide SIRET (if company), physical address, hosting provider (Vercel), and email address before pages can be written. These cannot be templated without real data.
- **i18n requires all text to be externalized from day one:** Retrofitting i18n is painful. All strings must go into translation files from the start. This affects every page including legal pages.
- **Screenshots require the mobile app:** Hero mockup and plugin screenshots depend on the existing Expo app. Must be captured before design work begins.

---

## MVP Definition

### Launch With (v1)

Minimum viable to launch publicly while satisfying French law.

- [ ] Hero section (headline, subheadline, app mockup, App Store + Play Store CTAs) — converts visitors into downloads
- [ ] Features showcase (17 plugins in grouped grid, not individual pages) — informs visitors
- [ ] Pricing section (free tier, "Download free" CTA) — removes friction
- [ ] FR/EN i18n via `next-intl` — stated requirement, cannot be retrofitted cheaply
- [ ] Mentions légales page — legally mandatory, penalty up to 375 000 €
- [ ] Politique de confidentialité / RGPD page — legally mandatory when collecting data
- [ ] CGU page — strongly recommended; required before any account creation
- [ ] Self-service account deletion — RGPD Art. 17 compliance; must be live before app launch
- [ ] Footer with links to all legal pages — LCEN requirement: accessible from every page
- [ ] Vercel deployment, custom domain — prerequisite to "going live"

### Add After Validation (v1.x)

- [ ] Social proof / testimonials section — add once real user reviews exist
- [ ] Animated scroll reveals (Framer Motion) — polish once core content is live
- [ ] Email capture / waitlist — add if pre-launch demand is confirmed
- [ ] Cookie consent banner — only if adding cookie-based analytics; avoid if using Plausible

### Future Consideration (v2+)

- [ ] Individual plugin landing pages (SEO) — high content work, low immediate ROI
- [ ] Blog / content marketing — deferred per PROJECT.md
- [ ] Coach ERP/CRM under `/coach` — Milestone 2 per PROJECT.md
- [ ] App preview / interactive demo — requires significant engineering investment

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Hero + CTAs | HIGH | LOW | P1 |
| Plugin showcase | HIGH | MEDIUM | P1 |
| Pricing section | HIGH | LOW | P1 |
| FR/EN i18n | HIGH | MEDIUM | P1 |
| Mentions légales | HIGH (legal) | LOW | P1 |
| Politique de confidentialité | HIGH (legal) | LOW–MEDIUM | P1 |
| CGU | HIGH (legal) | LOW | P1 |
| Self-service account deletion | HIGH (legal/UX) | MEDIUM | P1 |
| Footer with legal links | HIGH (legal) | LOW | P1 |
| Social proof section | MEDIUM | LOW–MEDIUM | P2 |
| Scroll animations | LOW | MEDIUM | P2 |
| Cookie consent banner | MEDIUM (conditional) | MEDIUM | P2 |
| Individual plugin pages | MEDIUM | HIGH | P3 |
| Blog | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Section-by-Section Requirements

### Hero Section

**What best-in-class fitness app heroes include (table stakes):**
- Benefit headline (not feature headline): "Your AI fitness coach" > "17 plugins for every workout goal"
- 1–2 sentence subheadline expanding on the benefit
- Primary CTA: App Store badge + Play Store badge (static images with links)
- App screenshot in a device mockup frame (iPhone)
- Brand color prominent (Ziko orange #FF5C1A on CTA button)

**Complexity:** LOW. No backend, no dynamic data. Pure static HTML/CSS.

**Dependency on mobile app:** Hero mockup requires real screenshots. Must be captured first.

---

### Features Showcase (17 Plugins)

**Problem:** 17 plugins = cognitive overload if listed linearly. Best practice is grouping.

**Recommended approach:** 4 category tabs or filter chips + 3-column card grid.

**Suggested categories (from plugin manifest data):**
- Training (timer, cardio, stretching, RPE, AI programs)
- Health (sleep, measurements, hydration, wearables)
- Coaching (habits, journal, AI persona, gamification)
- Nutrition (nutrition tracker, supplements)
- Community (community, stats)

**Each plugin card needs:** Icon (Ionicons name → render as SVG or image), plugin name, 1-sentence description.

**Complexity:** MEDIUM. Requires translating manifest data into marketing copy for each plugin (17 × 2 languages = 34 entries).

---

### Pricing Section

**Table stakes:** A single "free" tier card with feature list and "Download free" CTA. No payment logic.

**Complexity:** LOW. Static component.

**Note:** Do not imply a premium tier exists if none is planned. "Free forever for individuals" is honest copy.

---

### Self-Service Account Deletion (RGPD Art. 17)

**What RGPD actually requires:**
- Users must be able to exercise their right to erasure. There is no mandate for a self-service form specifically — email is legally sufficient — but a form is best practice and reduces support load.
- Organization must respond within **1 month** (extendable to 3 months for complex cases, with notification to user within month 1).
- Identity verification is allowed only if there is reasonable doubt. If the user is not authenticated, asking for their email address is sufficient.
- Not all data can be deleted: legally-mandated retention obligations override the right to erasure (e.g., transaction records for tax purposes — not applicable here since Ziko is free).
- Organization must keep an internal log of the deletion request (date, identity, action taken) for audit purposes. This is an internal backend concern.

**Minimum compliant self-service flow:**
1. User navigates to `/delete-account` (linked from privacy policy + footer)
2. Form: email address input + checkbox "I confirm I want to permanently delete my account and all associated data"
3. Submit → Next.js Server Action calls `supabase.auth.admin.listUsers()` to find user by email, then `supabase.auth.admin.deleteUser(userId)`
4. Success message: "Your deletion request has been processed. All account data has been removed."
5. **Optional but recommended:** Email confirmation to user that deletion is complete (proves compliance)
6. Internal: log the deletion event (timestamp, email hash, action) — can be a simple Supabase table or log

**What NOT to do:**
- Do not require the user to log in to delete their account — a deleted user cannot log in. The flow must be unauthenticated.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code.
- Do not soft-delete (mark as deleted) without actually deleting — Supabase `deleteUser` hard-deletes; this is correct.
- Do not add a "30-day recovery window" unless explicitly designed for it — this adds complexity and is not required.

**Complexity:** MEDIUM. Requires a Server Action, service role key in environment, basic form validation, error handling (email not found, already deleted).

---

### French Legal Pages — Mandatory Content

All three pages are static content. The challenge is knowing what to write, not how to build it.

#### Mentions Légales (legally mandatory under LCEN 2004)

**Required fields — ALL mandatory:**
- Raison sociale (company name) or nom/prénom (individual)
- Statut juridique (SAS, SARL, auto-entrepreneur, etc.)
- Capital social (if applicable)
- Numéro SIRET / RCS
- Adresse du siège social
- Numéro de téléphone
- Adresse email
- Directeur de la publication (name of person legally responsible for content)
- Hébergeur du site: Vercel Inc., 340 Pine Street Suite 1212, San Francisco, CA 94104, USA
- If regulated profession: professional license details, regulatory body

**Penalty for omission:** 1 year imprisonment + 75 000 € fine (individual) / 375 000 € (company).

**Complexity:** LOW (static page). Blocked on: developer providing SIRET + legal identity.

#### Politique de Confidentialité / RGPD (legally mandatory, RGPD Art. 13/14)

**Required fields:**
- Identity and contact details of the data controller
- Contact details of DPO (if appointed — optional for small companies)
- For each processing activity: purpose, legal basis (consent / contract / legitimate interest), data categories, retention period
- Data collected by Ziko: email, name, age, weight, height, fitness data (workout logs, nutrition, sleep, etc.), GPS data (cardio), device identifiers
- Recipients of data: Supabase (US, covered by Standard Contractual Clauses), Anthropic (AI processing — must be disclosed), Vercel (hosting)
- International transfers: Supabase (US), Anthropic (US) — must mention SCCs or adequacy decision
- User rights: access, rectification, deletion (Art. 17), portability, objection, restriction
- How to exercise rights: link to `/delete-account`, email address
- Right to lodge complaint with CNIL (cnil.fr)
- No automated decision-making (or describe it if AI coaching constitutes profiling under Art. 22)

**Complexity:** LOW (static page). Blocked on: data inventory of what Supabase actually stores + Anthropic processing agreement.

**Important — AI coaching disclosure:** The use of Claude Sonnet for AI coaching likely constitutes automated processing of personal data. If it involves "profiling" (evaluating personal aspects to predict behavior/performance), RGPD Art. 22 requires disclosure. The privacy policy must mention Anthropic as a data processor.

#### CGU — Conditions Générales d'Utilisation

**Required / strongly recommended fields:**
- Object of the service and what the app does
- User eligibility (age minimum — fitness apps typically 16+ or 18+; relevant given health data)
- Account creation conditions
- User obligations (prohibited behaviors: false information, illegal content, abuse)
- Intellectual property: Ziko owns the platform; user owns their data
- Limitation of liability (the AI coaching is not a medical substitute — explicit disclaimer required)
- Service availability and maintenance right
- Account suspension/termination conditions
- Modifications to CGU (how users are notified)
- Governing law: French law
- Jurisdiction: French courts (or arbitration clause)

**Critical disclaimer:** AI health/fitness coaching must include "not a substitute for medical advice" disclaimer. This protects against liability under French health law.

**Complexity:** LOW (static page). Not blocked on external data but requires legal review for liability clauses.

---

## Competitor Feature Analysis

| Feature | MyFitnessPal site | Strava site | Our Approach |
|---------|--------------|--------------|--------------|
| Hero | Video background, aspirational | Bold static image, athlete-focused | Static mockup + orange brand color; video adds complexity without enough ROI |
| Plugin/feature showcase | Tab-based by category | Feature grid with icons | Tabbed grid by category — matches scale of 17 plugins |
| Pricing | Free + Premium toggle | Free + subscription tiers | Single free tier card — simpler, no toggle needed |
| Social proof | Star ratings, press logos | Athlete count, Strava segments | Defer to v1.x — no users yet at launch |
| Legal pages | GDPR page, privacy, ToS | Privacy policy, ToS | All three French pages (mentions légales + politique confidentialité + CGU) — stricter than GDPR minimum due to LCEN |
| Account deletion | In-app settings | In-app settings | Self-service web form — better than in-app because deleted users can't log in |

---

## Sources

- [CNIL — Le droit à l'effacement](https://www.cnil.fr/fr/comprendre-mes-droits/le-droit-leffacement-supprimer-vos-donnees-en-ligne) — HIGH confidence, official French data protection authority
- [economie.gouv.fr — Mentions légales obligations](https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter) — HIGH confidence, official French government
- [martin.avocat.fr — CGV/CGU/mentions légales differences](https://martin.avocat.fr/cgv-cgu-mentions-legales-differences/) — MEDIUM confidence, French legal practitioner
- [Silexo — Droit à l'effacement 2025](https://silexo.fr/article/142/droit-a-leffacement-des-donnees-obligations-rgpd-procedures-et-controle-des-autorites-en-2025) — MEDIUM confidence, RGPD specialist
- [Moosend — Fitness landing page examples 2026](https://moosend.com/blog/fitness-landing-page-examples/) — MEDIUM confidence, email marketing platform analysis
- [Unbounce — 12 fitness landing page examples](https://unbounce.com/landing-page-examples/fitness/) — MEDIUM confidence, conversion optimization platform
- [CNIL RGPD en pratique](https://www.cnil.fr/fr/rgpd-en-pratique-communiquer-en-ligne) — HIGH confidence, official CNIL guidance
- [RGPD et applications mobiles — CNIL recommendations](https://monexpertrgpd.com/applications-mobiles-recommandations-cnil/) — MEDIUM confidence, practitioner summary of official guidance

---
*Feature research for: Ziko fitness app marketing/landing site (Next.js, French market)*
*Researched: 2026-03-26*
