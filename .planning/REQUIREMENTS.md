# Requirements: Ziko Platform

**Defined:** 2026-03-26 (v1.0 web) · Updated: 2026-03-28 (v1.1 mobile)
**Core Value (v1.1):** A fitness user has a single app that coaches them, tracks everything, and tells them what to cook based on what's in their kitchen.

---

## v1.0 Requirements — Ziko Web (all validated)

### Foundation
- [x] **FOUND-01**: Project is bootstrapped as standalone Next.js 15 App Router repo with Tailwind v4 and TypeScript
- [x] **FOUND-02**: FR/EN i18n routing works via next-intl v4 — French is default (clean URLs), English uses `/en/` prefix
- [x] **FOUND-03**: Ziko design tokens (primary `#FF5C1A`, bg `#F7F6F3`, text `#1C1A17`, border `#E2E0DA`) applied globally via Tailwind v4 `@theme` directive
- [x] **FOUND-04**: All pages are statically generated (`generateStaticParams` for both locales, `setRequestLocale` in every route segment)
- [x] **FOUND-05**: Fonts are self-hosted via `next/font` (no Google CDN, CNIL-compliant)
- [x] **FOUND-06**: Vercel project created with `SUPABASE_SERVICE_ROLE_KEY` scoped to server-only (no `NEXT_PUBLIC_` prefix)
- [x] **FOUND-07**: Footer visible on every page with links to all 3 legal pages (LCEN requirement)

### Marketing
- [x] **MKTG-01**: Hero section displays headline, app screenshot in device frame, and App Store + Play Store CTA buttons in Ziko orange
- [x] **MKTG-02**: Features showcase presents all 17 plugins with icons and bilingual descriptions
- [x] **MKTG-03**: Pricing section presents free tier with a single prominent "Download free" CTA

### RGPD
- [x] **RGPD-01**: Self-service account deletion — IP rate-limited server action, anti-enumeration, high-friction UX
- [x] **RGPD-02**: Mentions légales — LCEN-compliant, BRICON Anatholy as publication director, Vercel hosting
- [x] **RGPD-03**: Politique de confidentialité — Anthropic named as AI data processor, health/GPS/AI data documented
- [x] **RGPD-04**: CGU — AI health liability disclaimer, French law applicable

### SEO & Launch
- [x] **SEO-01**: OG metadata with metadataBase + generateMetadata on all pages
- [x] **SEO-02**: Deployed on Vercel at https://ziko-app.com — custom domain, HTTPS, all routes static
- [x] **SEO-03**: Plausible cookieless analytics active — no cookie banner required
- [x] **SEO-04**: Google Search Console sitemap submitted — site discoverable by Google

---

## v1.1 Requirements — Smart Pantry Plugin (mobile app)

### Smart Inventory (PANTRY)

- [x] **PANTRY-01**: User can add a pantry item with name, quantity, unit (g / ml / pieces), category, and optional expiration date
- [x] **PANTRY-02**: User can edit any field of an existing pantry item inline
- [x] **PANTRY-03**: User can delete a pantry item with a confirmation prompt
- [x] **PANTRY-04**: User can set a low-stock threshold per item (when qty ≤ threshold, item flags as low-stock)
- [x] **PANTRY-05**: User can scan a product barcode to auto-fill item name from Open Food Facts API (manual entry fallback always available)
- [x] **PANTRY-06**: User can view all pantry items grouped by category, with low-stock items visually flagged

### AI Recipe Suggestions (RECIPE)

- [ ] **RECIPE-01**: User can request AI recipe suggestions based on available pantry items
- [ ] **RECIPE-02**: User can request macro-gap-filling recipe suggestions based on remaining daily macros + pantry contents
- [ ] **RECIPE-03**: User can view a suggested recipe's full details — ingredients with quantities, macro breakdown (calories / protein / carbs / fat), and cooking steps
- [ ] **RECIPE-04**: User can adjust serving size of a suggested recipe and see recalculated macros before logging

### Calorie Tracker Sync (SYNC)

- [ ] **SYNC-01**: User can confirm a cooked recipe to auto-log its macros to the nutrition plugin
- [ ] **SYNC-02**: User can edit any macro value and the meal_type (breakfast / lunch / dinner / snack) before confirming sync
- [ ] **SYNC-03**: Pantry item quantities are decremented for used ingredients when a recipe is confirmed as cooked

### Smart Shopping List (SHOP)

- [ ] **SHOP-01**: User can view a rule-based shopping list auto-generated from low/out-of-stock pantry items
- [ ] **SHOP-02**: User can add missing recipe ingredients to the shopping list in one tap from the recipe detail screen
- [ ] **SHOP-03**: User can check off shopping list items as purchased; checking off auto-restores pantry quantity to threshold
- [ ] **SHOP-04**: User can export the shopping list via the native share sheet (plain text)

---

## Future Requirements (deferred from v1.1)

- Saved recipe library — persist AI-suggested recipes for later (v1.2)
- Recipe history — log of all cooked recipes with dates
- Meal planning calendar — plan recipes per day of week
- Cross-device shopping list sync (currently MMKV local only)

## Out of Scope

- AI-generated shopping list — user explicitly chose rule-based
- Recipe database integration (MealDB, Edamam, etc.) — Claude handles suggestions
- Per-ingredient nutritional analysis beyond what Open Food Facts returns
- Dark mode — matches Ziko light sport theme only

---

## Traceability

*Filled by roadmapper — 2026-03-28*

| REQ-ID | Phase |
|--------|-------|
| PANTRY-01 | Phase 6 |
| PANTRY-02 | Phase 6 |
| PANTRY-03 | Phase 6 |
| PANTRY-04 | Phase 6 |
| PANTRY-05 | Phase 6 |
| PANTRY-06 | Phase 6 |
| RECIPE-01 | Phase 7 |
| RECIPE-02 | Phase 7 |
| RECIPE-03 | Phase 7 |
| RECIPE-04 | Phase 7 |
| SYNC-01 | Phase 8 |
| SYNC-02 | Phase 8 |
| SYNC-03 | Phase 8 |
| SHOP-01 | Phase 9 |
| SHOP-02 | Phase 9 |
| SHOP-03 | Phase 9 |
| SHOP-04 | Phase 9 |
