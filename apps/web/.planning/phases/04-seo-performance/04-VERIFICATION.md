---
phase: 04-seo-performance
verified: 2026-03-27T16:30:00Z
status: gaps_found
score: 3/4 must-haves verified
re_verification: false
gaps:
  - truth: "OG image URLs and canonical links in page <head> use the production domain, not Vercel preview URLs"
    status: failed
    reason: "NEXT_PUBLIC_SITE_URL is set to 'http://localhost:3000' in .env.local. The code correctly reads this variable via metadataBase in root layout.tsx, but no production value is set anywhere in the repo. The built HTML and sitemap.xml both emit localhost:3000 in every og:url, og:image, canonical href, and sitemap <loc> entry."
    artifacts:
      - path: "src/app/layout.tsx"
        issue: "metadataBase reads NEXT_PUBLIC_SITE_URL — correct pattern, but no production value is configured"
      - path: "src/app/robots.ts"
        issue: "Sitemap URL emits http://localhost:3000/sitemap.xml at build time"
      - path: "src/app/sitemap.ts"
        issue: "All <loc> entries emit http://localhost:3000/* at build time"
      - path: ".env.local"
        issue: "NEXT_PUBLIC_SITE_URL=http://localhost:3000 — no .env.production or Vercel project env var documented"
    missing:
      - "Set NEXT_PUBLIC_SITE_URL=https://ziko-app.com (or actual production domain) as a Vercel project environment variable for Production deployments"
      - "Add .env.production.local (gitignored) or document the Vercel env var requirement in .env.example"
      - ".env.example currently has NEXT_PUBLIC_SITE_URL= (blank) — it should show the expected format e.g. https://ziko-app.com"
human_verification:
  - test: "Confirm production domain and Vercel env var setup"
    expected: "After setting NEXT_PUBLIC_SITE_URL to the real production domain in Vercel dashboard, a production build should emit that domain in all og:url, og:image, canonical, and sitemap URLs"
    why_human: "Cannot verify Vercel project environment variables programmatically from this codebase"
  - test: "Lighthouse audit on production URL"
    expected: "Core Web Vitals pass (LCP, CLS, FID/INP green), hero image loads fast via priority preload"
    why_human: "Requires a live production deployment and browser-based audit tool"
---

# Phase 4: SEO + Performance Verification Report

**Phase Goal:** Every page is confirmed static, Open Graph metadata resolves to production URLs, a sitemap and robots.txt are accessible at those paths, and the hero image passes Core Web Vitals on a Lighthouse audit.

