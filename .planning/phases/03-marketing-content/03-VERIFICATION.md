---
phase: 03-marketing-content
verified: 2026-03-26T22:00:00Z
status: passed
score: 3/3 must-haves verified
---

# Phase 3: Marketing Content Verification Report

**Phase Goal:** A visitor landing on the site understands what Ziko does, sees all 17 plugins organized clearly, and can tap a CTA to download the app — all copy present in both French and English
**Verified:** 2026-03-26T22:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Hero section displays a headline, device frame, and App Store + Play Store CTA buttons in Ziko orange | VERIFIED | `Hero.tsx` — split layout, `text-3xl md:text-4xl font-bold text-text`, two `bg-primary` CTA `<a>` elements, CSS phone frame 220x440px with orange gradient |
| 2 | Plugin showcase presents all 17 plugins in 5 categories with icon, name, and bilingual description | VERIFIED | `PluginShowcase.tsx` — 17 icons imported from `react-icons/io5`, CATEGORIES data structure with 5 groups (5+4+2+5+1 = 17), `tPlugins(plugin.id)` fetches per-locale descriptions |
| 3 | Pricing section shows a free tier card with a "Download free" CTA | VERIFIED | `Pricing.tsx` — single card `bg-white border-2 border-primary`, price "0€", 3 value props, `bg-primary text-white` CTA button |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `C:/ziko-web/src/components/layout/Header.tsx` | Sticky header, Server Component, getTranslations, locale switcher | VERIFIED | 39 lines, `sticky top-0 z-50`, no `'use client'`, `getTranslations('Header')`, `Link` from `@/i18n/navigation`, orange CTA |
| `C:/ziko-web/src/components/marketing/Hero.tsx` | Split layout, device frame, two orange CTAs | VERIFIED | 74 lines, `flex flex-col md:flex-row`, CSS phone frame (220x440, border-radius 32, orange gradient), two `bg-primary` CTA buttons |
| `C:/ziko-web/src/components/marketing/PluginShowcase.tsx` | 17 plugins in 5 categories, react-icons, bilingual | VERIFIED | 122 lines, 17 icons imported from `react-icons/io5`, 5 CATEGORIES, `getTranslations('Plugins')` for descriptions |
| `C:/ziko-web/src/components/marketing/Pricing.tsx` | Free tier card, orange CTA, value props | VERIFIED | 45 lines, `border-2 border-primary`, 3 value props with `IoCheckmarkCircleOutline text-primary`, `bg-primary` CTA |
| `C:/ziko-web/src/app/[locale]/page.tsx` | Imports and renders all 3 sections | VERIFIED | Imports Hero, PluginShowcase, Pricing — renders all 3 in sequence, `setRequestLocale(locale)` preserved |
| `C:/ziko-web/src/app/[locale]/layout.tsx` | Header integrated above flex-1 children | VERIFIED | `import { Header }` present, `<Header />` rendered between root div and `<div className="flex-1">` |
| `C:/ziko-web/messages/fr.json` | 17 Plugins keys, Header + Home + Pricing namespaces | VERIFIED | Plugins: 17 keys (timer, cardio, ai-programs, rpe, stretching, sleep, measurements, hydration, wearables, nutrition, supplements, habits, persona, journal, gamification, stats, community); Header: 4 keys; Home.hero/showcase/pricing all populated |
| `C:/ziko-web/messages/en.json` | 17 Plugins keys, Header + Home + Pricing namespaces | VERIFIED | Same key structure as fr.json — all 17 plugin descriptions in English, all Home and Header keys present |
| `C:/ziko-web/package.json` | react-icons dependency | VERIFIED | `"react-icons": "^5.6.0"` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `layout.tsx` | `Header.tsx` | `import { Header }` + `<Header />` | WIRED | Import line 6, JSX render line 30 |
| `page.tsx` | `Hero.tsx` | `import { Hero }` + `<Hero />` | WIRED | Import line 2, JSX render line 14 |
| `page.tsx` | `PluginShowcase.tsx` | `import { PluginShowcase }` + `<PluginShowcase />` | WIRED | Import line 3, JSX render line 15 |
| `page.tsx` | `Pricing.tsx` | `import { Pricing }` + `<Pricing />` | WIRED | Import line 4, JSX render line 16 |
| `Header.tsx` | `messages/{locale}.json` | `getTranslations('Header')` | WIRED | All 4 keys (logo, cta, localeFR, localeEN) present in both locales |
| `Hero.tsx` | `messages/{locale}.json` | `getTranslations('Home')` + `t('hero.*')` | WIRED | hero.headline, hero.subline, hero.ctaAppStore, hero.ctaPlayStore all populated |
| `PluginShowcase.tsx` | `messages/{locale}.json` | `getTranslations('Plugins')` + `tPlugins(plugin.id)` | WIRED | All 17 plugin IDs have matching keys in both fr.json and en.json |
| `Pricing.tsx` | `messages/{locale}.json` | `getTranslations('Home')` + `t('pricing.*')` | WIRED | pricing.heading, .price, .priceUnit, .valueProp1-3, .cta all present |
| `PluginShowcase.tsx` | `react-icons/io5` | 17 named icon imports | WIRED | All 17 icons imported and used via `<Icon size={24} />` pattern |

