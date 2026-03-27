# Phase 5: Launch - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Activate the Ziko marketing site on the production custom domain — DNS configured, HTTPS live, real app screenshot in place, Plausible analytics installed, and Google Search Console submission made.

This phase has no new v1 requirements. It verifies and activates all prior work. No new marketing content, no coach CRM, no new components.

</domain>

<decisions>
## Implementation Decisions

### Production Domain
- **D-01:** Production domain is **`https://ziko-app.com`** (locked in Phase 4). All OG URLs, sitemap entries, and canonical links already use this origin via `NEXT_PUBLIC_SITE_URL`.
- **D-02:** Domain is configured via **Vercel dashboard** — add custom domain, update DNS (CNAME or nameservers per registrar), HTTPS auto-provisioned by Vercel. No manual SSL setup needed.
- **D-03:** `NEXT_PUBLIC_SITE_URL=https://ziko-app.com` must be set in Vercel project environment variables (Production environment) before the final deploy.

### App Screenshot
- **D-04:** Real Expo app screenshot is at **`/c/ziko-web/public/screen.jpg`** — already present. `Hero.tsx` must be updated to reference `src="/screen.jpg"` instead of `src="/app-screenshot-placeholder.png"`. No other code changes needed.

### Analytics
- **D-05:** **Plausible Analytics** is installed in this phase — cookieless, privacy-first, no cookie consent banner required.
- **D-06:** Plausible script added to **`src/app/layout.tsx`** (root layout) via a `<Script>` tag from `next/script` with `strategy="afterInteractive"`. Domain: `ziko-app.com`. No custom events for v1 — just pageview tracking.
- **D-07:** Plausible account must exist at plausible.io with `ziko-app.com` added as a site before the script is deployed. The script `data-domain` attribute matches exactly.

### CTA Links
- **D-08:** Hero App Store and Play Store buttons are currently `href="#"` stubs. Phase 5 plan includes a **checklist step** to verify real URLs are available and replace them. If URLs are not yet available, the stubs remain — not a launch blocker, but documented.

### Google Search Console
- **D-09:** After the domain is live on HTTPS, submit to **Google Search Console**:
  1. Add property for `https://ziko-app.com` (domain property or URL-prefix property)
  2. Verify ownership via Vercel DNS TXT record or HTML file method
  3. Submit sitemap URL: `https://ziko-app.com/sitemap.xml`
  4. Request indexing on the homepage URL
- **D-10:** Search Console submission is done **after** confirming the live site loads correctly on the custom domain — not before.

### Launch Checklist Order
- **D-11:** Ordered execution:
  1. Set `NEXT_PUBLIC_SITE_URL` in Vercel env vars
  2. Update Hero.tsx to use `screen.jpg`
  3. Install Plausible script in root layout
  4. Deploy to Vercel (production)
  5. Add custom domain in Vercel dashboard + configure DNS
  6. Confirm HTTPS live at `https://ziko-app.com`
  7. Spot-check all pages and links (no localhost leakage, no broken links)
  8. Submit sitemap to Google Search Console
  9. Verify/replace CTA `href="#"` stubs if App Store URLs available

### Claude's Discretion
- Plausible `<Script>` exact placement within `<head>` vs `<body>` (follow Next.js `next/script` best practice with `strategy="afterInteractive"`)
- Whether to add `<noscript>` fallback for Plausible (standard: skip — Plausible works without JS fallback)
- DNS propagation wait time documentation in plan (typically 5–30 min for Vercel domains)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Vision, design tokens, constraints
- `.planning/REQUIREMENTS.md` — Phase 5 success criteria (custom domain, analytics decision, no broken links)
- `.planning/ROADMAP.md` — Phase 5 success criteria and dependency on Phase 4

### Prior Phase Decisions (locked patterns)
- `.planning/phases/04-seo-performance/04-CONTEXT.md` — Production domain `ziko-app.com`, `NEXT_PUBLIC_SITE_URL` env var, metadataBase setup
- `.planning/phases/03-marketing-content/03-CONTEXT.md` — Hero CSS phone frame, CTA `href="#"` stubs, `next/image` in phone frame inner

### Existing Code (read before implementing)
- `/c/ziko-web/src/app/layout.tsx` — Root layout where Plausible `<Script>` goes
- `/c/ziko-web/src/components/marketing/Hero.tsx` — Update `src` prop from placeholder to `screen.jpg`
- `/c/ziko-web/public/screen.jpg` — Real app screenshot (already present)
- `/c/ziko-web/src/app/sitemap.ts` — Sitemap URL to submit to Search Console

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `next/script` — available via Next.js, no new dependency needed for Plausible
- `NEXT_PUBLIC_SITE_URL` env var — already wired into sitemap.ts and root layout metadataBase; just needs production value set in Vercel

### Established Patterns
- Root layout (`src/app/layout.tsx`) is the right place for global scripts — already handles fonts and metadata
- `public/` directory — static assets served at root; `screen.jpg` already there, just need to update the reference in Hero.tsx

### Integration Points
- `src/app/layout.tsx` → add Plausible `<Script>` inside `<body>` or `<head>`
- `src/components/marketing/Hero.tsx` → change one `src` prop value
- Vercel dashboard → env vars + custom domain (operational, not code)
- Google Search Console → submit sitemap (operational)

</code_context>

<specifics>
## Specific Details

- Real screenshot path: `/c/ziko-web/public/screen.jpg` → served at `/screen.jpg`
- Plausible script tag: `<Script defer data-domain="ziko-app.com" src="https://plausible.io/js/script.js" strategy="afterInteractive" />`
- Sitemap submission URL: `https://ziko-app.com/sitemap.xml`
- D-11 defines the ordered checklist — planner should create tasks that follow this order

</specifics>

<deferred>
## Deferred Ideas

- **Plausible custom events** (App Store click tracking) — ANLT-02 in v2 requirements; not in this phase
- **Search Console rich results** / structured data — v2 SEO work
- **App Store / Play Store real URLs** — if not available at launch time, CTA stubs remain; swap is a 2-line code change post-launch

</deferred>

---

*Phase: 05-launch*
*Context gathered: 2026-03-27*
