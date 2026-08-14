---
status: complete
phase: 04-seo-performance
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-03-27T17:40:00Z
updated: 2026-03-27T17:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. OG image file accessible
expected: Open http://localhost:3000/og-image.png. A 1200×630 branded PNG with orange Ziko design loads (no 404, no broken image).
result: pass

### 2. French page has meta title
expected: Open http://localhost:3000/fr or run `curl -s http://localhost:3000/fr | grep -i '<title'`. Browser tab / title tag shows a French title containing "Ziko" (e.g. "Ziko — Application Fitness & Coaching IA" or similar). NOT "Next.js App" or empty.
result: pass

### 3. English page has different meta title
expected: Open http://localhost:3000/en. Browser tab / title tag shows an English title containing "Ziko" — different wording from the French title.
result: pass

### 4. Sitemap returns valid XML
expected: Run `curl http://localhost:3000/sitemap.xml` (server running after `npm run build && npm start`). Response is valid XML starting with `<?xml` and contains a `<urlset>` element with 8 `<url>` entries — covering /fr, /en, and 3 legal pages × 2 locales.
result: pass

### 5. Robots.txt blocks deletion pages
expected: Run `curl http://localhost:3000/robots.txt`. Response contains `Disallow: /fr/supprimer-mon-compte` and `Disallow: /en/supprimer-mon-compte`. The deletion page is blocked from search indexing.
result: pass

### 6. Hero shows next/image (not CSS gradient)
expected: Open http://localhost:3000/fr. Inspect the phone frame in the Hero section. The inner fill should be a rendered `<img>` element loaded via Next.js image optimization — not a CSS `linear-gradient` background. The image appears as an orange-tinted placeholder PNG.
result: pass

## Summary

total: 6
passed: 6
issues: 0
skipped: 0
pending: 0

## Gaps

[none yet]
