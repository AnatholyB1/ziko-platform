# Phase 31: Public Marketing /coachs — Research

**Researched:** 2026-05-22
**Domain:** Next.js 15 SSG marketing page — next-intl, framer-motion, Tailwind v4
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** — Hero headline: "La CRM coaching à l'IA" (FR) / "The AI-powered coaching CRM" (EN)
- **D-02** — Pricing callout in hero as badge/subtitle near CTA; no pricing column in comparison table
- **D-03** — CTA links to `/coach/onboarding`; button text "Rejoindre la bêta privée" / "Join the private beta"
- **D-04** — 4 feature blocks in order: Client CRM → AI Analysis → Coaching Programs → CRM-to-ERP (Roadmap tag)
- **D-05** — Placeholder video frame at launch; real video deferred. Dark/orange gradient frame, Ziko logo + play icon, caption "Démo bientôt disponible" / "Demo coming soon"
- **D-06** — Competitors named explicitly: Trainerize and TrueCoach
- **D-07** — 3 comparison rows: AI-native tools / Client data depth / Integrated athlete mobile app
- **D-08** — Founder section ships with placeholder (TODO comment); real content provided before go-live
- **D-09** — Mission tagline: "Built by athletes, for coaches."
- **D-10** — New file: `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx`; uses existing `(marketing)` layout
- **D-11** — SSG: `generateStaticParams` + `setRequestLocale`; two locales: `['fr', 'en']`
- **D-12** — next-intl namespace: `coachs.*` for all copy

### Claude's Discretion
- Exact Tailwind layout, spacing, and typography within the existing marketing site aesthetic
- FAQ questions and answers (6 items fully specified in UI-SPEC)
- OG metadata title/description copy (fully specified in UI-SPEC)
- Section ordering (hero → video → feature blocks → comparison → founder → FAQ → CTA footer)

### Deferred Ideas (OUT OF SCOPE)
- Real 60s demo video (placeholder ships instead)
- Testimonials section (no social proof in private beta)
- Pricing page (no pricing model in v1.5 beta)
- Founder photo (placeholder avatar ships; real photo added before go-live)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MKT-01 | Non-authenticated visitor can browse `/coachs` (FR) and `/en/coachs` (EN) with hero, 3–4 feature blocks, FAQ, and footer | SSG shell pattern confirmed from `page.tsx`; `(marketing)` layout auto-provides Header + Footer |
| MKT-02 | "Rejoindre la bêta privée" CTA links to `/coach/onboarding`; no pricing displayed | Route confirmed at `apps/web/src/app/[locale]/coach/onboarding/page.tsx`; simple `<Link href="/coach/onboarding">` |
| MKT-03 | 60s muted auto-play demo video — CONTEXT D-05 defers real video; placeholder ships | Placeholder `<div>` with `aspect-video` gradient + centered Ziko logo + play icon satisfies the section presence requirement |
| MKT-04 | Honest comparison table vs Trainerize / TrueCoach (key features only, no testimonials) | Pure HTML `<table>` with Tailwind — no library needed; 3-column layout per D-07 |
| MKT-05 | Page is fully static (SSG), CNIL-compliant (self-hosted fonts), SEO-optimized with OG metadata | `next/font` (Inter) already used site-wide; `generateStaticParams` + `generateMetadata` pattern confirmed; OG image must be created as `/public/og-coachs.png` |
| MKT-06 | "Built by athletes, for coaches." founder section | Blockquote card with TODO placeholders per D-08/D-09 |
</phase_requirements>

---

## Summary

Phase 31 is a **pure static marketing page** — no backend, no auth, no new packages. The entire implementation is: one new `page.tsx`, seven new component files, two i18n JSON additions, and one static OG image. All dependencies (framer-motion 12, react-icons 5, next-intl 4, Next.js 15, Tailwind) are already installed.

The existing `apps/web/src/app/[locale]/(marketing)/page.tsx` is the exact template to clone. It uses `generateStaticParams`, `setRequestLocale`, `generateMetadata` with `await params`, and `useTranslations` — the same pattern `coachs/page.tsx` must follow. The `(marketing)` layout auto-provides Header + Footer with zero configuration.

The UI-SPEC is comprehensive and pixel-perfect. Every copy string, color value, spacing token, animation variant, and accessibility attribute is already specified. The planner should reference the UI-SPEC directly for implementation details rather than re-deriving them.

