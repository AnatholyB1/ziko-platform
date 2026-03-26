# Phase 1: Foundation - Research

**Researched:** 2026-03-26
**Domain:** Next.js 15 App Router scaffold — next-intl v4 i18n routing, Tailwind v4 design tokens, self-hosted fonts, Supabase admin client scaffold, Vercel deployment
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New standalone GitHub repo — completely separate from the existing Turborepo monorepo. Not `apps/web/` inside this repo. Independent Vercel project, independent CI.
- **D-02:** Create the Vercel project at the START of Phase 1, not at the end. Set all env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL) early so static rendering can be verified against production throughout development. `SUPABASE_SERVICE_ROLE_KEY` is server-only — no `NEXT_PUBLIC_` prefix, never in client bundle.
- **D-03:** Core 5 colors only in Tailwind v4 `@theme` directive in `globals.css`: `primary: #FF5C1A`, `background: #F7F6F3`, `text: #1C1A17`, `border: #E2E0DA`, `muted: #6B6963`. No typography scale or spacing in Phase 1 — add only if needed in Phase 3.
- **D-04:** `localePrefix: 'as-needed'` — French is the default locale with clean URLs (`/about`, `/politique-de-confidentialite`). English uses the `/en/` prefix (`/en/about`, `/en/privacy`). Middleware detects locale from URL prefix → cookie → Accept-Language header.
- **D-05:** Next.js 15 (not 16 — ecosystem maturity), React 19, TypeScript 5, Tailwind v4 CSS-first config.
- **D-06:** next-intl v4.x — ESM-only, strict locale typing, auto-inherited messages. Do NOT use v3.
- **D-07:** `@supabase/supabase-js` v2 only — no `@supabase/ssr` (deferred to Milestone 2 coach CRM). Admin client in `src/lib/supabase/admin.ts` with `import 'server-only'`.
- **D-08:** Fonts via `next/font` (self-hosted from Vercel CDN) — no Google Fonts CDN (CNIL compliance).

### Claude's Discretion

- Exact font choice (Inter is standard for Next.js projects — proceed with that unless overridden)
- `middleware.ts` matcher pattern — use the exact next-intl recommended pattern unchanged
- Whether to use `src/` directory or root-level `app/` — use `src/app/` (cleaner separation)
- Folder structure inside `src/` — follow architecture research recommendations

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Project is bootstrapped as standalone Next.js 15 App Router repo with Tailwind v4 and TypeScript | `create-next-app@15` bootstrap command in Standard Stack section; exact flags documented |
| FOUND-02 | FR/EN i18n routing works via next-intl v4 — French is default (clean URLs), English uses `/en/` prefix | next-intl v4 `defineRouting` + `localePrefix: 'as-needed'` pattern in Architecture Patterns; middleware config verified |
| FOUND-03 | Ziko design tokens applied globally via Tailwind v4 `@theme` directive | Exact `@theme` block in Code Examples; 5 token names confirmed from CONTEXT.md D-03 |
| FOUND-04 | All pages are statically generated (`generateStaticParams` for both locales, `setRequestLocale` in every route segment) | Static generation pattern with `generateStaticParams` + `setRequestLocale` documented; verification via `next build` output `○` markers |
| FOUND-05 | Fonts are self-hosted via `next/font` (no Google CDN, CNIL-compliant) | Inter via `next/font/google` self-hosts automatically from Vercel CDN; verified in PITFALLS.md Pitfall 8 + UI-SPEC font note |
| FOUND-06 | Vercel project created with `SUPABASE_SERVICE_ROLE_KEY` scoped to server-only (no `NEXT_PUBLIC_` prefix) | Admin client pattern with `import 'server-only'` documented; env var scoping rules in Common Pitfalls section |
| FOUND-07 | Footer visible on every page with links to all 3 legal pages (LCEN requirement) | Footer component spec from UI-SPEC; URL slugs for all 3 legal stub pages documented |
</phase_requirements>

---

## Summary

