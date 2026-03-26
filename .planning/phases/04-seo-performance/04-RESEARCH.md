# Phase 4: SEO + Performance - Research

**Researched:** 2026-03-26
**Domain:** Next.js 15 App Router metadata API, sitemap/robots file conventions, next/image Core Web Vitals, sharp image generation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Production domain is `https://ziko-app.com` — all `metadataBase`, OG image URLs, sitemap entries, and canonical links resolve to this origin.
- **D-02:** `metadataBase` is set via the `NEXT_PUBLIC_SITE_URL` env var. Vercel env var set to `https://ziko-app.com`. Fallback: `http://localhost:3000` for local dev.
- **D-03:** Page titles and meta descriptions are locale-specific (FR + EN) — use the same `getTranslations()` i18n pattern. FR: `"Ziko — L'appli fitness tout-en-un"`. EN: `"Ziko — All-in-one fitness app"`.
- **D-04:** OG image is a static PNG at `/public/og-image.png` — 1200×630px, `#FF5C1A` primary, `#F7F6F3` background, logo text and tagline. Zero runtime cost. Shared across all locales.
- **D-05:** Each page exports a `generateMetadata()` function (Next.js App Router pattern).
- **D-06:** Sitemap includes all public pages for both FR and EN locales: `/`, `/en/`, `/mentions-legales`, `/en/mentions-legales`, `/politique-de-confidentialite`, `/en/politique-de-confidentialite`, `/cgu`, `/en/cgu`.
- **D-07:** `/supprimer-mon-compte` is excluded from the sitemap.
- **D-08:** `robots.txt` disallows `/supprimer-mon-compte` explicitly. All other routes are allowed.
- **D-09:** Sitemap implemented as `src/app/sitemap.ts`. Robots as `src/app/robots.ts`. Both statically generated at build time.
- **D-10:** The CSS phone frame in `Hero.tsx` is retained as the visual.
- **D-11:** A placeholder PNG (220×440px, orange-to-light gradient) generated via `scripts/generate-placeholder.js` using `sharp`. Output to `public/app-screenshot-placeholder.png`. Run once, commit the output.
- **D-12:** `Hero.tsx` updated to use `next/image` inside the phone frame's inner area. Props: `priority` (true — above the fold), `sizes="(max-width: 768px) 100vw, 220px"`, `alt` from translations.
- **D-13:** Pre-launch swap: replace `app-screenshot-placeholder.png` with real Expo app screenshot — no code changes.
- **D-14:** Phase 4 runs `next build` and confirms all `[locale]/*` routes are `○` (static). Any regression to `ƒ` (dynamic) must be fixed in this phase.

### Claude's Discretion

- Exact FR/EN copy for page `<title>` tags and `<meta description>` on legal pages and homepage
- `changefreq` and `priority` values in sitemap entries (standard: homepage = `weekly` / `1.0`, legal = `monthly` / `0.3`)
- Whether to add `twitter:card` tags alongside OG tags (standard practice — go ahead)
- OG image visual design details (layout, font size, logo treatment)
- Sharp vs canvas choice for the PNG generation script (locked to sharp by D-11)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

**Pre-launch tasks carried forward from Phase 3 (not new scope):**
- Replace all `#` CTA links with real App Store / Play Store URLs
- Replace `app-screenshot-placeholder.png` with real Expo app screenshot
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEO-01 | `metadataBase` is set to production domain — OG images and canonical URLs use production URLs, not Vercel preview URLs | D-02: `NEXT_PUBLIC_SITE_URL` env var pattern; `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL)` in locale layout |
| SEO-02 | `next build` output shows all `[locale]/*` routes as `○` (static), not `ƒ` (dynamic) | `generateStaticParams` already in locale layout; `generateMetadata` with `getTranslations` is server-side and statically compatible |
| SEO-03 | Sitemap and `robots.txt` are auto-generated and accessible at `/sitemap.xml` and `/robots.txt` | `src/app/sitemap.ts` and `src/app/robots.ts` — Next.js 15 file-based convention verified |
| SEO-04 | Hero image uses `next/image` with `priority` and correct `sizes` prop; Core Web Vitals pass Lighthouse audit on production URL | `priority` prop valid in Next.js 15.x; `sizes="(max-width: 768px) 100vw, 220px"`; `fill` + `object-fit: cover` inside positioned container |
</phase_requirements>