**Verified:** 2026-03-27T16:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OG image URLs and canonical links use the production domain | ✗ FAILED | Built HTML emits `http://localhost:3000` in all og:url, og:image, and canonical href attributes. Sitemap and robots.txt also emit localhost URLs. Root cause: `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local`, no production override configured. |
| 2 | `next build` shows all `[locale]/*` routes as statically generated — no dynamic regressions | ✓ VERIFIED | Build succeeds (0 errors). All `[locale]/*` routes show `●` (SSG via generateStaticParams). Note: `●` is Next.js notation for "statically prerendered with generateStaticParams" — these pages ARE static HTML. `/robots.txt` and `/sitemap.xml` show `○` (fully static). No `ƒ` (dynamic/server) routes exist. |
| 3 | `/sitemap.xml` and `/robots.txt` return valid responses and are accessible | ✓ VERIFIED | Both files are prerendered as static content (`○`). `robots.ts` returns correct rules including Disallow for `/*/supprimer-mon-compte`. `sitemap.ts` generates 8 localized entries (fr+en for 4 pages) with `alternates.languages`. Structure is valid. URLs contain localhost (blocker for truth #1 in production), but the route accessibility itself is verified. |
| 4 | Hero image loads with `priority` and `sizes` prop set correctly on all `next/image` usages | ✓ VERIFIED | `Hero.tsx` line 63: `priority` prop present. Line 64: `sizes="(max-width: 768px) 100vw, 220px"` — correct responsive sizes. Only one `next/image` usage exists across the entire project. Built HTML confirms `<link rel="preload" as="image" imageSizes="(max-width: 768px) 100vw, 220px" ...>` is emitted in `<head>`. |

**Score:** 3/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/layout.tsx` | Root metadata with `metadataBase` pointing to production URL | ✓ VERIFIED | `metadataBase: new URL(siteUrl)` where `siteUrl = process.env.NEXT_PUBLIC_SITE_URL`. Pattern is correct. Value is wrong at build time (localhost). |
| `src/app/robots.ts` | Valid robots.txt with sitemap URL | ✓ VERIFIED | Returns correct MetadataRoute.Robots. Disallows `/*/supprimer-mon-compte` for both locales. Sitemap URL reads from same env var. |
| `src/app/sitemap.ts` | Valid sitemap with all localized routes | ✓ VERIFIED | Generates 8 entries: fr+en for `/`, `/mentions-legales`, `/politique-de-confidentialite`, `/cgu`. Includes `alternates.languages` for hreflang. Missing `/supprimer-mon-compte` entries (correctly excluded — that page has `robots: {index: false}`). |
| `src/app/[locale]/page.tsx` | generateMetadata with OG tags | ✓ VERIFIED | Full OG + Twitter metadata, canonical with locale, hreflang alternates. Uses relative URLs (`/${locale}`) which Next.js resolves against `metadataBase`. |
| `src/components/marketing/Hero.tsx` | `next/image` with `priority` and `sizes` | ✓ VERIFIED | `priority` set, `sizes="(max-width: 768px) 100vw, 220px"`, `fill` layout, `objectFit: 'cover'`. |
| `public/og-image.png` | OG image file exists | ✓ VERIFIED | File exists at `public/og-image.png`. |
| `.env.example` | Documents required env vars | ✗ STUB | `NEXT_PUBLIC_SITE_URL=` is blank — does not document the expected production value format. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/layout.tsx` | `NEXT_PUBLIC_SITE_URL` | `metadataBase: new URL(siteUrl)` | ✓ WIRED | Code reads env var correctly |
| `src/app/robots.ts` | `NEXT_PUBLIC_SITE_URL` | `${BASE_URL}/sitemap.xml` | ✓ WIRED | Code reads env var correctly |
| `src/app/sitemap.ts` | `NEXT_PUBLIC_SITE_URL` | `${BASE_URL}/${locale}${path}` | ✓ WIRED | Code reads env var correctly |
| `NEXT_PUBLIC_SITE_URL` | Production domain | Environment variable set | ✗ NOT_WIRED | `.env.local` has `http://localhost:3000`. No `.env.production` file. No Vercel env var documented. Production builds will emit localhost URLs. |
| `[locale]/layout.tsx` | Static generation | `generateStaticParams()` | ✓ WIRED | Returns `routing.locales.map(locale => ({ locale }))` — generates `/fr` and `/en` |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase covers metadata, routing config, and static assets, not components rendering dynamic server data.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `next build` compiles without errors | `npx next build` | Exit 0, 16 static pages generated | ✓ PASS |
| All `[locale]/*` routes are statically prerendered | Build output symbols | All show `●` (SSG) or `○` (Static), zero `ƒ` routes | ✓ PASS |
| `/robots.txt` generates correctly | Built body file | Valid User-Agent/Allow/Disallow/Sitemap structure | ✓ PASS |
| `/sitemap.xml` generates correctly | Built body file | Valid XML with 8 localized URL entries | ✓ PASS |
| Hero `<Image>` emits preload hint with correct sizes | Built HTML `<head>` | `<link rel="preload" as="image" imageSizes="(max-width: 768px) 100vw, 220px">` confirmed | ✓ PASS |
| OG URLs use production domain | Built HTML meta tags | `og:url content="http://localhost:3000/fr"` — localhost, not production | ✗ FAIL |
| Canonical URLs use production domain | Built HTML `<link>` | `canonical href="http://localhost:3000/fr"` — localhost, not production | ✗ FAIL |

---

### Requirements Coverage

No `REQUIREMENTS.md` found at `C:/ziko-web/.planning/REQUIREMENTS.md` (file does not exist in the ziko-web project). Requirements SEO-01 through SEO-04 were verified against the stated success criteria from the phase goal directly.

| Requirement | Description (from phase brief) | Status | Evidence |
|-------------|-------------------------------|--------|----------|
| SEO-01 | OG image URLs and canonical links use production domain | ✗ BLOCKED | Built HTML shows localhost:3000 in all OG and canonical tags |
| SEO-02 | All `[locale]/*` routes are static (no regressions) | ✓ SATISFIED | All routes show `●` SSG — prerendered static HTML, no dynamic routes |
| SEO-03 | `/sitemap.xml` and `/robots.txt` accessible and valid | ✓ SATISFIED | Both prerendered as `○` static, valid structure confirmed |
| SEO-04 | Hero image has `priority` + correct `sizes`, Core Web Vitals pass on Lighthouse | ? PARTIAL | `priority` and `sizes` verified in code and built HTML; Lighthouse audit requires live production URL — needs human |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.env.local` | 3 | `NEXT_PUBLIC_SITE_URL=http://localhost:3000` | ✗ Blocker | All OG, canonical, sitemap URLs resolve to localhost in every build using this env file |
| `src/app/[locale]/mentions-legales/page.tsx` | 52–54 | `[A COMPLETER]` placeholders for SIRET, legal form, registered address | ⚠️ Warning | Legal page has unfinished data — not an SEO blocker but visible to users |
| `.env.example` | 3 | `NEXT_PUBLIC_SITE_URL=` (blank, no example value) | ℹ️ Info | Developers cloning the repo get no guidance on expected production value format |

---

### Human Verification Required

#### 1. Vercel Production Environment Variable

**Test:** In the Vercel dashboard for the ziko-web project, confirm that `NEXT_PUBLIC_SITE_URL` is set to the production domain (e.g. `https://ziko-app.com`) for the Production environment.
**Expected:** After setting the variable and redeploying, the production build's HTML should emit the production domain in `og:url`, `og:image`, `canonical`, and all sitemap `<loc>` entries.
**Why human:** Cannot inspect Vercel project environment variables from the codebase.

#### 2. Lighthouse Core Web Vitals Audit

**Test:** Open Chrome DevTools Lighthouse on the production URL (e.g. `https://ziko-app.com/fr`), run a Mobile audit.
**Expected:** LCP < 2.5s, CLS < 0.1, FID/INP < 200ms. Hero image should load fast due to the `priority` preload hint verified in the HTML.
**Why human:** Requires a live deployment and browser-based rendering measurement.

---

### Gaps Summary

One gap blocks the primary SEO goal: **production domain URLs are not emitted**. The implementation pattern is correct — `metadataBase` in the root layout reads `NEXT_PUBLIC_SITE_URL`, which propagates to all relative OG and canonical URLs across every page. The robots.ts and sitemap.ts also read the same variable for absolute URLs. However, the environment variable is set to `http://localhost:3000` in `.env.local` and there is no `.env.production` file nor any documentation of the Vercel project variable. Every production build will emit localhost URLs in metadata until this is configured.

The fix is entirely outside the codebase: set `NEXT_PUBLIC_SITE_URL=https://<production-domain>` in the Vercel project settings for the Production environment. No code changes are required.

The static generation, sitemap/robots structure, hero image optimization, and `next/image` configuration are all correctly implemented and verified.

---

_Verified: 2026-03-27T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