Phase 1 delivers a technical skeleton only — no marketing content, no legal text, no form logic. The output is a statically-rendered, bilingual Next.js site live on Vercel: empty translated placeholder pages, a footer with links to stub legal pages, Ziko design tokens applied globally, Inter self-hosted via `next/font`, and an admin Supabase client scaffolded but never called. Every visible page must show as `○` (static) in `next build` output, not `ƒ` (dynamic).

The entire phase is standard well-documented territory (confirmed HIGH confidence in SUMMARY.md). All critical patterns — `setRequestLocale`, `generateStaticParams`, middleware matcher, `import 'server-only'` on the admin client — are sourced directly from official next-intl and Next.js docs. Research does not surface any ambiguity or alternatives for the locked decisions; the task is correct implementation of documented patterns.

The single highest-severity risk in this phase is the Supabase service role key being accidentally bundled into client JavaScript. The second-highest is `setRequestLocale` being omitted from any route segment, which silently forces dynamic rendering. Both are prevented by specific code patterns documented below.

**Primary recommendation:** Bootstrap with `create-next-app@15`, add next-intl v4, set up `src/i18n/routing.ts` as the single locale config source, call `setRequestLocale` as the first statement in every `[locale]` layout and page, add `import 'server-only'` to the admin client, and verify `next build` shows `○` on all routes before declaring the phase done.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.14 (latest v15) | App Router framework | Locked by D-05; v15 has full ecosystem support for next-intl v4, React 19 |
| React | 19.x | UI runtime | Bundled with Next.js 15; required for Server Components and Server Actions |
| TypeScript | 5.x | Type safety | Locked by D-05; required across all Ziko Platform code |
| Tailwind CSS | 4.2.2 | Utility styling + design tokens | Locked by D-05; CSS-first `@theme` directive replaces `tailwind.config.js` |
| next-intl | 4.8.3 | FR/EN i18n routing | Locked by D-06; ESM-only, strict locale typing, auto-inherited messages |
| @supabase/supabase-js | 2.100.1 | Admin client factory (scaffold only) | Locked by D-07; admin API requires service role key, server-side only |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tailwindcss/postcss | 4.2.2 | PostCSS plugin for Tailwind v4 | Required — replaces old `tailwindcss` PostCSS plugin; peer dep of Tailwind v4 |
| postcss | latest | CSS processing pipeline | Peer dep of `@tailwindcss/postcss`; add to devDeps |
| server-only | latest | Build-time guard for server modules | Add to any file containing `SUPABASE_SERVICE_ROLE_KEY`; causes build error if imported in client |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js 15 | Next.js 16 (16.2.1 current) | 16 is available but next-intl v4 and tooling ecosystem are more battle-tested against v15. Upgrade in Milestone 2 when ecosystem catches up. |
| next-intl v4 | Paraglide (inlang) | Compile-time type-safe translations, no runtime overhead; more complex setup, smaller ecosystem. Not worth the setup cost for this project. |
| Inter (next/font) | Any other variable font | Inter is the Next.js default and widely expected by `create-next-app`; CONTEXT.md discretion allows Inter — proceed with it |

**Installation:**

```bash
# Bootstrap — creates Next.js 15 + Tailwind v4 + TypeScript + App Router + src/ layout
npx create-next-app@15 ziko-web --typescript --tailwind --eslint --app --src-dir

# i18n
npm install next-intl

# Supabase admin client (server-only, scaffold for Phase 2 deletion action)
npm install @supabase/supabase-js

# Server-only guard
npm install server-only
```

**Version verification (confirmed 2026-03-26 against npm registry):**

| Package | Verified Version | Notes |
|---------|-----------------|-------|
| `next` | 15.5.14 | Latest v15; use `npx create-next-app@15` to pin to v15 branch |
| `next-intl` | 4.8.3 | Latest v4; STACK.md pinned this version |
| `tailwindcss` | 4.2.2 | Latest v4; bundled via `create-next-app` as of late 2024 |
| `@supabase/supabase-js` | 2.100.1 | Latest v2; confirmed |
| `react-hook-form` | 7.72.0 | Latest v7 (not needed in Phase 1 — defer to Phase 2) |
| `zod` | 4.3.6 | Latest v4 (not needed in Phase 1 — defer to Phase 2) |

---

## Architecture Patterns

### Recommended Project Structure

