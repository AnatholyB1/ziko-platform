# SEO & Manifest — Design Spec

**Date:** 2026-04-30
**Project:** ziko-web (Next.js 15, next-intl v4, App Router)
**Scope:** Web App Manifest, generated icons, root metadata polish, JSON-LD structured data

---

## Context

The ziko-web landing page already has a solid SEO foundation:
- `generateMetadata()` with title, description, OG, Twitter cards, and hreflang alternates on every page
- `sitemap.ts` with per-locale URLs and `alternates.languages`
- `robots.ts`
- Static `og-image.png` (1200×630) and `favicon.ico`

**Gaps being addressed:**
1. No web app manifest → no theme color, no installability, no home screen icon
2. No generated square icons (only favicon.ico, no PNG 192/512)
3. Root layout metadata lacks title template, `applicationName`, `themeColor`, `manifest`, `appleWebApp`
4. No JSON-LD structured data → missing rich snippet eligibility

---

## 1. Manifest

### File: `src/app/manifest.ts`

Next.js App Router serves this automatically at `/manifest.webmanifest`.

```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ziko',
    short_name: 'Ziko',
    description: 'Coach IA, 17 plugins, iOS & Android',
    start_url: '/fr',
    display: 'standalone',
    background_color: '#F7F6F3',
    theme_color: '#FF5C1A',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

---

## 2. Generated Icons

Next.js App Router supports icon generation via React components using `ImageResponse`.

### `src/app/icon.tsx`
- Generates `/icon.png` at 32×32 (used as favicon fallback)
- Design: white background `#FFFFFF`, letter **Z** centered, color `#FF5C1A`, bold
- Next.js auto-injects `<link rel="icon">` in `<head>`
- Export `size = { width: 32, height: 32 }` and `contentType = 'image/png'`

### `src/app/apple-icon.tsx`
- Generates `/apple-icon.png` at 180×180
- Same visual design as `icon.tsx`
- Next.js auto-injects `<link rel="apple-touch-icon">` in `<head>`

### Manifest icon references
The manifest references `/icon.png` for both 192 and 512 sizes. Browsers download the image once; the `sizes` field is advisory. This avoids needing separate route files.

```ts
icons: [
  { src: '/icon.png', sizes: '192x192', type: 'image/png' },
  { src: '/icon.png', sizes: '512x512', type: 'image/png' },
]
```

For a proper 512×512 icon with full fidelity, generate a second file `src/app/icon2.tsx` at 512×512. This is optional and can be done later.

---

## 3. Root Layout Metadata

**File:** `src/app/layout.tsx`

Add to the existing `metadata` export:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | Ziko',
    default: 'Ziko — L\'appli fitness tout-en-un',
  },
  applicationName: 'Ziko',
  themeColor: '#FF5C1A',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ziko',
  },
}
```

**Title template & translations:** All existing `Metadata.*Title` keys in `messages/fr.json` and `messages/en.json` currently include "— Ziko" (e.g. `"Ziko — L'appli fitness tout-en-un"`, `"Mentions légales — Ziko"`). With `template: '%s | Ziko'` this would produce double branding.

**Fix:** Strip "— Ziko" / "— Ziko" from all `Metadata.*Title` translation values in both locale files so the template handles the brand suffix. Examples:
- `"homeTitle": "Ziko — L'appli fitness tout-en-un"` → `"Ziko — L'appli fitness tout-en-un"` (homepage uses `default`, skip template)
- `"legalTitle": "Mentions légales — Ziko"` → `"Mentions légales"`
- `"privacyTitle": "Politique de confidentialité — Ziko"` → `"Politique de confidentialité"`
- etc.

The homepage `generateMetadata()` sets `title: t('homeTitle')` — since `homeTitle` is the brand phrase itself, it should be set directly as the `default` in root layout instead, and pages use short titles.

---

## 4. JSON-LD Structured Data

### Component: `src/components/seo/JsonLd.tsx`

Minimal server component:

```tsx
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
```

### Usage: `src/app/[locale]/page.tsx`

Two schemas injected in the homepage `<main>`:

**`MobileApplication`:**
```json
{
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  "name": "Ziko",
  "description": "<homeDescription from translations>",
  "operatingSystem": "iOS, Android",
  "applicationCategory": "HealthApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "EUR"
  },
  "url": "https://ziko-app.com",
  "screenshot": "https://ziko-app.com/screen.jpg"
}
```

**`WebSite`:**
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://ziko-app.com",
  "name": "Ziko"
}
```

Both use `getTranslations()` for the description field (locale-aware). The `url` field uses `process.env.NEXT_PUBLIC_SITE_URL`.

JSON-LD is injected on the **homepage only**. Legal/policy pages do not get structured data.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/manifest.ts` | Web app manifest |
| `src/app/icon.tsx` | Generated favicon/icon PNG |
| `src/app/apple-icon.tsx` | Generated Apple touch icon |
| `src/components/seo/JsonLd.tsx` | JSON-LD script injector |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Add title template, themeColor, manifest, appleWebApp |
| `src/app/[locale]/page.tsx` | Add `<JsonLd>` with MobileApplication + WebSite schemas |

---

## Out of Scope

- Dynamic OG image generation (`/api/og` route) — static `og-image.png` is sufficient
- Structured data on legal pages — no SEO value
- PWA service worker / offline support — not needed for a marketing landing page
