# Stack Research

**Domain:** Next.js marketing site with i18n, legal pages, Supabase account deletion
**Researched:** 2026-03-26
**Confidence:** HIGH

---

## Context: What Already Exists (Do Not Reinstall)

The Ziko platform already has a Supabase backend and Hono API deployed on Vercel. This research
covers ONLY the new Next.js marketing site — a separate standalone project (new repo, separate
Vercel deployment per the PROJECT.md decision).

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x (stable) | App Router framework | v15 is stable and fully supported; v16 exists but ecosystem (next-intl, shadcn) is more battle-tested against v15. Use v15 for this milestone. |
| React | 19.x | UI runtime | Bundled with Next.js 15; brings stable Server Components and Server Actions |
| TypeScript | 5.x | Type safety | Non-negotiable for a codebase that will grow to include a coach CRM |
| Tailwind CSS | 4.x | Utility styling | v4 is now the default in `create-next-app`; CSS-first config replaces `tailwind.config.js`; 70% smaller production CSS than v3 |
| next-intl | 4.x (4.8.3+) | FR/EN i18n routing | The de-facto standard for Next.js App Router i18n; v4 is ESM-only, has strict locale typing, and `NextIntlClientProvider` no longer needs manual `messages` prop — inherited from `i18n/request.ts` automatically |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | 2.x (2.100+) | Supabase admin client for account deletion | Used ONLY in Server Actions with service role key; never import into client components |
| `@supabase/ssr` | 0.9.x | Cookie-based Supabase sessions for SSR | Only needed if Milestone 2 (coach CRM) requires user sessions. For Milestone 1 (marketing + deletion), you do NOT need `@supabase/ssr` — the deletion server action uses the admin client directly |
| `react-hook-form` | 7.x | Account deletion form state | Lightweight, uncontrolled; pairs with Zod for the deletion confirmation form |
| `zod` | 3.x | Schema validation (client + server) | Shared validation schema runs on both client (instant UX feedback) and in the server action (security) |
| `@hookform/resolvers` | 3.x | Bridge between react-hook-form and Zod | Needed to pass `zodResolver` to `useForm()` |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@tailwindcss/postcss` | PostCSS plugin for Tailwind v4 | Replaces the old `tailwindcss` PostCSS plugin; required for v4 |
| `postcss` | CSS processing pipeline | Peer dep of `@tailwindcss/postcss`; add to devDeps |
| ESLint + `eslint-config-next` | Linting | Included by `create-next-app`; keep it |
| `typescript` | Type checking | Included by `create-next-app --typescript` |

---

## Installation

```bash
# Bootstrap (sets up Next.js 15 + Tailwind v4 + TypeScript + App Router)
npx create-next-app@latest ziko-web --typescript --tailwind --eslint --app --src-dir

# i18n
npm install next-intl

# Supabase admin (server-only, for account deletion server action)
npm install @supabase/supabase-js

# Account deletion form
npm install react-hook-form zod @hookform/resolvers