```
ziko-web/
├── messages/
│   ├── fr.json                   # French translations (default locale)
│   └── en.json                   # English translations
├── public/
│   └── og-image.png              # Placeholder (Phase 4 fills this)
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx        # Root locale layout — NextIntlClientProvider, Inter font, generateStaticParams
│   │   │   ├── page.tsx          # Placeholder homepage — "Bienvenue sur Ziko" / "Welcome to Ziko"
│   │   │   ├── mentions-legales/
│   │   │   │   └── page.tsx      # Stub legal page — FR URL: /mentions-legales
│   │   │   ├── politique-de-confidentialite/
│   │   │   │   └── page.tsx      # Stub legal page — FR URL: /politique-de-confidentialite
│   │   │   └── cgu/
│   │   │       └── page.tsx      # Stub legal page — FR URL: /cgu
│   │   ├── favicon.ico
│   │   └── globals.css           # @import "tailwindcss" + @theme design tokens
│   ├── components/
│   │   └── layout/
│   │       └── Footer.tsx        # Footer with 3 legal links + copyright (FOUND-07)
│   ├── i18n/
│   │   ├── routing.ts            # defineRouting — single source of truth for locales config
│   │   ├── request.ts            # getRequestConfig — loads messages per locale
│   │   └── navigation.ts        # Type-safe Link, redirect, useRouter, usePathname exports
│   └── lib/
│       └── supabase/
│           └── admin.ts          # createAdminClient() — import 'server-only' + service_role key
├── middleware.ts                  # next-intl middleware — at project root (NOT inside src/app/)
├── next.config.ts                 # withNextIntl plugin wrapping nextConfig
├── postcss.config.mjs             # { plugins: { "@tailwindcss/postcss": {} } }
├── tsconfig.json                  # paths: "@/*": ["./src/*"]
└── .env.local                     # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL
```

**Note on legal page URL slugs (from UI-SPEC):**

| Page | FR URL (default, no prefix) | EN URL |
|------|----------------------------|--------|
| Homepage | `/` | `/en` |
| Mentions légales | `/mentions-legales` | `/en/legal` |
| Politique de confidentialité | `/politique-de-confidentialite` | `/en/privacy` |
| CGU | `/cgu` | `/en/terms` |

The `[locale]` folder structure uses the French slug names for folders since those are the primary URLs. The English translated paths are handled by next-intl's `localePrefix: 'as-needed'` routing.

### Pattern 1: i18n Routing Config (Single Source of Truth)

**What:** All locale config lives in `src/i18n/routing.ts`. Both the middleware and `next.config.ts` import from this single file. The `defineRouting` call specifies `locales`, `defaultLocale`, and `localePrefix`.

**When to use:** Every file that needs locale awareness imports from here — no hardcoded locale strings anywhere else.

```typescript
// Source: next-intl.dev/docs/routing/configuration
// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
});
```

### Pattern 2: Middleware with Exact Matcher

**What:** Middleware at `middleware.ts` (project root) uses the exact next-intl recommended matcher — excludes `/_next`, `/_vercel`, `/api`, and any path containing a dot (static assets, favicon, sitemap).

**When to use:** Use this pattern verbatim — do not modify the matcher regex.

```typescript
// Source: next-intl.dev/docs/routing/middleware
// middleware.ts (project root — NOT src/app/)
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except /api, /_next, /_vercel, and paths with dots
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
```

### Pattern 3: Static Generation in Every Locale Route Segment

**What:** `generateStaticParams` in the root locale layout generates HTML for both `fr` and `en` at build time. `setRequestLocale(locale)` must be called as the first statement in every layout and page inside `[locale]/` — without it, next-intl opts the route into dynamic rendering.

**When to use:** Every file under `src/app/[locale]/` that receives `params` with `locale`.

```typescript
// Source: next-intl.dev/docs/routing/setup (static rendering section)
// src/app/[locale]/layout.tsx
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);  // First statement — required for static rendering
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
```