**Primary recommendation:** Treat the UI-SPEC as the single implementation source of truth. Clone the home page SSG shell, wire the `coachs.*` namespace, build 7 components, create `/og-coachs.png`, and ship.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page routing (FR/EN) | Frontend Server (SSR/SSG) | — | `generateStaticParams` at build time; `setRequestLocale` per request |
| i18n copy (all sections) | Frontend Server (SSG) | Client (hydration) | `getTranslations` server-side in `generateMetadata`; `useTranslations` in Client Components |
| Animation (framer-motion) | Browser / Client | — | All motion variants are `'use client'` components; server renders skeleton HTML |
| OG metadata | Frontend Server (SSG) | CDN/Static | `generateMetadata` runs at build; output is static HTML `<meta>` tags |
| CTA routing (/coach/onboarding) | Browser / Client | — | Simple `<Link href>` — no server call |
| Static assets (OG image) | CDN / Static | — | `/public/og-coachs.png` served directly from Vercel edge |

---

## Standard Stack

### Core (pre-installed, no new packages required)

| Library | Installed Version | Purpose | Source |
|---------|-------------------|---------|--------|
| Next.js | 15.5.14 | SSG, `generateStaticParams`, `generateMetadata` | [VERIFIED: apps/web/package.json] |
| next-intl | ^4.8.3 | `useTranslations`, `setRequestLocale`, `getTranslations` (server) | [VERIFIED: apps/web/package.json] |
| framer-motion | ^12.38.0 | All animation variants (`fadeIn`, `fadeUp`, `containerVariants`, `AnimatePresence`) | [VERIFIED: apps/web/package.json] |
| react-icons | ^5.6.0 | Ionicons 5 (`react-icons/io5`) — `IoPeopleOutline`, `IoSparklesOutline`, `IoCalendarOutline`, `IoRocketOutline`, `IoCheckmarkCircleOutline`, `IoCloseCircleOutline`, `IoChevronDownOutline`, `IoPlayOutline` | [VERIFIED: apps/web/package.json] |
| Tailwind CSS | v4 (inferred from site) | All layout, spacing, color utilities | [VERIFIED: existing components use Tailwind v4 syntax] |

**No new packages to install.** This phase is zero-dependency-addition.

### Motion Utilities (from `@/lib/motion`)

The file `apps/web/src/lib/motion.ts` already exports:

| Export | Type | Value |
|--------|------|-------|
| `fadeUp` | `Variants` | `hidden: { opacity:0, y:30 }` / `visible: { opacity:1, y:0, transition: easeOut }` |
| `fadeIn` | `Variants` | `hidden: { opacity:0 }` / `visible: { opacity:1, transition: { duration:0.4 } }` |
| `staggerContainer` | `Variants` | `staggerChildren: 0.1, delayChildren: 0.1` |
| `scaleIn` | `Variants` | `hidden: { opacity:0, scale:0.95 }` / `visible: { opacity:1, scale:1, transition: easeOut }` |
| `easeOut` | `Transition` | `duration:0.5, ease:[0.16,1,0.3,1]` |

The hero word-stagger uses a **local** `containerVariants` + `wordVariants` defined inside `Hero.tsx` — not from the shared lib. `CoachsHero` must define its own `containerVariants` the same way (staggerChildren:0.14, wordVariants: opacity+y). `ctaHover` and `ctaTap` are also imported from `@/lib/motion` in Hero.tsx. [VERIFIED: Hero.tsx source]

### i18n Pattern (confirmed from codebase)

**Server components / metadata:**
```ts
// In generateMetadata and Server Components:
const t = await getTranslations({ locale, namespace: 'coachs' })
```

**Client components:**
```ts
'use client'
import { useTranslations } from 'next-intl'
const t = useTranslations('coachs')
t('hero.badge')  // dot-notation path within namespace
```

**Important:** `setRequestLocale(locale)` is called at the TOP of the page component function, before any `await`. [VERIFIED: page.tsx line 43]

### SSG Shell Pattern (confirmed from `page.tsx`)

```ts
// apps/web/src/app/[locale]/(marketing)/coachs/page.tsx

type Props = { params: Promise<{ locale: string }> }

export async function generateStaticParams() {
  return [{ locale: 'fr' }, { locale: 'en' }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  // use getTranslations for metadata strings
}

export default async function CoachsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  // render components
}
```

No `force-dynamic`, no `revalidate = 0` — those are for `(coach)` authenticated pages only. Marketing pages are SSG. [VERIFIED: CONTEXT.md §Architecture citing Phase 23 D-15]

---

