---
phase: 4
slug: seo-performance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework in ziko-web |
| **Config file** | none |
| **Quick run command** | `cd /c/ziko-web && npm run build` |
| **Full suite command** | `cd /c/ziko-web && npm run build && npm start` (then manual smoke) |
| **Estimated runtime** | ~30-60 seconds (Next.js build) |

---

## Sampling Rate

- **After every task commit:** Run `cd /c/ziko-web && npm run build` (verify static routes, no dynamic regression)
- **After every plan wave:** Run full build + manual curl smoke test of sitemap/robots URLs
- **Before `/gsd:verify-work`:** Lighthouse audit on production URL must pass Core Web Vitals
- **Max feedback latency:** ~60 seconds (build gate)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | SEO-01 | build gate | `npm run build 2>&1 \| grep -E "○\|ƒ"` | ✅ | ⬜ pending |
| 4-01-02 | 01 | 1 | SEO-01 | build gate | `npm run build` (no errors) | ✅ | ⬜ pending |
| 4-01-03 | 01 | 1 | SEO-02 | build gate | `npm run build 2>&1 \| grep -E "○\|ƒ"` | ✅ | ⬜ pending |
| 4-02-01 | 02 | 2 | SEO-03 | smoke | `npm run build && npm start` then `curl http://localhost:3000/sitemap.xml` | ❌ manual | ⬜ pending |
| 4-02-02 | 02 | 2 | SEO-03 | smoke | `npm run build && npm start` then `curl http://localhost:3000/robots.txt` | ❌ manual | ⬜ pending |
| 4-02-03 | 02 | 2 | SEO-02 | build gate | `npm run build 2>&1 \| grep -E "○\|ƒ"` | ✅ | ⬜ pending |
| 4-03-01 | 03 | 3 | SEO-04 | build gate | `npm run build` (no errors) | ✅ | ⬜ pending |
| 4-03-02 | 03 | 3 | SEO-04 | manual | Lighthouse audit on production URL | ❌ manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No test files to create — this phase has no test framework. Validation is build-output and manual audit based.

*Existing infrastructure covers all phase requirements (build gate + manual).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OG image URLs use `https://ziko-app.com` in production | SEO-01 | Requires deployed environment + OG debugger tool | 1. Deploy to Vercel. 2. Open Facebook Sharing Debugger or Twitter Card Validator. 3. Paste production URL. 4. Verify `og:image` shows `https://ziko-app.com/og-image.png`, not `http://localhost`. |
| Canonical links use production domain | SEO-01 | Requires deployed environment | 1. Deploy to Vercel. 2. `curl https://ziko-app.com/ \| grep canonical` — verify `https://ziko-app.com`. 3. `curl https://ziko-app.com/en/ \| grep canonical` — verify `https://ziko-app.com/en`. |
| `/sitemap.xml` returns valid XML | SEO-03 | Requires running server | 1. After build: `curl http://localhost:3000/sitemap.xml` — verify XML response with `<urlset>` element. |
| `/robots.txt` returns valid text | SEO-03 | Requires running server | 1. After build: `curl http://localhost:3000/robots.txt` — verify `Disallow: /supprimer-mon-compte` present. |
| Core Web Vitals pass Lighthouse | SEO-04 | Requires production URL, browser-based audit | 1. Deploy to Vercel. 2. Open Chrome DevTools → Lighthouse. 3. Run Performance audit on production URL. 4. Verify LCP < 2.5s, CLS < 0.1, FID/INP < 200ms. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (build gate)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