```typescript
// src/app/[locale]/page.tsx
import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);  // First statement in every page too
  // useTranslations is valid in sync server components — but this is async
  // so we read translations via a child sync component instead
  return <main><HeroPlaceholder /></main>;
}

// Sync child — useTranslations works here
function HeroPlaceholder() {
  const t = useTranslations('Home');
  return (
    <section>
      <h1>{t('heading')}</h1>
      <p>{t('body')}</p>
    </section>
  );
}
```

### Pattern 4: Admin Client with `import 'server-only'`

**What:** The Supabase admin client factory lives in `src/lib/supabase/admin.ts`. The `import 'server-only'` at the top causes a hard build error if any client component tries to import it. The factory is scaffolded in Phase 1 but not called until Phase 2.

```typescript
// Source: supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa
// src/lib/supabase/admin.ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
```

### Pattern 5: Tailwind v4 Design Tokens via `@theme`

**What:** No `tailwind.config.js`. All design tokens live in `src/app/globals.css` under the `@theme` directive. The 5 Ziko brand tokens are declared here; the rest of Phase 1 uses Tailwind's default scale.

```css
/* Source: tailwindcss.com/docs/guides/nextjs + CONTEXT.md D-03 */
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: #FF5C1A;
  --color-background: #F7F6F3;
  --color-text: #1C1A17;
  --color-border: #E2E0DA;
  --color-muted: #6B6963;
}
```

After this declaration, `bg-primary`, `text-text`, `bg-background`, `border-border`, `text-muted` work as Tailwind utility classes.

### Pattern 6: Self-Hosted Inter Font via `next/font/google`

**What:** `next/font/google` downloads fonts at build time and serves them from `/_next/static/` — no outbound request to `fonts.googleapis.com`. This is CNIL-compliant (no IP transmitted to Google) and satisfies FOUND-05 and D-08.

```typescript
// Source: nextjs.org/docs/app/building-your-application/optimizing/fonts
// src/app/[locale]/layout.tsx (extends Pattern 3 above)
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

// Apply: <body className={inter.className}>
```

### Pattern 7: `next.config.ts` with `withNextIntl`

**What:** The `createNextIntlPlugin` wrapper must wrap the Next.js config export. Without it, next-intl message loading does not work at all.

```typescript
// Source: next-intl.dev/docs/getting-started/app-router/with-i18n-routing
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  // No additional config needed for Phase 1
};

export default withNextIntl(nextConfig);
```

### Anti-Patterns to Avoid

- **`middleware.ts` inside `src/app/`:** Next.js requires middleware at the project root (or `src/` if using src-dir layout). Never place it inside `app/`. Per ARCHITECTURE.md: correct location is `<project-root>/middleware.ts`.
- **`useTranslations` in async server components:** Use `getTranslations` (from `'next-intl/server'`) in async components. Use `useTranslations` only in sync server components and client components.
- **`setRequestLocale` only in the root layout:** It does NOT cascade. Call it in every layout AND every page inside `[locale]/`.
- **`NEXT_PUBLIC_` prefix on `SUPABASE_SERVICE_ROLE_KEY`:** This prefix bakes the value into the client bundle. The env var must have no prefix.
- **Importing `createAdminClient` in any Client Component:** The `import 'server-only'` guard prevents this at build time — do not try to work around it.
- **Modifying the middleware matcher regex:** Use it verbatim. Custom modifications frequently break favicon, static asset, or API route handling.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale detection + routing | Custom middleware with `accept-language` parsing | `next-intl` middleware + `createMiddleware(routing)` | Cookie handling, redirects, default locale normalization, and prefix logic have many edge cases |
| Self-hosted font serving | Manual font file placement in `public/` | `next/font/google` | Automatic preload, display swap, subset subsetting, CNIL-compliant CDN serving from `/_next/static/` |
| Translation string loading | Custom `fs.readFile` in each route | `next-intl` `getRequestConfig` in `i18n/request.ts` | Handles locale resolution, caching, type-safe message keys |
| Type-safe navigation (Link with locale) | Manual locale prefix injection | `navigation.ts` exports from next-intl (`createNavigation`) | Handles `as-needed` prefix correctly, prevents double-prefixing for the default locale |
| Server-only module guard | Runtime env var check in components | `import 'server-only'` from the `server-only` npm package | Build-time error, not runtime — catches the bug before deployment |