## Package Legitimacy Audit

No new packages are installed in this phase. All libraries (`framer-motion`, `react-icons`, `next-intl`, `next`) are pre-existing in `apps/web/package.json` and were vetted in prior phases.

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none  
**No new packages to audit.**

---

## Architecture Patterns

### System Architecture Diagram

```
Build time (SSG):
  generateStaticParams(['fr','en'])
    → generateMetadata(locale)   → <meta og:title, og:image /og-coachs.png>
    → CoachsPage(locale)
         → setRequestLocale(locale)
         → [renders 7 Server Component wrappers]
              → CoachsHero          (Client — framer-motion)
              → CoachsVideoPlaceholder (Client — framer-motion)
              → CoachsFeatureBlocks  (Client — framer-motion + useInView)
              → CoachsComparisonTable (Client — framer-motion + useInView)
              → CoachsFounderSection  (Client — framer-motion + useInView)
              → CoachsFAQ            (Client — framer-motion + AnimatePresence)
              → CoachsCtaFooter      (Client — framer-motion + useInView)

Request time (static):
  Vercel CDN → pre-built HTML + hydration bundle
  <Link href="/coach/onboarding"> → Next.js client-side navigation
```

### Recommended Project Structure

```
apps/web/src/
├── app/[locale]/(marketing)/
│   ├── layout.tsx              ← EXISTING (Header + Footer)
│   ├── page.tsx                ← EXISTING (home page — clone this)
│   └── coachs/
│       └── page.tsx            ← NEW (Phase 31)
├── components/marketing/
│   ├── Hero.tsx                ← EXISTING
│   ├── HowItWorks.tsx          ← EXISTING
│   ├── Pricing.tsx             ← EXISTING
│   ├── CoachsHero.tsx          ← NEW
│   ├── CoachsVideoPlaceholder.tsx ← NEW
│   ├── CoachsFeatureBlocks.tsx ← NEW
│   ├── CoachsComparisonTable.tsx ← NEW
│   ├── CoachsFounderSection.tsx ← NEW
│   ├── CoachsFAQ.tsx           ← NEW
│   └── CoachsCtaFooter.tsx     ← NEW
└── lib/
    └── motion.ts               ← EXISTING (reuse fadeUp, fadeIn, ctaHover, ctaTap)

apps/web/public/
└── og-coachs.png               ← NEW (1200×630, dark bg, ZIKO white, orange subtitle)

apps/web/messages/
├── fr.json                     ← ADD "coachs": { ... } (~52 keys)
└── en.json                     ← ADD "coachs": { ... } (~52 keys)
```

### Pattern 1: Component is always `'use client'` with `useTranslations`

All 7 new components use animations, so they are `'use client'` components. They call `useTranslations('coachs')` directly.

```tsx
// Source: verified from Hero.tsx pattern
'use client'
import { useTranslations } from 'next-intl'
import { motion, useInView } from 'framer-motion'
import { fadeUp } from '@/lib/motion'

export function CoachsCtaFooter() {
  const t = useTranslations('coachs')
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  return (
    <section ref={ref} className="py-24 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        {t('cta.heading')}
      </motion.div>
    </section>
  )
}
```

### Pattern 2: FAQ accordion with AnimatePresence

```tsx
// Source: UI-SPEC motion contract
const [openIndex, setOpenIndex] = useState<number | null>(null)

<AnimatePresence>
  {openIndex === i && (
    <motion.div
      key="answer"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{ overflow: 'hidden' }}
    >
      <p className="text-base text-muted leading-relaxed py-4">{t(`faq.a${i+1}`)}</p>
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 3: useInView stagger for feature cards

```tsx
// Source: UI-SPEC motion contract
const ref = useRef(null)
const inView = useInView(ref, { once: true, margin: '-80px' })

<div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-8">
  {features.map((f, i) => (
    <motion.div
      key={f.key}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* card content */}
    </motion.div>
  ))}