---

## Summary

Phase 4 delivers four discrete changes to the existing Next.js 15 App Router site: (1) `metadataBase` + `generateMetadata()` across all pages, (2) `sitemap.ts` and `robots.ts` file-based generation, (3) `next/image` in the Hero component, and (4) a static build verification gate.

All patterns are native to Next.js 15 App Router and verified against the official docs (as of Next.js 15.5.14 / docs version 16.2.1). The implementation is additive — no existing routes, components, or data fetching patterns need to change. The `getTranslations()` pattern already established in Phase 3 extends naturally to `generateMetadata()`. Sharp 0.34.5 is already present in the project's `node_modules` (as a transitive dependency of Next.js image optimization); it must be added as an explicit `devDependency` for the generation script.

**Critical finding:** The routing.ts file shows `localePrefix: 'always'` but CONTEXT.md references `as-needed`. The actual code has `'always'`, meaning both `/fr/...` and `/en/...` patterns are used — the sitemap must use `/fr/` prefix for French pages, not clean root URLs. Verify this before writing sitemap entries.

**Primary recommendation:** Implement in three sequential tasks: (P01) OG metadata + metadataBase across all pages; (P02) sitemap.ts + robots.ts + static verification; (P03) Hero next/image + placeholder PNG generation script.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.14 | Metadata API, sitemap/robots file conventions, next/image | Already installed; native metadata support requires no extra packages |
| next-intl | 4.8.3 | `getTranslations()` in `generateMetadata()` | Already established pattern; server-side async API works in metadata functions |
| sharp | 0.34.5 | PNG generation script for placeholder image | Transitive dep of Next.js; must add as explicit devDependency |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` / `node:path` | built-in | Write PNG output from generation script | Generation script only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sharp (D-11 locked) | canvas | canvas requires native bindings and heavier setup; sharp is already present in node_modules as a transitive dep — no reason to add canvas |

**Installation (sharp as explicit devDependency):**
```bash
npm install --save-dev sharp
```

**Version verification:** sharp 0.34.5 confirmed present in `/c/ziko-web/node_modules/sharp/package.json`.

---

## Architecture Patterns

### File Placement

```
src/app/
├── layout.tsx              # Root layout — metadataBase goes here
├── sitemap.ts              # NEW — MetadataRoute.Sitemap (at app root, not inside [locale])
├── robots.ts               # NEW — MetadataRoute.Robots (at app root, not inside [locale])
└── [locale]/
    ├── layout.tsx           # Locale layout — generateMetadata() OR metadata export here
    └── page.tsx             # Homepage — generateMetadata() with locale-specific title/desc
scripts/
└── generate-placeholder.js # NEW — one-time script, outputs public/app-screenshot-placeholder.png
public/
├── og-image.png            # NEW — 1200×630px static OG image
└── app-screenshot-placeholder.png  # NEW — generated by script, committed
messages/
├── fr.json                 # Add Metadata namespace with title/description keys
└── en.json                 # Add Metadata namespace with title/description keys
```

### Pattern 1: metadataBase in Root Layout

The `metadataBase` must be set in `src/app/layout.tsx` (the outermost layout, before `[locale]`). All URL-based metadata fields in child segments will inherit and resolve against this base.

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
```

**Why root layout:** `metadataBase` set in a parent layout applies to all child segments. The locale layout `[locale]/layout.tsx` is a child of the root layout — any `metadataBase` set there would also work, but the root layout is the canonical location per Next.js docs.

### Pattern 2: generateMetadata with next-intl