**Key insight:** next-intl handles 90% of the locale routing complexity. The patterns are well-documented and the library is purpose-built for Next.js App Router. Hand-rolling any of these would recreate the library's logic badly.

---

## Common Pitfalls

### Pitfall 1: `setRequestLocale` Missing — Dynamic Rendering Forced

**What goes wrong:** All `[locale]/*` routes appear as `ƒ` (serverless function) in `next build` output instead of `○` (static). Every page load triggers a Vercel function invocation. FOUND-04 fails.

**Why it happens:** Developers call `setRequestLocale` only in `[locale]/layout.tsx` assuming it cascades. It does not. Every layout AND every page inside `[locale]/` must call it independently.

**How to avoid:** Call `setRequestLocale(locale)` as the very first statement in every file under `src/app/[locale]/`. Add it to `layout.tsx` AND `page.tsx` AND all nested `layout.tsx` files.

**Warning signs:** `next build` output shows `ƒ` on any `[locale]` route. `generateStaticParams` present but `setRequestLocale` missing still causes dynamic rendering.

### Pitfall 2: Service Role Key in Client Bundle

**What goes wrong:** `SUPABASE_SERVICE_ROLE_KEY` appears in built `.next/static/` files, visible to anyone who inspects the page source. Full database admin access is exposed.

**Why it happens:** The admin client file gets imported (directly or transitively) into a Client Component, or the env var is accidentally named with `NEXT_PUBLIC_` prefix.

**How to avoid:** Add `import 'server-only'` as the first line of `src/lib/supabase/admin.ts`. Never prefix the key with `NEXT_PUBLIC_`. After build, verify: `grep -r "eyJ" .next/static/` should find no JWT tokens.

**Warning signs:** Build error mentioning `server-only` import in a client component (this is the correct failure mode). The key appearing in browser DevTools Sources.

### Pitfall 3: `middleware.ts` Matcher Too Broad or Wrong Location

**What goes wrong:** `/favicon.ico` returns a 404 or redirect to `/fr/favicon.ico`. Static assets under `/_next/` get processed through locale middleware, causing errors.

**Why it happens:** Modified matcher regex that doesn't exclude paths containing dots, or `middleware.ts` placed inside `src/app/` instead of the project root.

**How to avoid:** Use the exact matcher from next-intl docs unchanged. Place `middleware.ts` at `<project-root>/middleware.ts` (same level as `package.json`).

**Warning signs:** Favicon 404. Static file requests appearing in middleware logs. Route with `.xml` or `.txt` extension returning a locale redirect.

### Pitfall 4: `useTranslations` Called in Async Server Component

**What goes wrong:** Build or runtime error: `"useTranslations is not callable within an async component"`. This is a React rule — hooks cannot be called in async functions.

**Why it happens:** The root locale layout is async (to `await params`) and a developer uses `useTranslations` directly in that async function body.

**How to avoid:** In async server components, use `getTranslations` from `'next-intl/server'`. Use `useTranslations` only in sync server components and client components.

### Pitfall 5: Google Fonts CDN Instead of Self-Hosted

**What goes wrong:** Browser loads fonts from `fonts.googleapis.com`, transmitting user IP to Google without consent. CNIL violation. FOUND-05 fails.

**Why it happens:** Copying font `<link>` tags from Google Fonts docs instead of using `next/font`.

**How to avoid:** Always use `next/font/google` (or `next/font/local`). Verify in DevTools Network tab: fonts must be served from `/_next/static/media/`, not `fonts.googleapis.com` or `fonts.gstatic.com`.

**Warning signs:** Network tab shows requests to `fonts.gstatic.com`.

### Pitfall 6: `createNextIntlPlugin` Missing from `next.config.ts`

**What goes wrong:** i18n appears to work in dev but `getMessages()` fails or messages are undefined. next-intl requires its plugin to be registered in the Next.js config.

**Why it happens:** Scaffold generates `next.config.ts` and developer adds next-intl routing without adding the plugin wrapper.

**How to avoid:** `next.config.ts` must export `withNextIntl(nextConfig)` — import `createNextIntlPlugin` from `'next-intl/plugin'` and wrap the config.

