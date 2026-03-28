# Roadmap: Ziko Platform

## Milestones

- ✅ **v1.0 Landing Page** - Phases 1-5 (shipped 2026-03-28)
- 🚧 **v1.1 Smart Pantry Plugin** - Phases 6-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 Landing Page (Phases 1-5) - SHIPPED 2026-03-28</summary>

Five phases took the Ziko web marketing site from an empty repo to a publicly-launched product. Phase 1 installed the technical foundation — i18n routing, design tokens, and the static rendering architecture. Phase 2 shipped all RGPD and French legal requirements. Phase 3 built the three marketing sections. Phase 4 hardened SEO metadata. Phase 5 threw the switch: custom domain live, site public.

### Phase 1: Foundation
**Goal**: A statically-rendered, bilingual Next.js site is live on Vercel with correct i18n routing, Ziko design tokens, and a secure admin Supabase client — ready for content and features to be built on top without rework
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07
**Success Criteria** (what must be TRUE):
  1. Visiting `/` serves the French homepage and visiting `/en/` serves the English homepage — locale routing works end-to-end with no 404s
  2. `next build` output lists all `[locale]/*` routes as `○` (static), not `ƒ` (dynamic)
  3. Page fonts load from Vercel's own CDN with no outbound requests to Google Fonts
  4. A footer is visible on every page with working links to all three legal page URLs
  5. The `SUPABASE_SERVICE_ROLE_KEY` env var is scoped server-only in Vercel — no `NEXT_PUBLIC_` prefix
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Bootstrap Next.js 15 project with Tailwind v4 tokens and next-intl v4 i18n routing
- [x] 01-02-PLAN.md — Pages, Footer, Supabase admin client, and static build verification
**UI hint**: yes

### Phase 2: RGPD Compliance
**Goal**: All French legal obligations are satisfied — the three mandatory legal pages are live with real operator data, and users can delete their account via a secure server-side form before the app goes public
**Depends on**: Phase 1
**Requirements**: RGPD-01, RGPD-02, RGPD-03, RGPD-04
**Success Criteria** (what must be TRUE):
  1. A user can enter their email on the account deletion page, submit the form, and receive a success confirmation — the account is deleted via the Supabase admin API on the server
  2. The deletion endpoint rejects more than 5 requests per minute from the same IP
  3. The Mentions Légales page is live and contains all legally-required fields: legal entity name, publication director name, and Vercel hosting details
  4. The Politique de Confidentialité page names Anthropic as a data processor and documents health data, GPS data, and AI coaching interactions
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
  2. The plugin showcase presents all 17 plugins grouped into categories — each plugin shows an icon, name, and description in both French and English
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
  4. Lighthouse audit on the production URL shows Core Web Vitals passing — hero image loads with `priority`
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — OG metadata, metadataBase, generateMetadata on all pages, translation strings, and OG image
- [x] 04-02-PLAN.md — Sitemap and robots.txt auto-generation via Next.js file conventions
- [x] 04-03-PLAN.md — Hero next/image with placeholder PNG and final static build verification gate
**UI hint**: no

### Phase 5: Launch
**Goal**: The site is publicly accessible on the production custom domain with HTTPS, all pre-launch checklist items verified, and analytics active
**Depends on**: Phase 4
**Requirements**: (no new v1 requirements — this phase verifies and activates all prior work)
**Success Criteria** (what must be TRUE):
  1. The site is reachable at the production custom domain over HTTPS with no certificate warnings
  2. All internal links and CTA buttons on the live domain resolve correctly — no broken links or localhost leakage
  3. Plausible cookieless analytics active — no cookie banner required
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Hero screenshot swap + Plausible Analytics script installation
- [ ] 05-02-PLAN.md — Deploy, custom domain, live verification, and Google Search Console submission
**UI hint**: no

</details>

### 🚧 v1.1 Smart Pantry Plugin (In Progress)

**Milestone Goal:** Add a `pantry` plugin to the Ziko mobile app that turns the phone into a kitchen brain — inventory tracking with barcode scan, AI macro-aware recipe suggestions, automatic calorie logging to the nutrition plugin, and a rule-based shopping list.

Four phases deliver this with a hard dependency gate between each. The plugin scaffold and database migration in Phase 6 gate everything downstream. Recipe suggestions (Phase 7) depend on pantry data existing. Calorie sync (Phase 8) depends on recipes existing in conversation context. Shopping list (Phase 9) depends only on pantry data and can be treated as a standalone closer.