</div>
```

### Anti-Patterns to Avoid

- **`force-dynamic` on marketing pages:** Only `(coach)` authenticated pages need `force-dynamic`. Marketing pages MUST be SSG. Adding `force-dynamic` breaks static generation. [VERIFIED: CONTEXT.md citing Phase 23 D-15]
- **Hardcoded strings:** Every user-facing string goes through `t('coachs.key')` — no hardcoded French or English text in components.
- **Using `Alert` from react-native in web:** N/A for web pages (no `showAlert` needed here — no interactive forms).
- **`params` without `await`:** In Next.js 15, `params` is a Promise. Must `await params` before destructuring `locale`. [VERIFIED: page.tsx line 11 `type Props = { params: Promise<{ locale: string }> }`]
- **Missing `setRequestLocale`:** Must be called at the top of the page component (before any `await`) for static locale rendering to work. [VERIFIED: page.tsx line 43]
- **Creating a new layout.tsx:** No new layout file — `(marketing)` layout already provides Header + Footer.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animation variants | Custom CSS keyframes | `framer-motion` variants (already installed) | Consistent with rest of marketing site; `useInView`, `AnimatePresence` for accordion |
| Accordion open/close | Custom height calculation | `AnimatePresence` + `motion.div height: 'auto'` | Handles arbitrary content height without JS measurement |
| i18n | String constants file | `useTranslations('coachs')` / `getTranslations` | Already integrated; locale routing handled by next-intl middleware |
| Icons | SVG files | `react-icons/io5` (Ionicons 5) — already installed | Same icon library as all existing marketing components |
| OG image generation | Dynamic `/api/og` route | Static `/public/og-coachs.png` file | Page is SSG — no need for dynamic generation; simpler and faster |

**Key insight:** This phase adds zero new dependencies. Every tool needed is already wired into the project. The only "new" artifact is the OG image file.

---

## MKT-03 Resolution: Video Placeholder vs. Real Video

**Requirement (MKT-03):** "The page includes a 60s muted auto-play demo video showing the coach CRM in action."

**CONTEXT.md D-05 (locked):** Real video is deferred. A placeholder ships at launch.

**Resolution:** The `CoachsVideoPlaceholder` component satisfies MKT-03 at the structural level. The DOM section exists, the `<section>` is present, and the visual treatment signals "video coming." When the real video is available, it replaces the placeholder `<div>` with:

```tsx
// Future swap — not in scope for Phase 31:
<video autoPlay muted loop playsInline className="w-full aspect-video rounded-2xl">
  <source src="/demo-coachs.mp4" type="video/mp4" />
</video>
```

The placeholder structure uses `aspect-video` so the swap is dimension-safe. The plan should include a `// TODO: replace with real video when available` comment in `CoachsVideoPlaceholder.tsx`.

---

## OG Image Requirements

The SEO metadata contract specifies `/og-coachs.png` (1200×630):
- Background: `#1C1A17` (dark)
- "ZIKO" in white, 72px, font-bold, centered
- Subtitle "La CRM coaching à l'IA" in `#FF5C1A` (orange), 40px, below the logo

**Implementation approach:** Create as a static file in `apps/web/public/og-coachs.png`. The simplest approach is a basic HTML-rendered screenshot or a manually designed image. **The plan should include a Wave 0 task to create this asset** — the page will 404 on OG image if it's missing.

Since there is no `@vercel/og` setup in the existing project (home page uses `/public/og-image.png` as a static file), follow the same pattern: **static PNG in `/public/`**. [VERIFIED: apps/web/public/ lists `og-image.png` as static file]

---

## Common Pitfalls

### Pitfall 1: `params` not awaited in Next.js 15
**What goes wrong:** `const { locale } = params` (without await) causes a TypeScript error and runtime failure in Next.js 15 where params is a Promise.
**Why it happens:** Next.js 15 changed params to async. Developers copy old patterns.
**How to avoid:** Always `const { locale } = await params` — confirmed pattern in existing `page.tsx`.
**Warning signs:** TypeScript error on `params.locale`.

### Pitfall 2: `setRequestLocale` called after `await`
**What goes wrong:** Static rendering fails; locale is not set before async operations complete.
**Why it happens:** Developer places `setRequestLocale` after the first `await` in the component.
**How to avoid:** Call `setRequestLocale(locale)` immediately after `await params`, before any other `await`.

### Pitfall 3: `useInView` firing on every render (not `once: true`)
**What goes wrong:** Animations re-trigger when scrolling back up, causing visual jank.
**How to avoid:** Always `useInView(ref, { once: true })` for entrance animations. [VERIFIED: pattern from UI-SPEC]

### Pitfall 4: i18n key mismatches between FR and EN files
**What goes wrong:** `useTranslations` throws if a key exists in `fr.json` but not in `en.json`.
**How to avoid:** Add all 52 keys to BOTH `fr.json` and `en.json` in the same task. Never add to one without the other.