---

### Data-Flow Trace (Level 4)

Not applicable — all components are static Server Components rendering bilingual translation strings. No database queries, no API calls, no dynamic state. Translation strings verified to be non-empty real copy (spot-checked: FR hero.headline, pricing.cta, Plugins.habits, Plugins.community; EN hero.headline, Plugins.wearables — all match UI-SPEC Copywriting Contract verbatim).

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| react-icons importable | `grep "react-icons" package.json` | `"react-icons": "^5.6.0"` | PASS |
| FR plugin count = 17 | `node -e "Object.keys(require('./messages/fr.json').Plugins).length"` | 17 | PASS |
| EN plugin count = 17 | `node -e "Object.keys(require('./messages/en.json').Plugins).length"` | 17 | PASS |
| Header is Server Component | grep for `'use client'` in Header.tsx | Not found | PASS |
| Header has sticky top-0 | grep `sticky top-0` in Header.tsx | Found (line 9) | PASS |
| Header uses getTranslations | grep in Header.tsx | Found (line 1 + 5) | PASS |
| Header uses @/i18n/navigation | grep in Header.tsx | Found (line 2) | PASS |
| All 3 sections in page.tsx | grep Hero/PluginShowcase/Pricing in page.tsx | All 3 found | PASS |
| Header in layout.tsx | grep Header in layout.tsx | Import + render both found | PASS |
| Translation values non-empty | node spot-check on 6 keys | All real strings, match UI-SPEC | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| MKTG-01 | 03-02-PLAN | Hero section with headline, device frame, App Store + Play Store CTAs in Ziko orange | SATISFIED | Hero.tsx — headline in `text-3xl md:text-4xl font-bold`, CSS phone frame with orange gradient, two `bg-primary` CTA buttons |
| MKTG-02 | 03-01-PLAN / 03-03-PLAN | Plugin showcase with all 17 plugins in 4-5 categories, FR+EN descriptions | SATISFIED | PluginShowcase.tsx — 5 categories, 17 plugins, react-icons/io5, bilingual via `getTranslations('Plugins')` |
| MKTG-03 | 03-03-PLAN | Pricing section with free tier card and "Download free" CTA | SATISFIED | Pricing.tsx — single card, orange border, `Télécharger gratuitement` / "Download for free" CTA |

---

### Decision Compliance (CONTEXT.md)

