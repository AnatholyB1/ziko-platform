# Phase 4: SEO + Performance - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Open Graph metadata (with production domain), generate sitemap.xml and robots.txt, verify all routes remain static, and satisfy Core Web Vitals by introducing a `next/image` placeholder in the Hero section.

This phase delivers SEO hardening only. No new marketing content (Phase 3 done), no custom domain DNS (Phase 5), no coach CRM (Milestone 2).

</domain>

<decisions>
## Implementation Decisions

### Production Domain
- **D-01:** Production domain is **`https://ziko-app.com`** — all `metadataBase`, OG image URLs, sitemap entries, and canonical links resolve to this origin.
- **D-02:** `metadataBase` is set via the **`NEXT_PUBLIC_SITE_URL`** env var (already referenced in Phase 1 decisions). Vercel env var set to `https://ziko-app.com`. No hardcoding — allows domain change without code modifications. Fallback: `http://localhost:3000` for local dev.

### OG Metadata
- **D-03:** Page titles and meta descriptions are **locale-specific (FR + EN)** — follow the same `getTranslations()` i18n pattern already established. FR example: `"Ziko — L'appli fitness tout-en-un"`. EN example: `"Ziko — All-in-one fitness app"`.
- **D-04:** OG image is a **static PNG at `/public/og-image.png`** — 1200×630px, Ziko brand colors (`#FF5C1A` primary, `#F7F6F3` background), logo text and tagline. Zero runtime cost. Shared across all locales (no locale-specific OG images needed).
- **D-05:** Each page exports a `generateMetadata()` function (Next.js App Router pattern) — or a shared root-level `metadata` constant for pages that don't need per-locale titles. Homepage and legal pages each get their own titles and descriptions.

### Sitemap
- **D-06:** Sitemap includes **all public pages** for both FR and EN locales:
  - `/` and `/en/` (homepage)
  - `/mentions-legales` and `/en/mentions-legales`
  - `/politique-de-confidentialite` and `/en/politique-de-confidentialite`
  - `/cgu` and `/en/cgu`
- **D-07:** `/supprimer-mon-compte` is **excluded** from the sitemap — it's a utility flow with no SEO value.
- **D-08:** `robots.txt` disallows `/supprimer-mon-compte` explicitly. All other routes are allowed.
- **D-09:** Sitemap implemented as `src/app/sitemap.ts` (Next.js 15 file-based convention — returns `MetadataRoute.Sitemap`). Robots as `src/app/robots.ts` (returns `MetadataRoute.Robots`). Both are statically generated at build time.

### Hero Image (Core Web Vitals)
- **D-10:** The CSS phone frame in `Hero.tsx` is **retained as the visual** — it provides the device chrome (border, shadow, notch). The inner fill currently uses a CSS gradient background.
- **D-11:** A **placeholder PNG** (220×440px, orange-to-light gradient matching the current CSS fill) is generated via a **Node.js script** in the repo (e.g., `scripts/generate-placeholder.js` using `sharp` or `canvas`). The PNG is output to `public/app-screenshot-placeholder.png`. This is a build-time script, not a Vercel build step — run once, commit the output.
- **D-12:** `Hero.tsx` is updated to use `next/image` inside the phone frame's inner area, replacing the CSS gradient div. Props: `priority` (true — it's above the fold), `sizes="(max-width: 768px) 100vw, 220px"`, `alt` from translations.
- **D-13:** Pre-launch swap: replace `app-screenshot-placeholder.png` with the real Expo app screenshot — no code changes needed, just a file replacement.

### Static Rendering Verification
- **D-14:** Phase 4 runs `next build` and confirms ALL `[locale]/*` routes are `○` (static). If any route regressed to `ƒ` (dynamic) due to Phase 3 content work, it must be fixed in this phase.

### Claude's Discretion
- Exact FR/EN copy for page `<title>` tags and `<meta description>` on legal pages and homepage
- `changefreq` and `priority` values in sitemap entries (standard: homepage = `weekly` / `1.0`, legal = `monthly` / `0.3`)
- Whether to add `twitter:card` tags alongside OG tags (standard practice — go ahead)
- OG image visual design details (layout, font size, logo treatment)
- Sharp vs canvas choice for the PNG generation script

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Vision, design tokens, constraints
- `.planning/REQUIREMENTS.md` — SEO-01, SEO-02, SEO-03, SEO-04 acceptance criteria
- `.planning/ROADMAP.md` — Phase 4 success criteria and dependency on Phase 3

### Prior Phase Decisions (locked patterns)
- `.planning/phases/01-foundation/01-CONTEXT.md` — `localePrefix: 'as-needed'` (FR clean URLs, EN `/en/` prefix), `NEXT_PUBLIC_SITE_URL` env var, static rendering pattern
- `.planning/phases/03-marketing-content/03-CONTEXT.md` — Hero CSS phone frame implementation (D-02, D-03), CTA `#` placeholders still in place

### Existing Code (read before implementing)
- `src/app/[locale]/layout.tsx` — Root locale layout; metadata may need a root-level export here
- `src/app/[locale]/page.tsx` — Homepage; needs `generateMetadata()` added
- `src/components/marketing/Hero.tsx` — CSS phone frame to update with `next/image`
- `next.config.ts` — Minimal config; may need `images` config if using external domains (not expected)
- `messages/fr.json` and `messages/en.json` — SEO strings (titles, descriptions, OG alt text) go here under a `Metadata` or `SEO` namespace

No external ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `next-intl` `getTranslations()` pattern — already used in every component; `generateMetadata()` can use `getTranslations('Metadata')` the same way
- `NEXT_PUBLIC_SITE_URL` — referenced in Phase 1 decisions; must be added to Vercel env vars if not already there
- `generateStaticParams()` in `src/app/[locale]/layout.tsx` — all locale routes already static; sitemap must enumerate the same locales (`routing.locales`)

### Established Patterns
- Static rendering: `generateStaticParams` + `setRequestLocale` — already in all pages; `sitemap.ts` and `robots.ts` work the same way (statically generated, no locale wrapper needed)
- Server components throughout — `generateMetadata` is called server-side, consistent with existing pattern
- Container: `max-w-screen-xl mx-auto px-8` — not relevant to metadata but consistent if any SEO UI is added

### Integration Points
- `src/app/sitemap.ts` — new file at app root (not inside `[locale]`); returns all URLs with both locale prefixes
- `src/app/robots.ts` — new file at app root; disallows `/supprimer-mon-compte`
- `public/og-image.png` — new static asset referenced in metadata
- `public/app-screenshot-placeholder.png` — generated by `scripts/generate-placeholder.js`, committed to repo
- `Hero.tsx` inner fill `<div>` → replaced with `<Image>` from `next/image`

</code_context>

<specifics>
## Specific Ideas

- Sitemap generation should import `routing.locales` from `@/i18n/routing` to enumerate locales dynamically — avoids hardcoding `['fr', 'en']` in two places.
- `metadataBase` set once in the root `src/app/layout.tsx` (if it exists) or in the locale layout — check which layout is the outermost.
- The placeholder PNG generation script should be runnable as `node scripts/generate-placeholder.js` and output to `public/`. Document in README as a "run once before first deploy" step.
- Pre-launch swap tasks (already in STATE.md blockers): replace CTA `#` links, replace placeholder PNG with real screenshot.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

**Pre-launch tasks carried forward from Phase 3 (not new scope):**
- Replace all `#` CTA links with real App Store / Play Store URLs
- Replace `app-screenshot-placeholder.png` with real Expo app screenshot

</deferred>

---

*Phase: 04-seo-performance*
*Context gathered: 2026-03-26*
