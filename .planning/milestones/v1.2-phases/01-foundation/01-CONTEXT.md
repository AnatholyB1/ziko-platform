# Phase 1: Foundation - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Bootstrap a standalone Next.js 15 App Router project with next-intl v4 FR/EN routing, Tailwind v4 Ziko design tokens, secure Supabase admin client structure, self-hosted fonts, and a live Vercel deployment — ready for content and features to be built on top without rework.

This phase delivers the technical skeleton only. No marketing content (Phase 3), no legal pages (Phase 2), no SEO optimization (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Repo Structure
- **D-01:** New standalone GitHub repo — completely separate from the existing Turborepo monorepo. Not `apps/web/` inside this repo. Independent Vercel project, independent CI.

### Vercel Setup
- **D-02:** Create the Vercel project at the START of Phase 1, not at the end. Set all env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL) early so static rendering can be verified against production throughout development. `SUPABASE_SERVICE_ROLE_KEY` is server-only — no `NEXT_PUBLIC_` prefix, never in client bundle.

### Design Tokens
- **D-03:** Core 5 colors only in Tailwind v4 `@theme` directive in `globals.css`: `primary: #FF5C1A`, `background: #F7F6F3`, `text: #1C1A17`, `border: #E2E0DA`, `muted: #6B6963`. No typography scale or spacing in Phase 1 — add only if needed in Phase 3.

### Locale Routing
- **D-04:** `localePrefix: 'as-needed'` — French is the default locale with clean URLs (`/about`, `/politique-de-confidentialite`). English uses the `/en/` prefix (`/en/about`, `/en/privacy`). Middleware detects locale from URL prefix → cookie → Accept-Language header.

### Stack (locked from research)
- **D-05:** Next.js 15 (not 16 — ecosystem maturity), React 19, TypeScript 5, Tailwind v4 CSS-first config.
- **D-06:** next-intl v4.x — ESM-only, strict locale typing, auto-inherited messages. Do NOT use v3.
- **D-07:** `@supabase/supabase-js` v2 only — no `@supabase/ssr` (deferred to Milestone 2 coach CRM). Admin client in `src/lib/supabase/admin.ts` with `import 'server-only'`.
- **D-08:** Fonts via `next/font` (self-hosted from Vercel CDN) — no Google Fonts CDN (CNIL compliance).

### Claude's Discretion
- Exact font choice (Inter is standard for Next.js projects — proceed with that unless overridden)
- `middleware.ts` matcher pattern — use the exact next-intl recommended pattern unchanged
- Whether to use `src/` directory or root-level `app/` — use `src/app/` (cleaner separation)
- Folder structure inside `src/` — follow architecture research recommendations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Vision, constraints, non-negotiables (Next.js 14+, Vercel, FR+EN from day one)
- `.planning/REQUIREMENTS.md` — FOUND-01 through FOUND-07 acceptance criteria
- `.planning/research/SUMMARY.md` — Full research synthesis: stack versions, architecture patterns, pitfalls

### Key Research Docs
- `.planning/research/STACK.md` — Pinned package versions, what NOT to install (anti-patterns)
- `.planning/research/ARCHITECTURE.md` — Folder structure, i18n config files, static rendering patterns, admin client pattern
- `.planning/research/PITFALLS.md` — Critical pitfalls to avoid (service role key, setRequestLocale, middleware matcher, Google Fonts)

No external ADRs — all decisions captured above and in research docs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — this is a brand-new standalone repo, completely separate from the existing monorepo.

### Established Patterns (from mobile monorepo — for reference/consistency)
- Design tokens: `#FF5C1A` (primary), `#F7F6F3` (background), `#1C1A17` (text), `#E2E0DA` (border), `#6B6963` (muted) — defined in mobile NativeWind/Tailwind config
- TypeScript strict mode everywhere
- Functional components, camelCase hooks, PascalCase components

### Integration Points
- `SUPABASE_URL` — same Supabase project as the mobile app backend
- `SUPABASE_SERVICE_ROLE_KEY` — needed for Phase 2 account deletion server action; admin client must be scaffolded but NOT called in Phase 1 (no deletion route yet)
- Vercel team — same team as `ziko-api-lilac.vercel.app`

</code_context>

<specifics>
## Specific Ideas

- No specific UI references provided — the scaffold phase has no visible UI beyond placeholder pages and footer stubs.
- The admin Supabase client should be created in `src/lib/supabase/admin.ts` with `import 'server-only'` even though it won't be called until Phase 2. This prevents the key from being accidentally bundled during Phase 2 development.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-26*
