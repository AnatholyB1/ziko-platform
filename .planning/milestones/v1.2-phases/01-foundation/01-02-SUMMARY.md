---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [nextjs, next-intl, tailwind, typescript, supabase, i18n, static-generation, footer]

# Dependency graph
requires:
  - phase: 01-foundation-01
    provides: next-intl routing config, translation stubs, Supabase admin scaffold, Tailwind tokens
provides:
  - Bilingual static routes (FR + EN) for homepage, mentions-legales, politique-de-confidentialite, cgu
  - Footer component with 3 legal links, 2px primary border, locale-aware Link
  - Supabase admin client refactored to createAdminClient() factory (server-only guard)
  - NextIntlClientProvider wrapping locale layout for client component locale context
  - Fully buildable site: npm run build passes, all routes SSG-rendered
affects: [02-rgpd, 03-marketing, 04-seo, 05-launch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - getTranslations (next-intl/server) for async Server Components instead of useTranslations
    - NextIntlClientProvider in locale layout to provide locale context to client-side Link components
    - Async Footer server component using getTranslations (avoids useTranslations in client boundary)
    - createAdminClient() factory pattern over singleton export for Supabase admin client

key-files:
  created:
    - ziko-web/src/app/[locale]/layout.tsx
    - ziko-web/src/app/[locale]/page.tsx
    - ziko-web/src/app/[locale]/mentions-legales/page.tsx
    - ziko-web/src/app/[locale]/politique-de-confidentialite/page.tsx
    - ziko-web/src/app/[locale]/cgu/page.tsx
    - ziko-web/src/components/layout/Footer.tsx
  modified:
    - ziko-web/src/app/layout.tsx
    - ziko-web/src/lib/supabase/admin.ts

key-decisions:
  - "getTranslations (async) used instead of useTranslations in all Server Components — avoids client boundary conflicts with next-intl navigation Link"
  - "NextIntlClientProvider added to locale layout — required for Link from createNavigation to access locale context during static generation"
  - "createAdminClient() factory exported instead of supabaseAdmin singleton — matches plan spec, avoids singleton shared state"

patterns-established:
  - "Pattern 4: All Server Component translations use getTranslations from next-intl/server (async)"
  - "Pattern 5: NextIntlClientProvider must wrap content in locale layout for client component locale access"
  - "Pattern 6: Legal stub pages use hardcoded UTF-8 h1 titles + getTranslations for body text"

requirements-completed: [FOUND-02, FOUND-04, FOUND-06, FOUND-07]

# Metrics
duration: 15min
completed: 2026-03-26
---

# Phase 01 Plan 02: Page Routes, Footer, and Build Verification Summary

**Bilingual Next.js site with static SSG routes (FR + EN), Footer with 3 locale-aware legal links and 2px orange top border, Supabase admin createAdminClient() factory, all routes verified as SSG in npm run build**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-26T17:00:00Z
- **Completed:** 2026-03-26T17:15:00Z
- **Tasks:** 3 (+ 1 fix iteration on Task 3)
- **Files modified:** 8

## Accomplishments

- Created `[locale]/layout.tsx` with Inter font, `generateStaticParams` for FR+EN, `setRequestLocale`, `NextIntlClientProvider`, and Footer
- Created bilingual placeholder pages for homepage + 3 French legal stubs (mentions-legales, politique-de-confidentialite, cgu), all with `setRequestLocale`
- Created `Footer` component with Ionicons-free approach using next-intl `Link`, 2px #FF5C1A top border, copyright + 3 legal links
- Refactored `admin.ts` to `createAdminClient()` factory with `server-only` guard + `detectSessionInUrl: false`
- `npm run build` succeeds — all locale routes show as `●` SSG (generateStaticParams), no `ƒ` dynamic routes
- Confirmed: `SUPABASE_SERVICE_ROLE_KEY` absent from client bundle, no Google Fonts CDN in build output

## Task Commits

Each task was committed atomically:

1. **Task 1: Create locale layout, homepage, and 3 legal stub pages** - `d10e5a8` (feat)
2. **Task 2: Create Footer component and Supabase admin client scaffold** - `7f91a7f` (feat)
3. **Task 3: Build verification** - `bb8a1d3` (fix — deviation fix applied during build verification)

## Files Created/Modified

- `ziko-web/src/app/layout.tsx` - Simplified to pass-through (html/body in locale layout)
- `ziko-web/src/app/[locale]/layout.tsx` - Root locale layout with Inter, generateStaticParams, NextIntlClientProvider, Footer
- `ziko-web/src/app/[locale]/page.tsx` - Bilingual homepage using getTranslations('Home')
- `ziko-web/src/app/[locale]/mentions-legales/page.tsx` - Stub page, setRequestLocale + getTranslations('LegalStub')
- `ziko-web/src/app/[locale]/politique-de-confidentialite/page.tsx` - Stub page, setRequestLocale + getTranslations('LegalStub')
- `ziko-web/src/app/[locale]/cgu/page.tsx` - Stub page, setRequestLocale + getTranslations('LegalStub')
- `ziko-web/src/components/layout/Footer.tsx` - Async Server Component, getTranslations('Footer'), 3 legal Links
- `ziko-web/src/lib/supabase/admin.ts` - createAdminClient() factory, import 'server-only', detectSessionInUrl: false

## Decisions Made

- Switched from `useTranslations` to `getTranslations` in all async Server Components — the `Link` from `@/i18n/navigation` is a client component (wraps BaseLink which has `'use client'`), making any component importing it a client component. `useTranslations` in a Client Component requires an IntlProvider, which wasn't in the layout. `getTranslations` (server-only) resolves this cleanly.
- Added `NextIntlClientProvider` to locale layout — the `Link` component from `createNavigation` calls `useLocale()` (reads from context) during server-side static generation. Without the provider, the context is undefined and throws during prerender.
- Refactored `admin.ts` to factory function — the plan specified `createAdminClient()` export, but plan 01 created a `supabaseAdmin` singleton. Updated to match the spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useTranslations in components importing client-side Link caused prerender failures**
- **Found during:** Task 3 (build verification)
- **Issue:** Plan specified `useTranslations` in sync child components (HomeContent, MentionsLegalesContent, etc.) and `Footer`. The `Link` from `@/i18n/navigation` is a client component (BaseLink has `'use client'`). Importing a client component in `Footer` made it a client component, and `useTranslations` in client components requires an IntlProvider — which was absent. During static generation, `Link` also calls `useLocale()` via `useContext`, which throws `Error()` without the provider.
- **Fix:** (1) Converted all page/layout translation calls to `getTranslations` from `'next-intl/server'` (async pattern). (2) Added `NextIntlClientProvider` to locale layout to provide IntlContext for client components (especially the `Link` locale auto-prefix).
- **Files modified:** `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/app/[locale]/mentions-legales/page.tsx`, `src/app/[locale]/politique-de-confidentialite/page.tsx`, `src/app/[locale]/cgu/page.tsx`, `src/components/layout/Footer.tsx`
- **Verification:** `npm run build` exits 0, all 8 locale routes show as `●` (SSG)
- **Committed in:** `bb8a1d3` (Task 3 fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan's translation approach)
**Impact on plan:** Required fix for build correctness. All acceptance criteria satisfied. No scope creep.

## Issues Encountered

- Plan's `useTranslations` in sync child components pattern conflicted with next-intl v4's behavior when components importing client-side Link are involved. The anti-pattern documented in 01-RESEARCH.md ("useTranslations in async server components") applies more broadly: any component that eventually imports a client component becomes a client component, requiring IntlProvider for useTranslations to work.

## User Setup Required

None - no external service configuration required. Phase 2 will require filling in `.env.local` with actual Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

## Next Phase Readiness

- Site builds cleanly: all routes statically generated, no dynamic rendering
- Footer visible on every locale page (via layout) with 3 working legal links
- Supabase admin client scaffolded with server-only guard — Phase 2 can call `createAdminClient()` safely
- Translation infrastructure ready for Phase 2 legal content additions
- No Google Fonts CDN — CNIL-compliant font serving confirmed

---
*Phase: 01-foundation*
*Completed: 2026-03-26*