#### Phase 6: Smart Inventory
**Goal**: Users can fully manage their pantry through the app — adding, editing, and viewing items grouped by storage location with visual expiry warnings — and the plugin is registered in the Ziko ecosystem with a live Supabase table
**Depends on**: Phase 5
**Requirements**: PANTRY-01, PANTRY-02, PANTRY-03, PANTRY-04, PANTRY-05, PANTRY-06
**Success Criteria** (what must be TRUE):
  1. User can add a pantry item (name, quantity, unit, category, expiration date) via manual form or barcode scan that auto-fills name from Open Food Facts
  2. User can edit any field of an existing item inline and delete an item with a confirmation prompt
  3. User can set a low-stock threshold per item — items at or below threshold appear visually flagged in the list
  4. User can view all pantry items grouped by storage location (fridge / freezer / pantry) with expiry color indicators (red for expired or today, yellow within 7 days, green otherwise)
  5. AI can read and manage pantry items via `pantry_get_items` and `pantry_update_item` tools ("Add 500g chicken breast to my pantry" works in AI chat)
**Plans**: TBD
**UI hint**: yes

#### Phase 7: AI Recipe Suggestions
**Goal**: Users can ask the AI what to cook and receive macro-aware recipe suggestions based on their current pantry contents and remaining daily calorie/protein budget
**Depends on**: Phase 6
**Requirements**: RECIPE-01, RECIPE-02, RECIPE-03, RECIPE-04
**Success Criteria** (what must be TRUE):
  1. User can request recipe suggestions from the Pantry Recipes screen and receive at least 3 recipes that use available pantry items
  2. Suggested recipes respect the user's remaining daily macro budget — a user who has already hit their calorie target sees lighter recipe options
  3. User can view a full recipe detail with ingredients, quantities, estimated macros (calories / protein / carbs / fat), and cooking steps
  4. User can adjust the serving count before logging and see the macro values recalculate accordingly
**Plans**: TBD
**UI hint**: yes

#### Phase 8: Calorie Tracker Sync
**Goal**: Users can confirm a cooked recipe from the Pantry plugin and have its macros automatically logged to the Nutrition plugin, with pantry quantities decremented for the ingredients used
**Depends on**: Phase 7
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. User can tap "I cooked this" on a recipe and see a confirm screen with editable macro fields and a meal-type selector pre-filled from the time of day
  2. Confirming the cook creates a visible entry in the Nutrition dashboard — the user is navigated to the Nutrition screen automatically to confirm no duplicate logging
  3. Pantry item quantities are decremented by the amounts used in the recipe after confirming
**Plans**: TBD
**UI hint**: yes

#### Phase 9: Smart Shopping List
**Goal**: Users have a rule-based shopping list automatically populated from low/out-of-stock pantry items and missing recipe ingredients, which they can check off as purchased and export to any app
**Depends on**: Phase 6
**Requirements**: SHOP-01, SHOP-02, SHOP-03, SHOP-04
**Success Criteria** (what must be TRUE):
  1. User sees a shopping list auto-generated from items where quantity is at or below the low-stock threshold — no manual curation required
  2. User can add missing recipe ingredients to the shopping list in one tap from the recipe detail screen
  3. User can check off a shopping list item as purchased — the item's pantry quantity is restored to its threshold value
  4. User can export the full shopping list as plain text via the native share sheet
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-03-26 |
| 2. RGPD Compliance | v1.0 | 3/3 | Complete | 2026-03-26 |
| 3. Marketing Content | v1.0 | 0/3 | Not started | - |
| 4. SEO + Performance | v1.0 | 3/3 | Complete | 2026-03-27 |
| 5. Launch | v1.0 | 1/2 | In progress | - |
| 6. Smart Inventory | v1.1 | 0/? | Not started | - |
| 7. AI Recipe Suggestions | v1.1 | 0/? | Not started | - |
| 8. Calorie Tracker Sync | v1.1 | 0/? | Not started | - |
| 9. Smart Shopping List | v1.1 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-26 — Milestone v1.0 Landing Page*
*Updated: 2026-03-28 — Milestone v1.1 Smart Pantry Plugin phases added (6-9)*