### Pitfall 5: Missing OG image file
**What goes wrong:** `og:image` metadata points to `/og-coachs.png` but the file doesn't exist → broken social sharing cards.
**How to avoid:** Create `/public/og-coachs.png` in Wave 0 (before the page references it in metadata).

### Pitfall 6: CRM mock card in hero using `rotateY` (not in UI-SPEC)
**What goes wrong:** Hero.tsx uses `rotateY: 8` on phone mock, but UI-SPEC for `CoachsHero` specifies `initial={{ opacity:0, x:80 }}` without `rotateY`. Don't copy the phone mockup animation — it's a different visual element.
**How to avoid:** Follow UI-SPEC hero card spec literally: `initial={{ opacity:0, x:80 }} animate={{ opacity:1, x:0 }}` with parallax `useTransform`.

---

## Code Examples

### generateStaticParams + generateMetadata (SSG shell)

```tsx
// Source: verified from apps/web/src/app/[locale]/(marketing)/page.tsx
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

type Props = { params: Promise<{ locale: string }> }

export async function generateStaticParams() {
  return [{ locale: 'fr' }, { locale: 'en' }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'coachs' })
  return {
    title: { absolute: t('meta.title') },
    description: t('meta.description'),
    alternates: {
      canonical: `/${locale}/coachs`,
      languages: { fr: '/fr/coachs', en: '/en/coachs' },
    },
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      url: `/${locale}/coachs`,
      siteName: 'Ziko',
      images: [{ url: '/og-coachs.png', width: 1200, height: 630 }],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
  }
}

export default async function CoachsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <main>
      <CoachsHero />
      <CoachsVideoPlaceholder />
      <CoachsFeatureBlocks />
      <CoachsComparisonTable />
      <CoachsFounderSection />
      <CoachsFAQ />
      <CoachsCtaFooter />
    </main>
  )
}
```

### Primary CTA button (consistent with Hero.tsx)

```tsx
// Source: verified from Hero.tsx + UI-SPEC
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ctaHover, ctaTap } from '@/lib/motion'

<motion.div whileHover={ctaHover} whileTap={ctaTap}>
  <Link
    href="/coach/onboarding"
    className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-xs inline-block"
    style={{ boxShadow: '0 4px 20px rgba(255,92,26,0.30)' }}
  >
    {t('hero.cta')}
  </Link>
</motion.div>
```

Note: `ctaHover` and `ctaTap` are exported from `@/lib/motion` — they are the same values used in the existing Hero.tsx. [VERIFIED: Hero.tsx imports line 6]

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `params.locale` (direct) | `await params` then destructure | Next.js 15 change — params is now a Promise |
| `useIntersectionObserver` custom hook | `useInView` from framer-motion | Simpler API, already available |
| Static height accordion | `AnimatePresence` + `height: 'auto'` | framer-motion handles variable height natively |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ctaHover` and `ctaTap` are exported from `@/lib/motion` | Code Examples | If not exported, must define inline — low impact |
| A2 | The `(marketing)` layout uses `<Header />` + `<Footer />` and `coachs/page.tsx` inherits it without any layout.tsx in the `coachs/` directory | Architecture | If a `coachs/layout.tsx` is needed, add it — zero risk |
| A3 | `/coach/onboarding` resolves correctly as a relative Next.js link (no locale prefix needed in `<Link href>`) | Don't Hand-Roll | next-intl's `Link` from `next-intl/navigation` handles locale prefixing automatically; if using native `next/link`, locale prefix must be added manually |

**Note on A3 (IMPORTANT):** Check whether existing CTAs in the marketing site use `next/link` or `next-intl`'s `Link`. If they use `next-intl`'s `Link`, the CTA href should be `/coach/onboarding` (no locale). If they use `next/link`, it should be `/${locale}/coach/onboarding`. Verify in Hero.tsx — it uses `<motion.a href="...">` for external links, not internal Link components. The onboarding CTA is an internal route: use `next/link` with `href={`/${locale}/coach/onboarding`}` or use next-intl's typed `Link`.

---

## Open Questions (RESOLVED)

1. **OG image creation method**
   - What we know: Must be a static 1200×630 PNG at `/public/og-coachs.png`
   - What's unclear: Whether the planner should include a "create manually" step or a code-based approach (e.g., HTML canvas script)
   - Recommendation: Plan includes a manual creation task (design the PNG once, check in to public/). A code-based generator is overkill for a one-time static asset.
   - RESOLVED: Plan 31-01 Task 1 creates `/public/og-coachs.png` as a static PNG via a minimal Node.js canvas script. Static file in public/ — no dynamic OG route.

2. **`next-intl` Link vs `next/link` for CTA**
   - What we know: Hero.tsx uses `<motion.a href="...">` for external links
   - What's unclear: Whether internal coach routes should use next-intl's typed `useRouter`/`Link` or plain `next/link`
   - Recommendation: Use `import Link from 'next/link'` with explicit locale prefix: `href={`/${locale}/coach/onboarding`}` passed from the server page as a prop, or hardcode `/fr/coach/onboarding` and `/en/coach/onboarding` via the locale variable. This matches Phase 24/25's established patterns.
   - RESOLVED: Plan 31-02 Task 1 uses `import Link from 'next/link'` with explicit `href={`/${locale}/coach/onboarding`}` — locale prop passed down from the server page component. Confirmed consistent with Phase 24/25 established patterns.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 31 is purely static page creation. No external services, CLIs, or runtimes beyond the existing Next.js build pipeline.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Not applicable for this phase |
| Quick run command | `cd apps/web && npm run build` (SSG build smoke test) |
| Full suite command | `cd apps/web && npm run build && npm run type-check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| MKT-01 | `/coachs` and `/en/coachs` render without error | Build smoke | `npm run build` — both routes appear in SSG output | Build fails if routes error |
| MKT-02 | CTA links to `/coach/onboarding` | Visual manual | Navigate to page, click CTA | |
| MKT-03 | Video placeholder section exists in DOM | Visual manual | Inspect page DOM | Placeholder div present |
| MKT-04 | Comparison table present with 3 rows | Visual manual | View page | |
| MKT-05 | SSG + OG metadata | Build smoke + manual | `npm run build` checks routes; inspect `<head>` for OG tags | |
| MKT-06 | Founder section present with TODO comment | Code review | `grep -r "TODO.*founder" apps/web/src/components/marketing/CoachsFounderSection.tsx` | |