The existing `getTranslations()` async pattern extends directly to `generateMetadata()`. No special next-intl adapter needed — `getTranslations` works in any async server context including metadata functions.

```typescript
// src/app/[locale]/page.tsx
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { setRequestLocale } from 'next-intl/server'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  return {
    title: t('homeTitle'),
    description: t('homeDescription'),
    alternates: {
      canonical: locale === 'fr' ? '/' : `/${locale}`,
      languages: {
        fr: '/',
        en: '/en',
      },
    },
    openGraph: {
      title: t('homeTitle'),
      description: t('homeDescription'),
      url: locale === 'fr' ? siteUrl : `${siteUrl}/en`,
      siteName: 'Ziko',
      images: [
        {
          url: '/og-image.png', // resolved against metadataBase → absolute URL
          width: 1200,
          height: 630,
          alt: t('ogImageAlt'),
        },
      ],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('homeTitle'),
      description: t('homeDescription'),
      images: ['/og-image.png'],
    },
  }
}
```

**Key:** `getTranslations({ locale, namespace: 'Metadata' })` — pass locale explicitly when used outside a request context that has already set it via `setRequestLocale`.

### Pattern 3: sitemap.ts with localized alternates

```typescript
// src/app/sitemap.ts
import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// IMPORTANT: routing.localePrefix is 'always' — FR uses /fr/ prefix, not clean root URL
// Verify actual URL structure before finalizing

const pages = [
  { path: '', changeFrequency: 'weekly' as const, priority: 1.0 },
  { path: '/mentions-legales', changeFrequency: 'monthly' as const, priority: 0.3 },
  { path: '/politique-de-confidentialite', changeFrequency: 'monthly' as const, priority: 0.3 },
  { path: '/cgu', changeFrequency: 'monthly' as const, priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}/fr${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
    alternates: {
      languages: routing.locales.reduce((acc, locale) => {
        acc[locale] = locale === routing.defaultLocale
          ? `${BASE_URL}/fr${path}`
          : `${BASE_URL}/${locale}${path}`
        return acc
      }, {} as Record<string, string>),
    },
  }))
}
```

**IMPORTANT NOTE on locale prefix:** The actual `routing.ts` has `localePrefix: 'always'` — not `as-needed` as mentioned in CONTEXT.md Phase 1 decisions. This means French URLs are `/fr/...` not `/...`. The sitemap must use `/fr/` for French pages. The implementer must verify the actual browser URL behavior before finalizing sitemap entries.

### Pattern 4: robots.ts

```typescript
// src/app/robots.ts
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/supprimer-mon-compte',
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
```

### Pattern 5: next/image in Hero (CSS phone frame)

The phone frame uses `overflow: hidden` and `position: relative` already — `next/image` with `fill` prop fits naturally inside it. The `priority` prop is valid in Next.js 15.x (deprecated only in Next.js 16).

```typescript
// src/components/marketing/Hero.tsx (updated inner fill section)
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'

// Replace the CSS gradient div with:
<div
  style={{
    width: '100%',
    height: '100%',
    borderRadius: 30,
    position: 'relative',  // required for fill prop
    overflow: 'hidden',
  }}
>
  <Image
    src="/app-screenshot-placeholder.png"
    alt={t('hero.appScreenshotAlt')}
    fill
    style={{ objectFit: 'cover' }}
    priority   // valid in Next.js 15.x; above-the-fold LCP image
    sizes="(max-width: 768px) 100vw, 220px"
  />
</div>
```

**Why `fill` instead of explicit width/height:** The parent div has explicit pixel dimensions (220×440). Using `fill` makes the image expand to fill that container. The `position: relative` on the parent is required when using `fill`.

### Pattern 6: sharp placeholder generation script

