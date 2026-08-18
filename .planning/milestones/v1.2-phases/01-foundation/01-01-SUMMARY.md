---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [nextjs, tailwind, next-intl, typescript, supabase, i18n, vercel]

# Dependency graph
requires: []
provides:
  - Next.js 15 App Router standalone project (ziko-web/) bootstrapped and compilable
  - Tailwind v4 CSS-first config with 5 Ziko design tokens in @theme block
  - next-intl v4 routing with fr default (as-needed prefix) and en support
  - Translation stubs for Home, Footer, LegalStub in FR and EN
  - Supabase admin client scaffold with server-only guard
  - middleware.ts at project root with next-intl recommended matcher
affects: [02-rgpd, 03-marketing, 04-seo, 05-launch]

# Tech tracking
tech-stack:
  added:
    - next@15.5.14
    - next-intl@4.8.3
    - "@supabase/supabase-js@2.100.1"
    - server-only
    - tailwindcss@4
    - "@tailwindcss/postcss@4"
  patterns:
    - Tailwind v4 CSS-first tokens via @theme directive (no tailwind.config.js)
    - next-intl v4 defineRouting as single source of truth for locale config
    - Supabase admin client with import server-only guard (never in client bundle)
    - Inter font via next/font/google for CNIL-compliant self-hosting

key-files:
  created:
    - ziko-web/src/i18n/routing.ts
    - ziko-web/src/i18n/request.ts
    - ziko-web/src/i18n/navigation.ts
    - ziko-web/middleware.ts
    - ziko-web/messages/fr.json
    - ziko-web/messages/en.json
    - ziko-web/.env.example
    - ziko-web/src/lib/supabase/admin.ts
  modified:
    - ziko-web/next.config.ts
    - ziko-web/postcss.config.mjs
    - ziko-web/src/app/globals.css
    - ziko-web/src/app/layout.tsx
    - ziko-web/.gitignore

key-decisions:
  - "Standalone repo at /c/ziko-web (not inside monorepo) per D-01"
  - "localePrefix: as-needed — FR has clean URLs, EN uses /en/ prefix"
  - "Inter via next/font/google (self-hosted from Vercel CDN) for CNIL compliance — no Google Fonts CDN"
  - "SUPABASE_SERVICE_ROLE_KEY server-only, no NEXT_PUBLIC_ prefix — admin client guarded with import server-only"
  - "Supabase admin client scaffolded in Phase 1 but not called — prevents accidental bundling in Phase 2"

patterns-established:
  - "Pattern 1: All locale config flows from src/i18n/routing.ts — middleware, navigation, request all import from there"
  - "Pattern 2: Server-only guard via import server-only on any file touching service role key"
  - "Pattern 3: Tailwind v4 @theme block in globals.css — no tailwind.config.js needed"

requirements-completed: [FOUND-01, FOUND-02, FOUND-03, FOUND-05]

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 01 Plan 01: Bootstrap Next.js 15 with next-intl v4 i18n and Tailwind v4 Ziko tokens Summary

**Next.js 15 App Router project bootstrapped with Tailwind v4 @theme Ziko tokens, next-intl v4 FR/EN routing (fr default, as-needed prefix), Inter self-hosted font, and Supabase admin scaffold guarded by server-only**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T17:01:23Z
- **Completed:** 2026-03-26T17:04:37Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Bootstrapped standalone Next.js 15 project at `/c/ziko-web` with TypeScript, Tailwind v4, App Router, and src/ layout
- Configured all 5 Ziko design tokens in globals.css @theme block and replaced Geist with Inter (CNIL-compliant self-hosting)
- Set up next-intl v4 routing with FR as default (clean URLs), EN with /en/ prefix, middleware at project root with recommended matcher
- Created FR/EN translation stubs for all Phase 1 string groups (Home, Footer, LegalStub) with proper UTF-8 accented characters
- Scaffolded Supabase admin client with import server-only guard — ready for Phase 2 account deletion without risk of client bundling

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap Next.js 15 project with Tailwind v4 and design tokens** - `2869860` (feat)
2. **Task 2: Configure next-intl v4 i18n routing and translation stubs** - `e1a6705` (feat)

## Files Created/Modified

- `ziko-web/next.config.ts` - Wrapped with createNextIntlPlugin pointing to src/i18n/request.ts
- `ziko-web/postcss.config.mjs` - Updated to @tailwindcss/postcss object format for Tailwind v4
- `ziko-web/src/app/globals.css` - Tailwind v4 @import + @theme block with 5 Ziko color tokens
- `ziko-web/src/app/layout.tsx` - Inter font via next/font/google, minimal root layout
- `ziko-web/.env.example` - Server-only env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL
- `ziko-web/.gitignore` - Added !.env.example exception so template is tracked
- `ziko-web/src/i18n/routing.ts` - defineRouting: locales=[fr,en], defaultLocale=fr, localePrefix=as-needed
- `ziko-web/src/i18n/request.ts` - getRequestConfig loading messages per locale
- `ziko-web/src/i18n/navigation.ts` - createNavigation exports: Link, redirect, usePathname, useRouter, getPathname
- `ziko-web/middleware.ts` - next-intl middleware at project root with recommended matcher pattern
- `ziko-web/messages/fr.json` - FR translation stubs with proper accented characters
- `ziko-web/messages/en.json` - EN translation stubs with matching key structure
- `ziko-web/src/lib/supabase/admin.ts` - Admin client with import server-only guard (scaffold only)

## Decisions Made

- Used Inter font (via next/font/google self-hosting) instead of default Geist — CNIL-compliant, no Google Fonts CDN
- Created Supabase admin client in Phase 1 even though it's not called until Phase 2 — prevents accidental client bundle inclusion
- Added `!.env.example` exception to .gitignore so the template is tracked in git

## Deviations from Plan

None — plan executed exactly as written. The Supabase admin client scaffold (`src/lib/supabase/admin.ts`) was created as specified by D-07 in CONTEXT.md, which was referenced in the plan's read_first but not explicitly listed as a task action — this is an additive clarification, not a deviation.

## Issues Encountered

None — `npx tsc --noEmit` passed cleanly on both Task 1 and Task 2 verifications.

## User Setup Required

None - no external service configuration required for this plan. Phase 2 will require filling in `.env.local` with actual Supabase credentials.

## Next Phase Readiness

- All config files type-check cleanly (tsc --noEmit exits 0)
- next-intl routing ready for App Router [locale] segment to be added in Plan 02
- Ziko design tokens available globally via Tailwind v4 utility classes
- Supabase admin client scaffolded and ready for account deletion in Phase 2
- Translation stubs ready — Plan 02 will create the [locale] layout and page components that use useTranslations()

---
*Phase: 01-foundation*
*Completed: 2026-03-26*