---

## Code Examples

Verified patterns from official sources:

### `i18n/request.ts` — Message Loading

```typescript
// Source: next-intl.dev/docs/getting-started/app-router/with-i18n-routing
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate that the locale is supported
  if (!locale || !routing.locales.includes(locale as 'fr' | 'en')) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

### `i18n/navigation.ts` — Type-Safe Navigation

```typescript
// Source: next-intl.dev/docs/routing/navigation
// src/i18n/navigation.ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

### `messages/fr.json` — Translation File Stub for Phase 1

```json
{
  "Home": {
    "heading": "Bienvenue sur Ziko",
    "body": "L'application fitness avec coaching IA. Bientôt disponible."
  },
  "Footer": {
    "copyright": "© 2026 Ziko. Tous droits réservés.",
    "legal": "Mentions légales",
    "privacy": "Politique de confidentialité",
    "terms": "CGU"
  },
  "LegalStub": {
    "comingSoon": "Contenu à venir."
  }
}
```

### `messages/en.json` — Translation File Stub for Phase 1

```json
{
  "Home": {
    "heading": "Welcome to Ziko",
    "body": "The fitness app with AI coaching. Coming soon."
  },
  "Footer": {
    "copyright": "© 2026 Ziko. All rights reserved.",
    "legal": "Legal notice",
    "privacy": "Privacy policy",
    "terms": "Terms of use"
  },
  "LegalStub": {
    "comingSoon": "Content coming soon."
  }
}
```

### Footer Component (FOUND-07)

```typescript
// Source: UI-SPEC component inventory + CONTEXT.md D-04 URL slugs
// src/components/layout/Footer.tsx
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function Footer() {
  const t = useTranslations('Footer');
  return (
    <footer
      className="bg-white border-t-2"
      style={{ borderTopColor: '#FF5C1A' }}
    >
      <div className="max-w-screen-xl mx-auto px-8 py-6 flex justify-between items-center">
        <p className="text-sm text-muted">{t('copyright')}</p>
        <nav className="flex gap-4">
          <Link href="/mentions-legales" className="text-sm text-text hover:underline">
            {t('legal')}
          </Link>
          <Link href="/politique-de-confidentialite" className="text-sm text-text hover:underline">
            {t('privacy')}
          </Link>
          <Link href="/cgu" className="text-sm text-text hover:underline">
            {t('terms')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
```

Note: The `Link` here is the type-safe version from `@/i18n/navigation` — it automatically prepends `/en/` for English locale and no prefix for French.

### `postcss.config.mjs` — Tailwind v4

