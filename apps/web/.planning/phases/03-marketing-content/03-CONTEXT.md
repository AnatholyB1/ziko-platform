# Phase 3: Marketing Content - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the three marketing sections on the homepage — Hero, Plugin Showcase (all 17 plugins), and Pricing — with bilingual copy (FR default, EN with `/en/` prefix). Add a minimal sticky navigation header.

A visitor landing on the site understands what Ziko does, sees all plugins organized clearly, and can tap a CTA to download the app. All copy present in both French and English.

This phase delivers marketing content only. No SEO metadata (Phase 4), no custom domain (Phase 5), no Coach CRM (Milestone 2).

</domain>

<decisions>
## Implementation Decisions

### Hero Section Layout
- **D-01:** Split layout — headline + subline + CTA buttons on the LEFT, phone device frame on the RIGHT. Standard mobile app marketing pattern.
- **D-02:** App screenshot is a known blocker — real screenshots not available at phase time. Use a CSS-only phone device frame (border-radius, shadow, notch) with a gradient/orange-themed color fill inside. Designed to be swapped for a real screenshot with a single image replacement — no code changes needed.
- **D-03:** Hero headline angle: all-in-one positioning — "17 plugins, one app". Claude writes FR + EN copy in this direction (e.g., FR: «Tout ce dont vous avez besoin pour progresser» / EN: «Everything you need to level up»).
- **D-04:** CTA buttons: App Store + Play Store side by side, styled in Ziko orange (`#FF5C1A`). Both link to `#` placeholder for now — documented as pre-launch swap task.

### Plugin Showcase
- **D-05:** 17 plugins grouped into **5 categories**:
  - **Training** → timer, cardio, ai-programs, rpe, stretching
  - **Health** → sleep, measurements, hydration, wearables
  - **Nutrition** → nutrition, supplements
  - **Coaching & AI** → habits, persona, journal, gamification, stats
  - **Community** → community
- **D-06:** Icons via `react-icons/io5` (Ionicons v5 subset) — exact icon name parity with the mobile app. Tree-shaken. Install `react-icons` package.
- **D-07:** Each plugin card shows: icon + plugin name + one-sentence description (in the active locale). Both FR and EN descriptions needed for all 17 plugins — Claude writes all 34 strings.
- **D-08:** Plugin descriptions go in translation files (`messages/fr.json`, `messages/en.json`) under a `Plugins` namespace, keyed by plugin ID (e.g., `Plugins.habits`, `Plugins.cardio`).

### Pricing Section
- **D-09:** Single free-tier card — no paid tier at launch. "Download free" CTA in orange. Card shows key value props (no subscription, AI coaching included, 17 plugins).
- **D-10:** CTA links to `#` placeholder (same as hero CTAs — pre-launch swap task).

### Navigation Header
- **D-11:** Minimal sticky header added to the locale layout. Logo left, FR | EN language switcher + "Télécharger" (FR) / "Download" (EN) CTA button right.
- **D-12:** Language switcher: two inline links `FR | EN` that toggle locale. FR → root `/`, EN → `/en/` (using `Link` from `@/i18n/navigation` with `locale` prop).
- **D-13:** Header is a Server Component — same pattern as `Footer.tsx` (uses `getTranslations`, `Link` from navigation).
- **D-14:** Sticky behavior via `position: sticky; top: 0; z-index: 50` — CSS only, no JS scroll listener.

### Store URLs
- **D-15:** App Store and Play Store URLs are NOT available yet. All download CTAs link to `#` placeholder. Planner must document "Replace `#` with real store URLs" as an explicit pre-launch checklist task in STATE.md blockers.

### Claude's Discretion
- Exact FR/EN copy for hero headline, subline, and pricing card value props (Claude writes, following the all-in-one / 17-plugins angle)
- Exact Ionicons icon name per plugin (match mobile app manifest exactly — see CLAUDE.md plugin catalog)
- Responsive breakpoints for hero split layout (mobile: stack vertically, desktop: side by side)
- Phone device frame CSS implementation details (dimensions, notch shape, inner gradient colors)
- Pricing card exact layout and value prop bullet points
- Header logo treatment (text "Ziko" in orange vs SVG logo — use text if no SVG available)

</decisions>

<specifics>
## Specific Ideas

- Device frame: build purely in CSS (no image, no SVG). Should look like a modern smartphone with a subtle notch/pill cutout at top. Inner area filled with an orange-to-light gradient as placeholder for the real screenshot.
- Plugin showcase: category tabs or filter chips to switch between the 5 groups — OR a section per group with a category heading. Either works; planner decides based on simplicity.
- Hero CTA buttons: App Store first (left), Play Store second (right). Both visible side by side. Use SVG badges or styled buttons — planner's call.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Vision, design tokens, constraints (light sport theme, no Framer Motion, Next.js 15)
- `.planning/REQUIREMENTS.md` — MKTG-01, MKTG-02, MKTG-03 acceptance criteria
- `.planning/ROADMAP.md` — Phase 3 success criteria

### Phase 1 & 2 Decisions (locked patterns)
- `.planning/phases/01-foundation/01-CONTEXT.md` — Stack decisions (Next.js 15, next-intl v4, `localePrefix: 'as-needed'`, Inter font, static rendering pattern)
- `.planning/phases/02-rgpd-compliance/02-CONTEXT.md` — Server Component pattern (`getTranslations`, `Link` from navigation), translation key naming conventions

### Existing Code (read before implementing)
- `src/app/[locale]/layout.tsx` — Locale layout where Header component must be added
- `src/app/[locale]/page.tsx` — Homepage stub to replace with marketing sections
- `src/components/layout/Footer.tsx` — Server component pattern to replicate for Header
- `messages/fr.json` — Translation file to extend with `Home`, `Header`, `Plugins`, `Pricing` namespaces
- `messages/en.json` — English translations (same namespaces)

### Plugin Reference
- `CLAUDE.md` (project root) — Plugin catalog table with all 17 plugin IDs, names, categories, and Ionicons icon names

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/layout/Footer.tsx` — Server Component using `getTranslations()` + `Link` from `@/i18n/navigation` — exact pattern for the new Header component
- `src/app/[locale]/layout.tsx` — Wraps children in `flex flex-col min-h-screen`, Footer at bottom — Header slot goes at top, above `<div className="flex-1">`
- Container pattern: `max-w-screen-xl mx-auto px-8` — use for all marketing sections

### Established Patterns
- Server components with `setRequestLocale(locale)` + `getTranslations('Namespace')` — all `[locale]` pages follow this
- Translation keys: flat namespace per feature, e.g. `Footer.copyright`, `Home.heading`
- Static rendering: `generateStaticParams` already in locale layout — new pages inherit it automatically
- `Link` from `@/i18n/navigation` (not `next/link`) — locale-aware links, required for locale switcher

### Integration Points
- Header added to `src/app/[locale]/layout.tsx` — between root `<div>` start and `<div className="flex-1">`
- New translation namespaces: `Header` (nav copy, CTA text), `Home` (hero, sections), `Plugins` (17 descriptions × 2 locales), `Pricing` (card copy)
- `react-icons` package to install in `ziko-web` (not monorepo — standalone project)
- Public folder is empty — device frame is CSS-only (no image files needed for placeholder)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

**Pre-launch tasks captured (not deferred, just documented):**
- Replace all `#` CTA links with real App Store URL and Play Store URL before launch
- Replace CSS gradient placeholder in phone frame with real Expo app screenshot

</deferred>

---

*Phase: 03-marketing-content*
*Context gathered: 2026-03-26*
