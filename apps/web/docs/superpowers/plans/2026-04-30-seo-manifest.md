# SEO & Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add web app manifest, generated icons, root metadata polish, and JSON-LD structured data to the ziko-web Next.js landing page.

**Architecture:** Six focused changes — a manifest route, two icon-generating routes (Next.js `ImageResponse`), a tiny `JsonLd` server component, root layout metadata additions, and translation key cleanup to avoid double branding. No new dependencies required.

**Tech Stack:** Next.js 15 App Router, TypeScript, `next/og` (ImageResponse), next-intl v4, Schema.org JSON-LD

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/app/manifest.ts` | Web app manifest at `/manifest.webmanifest` |
| Create | `src/app/icon.tsx` | Generates `/icon.png` (32×32) via ImageResponse |
| Create | `src/app/apple-icon.tsx` | Generates `/apple-icon.png` (180×180) via ImageResponse |
| Create | `src/components/seo/JsonLd.tsx` | Injects `<script type="application/ld+json">` |
| Modify | `src/app/layout.tsx` | Add title template, themeColor, manifest, appleWebApp |
| Modify | `src/app/[locale]/page.tsx` | Add JsonLd schemas + fix homepage title to use `absolute` |
| Modify | `messages/fr.json` | Strip "— Ziko" from individual page title keys |
| Modify | `messages/en.json` | Strip "— Ziko" from individual page title keys |

---

## Task 1: JsonLd component

**Files:**
- Create: `src/components/seo/JsonLd.tsx`

- [ ] **Step 1: Create the component**

`src/components/seo/JsonLd.tsx`:
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

- [ ] **Step 2: Type-check**

```bash
cd C:/ziko-web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/ziko-web && git add src/components/seo/JsonLd.tsx && git commit -m "feat(seo): add JsonLd server component"
```

---

## Task 2: Web App Manifest

**Files:**
- Create: `src/app/manifest.ts`

- [ ] **Step 1: Create the manifest route**

`src/app/manifest.ts`:
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

Next.js serves this automatically at `/manifest.webmanifest`.

- [ ] **Step 2: Type-check**

```bash
cd C:/ziko-web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/ziko-web && git add src/app/manifest.ts && git commit -m "feat(seo): add web app manifest"
```

---

## Task 3: Generated Icons

**Files:**
- Create: `src/app/icon.tsx`
- Create: `src/app/apple-icon.tsx`

`next/og` is already available in Next.js 15 — no install needed.

- [ ] **Step 1: Create icon.tsx (32×32 favicon)**

`src/app/icon.tsx`:
```tsx
import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#FFFFFF',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#FF5C1A', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
          Z
        </span>
      </div>
    ),
    { ...size }
  )
}
```

Next.js auto-injects `<link rel="icon" href="/icon.png">` in every page's `<head>`.

- [ ] **Step 2: Create apple-icon.tsx (180×180)**

`src/app/apple-icon.tsx`:
```tsx
import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#FFFFFF',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#FF5C1A', fontSize: 120, fontWeight: 700, lineHeight: 1 }}>
          Z
        </span>
      </div>
    ),
    { ...size }
  )
}
```

Next.js auto-injects `<link rel="apple-touch-icon" href="/apple-icon.png">` in every page's `<head>`.

- [ ] **Step 3: Type-check**

```bash
cd C:/ziko-web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd C:/ziko-web && git add src/app/icon.tsx src/app/apple-icon.tsx && git commit -m "feat(seo): add generated icon and apple-touch-icon"
```

---

## Task 4: Root Layout Metadata

**Files:**
- Modify: `src/app/layout.tsx`

Current file (`src/app/layout.tsx`) — full content for reference:
```tsx
import type { Metadata } from 'next'
import Script from 'next/script'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        {/* Privacy-friendly analytics by Plausible */}
        <Script
          async
          src="https://plausible.io/js/pa-rJuI-Kc3gPygcauGKG7eV.js"
          strategy="afterInteractive"
        />
        <Script
          id="plausible-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`,
          }}
        />
      </body>
    </html>
  )
}
```

- [ ] **Step 1: Replace the metadata export**

Replace:
```ts
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
}
```

With:
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

- [ ] **Step 2: Type-check**

```bash
cd C:/ziko-web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/ziko-web && git add src/app/layout.tsx && git commit -m "feat(seo): add title template, themeColor, manifest and appleWebApp to root layout"
```

---

## Task 5: Translation Keys — Remove Double Branding

**Files:**
- Modify: `messages/fr.json`
- Modify: `messages/en.json`

The root layout now adds `| Ziko` via the template. Individual page titles must not contain "— Ziko" or they'll render as `"Mentions légales — Ziko | Ziko"`. The homepage uses `absolute` (next task) so `homeTitle` stays untouched.

- [ ] **Step 1: Update messages/fr.json**

In the `"Metadata"` object, change these keys:
```json
"legalTitle": "Mentions légales",
"legalDescription": "Mentions légales de Ziko, application fitness mobile.",
"privacyTitle": "Politique de confidentialité",
"privacyDescription": "Comment Ziko collecte et traite vos données personnelles.",
"cguTitle": "CGU",
"cguDescription": "Conditions générales d'utilisation de l'application Ziko.",
"deleteTitle": "Supprimer mon compte",
"deleteDescription": "Demander la suppression de votre compte Ziko."
```

Leave `homeTitle`, `homeDescription`, `ogImageAlt`, `appScreenshotAlt` unchanged.

- [ ] **Step 2: Update messages/en.json**

In the `"Metadata"` object, change these keys:
```json
"legalTitle": "Legal notice",
"legalDescription": "Legal notice for Ziko, a mobile fitness application.",
"privacyTitle": "Privacy policy",
"privacyDescription": "How Ziko collects and processes your personal data.",
"cguTitle": "Terms of use",
"cguDescription": "Terms of use for the Ziko application.",
"deleteTitle": "Delete my account",
"deleteDescription": "Request deletion of your Ziko account."
```

Leave `homeTitle`, `homeDescription`, `ogImageAlt`, `appScreenshotAlt` unchanged.

- [ ] **Step 3: Commit**

```bash
cd C:/ziko-web && git add messages/fr.json messages/en.json && git commit -m "fix(seo): remove brand suffix from page title translation keys"
```

---

## Task 6: Homepage — JSON-LD + Absolute Title

**Files:**
- Modify: `src/app/[locale]/page.tsx`

The homepage title `"Ziko — L'appli fitness tout-en-un"` is a brand statement — it should bypass the `| Ziko` template. Use Next.js `title: { absolute: '...' }` for this.

Also add two JSON-LD schemas via the `JsonLd` component created in Task 1.

- [ ] **Step 1: Update generateMetadata — use absolute title**

In `src/app/[locale]/page.tsx`, find the `generateMetadata` function. Replace:
```ts
return {
  title: t('homeTitle'),
```
With:
```ts
return {
  title: { absolute: t('homeTitle') },
```

This prevents the template from appending `| Ziko` to the homepage title.

- [ ] **Step 2: Add JSON-LD import and schemas to the page component**

At the top of the file, add the import:
```ts
import { JsonLd } from '@/components/seo/JsonLd'
```

Replace the `HomePage` function with:
```tsx
export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Metadata' })
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ziko-app.com'

  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'Ziko',
    description: t('homeDescription'),
    operatingSystem: 'iOS, Android',
    applicationCategory: 'HealthApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    url: siteUrl,
    screenshot: `${siteUrl}/screen.jpg`,
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: siteUrl,
    name: 'Ziko',
  }

  return (
    <main>
      <JsonLd data={appSchema} />
      <JsonLd data={websiteSchema} />
      <Hero />
      <HowItWorks />
      <AICoach />
      <PluginShowcase />
      <Pricing />
    </main>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd C:/ziko-web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd C:/ziko-web && git add src/app/\[locale\]/page.tsx && git commit -m "feat(seo): add JSON-LD structured data to homepage + fix absolute title"
```

---

## Task 7: Build Verification

- [ ] **Step 1: Run production build**

```bash
cd C:/ziko-web && npm run build
```

Expected: build completes with no errors. You should see routes listed including `/manifest.webmanifest`, `/icon.png`, `/apple-icon.png`.

- [ ] **Step 2: Start prod server and spot-check**

```bash
cd C:/ziko-web && npm run start
```

Open `http://localhost:3000` in a browser and check:

1. Browser tab shows `Ziko — L'appli fitness tout-en-un` (no `| Ziko` suffix on homepage)
2. A legal page (e.g. `/fr/cgu`) shows `CGU | Ziko` in the tab
3. DevTools → Application → Manifest shows the Ziko manifest with orange theme color
4. DevTools → Elements → `<head>` contains:
   - `<link rel="manifest" href="/manifest.webmanifest">`
   - `<link rel="icon" href="/icon.png">`
   - `<link rel="apple-touch-icon" href="/apple-icon.png">`
   - `<meta name="theme-color" content="#FF5C1A">`
5. DevTools → Elements → `<body>` of homepage contains two `<script type="application/ld+json">` tags
6. Navigate to `/icon.png` — should render a small white square with orange "Z"
7. Navigate to `/manifest.webmanifest` — should return valid JSON

- [ ] **Step 3: Validate JSON-LD**

Copy the JSON-LD script content from step 5 and paste into [Google's Rich Results Test](https://search.google.com/test/rich-results) (optional, manual step).

- [ ] **Step 4: Final commit if any last-minute fixes**

```bash
cd C:/ziko-web && git add -A && git commit -m "fix(seo): post-build corrections"
```

Only run this step if Step 1 or 2 revealed issues.