```javascript
// scripts/generate-placeholder.js
const sharp = require('sharp')
const path = require('path')

const width = 220
const height = 440

// Create SVG gradient matching the original CSS gradient
const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="60%" y2="100%">
        <stop offset="0%" style="stop-color:#FF5C1A;stop-opacity:1" />
        <stop offset="60%" style="stop-color:#FFB199;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#F7F6F3;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#grad)" rx="30" />
  </svg>
`

const outputPath = path.join(__dirname, '..', 'public', 'app-screenshot-placeholder.png')

sharp(Buffer.from(svg))
  .png()
  .toFile(outputPath)
  .then(() => console.log(`Generated: ${outputPath}`))
  .catch(err => { console.error(err); process.exit(1) })
```

**Run with:** `node scripts/generate-placeholder.js`
**Output:** `public/app-screenshot-placeholder.png` — commit this file.

### Pattern 7: Translation namespace additions

Add a `Metadata` namespace to both `messages/fr.json` and `messages/en.json`:

```json
{
  "Metadata": {
    "homeTitle": "Ziko — L'appli fitness tout-en-un",
    "homeDescription": "Coaching IA, suivi nutrition, GPS running, 17 plugins. Téléchargez Ziko gratuitement.",
    "ogImageAlt": "Ziko — Application fitness tout-en-un",
    "legalTitle": "Mentions légales — Ziko",
    "legalDescription": "Mentions légales de Ziko, application fitness mobile.",
    "privacyTitle": "Politique de confidentialité — Ziko",
    "privacyDescription": "Comment Ziko collecte et traite vos données personnelles.",
    "cguTitle": "Conditions générales d'utilisation — Ziko",
    "cguDescription": "Conditions générales d'utilisation de l'application Ziko.",
    "appScreenshotAlt": "Capture d'écran de l'application Ziko"
  }
}
```

### Anti-Patterns to Avoid

- **Hardcoding `https://ziko-app.com`** in code: Use `process.env.NEXT_PUBLIC_SITE_URL` per D-02.
- **Placing sitemap.ts inside `[locale]/`**: sitemap and robots must live at `src/app/sitemap.ts` and `src/app/robots.ts` (app root), not inside the locale segment.
- **Using `new URL()` without fallback**: `new URL(undefined)` throws at runtime. Always use `|| 'http://localhost:3000'`.
- **Setting `metadataBase` in the locale layout only**: The locale layout is a child layout — if the root `app/layout.tsx` also has metadata, the locale layout's `metadataBase` is used for child pages but does not affect root-level metadata. Safe to set in either; safest to set in root layout.
- **Not passing `locale` to `getTranslations` in `generateMetadata`**: Unlike `page.tsx` where `setRequestLocale(locale)` has already been called before rendering, `generateMetadata` runs before the component tree. Always pass `{ locale, namespace }` explicitly.
- **Using `priority` prop on Next.js 16+**: `priority` is deprecated in Next.js 16 in favor of `preload`. For this project (Next.js 15.5.14), `priority` is valid. Document this for future upgrades.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sitemap XML generation | Custom XML string builder | `src/app/sitemap.ts` returning `MetadataRoute.Sitemap` | Next.js handles XML encoding, namespace declarations, and static generation automatically |
| robots.txt string | Template literal in a route handler | `src/app/robots.ts` returning `MetadataRoute.Robots` | Next.js handles format, content-type header, and static caching |
| OG image generation at runtime | Vercel OG (`@vercel/og`) or `ImageResponse` | Static PNG at `/public/og-image.png` | D-04 locked; zero runtime cost; static PNG is simpler and faster |
| Gradient PNG creation | Raw pixel manipulation | `sharp` with SVG input | sharp handles SVG-to-PNG conversion with proper color rendering in one line |
| Locale-specific OG images | Per-locale image generation | Single shared `/public/og-image.png` | D-04: no locale-specific OG images needed; brand image is language-agnostic |

**Key insight:** Next.js 15's file-based metadata conventions (`sitemap.ts`, `robots.ts`) handle all the boilerplate that developers typically hand-roll (XML namespaces, content-type headers, proper caching headers). Use them.