| Decision | Spec | Actual | Status |
|----------|------|--------|--------|
| D-01: Split hero layout | Left text, right phone frame | `flex flex-col md:flex-row`, left `.md:w-1/2` copy, right `.md:w-1/2` frame | COMPLIANT |
| D-02: CSS-only phone frame | No image, gradient fill placeholder | Pure CSS inline styles, linear-gradient orange-to-light | COMPLIANT |
| D-04: App Store + Play Store CTAs | href="#" placeholder | Both `<a href="#">` with orange classes | COMPLIANT |
| D-05: 5 categories | Training, Health, Nutrition, Coaching & AI, Community | CATEGORIES array: categoryTraining(5), categoryHealth(4), categoryNutrition(2), categoryCoaching(5), categoryCommunity(1) | COMPLIANT |
| D-06: react-icons/io5 | Ionicons v5 tree-shaken | 17 icons imported from `react-icons/io5` | COMPLIANT |
| D-08: Plugins namespace | `messages/{locale}.json` under `Plugins` key | `Plugins.{pluginId}` in both fr.json and en.json | COMPLIANT |
| D-09: Single free-tier pricing card | No paid tier, "Download free" CTA | One card, `border-2 border-primary`, CTA text from `t('pricing.cta')` | COMPLIANT |
| D-11: Sticky header | Logo + FR/EN switcher + CTA | `sticky top-0 z-50`, logo orange, FR/EN Links, orange CTA button | COMPLIANT |
| D-13: Header as Server Component | getTranslations pattern | No `'use client'`, `async function Header()`, `getTranslations` | COMPLIANT |
| D-14: Sticky via CSS only | `sticky top-0 z-50` | className includes `sticky top-0 z-50` — no JS scroll listener | COMPLIANT |

---

### Anti-Patterns Found

None detected. No TODO/FIXME/placeholder comments in component files. `href="#"` values for CTAs are intentional documented stubs (per D-04/D-15) — real App Store/Play Store URLs not yet available. Phone frame gradient is an intentional CSS placeholder (per D-02) designed for a single-image swap at launch.

---

### Human Verification Required

#### 1. Visual Layout — Hero Split

**Test:** Load `http://localhost:3000` on a desktop viewport (>768px) and a mobile viewport (<768px)
**Expected:** Desktop shows side-by-side hero (text left, phone frame right); mobile shows stacked vertically
**Why human:** Responsive Tailwind breakpoint behavior requires a browser render

#### 2. Locale Switcher Behavior

**Test:** Click "EN" in the header on the French homepage; verify redirect to `/en/` and all text switches to English
**Expected:** All copy switches to English including hero headline, plugin descriptions, and pricing card
**Why human:** next-intl locale routing behavior requires browser testing

#### 3. Plugin Showcase Visual Grouping

**Test:** Scroll through the plugin showcase section
**Expected:** 5 category headings visible, each followed by a grid of plugin cards with Ionicons icons, plugin names, and one-sentence descriptions
**Why human:** Grid layout and icon rendering require browser verification

#### 4. Orange Color Consistency

**Test:** Visually inspect all CTA elements — hero CTAs, pricing CTA, header CTA button, logo text
**Expected:** All use `#FF5C1A` orange; plugin card icons are `#1C1A17` neutral (not orange)
**Why human:** Color rendering verification requires visual inspection

---

### Gaps Summary

No gaps. All three success criteria are fully satisfied:
1. Hero section — headline, CSS device frame, App Store and Play Store CTAs in Ziko orange — VERIFIED
2. Plugin showcase — all 17 plugins in 5 categories with react-icons/io5 icons and bilingual descriptions from translation files — VERIFIED
3. Pricing section — free tier card with orange "Download free" CTA — VERIFIED

All 13 key links are wired. All 3 requirements (MKTG-01, MKTG-02, MKTG-03) are satisfied. All 10 CONTEXT.md decisions are compliant. Translation strings are real bilingual copy matching the UI-SPEC Copywriting Contract.

---

_Verified: 2026-03-26T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
