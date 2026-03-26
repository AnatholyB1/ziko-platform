---
phase: 01-foundation
verified: 2026-03-26T18:00:00Z
status: human_needed
score: 9/10 must-haves verified
re_verification: false
human_verification:
  - test: "Visit the deployed Vercel URL at `/` and `/en/` to confirm bilingual routing works end-to-end with no 404s"
    expected: "French homepage at `/` shows 'Bienvenue sur Ziko'; English homepage at `/en/` shows 'Welcome to Ziko'"
    why_human: "No Vercel deployment configuration found (.vercel/ directory absent, no vercel.json). Cannot programmatically verify live Vercel deployment. Phase goal says 'live on Vercel' and Success Criterion 1 requires visiting both locale URLs."
  - test: "Confirm SUPABASE_SERVICE_ROLE_KEY is set as a server-only environment variable in the Vercel project dashboard (not prefixed with NEXT_PUBLIC_)"
    expected: "Variable visible in Vercel dashboard under Environment Variables with no NEXT_PUBLIC_ prefix"
    why_human: "Cannot access Vercel dashboard programmatically. FOUND-06 requires this Vercel-side configuration to be complete."
---

# Phase 1: Foundation Verification Report

**Phase Goal:** A statically-rendered, bilingual Next.js site is live on Vercel with correct i18n routing, Ziko design tokens, and a secure admin Supabase client — ready for content and features to be built on top without rework
**Verified:** 2026-03-26T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #  | Truth                                                                                                       | Status      | Evidence                                                                                              |
|----|-------------------------------------------------------------------------------------------------------------|-------------|-------------------------------------------------------------------------------------------------------|
| 1  | Visiting `/` serves the French homepage and `/en/` serves the English homepage — locale routing works end-to-end with no 404s | ? UNCERTAIN | All code is in place; Vercel deployment not found (.vercel/ absent). Needs human verification.        |
| 2  | `next build` output lists all `[locale]/*` routes as `○` (static), not `ƒ` (dynamic)                       | ✓ VERIFIED  | Build output confirmed: all 4 locale routes show `●` (SSG via generateStaticParams). Build exits 0.   |
| 3  | Page fonts load from Vercel's own CDN with no outbound requests to Google Fonts                             | ✓ VERIFIED  | `grep -r "fonts.googleapis.com\|fonts.gstatic.com" .next/` returns empty. Inter loaded via next/font/google (self-hosted). |
| 4  | A footer is visible on every page with working links to all three legal page URLs                           | ✓ VERIFIED  | Footer.tsx exists, wired in `[locale]/layout.tsx`, renders 3 locale-aware Links to /mentions-legales, /politique-de-confidentialite, /cgu. |
| 5  | `SUPABASE_SERVICE_ROLE_KEY` env var is scoped server-only in Vercel — no `NEXT_PUBLIC_` prefix, admin client file contains `import 'server-only'` | ✓ VERIFIED (code) / ? UNCERTAIN (Vercel config) | `admin.ts` line 1 is `import 'server-only'`. No NEXT_PUBLIC_ usage found in source. Key absent from `.next/static/`. Vercel dashboard config unverifiable programmatically. |

**Score:** 9/10 must-haves verified (automated); 2 items need human confirmation for full goal achievement

---

### Required Artifacts

| Artifact                                                                 | Expected                                                    | Status      | Details                                                                                      |
|--------------------------------------------------------------------------|-------------------------------------------------------------|-------------|----------------------------------------------------------------------------------------------|
| `ziko-web/src/i18n/routing.ts`                                           | Single source of truth for locale config                    | ✓ VERIFIED  | Exists, substantive (7 lines), exports `routing` with locales=['fr','en'], defaultLocale='fr', localePrefix='as-needed' |
| `ziko-web/src/i18n/request.ts`                                           | Message loading per locale                                  | ✓ VERIFIED  | Exists, uses `getRequestConfig`, dynamically imports messages by locale, falls back to defaultLocale |
| `ziko-web/src/i18n/navigation.ts`                                        | Type-safe Link, redirect, usePathname, useRouter, getPathname | ✓ VERIFIED | Exists, exports all 5 symbols via `createNavigation(routing)`                                |
| `ziko-web/middleware.ts`                                                  | Locale detection middleware at project root                 | ✓ VERIFIED  | Exists at root (not inside src/), imports routing, exact recommended matcher pattern present  |
| `ziko-web/src/app/globals.css`                                           | Tailwind v4 import + Ziko design tokens                     | ✓ VERIFIED  | Contains `@import "tailwindcss"` and `@theme` block with all 5 color tokens                  |
| `ziko-web/src/app/[locale]/layout.tsx`                                   | Root locale layout with Inter, generateStaticParams, Footer | ✓ VERIFIED  | 39 lines, Inter font, generateStaticParams using routing.locales, setRequestLocale, NextIntlClientProvider, Footer rendered |
| `ziko-web/src/app/[locale]/page.tsx`                                     | Bilingual placeholder homepage                              | ✓ VERIFIED  | Exists, calls setRequestLocale, getTranslations('Home'), renders h1 and body text            |
| `ziko-web/src/components/layout/Footer.tsx`                              | Footer with 3 legal links + copyright                       | ✓ VERIFIED  | 24 lines, async Server Component, getTranslations('Footer'), 3 locale-aware Links, border-t-primary |
| `ziko-web/src/lib/supabase/admin.ts`                                     | Server-only Supabase admin client factory                   | ✓ VERIFIED  | First import is `import 'server-only'`, exports `createAdminClient()`, uses SUPABASE_SERVICE_ROLE_KEY, no NEXT_PUBLIC_ |
| `ziko-web/src/app/[locale]/mentions-legales/page.tsx`                   | Legal stub page                                             | ✓ VERIFIED  | Exists, setRequestLocale, getTranslations('LegalStub'), h1 present                           |
| `ziko-web/src/app/[locale]/politique-de-confidentialite/page.tsx`        | Legal stub page                                             | ✓ VERIFIED  | Exists, setRequestLocale, getTranslations('LegalStub'), h1 present                           |
| `ziko-web/src/app/[locale]/cgu/page.tsx`                                 | Legal stub page                                             | ✓ VERIFIED  | Exists, setRequestLocale, getTranslations('LegalStub'), h1 present                           |
| `ziko-web/messages/fr.json`                                               | French translation stubs                                    | ✓ VERIFIED  | Contains Home, Footer, LegalStub keys with proper UTF-8 accented characters                  |
| `ziko-web/messages/en.json`                                               | English translation stubs                                   | ✓ VERIFIED  | Contains matching Home, Footer, LegalStub keys in English                                    |