---

## Common Pitfalls

### Pitfall 1: metadataBase env var not set on Vercel

**What goes wrong:** `metadataBase` evaluates to `http://localhost:3000` in production, causing OG image URLs and canonical links to point to localhost.
**Why it happens:** `NEXT_PUBLIC_SITE_URL` is set in `.env` as `http://localhost:3000` (confirmed in `.env` file) but not yet set in Vercel project environment variables.
**How to avoid:** Add `NEXT_PUBLIC_SITE_URL=https://ziko-app.com` to Vercel project settings before deploying Phase 4. Document as a deployment step in the plan.
**Warning signs:** OG debuggers (Facebook Sharing Debugger, Twitter Card Validator) show `localhost` URLs.

### Pitfall 2: localePrefix mismatch between CONTEXT.md and actual code

**What goes wrong:** Sitemap and canonical URLs use wrong path prefix. CONTEXT.md says `localePrefix: 'as-needed'` (clean FR URLs), but `src/i18n/routing.ts` actually has `localePrefix: 'always'` (both FR and EN use their locale prefix: `/fr/...` and `/en/...`).
**Why it happens:** A decision may have been changed during implementation without updating the CONTEXT.md.
**How to avoid:** Before finalizing sitemap entries, run `next dev` and verify the actual URL of the French homepage in a browser. If it's `/fr/` prefix, update sitemap entries accordingly.
**Warning signs:** Sitemap has `https://ziko-app.com/` but the actual page is at `https://ziko-app.com/fr/`.

### Pitfall 3: generateMetadata causes route to become dynamic

**What goes wrong:** A route that was previously `○` (static) becomes `ƒ` (dynamic) after adding `generateMetadata`.
**Why it happens:** `generateMetadata` introduces a data dependency that Next.js cannot resolve at build time — e.g., using `cookies()`, `headers()`, or uncached `fetch()` inside it.
**How to avoid:** Keep `generateMetadata` using only: (1) `params` (which `generateStaticParams` already covers), (2) `getTranslations()` with explicit locale, (3) env vars. No runtime APIs. This matches the existing pattern.
**Warning signs:** `next build` output changes `○` to `ƒ` for a route after adding metadata.

### Pitfall 4: next/image `fill` prop without positioned parent

**What goes wrong:** Image renders incorrectly (overflows, has 0 height, or stretches) inside the phone frame.
**Why it happens:** The `fill` prop requires the parent element to have `position: relative`, `fixed`, or `absolute`. The phone frame's inner div currently has no explicit `position`.
**How to avoid:** Add `position: 'relative'` to the inner div that replaces the CSS gradient div before placing `<Image fill ... />` inside it.
**Warning signs:** Image appears stretched, invisible, or breaks the phone frame layout.

### Pitfall 5: sharp not declared as explicit devDependency

**What goes wrong:** `node scripts/generate-placeholder.js` fails with `Cannot find module 'sharp'` in a clean CI environment or after `npm ci`.
**Why it happens:** Sharp is currently only a transitive dependency (pulled in by Next.js). A transitive dep may not be installed in all environments, and `npm ci` only installs declared deps.
**How to avoid:** Run `npm install --save-dev sharp` in the ziko-web directory before writing the generation script.
**Warning signs:** Script works locally but fails in CI or after a clean install.

### Pitfall 6: OG image not committed to repository

**What goes wrong:** Production deployment has no OG image at `/og-image.png`.
**Why it happens:** The file is created locally but not committed to git (e.g., accidentally in `.gitignore`, or developer forgot to add it).
**How to avoid:** Verify `public/og-image.png` and `public/app-screenshot-placeholder.png` are tracked by git. The `.gitignore` in this project only ignores `.env` files — PNG files in `public/` should be tracked automatically.
**Warning signs:** `git status` shows the PNG files as untracked after creation.

---

## Code Examples

Verified patterns from official Next.js 15 docs (version 16.2.1, 2026-03-25):