```javascript
// Source: tailwindcss.com/docs/guides/nextjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` with `theme.extend.colors` | `@theme` directive in `globals.css` | Tailwind v4 (late 2024) | No config file needed; tokens declared in CSS |
| `NextIntlClientProvider` required `messages` prop manually | v4 auto-inherits messages from `i18n/request.ts` | next-intl v4.0 | Cleaner root layout — no need to pass messages down |
| `next-intl` `createNextIntlMiddleware` | `createMiddleware(routing)` | next-intl v3+ | Simpler middleware with routing object |
| Pages Router `getStaticProps` for i18n | App Router `generateStaticParams` + `setRequestLocale` | Next.js 13+ | Static rendering opt-in required per route segment |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` (for auth) or direct admin client (for admin ops) | Supabase 2023+ | Auth helpers deprecated; Phase 1 uses direct admin client only |

**Deprecated/outdated:**

- `tailwind.config.js`: Not needed in Tailwind v4; use `@theme` in CSS.
- `next-i18next`: Pages Router only; not compatible with App Router Server Components.
- `@supabase/auth-helpers-nextjs`: Deprecated; replaced by `@supabase/ssr` (which is itself deferred to Milestone 2).
- Passing `messages` to `NextIntlClientProvider`: Removed in next-intl v4; messages are inherited automatically.

---

## Environment Availability

> Step 2.6: SKIPPED — Phase 1 creates a brand-new standalone repo. No external runtime services are required during development (the Supabase admin client is scaffolded but not called). Vercel deployment is a manual setup step (D-02), not a CLI dependency. The only external requirement is a Vercel account and access to the existing Supabase project — both are operator-controlled, not tool-checked.

---

## Validation Architecture

### Test Framework

Phase 1 is a green-field scaffold with no test infrastructure yet. The phase creates the repo from scratch; no existing test config exists to detect.

| Property | Value |
|----------|-------|
| Framework | None installed — Wave 0 must add |
| Config file | None — see Wave 0 |
| Quick run command | `npx tsc --noEmit` (type-check, always available) |
| Full suite command | `npm run build` — verifies static rendering via `next build` output |

**Primary validation for this phase is not unit tests — it is `next build` output.** FOUND-04 is satisfied if and only if all `[locale]/*` routes show as `○` (static) in build output, not `ƒ` (dynamic). This is the acceptance criterion that cannot be faked.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | Repo bootstrapped as Next.js 15 App Router + Tailwind v4 + TS | smoke | `npx tsc --noEmit` | ❌ Wave 0 |
| FOUND-02 | FR/EN i18n routing works; FR has clean URLs, EN has `/en/` prefix | smoke | `npm run build` — check route table output | ❌ Wave 0 |
| FOUND-03 | Ziko design tokens in `@theme` directive | smoke | `npx tsc --noEmit` (type check) + manual visual | N/A |
| FOUND-04 | All pages statically generated | smoke | `npm run build` — ALL `[locale]/*` routes must be `○` | N/A |
| FOUND-05 | Fonts self-hosted, no Google CDN request | manual | Browser DevTools Network tab — no `fonts.gstatic.com` | N/A |
| FOUND-06 | Vercel env vars scoped correctly, key not in client bundle | manual | `grep -r "eyJ" .next/static/` returns empty | N/A |
| FOUND-07 | Footer on every page with 3 legal links | smoke | `npm run build` succeeds + manual page inspection | N/A |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` — catches type errors before accumulation
- **Per wave merge:** `npm run build` — the definitive check; static vs dynamic route classification is visible only in build output
- **Phase gate:** `npm run build` green AND all `[locale]/*` routes shown as `○` before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `next.config.ts` — must include `withNextIntl` wrapper
- [ ] `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts` — core next-intl config files
- [ ] `messages/fr.json` + `messages/en.json` — translation stubs with Phase 1 strings
- [ ] `src/app/globals.css` — must include `@import "tailwindcss"` + `@theme` block
- [ ] `middleware.ts` — exact matcher pattern at project root
- [ ] `src/lib/supabase/admin.ts` — with `import 'server-only'`

*(No unit test framework is needed in Phase 1 — build validation and type-check are the primary quality gates. A test framework can be added in Phase 2 when the first Server Action is implemented.)*

---

## Open Questions

1. **Next.js 15 minor version pin**
   - What we know: Latest v15 is 15.5.14. `create-next-app@15` will install the latest v15.
   - What's unclear: Whether the planner should pin an exact version (`next@15.5.14`) or use `^15` range.
   - Recommendation: Use `npx create-next-app@15` (lets npm resolve the latest v15 patch). Do not pin to an exact minor — security patches should apply automatically.

2. **English legal page URL slugs vs folder names**
   - What we know: FR uses `/mentions-legales`, `/politique-de-confidentialite`, `/cgu`. EN uses `/en/legal`, `/en/privacy`, `/en/terms` per UI-SPEC.
   - What's unclear: How next-intl `as-needed` handles different slugs per locale (the folder names are French).
   - Recommendation: Use the French folder names (`mentions-legales/`, `politique-de-confidentialite/`, `cgu/`) since those are the primary URLs. The EN routes at `/en/legal` etc. require either separate route files or next-intl's `pathnames` configuration. **The planner should verify whether Phase 1 needs translated pathnames or can use the same French slug for EN too** — using `/en/mentions-legales` is simpler and acceptable for stub pages.

3. **`params` typing in Next.js 15**
   - What we know: Next.js 15 changed `params` from a plain object to a `Promise<{...}>` — must `await params` in async components.
   - What's unclear: Whether `create-next-app@15` generates boilerplate with this pattern already applied.
   - Recommendation: Always write `const { locale } = await params;` in all `[locale]` route files. Treat the synchronous pattern as deprecated.

---

## Project Constraints (from CLAUDE.md)

The project CLAUDE.md describes the existing Turborepo mobile monorepo — it does not directly govern the new standalone `ziko-web` repo being created in Phase 1. However, the following conventions from CLAUDE.md should carry over to `ziko-web` for consistency:

| Constraint | Source | Application to ziko-web |
|------------|--------|------------------------|
| TypeScript strict mode everywhere | CLAUDE.md general convention | Set `"strict": true` in `tsconfig.json` |
| Functional components, camelCase hooks, PascalCase components | CLAUDE.md general convention | Apply to all React components in `ziko-web` |
| Design tokens: `#FF5C1A`, `#F7F6F3`, `#1C1A17`, `#E2E0DA`, `#6B6963` | CLAUDE.md Design System table | Exactly matches CONTEXT.md D-03 — use verbatim |
| Light sport theme — no dark mode | CLAUDE.md Design System note | No `dark:` Tailwind classes anywhere |
| `SUPABASE_SERVICE_ROLE_KEY` server-only (no `NEXT_PUBLIC_` prefix) | CLAUDE.md env var section | Critical — enforced by `import 'server-only'` pattern |
| RTK prefix for all Bash commands | User CLAUDE.md (global) | All dev commands should use `rtk` prefix (e.g., `rtk next build`, `rtk npm install`) |

The `ziko-web` project will not use:
- NativeWind (React Native only)
- Expo Router
- `@ziko/plugin-sdk`
- Zustand or TanStack Query (no client state management in Phase 1)
- `showAlert` from plugin-sdk
- Ionicons

---

## Sources

### Primary (HIGH confidence)

- [next-intl.dev — App Router setup](https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing) — i18n routing, setRequestLocale, middleware, generateStaticParams, static rendering
- [next-intl.dev — Routing configuration](https://next-intl.dev/docs/routing/configuration) — defineRouting, localePrefix, as-needed
- [next-intl v4.0 release blog](https://next-intl.dev/blog/next-intl-4-0) — ESM-only, auto-inherited messages, breaking changes from v3
- [Tailwind CSS v4 + Next.js guide](https://tailwindcss.com/docs/guides/nextjs) — @tailwindcss/postcss, @theme directive, globals.css setup
- [Next.js 15 stable release](https://nextjs.org/blog/next-15) — React 19, App Router, params as Promise
- [Supabase docs — service_role in server actions](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa) — import 'server-only' pattern, admin client
- [Next.js — Font optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) — next/font/google self-hosting
- `.planning/research/ARCHITECTURE.md` — Folder structure, component responsibilities, data flow
- `.planning/research/STACK.md` — Pinned versions, installation commands, compatibility matrix
- `.planning/research/PITFALLS.md` — All 8 critical pitfalls with prevention strategies
- `.planning/research/SUMMARY.md` — Executive synthesis, phase rationale
- `.planning/phases/01-foundation/01-CONTEXT.md` — All locked decisions D-01 through D-08
- `.planning/phases/01-foundation/01-UI-SPEC.md` — Component inventory, URL slugs, color + typography contract
- npm registry (verified 2026-03-26) — next@15.5.14, next-intl@4.8.3, tailwindcss@4.2.2, @supabase/supabase-js@2.100.1

### Secondary (MEDIUM confidence)

- [Vercel — Common mistakes with the Next.js App Router](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them) — dynamic rendering pitfalls, env var scoping
- [Next.js — Security in Server Components and Actions](https://nextjs.org/blog/security-nextjs-server-components-actions) — server-only import pattern

### Tertiary (LOW confidence)

None — all findings verified at HIGH or MEDIUM against official documentation.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions verified against npm registry 2026-03-26
- Architecture: HIGH — patterns sourced directly from official next-intl and Next.js docs
- Pitfalls: HIGH — all verified against official sources (next-intl docs, Vercel blog, Next.js security docs)
- Validation: HIGH — `next build` output is the authoritative acceptance check for FOUND-04

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (30 days — stable libraries, no fast-moving APIs in scope)