# @supabase/ssr — defer to Milestone 2 (coach auth), do NOT add now
```

No additional dev dependencies needed beyond what `create-next-app` installs.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| next-intl v4 | next-i18next | Only if you need Pages Router; dead weight in App Router projects |
| next-intl v4 | Paraglide (inlang) | If you want compile-time type-safe translations without runtime overhead; more complex setup, smaller ecosystem |
| Tailwind CSS v4 | Tailwind CSS v3 | If you're adding this site INTO the existing Turborepo monorepo (NativeWind uses v3 — version conflict). Since this is a standalone repo, use v4. |
| react-hook-form + zod | Native `useActionState` + server-only Zod | Simpler for a single form; valid if you want zero client JS for the deletion form. Only worth it if bundle size is critical. |
| Next.js 15 | Next.js 16 | Use 16 when next-intl v4, shadcn, and your tooling explicitly declare 16 support. As of 2026-03-26, 16 is stable but the ecosystem around it is still catching up. |
| Standalone repo | Inside Turborepo monorepo | Valid if you want shared types/components with mobile. Rejected because NativeWind (Tailwind v3) creates a version conflict with Tailwind v4, and the sites audience and deploy lifecycle are completely different. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated; replaced by `@supabase/ssr` | `@supabase/ssr` (only if you need session auth; skip for Milestone 1) |
| `next-i18next` | Built for Pages Router; does not support App Router Server Components | `next-intl` |
| `i18next` + `react-i18next` directly | Works but requires manual middleware and routing wiring that next-intl handles for you | `next-intl` |
| `contentlayer` | Unmaintained as of 2024; community fork exists but fragile | Static MDX via `@next/mdx` if legal pages need MDX, or just inline JSX |
| `@mdx-js/loader` / MDX for legal pages | Overkill for static text pages that will be edited once and forgotten | Plain `.tsx` components with the text inline |
| `framer-motion` | 40+ KB bundle cost; not needed for a marketing site whose primary job is conversion | CSS animations via Tailwind (`transition`, `animate-*`) |
| `shadcn/ui` | Excellent for dashboards, but adds components you don't need for a 5-page marketing site. Reserve for Milestone 2 (coach CRM). | Custom Tailwind components |
| `prisma` / any ORM | There is no direct DB access from the marketing site; account deletion calls Supabase Auth admin API | `@supabase/supabase-js` admin client only |
| `next-auth` / `auth.js` | Not needed for Milestone 1; defer auth to Milestone 2 | Skip entirely for Milestone 1 |
| State management (Zustand, Redux, Jotai) | Marketing site has no global client state; deletion form is a single local form | `react-hook-form` local form state only |
| Image optimization CDN libraries | Next.js `<Image>` covers all optimization needs | Built-in `next/image` |

---

## Stack Patterns by Variant

**For the account deletion server action (RGPD requirement):**
- Use `createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL`
- Call `supabase.auth.admin.deleteUser(userId)` — requires looking up the user by email first via `supabase.auth.admin.listUsers()` or `getUserByEmail()`
- The server action runs in a `"use server"` file; service role key never reaches the client bundle
- Pattern: user submits email → server action looks up uid by email → confirms deletion → calls `deleteUser(uid)`

**For next-intl routing (FR default, EN secondary):**
- Use `[locale]` dynamic segment under `src/app/[locale]/`
- `src/i18n/routing.ts` defines `locales: ['fr', 'en']` and `defaultLocale: 'fr'`
- Middleware at `src/middleware.ts` uses `createMiddleware(routing)` from `next-intl/middleware`
- Call `setRequestLocale(locale)` at the top of every page and layout for static rendering
- `NextIntlClientProvider` in root layout inherits messages automatically in v4 — no need to pass `messages` prop manually

**For Tailwind v4 design token setup (Ziko brand):**
- Define design tokens in `src/app/globals.css` using `@theme` directive
- No `tailwind.config.js` needed; everything lives in CSS
- Example: `--color-primary: #FF5C1A;` then use `bg-primary` in JSX

**If Milestone 2 (coach CRM) auth is added later:**
- Add `@supabase/ssr` at that point for cookie-based session management
- Add `next-auth` or implement Supabase session middleware; do not architect for this now

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `next-intl@4.x` | Next.js 15.x, React 19 | v4 requires React 17+; works on 19. Drops v3's `intl` peer dep. |
| `next-intl@4.x` | Next.js 16.x | Supported but verify at upgrade time |
| `tailwindcss@4.x` | Next.js 15.x | Bundled via `create-next-app` as of late 2024; use `@tailwindcss/postcss` not the old postcss plugin |
| `tailwindcss@4.x` | NativeWind (mobile) | NOT compatible — NativeWind uses Tailwind v3. This is why the marketing site must be a standalone repo, not inside the existing Turborepo. |
| `@supabase/supabase-js@2.x` | Node.js (Server Actions) | Admin API only works server-side; `supabase.auth.admin.*` requires service role key |
| `react-hook-form@7.x` | React 19 | Compatible; works as a Client Component (`"use client"`) wrapper around a server action |
| `zod@3.x` | TypeScript 5.x | Full compatibility |

---

## Environment Variables Required

```bash
# .env.local (never commit)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Admin operations only — never EXPO_PUBLIC_ prefix

# No NEXT_PUBLIC_ Supabase keys needed for Milestone 1
# The marketing site has no client-side Supabase calls
```

---

## Sources

- [next-intl.dev — App Router setup docs](https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing) — setup steps, setRequestLocale, middleware — HIGH confidence
- [next-intl v4.0 release blog](https://next-intl.dev/blog/next-intl-4-0) — breaking changes, ESM-only, auto-inherited messages — HIGH confidence
- [npm: next-intl](https://www.npmjs.com/package/next-intl) — latest version 4.8.3 — HIGH confidence
- [Supabase docs: auth-admin-deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) — requires service_role key, server-only — HIGH confidence
- [npm: @supabase/supabase-js](https://www.npmjs.com/package/@supabase/supabase-js) — latest 2.100.1 — HIGH confidence
- [npm: @supabase/ssr](https://www.npmjs.com/package/@supabase/ssr) — latest 0.9.0 — HIGH confidence
- [Tailwind CSS v4 + Next.js official guide](https://tailwindcss.com/docs/guides/nextjs) — postcss setup, @theme directive — HIGH confidence
- [Next.js 15 stable release](https://nextjs.org/blog/next-15) — React 19, App Router stable — HIGH confidence
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — Turbopack default, React 19.2 — MEDIUM confidence (ecosystem catching up)
- [Supabase discussions #23144](https://github.com/orgs/supabase/discussions/23144) — admin deleteUser from server action pattern — MEDIUM confidence

---
*Stack research for: Next.js marketing site — Ziko fitness app*
*Researched: 2026-03-26*