### MetadataRoute.Sitemap type
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
type Sitemap = Array<{
  url: string
  lastModified?: string | Date
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
  alternates?: {
    languages?: Record<string, string>
  }
}>
```

### MetadataRoute.Robots type
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
type Robots = {
  rules: {
    userAgent?: string | string[]
    allow?: string | string[]
    disallow?: string | string[]
    crawlDelay?: number
  } | Array<{ userAgent: string | string[]; allow?: string | string[]; disallow?: string | string[]; crawlDelay?: number }>
  sitemap?: string | string[]
  host?: string
}
```

### metadataBase with openGraph and twitter card
```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export const metadata: Metadata = {
  metadataBase: new URL('https://acme.com'),
  openGraph: {
    images: '/og-image.png', // resolved to https://acme.com/og-image.png
  },
}
```

### next/image with fill + priority (LCP hero image)
```typescript
// Source: https://nextjs.org/docs/app/api-reference/components/image
// priority is valid in Next.js 15.x; deprecated in Next.js 16 in favor of preload prop
<Image
  src="/app-screenshot-placeholder.png"
  alt="App screenshot"
  fill
  style={{ objectFit: 'cover' }}
  priority
  sizes="(max-width: 768px) 100vw, 220px"
/>
// Parent must have: position: 'relative' (or 'fixed' or 'absolute')
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Head>` from `next/head` | `metadata` export / `generateMetadata()` | Next.js 13 (App Router) | Pages Router pattern must not be used in App Router |
| `priority` prop for LCP images | `preload` prop | Next.js 16 | `priority` still valid in Next.js 15.x — no action needed now |
| Static `sitemap.xml` file | `app/sitemap.ts` programmatic generation | Next.js 13.3+ | TypeScript-typed, auto-cached, no manual XML |
| Static `robots.txt` file | `app/robots.ts` programmatic generation | Next.js 13.3+ | Type-safe, consistent with sitemap pattern |

**Deprecated/outdated:**
- `next/head` `<Head>` component: Not supported in App Router — do not use.
- `priority` prop on `next/image`: Valid in Next.js 15.x. Will need migration when upgrading to 16+.
- `themeColor` and `colorScheme` in `metadata` object: Deprecated since Next.js 14, replaced by `generateViewport`.

---

## Open Questions

1. **Actual locale URL prefix (localePrefix mismatch)**
   - What we know: `routing.ts` has `localePrefix: 'always'`, meaning French pages are at `/fr/` not `/`
   - What's unclear: Whether the middleware rewrites `/fr/` to `/` at the edge, making canonical URLs cleaner; what the actual browser URL shows for the French homepage
   - Recommendation: Implementer must `npm run dev` and visit the homepage to confirm the exact URL structure before writing sitemap entries. If `/fr/` is the real URL, use that in the sitemap.

2. **`NEXT_PUBLIC_SITE_URL` on Vercel**
   - What we know: The local `.env` has `NEXT_PUBLIC_SITE_URL=http://localhost:3000`; CONTEXT.md says it must be set to `https://ziko-app.com` in Vercel
   - What's unclear: Whether it has already been added to the Vercel project env vars
   - Recommendation: Include a task step to verify/set this in Vercel dashboard before the phase is considered complete.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|---------|
| Node.js | generate-placeholder.js script | ✓ | v25.7.0 | — |
| sharp | generate-placeholder.js script | ✓ (transitive) | 0.34.5 | — (must add as explicit devDependency) |
| next | Metadata API, sitemap, robots, next/image | ✓ | 15.5.14 | — |
| next-intl | getTranslations in generateMetadata | ✓ | 4.8.3 | — |
| NEXT_PUBLIC_SITE_URL env var (Vercel) | metadataBase production value | ✗ (not set to production domain) | — | `http://localhost:3000` (dev fallback only) |