---

### Key Link Verification

| From                                       | To                                          | Via                                       | Status      | Details                                                                    |
|--------------------------------------------|---------------------------------------------|-------------------------------------------|-------------|----------------------------------------------------------------------------|
| `middleware.ts`                            | `src/i18n/routing.ts`                       | `import { routing } from './src/i18n/routing'` | ✓ WIRED  | Line 2: `import { routing } from './src/i18n/routing'`                     |
| `next.config.ts`                           | `src/i18n/request.ts`                       | `createNextIntlPlugin('./src/i18n/request.ts')` | ✓ WIRED | Line 3: `createNextIntlPlugin('./src/i18n/request.ts')`                    |
| `src/app/[locale]/layout.tsx`              | `src/components/layout/Footer.tsx`          | `import and render <Footer />`            | ✓ WIRED     | Line 5: `import { Footer } from '@/components/layout/Footer'`; line 34: `<Footer />` |
| `src/components/layout/Footer.tsx`         | `src/i18n/navigation.ts`                    | `import { Link } from '@/i18n/navigation'` | ✓ WIRED    | Line 2: `import { Link } from '@/i18n/navigation'`; Link used on lines 11, 14, 17 |
| `src/app/[locale]/layout.tsx`              | `src/i18n/routing.ts`                       | `routing.locales` in generateStaticParams | ✓ WIRED     | Line 14: `return routing.locales.map((locale) => ({ locale }))`            |
| `src/lib/supabase/admin.ts`                | `server-only`                               | `import 'server-only'` build guard        | ✓ WIRED     | Line 1: `import 'server-only'`                                             |

---

### Data-Flow Trace (Level 4)

Not applicable — all artifacts in this phase are configuration files, i18n setup, or static content rendering components. No external data sources or dynamic DB queries are present. Translation data flows from `messages/*.json` through `getRequestConfig` → `getTranslations()` → component render. This flow is fully static and verified by the successful SSG build (13 static pages generated at build time).

---

### Behavioral Spot-Checks