### Wave 0 Gaps
- [ ] `/public/og-coachs.png` — must exist before page references it in metadata
- [ ] `"coachs"` namespace in `fr.json` and `en.json` — must exist before components use `useTranslations('coachs')`
- [ ] TypeScript passes on new components: `cd apps/web && npm run type-check`

---

## Security Domain

This phase has no authentication, no form submissions, no user input, no backend routes, and no data handling. It is a fully static public marketing page.

**ASVS:** Not applicable. The page renders pre-built HTML served from CDN. No session, no auth, no input validation surface.

**CNIL compliance (MKT-05):** Satisfied by `next/font` (Inter) which self-hosts the font at build time — no Google Fonts CDN call at runtime. This is the existing pattern site-wide. [VERIFIED: existing marketing site uses `next/font`]

---

## Sources

### Primary (HIGH confidence)
- `apps/web/src/app/[locale]/(marketing)/page.tsx` — SSG shell pattern (generateStaticParams, generateMetadata, setRequestLocale)
- `apps/web/src/app/[locale]/(marketing)/layout.tsx` — confirms Header + Footer provided automatically
- `apps/web/src/components/marketing/Hero.tsx` — confirms animation patterns (containerVariants, wordVariants, fadeIn, fadeUp, ctaHover, ctaTap, useScroll/useTransform)
- `apps/web/src/lib/motion.ts` — confirms available exports (fadeUp, fadeIn, staggerContainer, scaleIn, easeOut, ctaHover, ctaTap)
- `apps/web/package.json` — confirms all package versions (framer-motion 12, react-icons 5, next-intl 4, Next.js 15)
- `apps/web/messages/fr.json` — confirms i18n file structure and namespace convention (top-level object keys)
- `apps/web/public/` — confirms static asset convention (og-image.png exists as static PNG)
- `.planning/phases/31-public-marketing-coachs/31-CONTEXT.md` — all locked decisions D-01..D-12
- `.planning/phases/31-public-marketing-coachs/31-UI-SPEC.md` — complete pixel-perfect implementation spec

### Secondary (MEDIUM confidence)
- `.planning/phases/31-public-marketing-coachs/31-CONTEXT.md §canonical_refs` — Phase 23 D-15 reference confirming `force-dynamic` not needed on marketing pages

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json; all patterns verified from existing source files
- Architecture: HIGH — SSG shell cloned from existing page.tsx; layout inheritance verified from layout.tsx
- Pitfalls: HIGH — Next.js 15 async params confirmed from existing code; animation patterns confirmed from Hero.tsx

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable stack — Next.js 15 + next-intl 4 are not fast-moving at this version)