**Missing dependencies with no fallback:**
- `NEXT_PUBLIC_SITE_URL=https://ziko-app.com` in Vercel project environment variables — must be set before Phase 4 deployment

**Missing dependencies with fallback:**
- `sharp` as explicit devDependency — currently transitive only; must run `npm install --save-dev sharp` in ziko-web

---

## Validation Architecture

Phase 4 has no automated test suite (no test framework detected in `package.json` or project root). Validation is via:
- `next build` static route verification (SEO-02)
- Manual Lighthouse audit on production URL (SEO-04)
- OG debugger tool verification (SEO-01)
- Browser fetch of `/sitemap.xml` and `/robots.txt` (SEO-03)

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEO-01 | OG URLs and canonical links use `https://ziko-app.com` | smoke | `npm run build` (check for build errors) then manual OG debugger | ❌ manual only |
| SEO-02 | All routes show `○` in build output | build gate | `npm run build 2>&1 \| grep -E "○\|ƒ"` | ✅ (build command exists) |
| SEO-03 | `/sitemap.xml` and `/robots.txt` return valid responses | smoke | `npm run build && npm start` then `curl http://localhost:3000/sitemap.xml` | ❌ Wave 0 gap |
| SEO-04 | Core Web Vitals pass Lighthouse audit | manual | Manual Lighthouse run on production URL | ❌ manual only |

### Sampling Rate
- **Per task commit:** `cd /c/ziko-web && npm run build` (verify no dynamic routes introduced)
- **Per wave merge:** Full build + manual smoke test of sitemap/robots URLs
- **Phase gate:** Lighthouse audit on production URL before `/gsd:verify-work`

### Wave 0 Gaps
- No test files to create — this phase has no test framework and validation is build + manual audit based.

---

## Project Constraints (from CLAUDE.md)

The project CLAUDE.md is for the Ziko Platform monorepo (mobile app), not the ziko-web marketing site. The relevant ziko-web constraints are embedded in CONTEXT.md decisions. Key applicable conventions:

- Design tokens: `#FF5C1A` primary, `#F7F6F3` background — must match OG image design
- No dark mode — light sport theme only
- No StyleSheet — use inline style objects (already used in Hero.tsx)
- Ionicons not relevant for this web project

---

## Sources

### Primary (HIGH confidence)
- `https://nextjs.org/docs/app/api-reference/functions/generate-metadata` — verified `generateMetadata`, `metadataBase`, openGraph, twitter card API (version 16.2.1, 2026-03-25)
- `https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap` — verified `MetadataRoute.Sitemap` type, localized sitemap with alternates (version 16.2.1, 2026-03-25)
- `https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots` — verified `MetadataRoute.Robots` type and disallow patterns (version 16.2.1, 2026-03-25)
- `https://nextjs.org/docs/app/api-reference/components/image` — verified `fill`, `priority`, `sizes` props and `priority` deprecation note for Next.js 16 (version 16.2.1, 2026-03-25)
- Direct file reads: `src/i18n/routing.ts`, `src/app/layout.tsx`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/components/marketing/Hero.tsx`, `next.config.ts`, `package.json`, `.env`

### Secondary (MEDIUM confidence)
- next-intl v4.8.3 docs — `getTranslations({ locale, namespace })` pattern for async server contexts including metadata functions; confirmed by existing codebase usage pattern

### Tertiary (LOW confidence)
- Sharp SVG-to-PNG pipeline pattern — inferred from sharp 0.34.5 API (confirmed installed); specific SVG gradient code is a standard pattern not verified against sharp docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from installed node_modules and package.json
- Architecture: HIGH — all patterns verified from official Next.js 15 docs
- Pitfalls: HIGH — localePrefix discrepancy confirmed by reading actual routing.ts vs CONTEXT.md; others inferred from Next.js behavior
- Sitemap locale URLs: MEDIUM — depends on localePrefix: 'always' behavior resolution (open question 1)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable APIs; re-verify if Next.js 16 upgrade is considered)
