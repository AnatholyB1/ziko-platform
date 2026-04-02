# Requirements: Ziko Platform

**Defined:** 2026-03-26 (v1.0 web) · Updated: 2026-04-02 (v1.2 barcode enrichment)
**Core Value (v1.2):** A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and now shows them exactly what's in their food.

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

## v1.1 Requirements — Smart Pantry Plugin (all validated)

### Smart Inventory (PANTRY)
- [x] **PANTRY-01**: User can add a pantry item with name, quantity, unit (g / ml / pieces), category, and optional expiration date (Validated in Phase 6)
- [x] **PANTRY-02**: User can edit any field of an existing pantry item inline (Validated in Phase 6)
- [x] **PANTRY-03**: User can delete a pantry item with a confirmation prompt (Validated in Phase 6)
- [x] **PANTRY-04**: User can set a low-stock threshold per item (when qty ≤ threshold, item flags as low-stock) (Validated in Phase 6)
- [x] **PANTRY-05**: User can scan a product barcode to auto-fill item name from Open Food Facts API (manual entry fallback always available) (Validated in Phase 6)
- [x] **PANTRY-06**: User can view all pantry items grouped by category, with low-stock items visually flagged (Validated in Phase 6)

### AI Recipe Suggestions (RECIPE)
- [x] **RECIPE-01**: User can request AI recipe suggestions based on available pantry items (Validated in Phase 7)
- [x] **RECIPE-02**: User can request macro-gap-filling recipe suggestions based on remaining daily macros + pantry contents (Validated in Phase 7)
- [x] **RECIPE-03**: User can view a suggested recipe's full details — ingredients with quantities, macro breakdown (calories / protein / carbs / fat), and cooking steps (Validated in Phase 7)
- [x] **RECIPE-04**: User can adjust serving size of a suggested recipe and see recalculated macros before logging (Validated in Phase 7)

### Calorie Tracker Sync (SYNC)
- [x] **SYNC-01**: User can confirm a cooked recipe to auto-log its macros to the nutrition plugin (Validated in Phase 8)
- [x] **SYNC-02**: User can edit any macro value and the meal_type (breakfast / lunch / dinner / snack) before confirming sync (Validated in Phase 8)
- [x] **SYNC-03**: Pantry item quantities are decremented for used ingredients when a recipe is confirmed as cooked (Validated in Phase 8)

### Smart Shopping List (SHOP)
- [x] **SHOP-01**: User can view a rule-based shopping list auto-generated from low/out-of-stock pantry items (Validated in Phase 9)
- [x] **SHOP-02**: User can add missing recipe ingredients to the shopping list in one tap from the recipe detail screen (Validated in Phase 9)
- [x] **SHOP-03**: User can check off shopping list items as purchased; checking off auto-restores pantry quantity to threshold (Validated in Phase 9)
- [x] **SHOP-04**: User can export the shopping list via the native share sheet (plain text) (Validated in Phase 9)

---

## v1.2 Requirements — Barcode Enrichment + Tech Debt

### Barcode Scan Data Layer (SCAN)

- [ ] **SCAN-01**: User can scan a product barcode in the nutrition plugin to retrieve food data from Open Food Facts (name, macros per 100g, Nutri-Score, Eco-Score, photo)
- [x] **SCAN-02**: User sees a "product not found" message and can fall back to manual entry when a barcode is not in Open Food Facts
- [ ] **SCAN-03**: Scanned product data (Nutri-Score, Eco-Score) is preserved on the nutrition log entry for later display

### Score Display (SCORE)

- [x] **SCORE-01**: User sees a product card with photo, Nutri-Score badge, Eco-Score badge, macros per 100g, and a serving size adjuster before confirming a scanned meal log
- [x] **SCORE-02**: User sees Nutri-Score and Eco-Score badges on nutrition journal entries logged via barcode scan
- [x] **SCORE-03**: User sees their average Nutri-Score for the day on the nutrition dashboard (widget hidden when no barcode-scanned meals exist that day)

### Tech Debt (DEBT)

- [x] **DEBT-01**: Checking off a recipe ingredient from the shopping list prompts "how much did you buy?" and inserts or restocks the ingredient in the pantry
- [x] **DEBT-02**: Checking off a low-stock pantry item from the shopping list prompts for quantity instead of auto-restoring to threshold+1
- [x] **DEBT-03**: Recipe cooked confirmation uses `pantry_log_recipe_cooked` AI tool registered in `registry.ts`; direct Supabase call removed from `RecipeConfirm.tsx`
- [x] **DEBT-04**: VALIDATION.md files for phases 06, 07, 08, and 09 accurately reflect post-execution state (Nyquist compliant)

---

## Future Requirements (deferred)

- Saved recipe library — persist AI-suggested recipes for later
- Recipe history — log of all cooked recipes with dates
- Meal planning calendar — plan recipes per day of week
- Cross-device shopping list sync (currently MMKV local only)
- Eco-Score display on pantry items (link scan data to pantry plugin)

## Out of Scope

- AI-generated shopping list — user explicitly chose rule-based
- Recipe database integration (MealDB, Edamam, etc.) — Claude handles suggestions
- Per-ingredient nutritional analysis beyond what Open Food Facts returns
- Dark mode — matches Ziko light sport theme only
- Barcode scan enrichment in pantry plugin (v1.2 nutrition plugin only)

---

## Traceability

*v1.0 and v1.1 filled by roadmapper — 2026-03-28*
*v1.2 filled by roadmapper — 2026-04-02*

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PANTRY-01 | Phase 6 | Validated |
| PANTRY-02 | Phase 6 | Validated |
| PANTRY-03 | Phase 6 | Validated |
| PANTRY-04 | Phase 6 | Validated |
| PANTRY-05 | Phase 6 | Validated |
| PANTRY-06 | Phase 6 | Validated |
| RECIPE-01 | Phase 7 | Validated |
| RECIPE-02 | Phase 7 | Validated |
| RECIPE-03 | Phase 7 | Validated |
| RECIPE-04 | Phase 7 | Validated |
| SYNC-01 | Phase 8 | Validated |
| SYNC-02 | Phase 8 | Validated |
| SYNC-03 | Phase 8 | Validated |
| SHOP-01 | Phase 9 | Validated |
| SHOP-02 | Phase 9 | Validated |
| SHOP-03 | Phase 9 | Validated |
| SHOP-04 | Phase 9 | Validated |
| SCAN-01 | Phase 10 | Pending |
| SCAN-02 | Phase 11 | Complete |
| SCAN-03 | Phase 10 | Pending |
| SCORE-01 | Phase 11 | Complete |
| SCORE-02 | Phase 11 | Complete |
| SCORE-03 | Phase 11 | Complete |
| DEBT-01 | Phase 10 | Complete |
| DEBT-02 | Phase 10 | Complete |
| DEBT-03 | Phase 10 | Complete |
| DEBT-04 | Phase 10 | Complete |
