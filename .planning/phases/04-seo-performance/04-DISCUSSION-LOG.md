# Phase 4: SEO + Performance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 04-seo-performance
**Areas discussed:** Production domain, OG metadata content, Sitemap scope, Hero image strategy

---

## Production Domain

| Option | Description | Selected |
|--------|-------------|----------|
| ziko.app | Use ziko.app as metadataBase | |
| zikoapp.com | Alternative .com domain | |
| Not decided yet | Use placeholder, swap pre-launch | |
| ziko-app.com | User-provided domain | ✓ |

**User's choice:** `ziko-app.com` (typed as "Other")
**Notes:** Domain is confirmed. `https://ziko-app.com` is the production origin.

---

## Domain — metadataBase approach

| Option | Description | Selected |
|--------|-------------|----------|
| Env var NEXT_PUBLIC_SITE_URL | Already in Phase 1 decisions; flexible | ✓ |
| Hardcode https://ziko-app.com | Simpler, fine since domain is locked | |

**User's choice:** Env var `NEXT_PUBLIC_SITE_URL`
**Notes:** Consistent with Phase 1 plan. Set in Vercel.

---

## OG Metadata — Locale-specific titles

| Option | Description | Selected |
|--------|-------------|----------|
| Locale-specific FR+EN | FR and EN get different titles/descriptions | ✓ |
| Global English only | One set for all locales | |

**User's choice:** Locale-specific FR+EN
**Notes:** Consistent with site-wide i18n approach.

---

## OG Metadata — OG Image

| Option | Description | Selected |
|--------|-------------|----------|
| Static PNG in /public | 1200x630, Ziko brand, simple | ✓ |
| next/og dynamic image | Build-time generated, locale-specific possible | |
| No OG image for now | Skip, add later | |

**User's choice:** Static PNG in /public
**Notes:** Zero runtime cost. Single image shared across all locales.

---

## Sitemap — Account deletion page

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude it | No SEO value, disallow in robots.txt | ✓ |
| Include it | Indexed like any other page | |

**User's choice:** Exclude
**Notes:** Utility flow — not a landing page. robots.txt also disallows it.

---

## Sitemap — Legal pages

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include all pages | Comprehensive sitemap including legal | ✓ |
| Homepage only | Minimal sitemap | |

**User's choice:** Yes, include all pages
**Notes:** Both FR and EN variants of all public pages.

---

## Hero Image — Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Keep CSS frame, add placeholder PNG | Generate PNG, use next/image, swap pre-launch | ✓ |
| Keep CSS frame as-is | No `<img>`, LCP risk | |
| Block Phase 4 until real screenshot | Wait on external asset | |

**User's choice:** Keep CSS frame, add placeholder PNG
**Notes:** Unblocks Phase 4. Real screenshot swap requires zero code changes.

---

## Hero Image — PNG generation method

| Option | Description | Selected |
|--------|-------------|----------|
| Generate via Node.js script | Reproducible, no binary in git | ✓ |
| Commit static PNG | Simplest, tiny file size | |

**User's choice:** Generate via Node.js script
**Notes:** Script in `scripts/generate-placeholder.js`, output committed to `public/`.