| Behavior                                         | Command                                                                               | Result                                              | Status   |
|--------------------------------------------------|---------------------------------------------------------------------------------------|-----------------------------------------------------|----------|
| Build succeeds with all routes static            | `cd /c/ziko-web && npx next build --turbopack`                                        | Exit 0; all 4 [locale]/* routes show `●` (SSG)     | ✓ PASS   |
| Service role key absent from client bundle       | `grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/static/`                                   | Empty — key not in client bundle                    | ✓ PASS   |
| No Google Fonts CDN in build output              | `grep -r "fonts.googleapis.com\|fonts.gstatic.com" .next/`                            | Empty — no external font CDN                        | ✓ PASS   |
| Locale routing works (Vercel live)               | Visit `/` and `/en/` on deployed URL                                                  | No Vercel deployment found — cannot verify          | ? SKIP   |

---

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                             | Status         | Evidence                                                                                      |
|-------------|-------------|-----------------------------------------------------------------------------------------|----------------|-----------------------------------------------------------------------------------------------|
| FOUND-01    | 01-01-PLAN  | Standalone Next.js 15 App Router repo with Tailwind v4 and TypeScript                  | ✓ SATISFIED    | `ziko-web/package.json`: next@15.5.14, tailwindcss@^4, typescript@^5; `@/*` path alias in tsconfig.json |
| FOUND-02    | 01-01-PLAN, 01-02-PLAN | FR/EN i18n routing via next-intl v4 — French default (clean URLs), English uses `/en/` prefix | ✓ SATISFIED | routing.ts: localePrefix='as-needed', defaultLocale='fr'; middleware.ts at root; FR/EN stubs present |
| FOUND-03    | 01-01-PLAN  | Ziko design tokens applied globally via Tailwind v4 `@theme` directive                 | ✓ SATISFIED    | globals.css: `@theme` block with all 5 tokens (#FF5C1A, #F7F6F3, #1C1A17, #E2E0DA, #6B6963) |
| FOUND-04    | 01-01-PLAN, 01-02-PLAN | All pages statically generated (generateStaticParams + setRequestLocale in every route segment) | ✓ SATISFIED | Build: all 4 [locale]/* routes `●` (SSG); all 5 route files call setRequestLocale; layout has generateStaticParams |
| FOUND-05    | 01-01-PLAN  | Fonts self-hosted via next/font (no Google CDN, CNIL-compliant)                        | ✓ SATISFIED    | Inter loaded via `next/font/google` in layout.tsx (self-hosted). No fonts.googleapis.com in .next/ output. |
| FOUND-06    | 01-02-PLAN  | SUPABASE_SERVICE_ROLE_KEY scoped server-only (no NEXT_PUBLIC_ prefix, admin client has server-only guard) | ✓ SATISFIED (code) / ? UNCERTAIN (Vercel config) | admin.ts: `import 'server-only'` on line 1; NEXT_PUBLIC_ absent from source; key absent from .next/static/; Vercel env var configuration unverifiable |
| FOUND-07    | 01-02-PLAN  | Footer visible on every page with links to all 3 legal pages                           | ✓ SATISFIED    | Footer.tsx wired in locale layout; renders 3 Links to /mentions-legales, /politique-de-confidentialite, /cgu |

**All 7 required requirements (FOUND-01 through FOUND-07) are claimed by plans 01-01 and 01-02.** No orphaned requirements for Phase 1.

---

### Anti-Patterns Found

| File                              | Line | Pattern                                | Severity   | Impact                                                                                         |
|-----------------------------------|------|----------------------------------------|------------|------------------------------------------------------------------------------------------------|
| `ziko-web/.env.example` (disk)    | 1-3  | Real credentials in `.env.example`     | ⚠️ Warning | `.env.example` on disk contains a Supabase URL and a key (`sb_publishable_...`). This file is uncommitted (shown as modified in `git status`). The committed version has empty values. Risk: if accidentally committed, credentials would be exposed. `.env.example` should contain placeholder strings, not real values. |

**No blocker anti-patterns found.** The warning above is a local-only state issue that does not affect the codebase or build.

Notable observations:
- `mentions-legales/page.tsx` line 13: h1 contains `Mentions l\u00e9gales` as a Unicode escape sequence in source. This renders correctly in the browser (React interprets Unicode escapes), but is a minor code style concern — writing the literal character is preferred. Not a functional issue.
- ROADMAP.md progress table shows "1/2 plans complete, In Progress" for Phase 1, but both plans have summaries and all tasks are done. The progress table was not updated after Plan 02 completed. Not a code issue.

---

### Human Verification Required

#### 1. Vercel Deployment Live

**Test:** Open the Vercel dashboard for the ziko-web project and confirm the site is deployed and accessible at a production URL. Visit `/` (should show French: "Bienvenue sur Ziko") and `/en/` (should show English: "Welcome to Ziko"). Check that all 4 locale routes are accessible with no 404s.
**Expected:** Both locale homepages render with translated content. Footer visible on each page with 3 working legal links.
**Why human:** No `.vercel/` directory or `vercel.json` found in `ziko-web/`. Cannot programmatically verify whether a Vercel project exists, whether the site has been deployed, or what the deployment URL is.

#### 2. Vercel Environment Variable Configuration

**Test:** In the Vercel project dashboard, navigate to Settings > Environment Variables. Confirm that `SUPABASE_SERVICE_ROLE_KEY` is present with a non-empty value and does NOT have the `NEXT_PUBLIC_` prefix.
**Expected:** Variable `SUPABASE_SERVICE_ROLE_KEY` appears without `NEXT_PUBLIC_` prefix, confirming it is server-only and never sent to the browser.
**Why human:** Vercel dashboard is not accessible programmatically. The code-side guard (`import 'server-only'`) is verified, but the actual Vercel project configuration requires human inspection.

---

### Gaps Summary

No gaps found in the implemented code. All artifacts exist, are substantive, and are correctly wired. The build passes with all routes statically generated, service role key is absent from the client bundle, and no Google Fonts CDN is present.

The two human verification items relate to **Vercel deployment status** — the phase goal says "live on Vercel" but no Vercel project configuration was found in the repository. The code is fully ready for deployment; the question is whether the deployment itself has been executed.

If the site has been deployed to Vercel, both human verification checks will pass and the phase goal is fully achieved. If not yet deployed, that is the only remaining action needed to satisfy Success Criterion 1.

---

_Verified: 2026-03-26T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
