# Architecture Research

**Domain:** Next.js 14 App Router marketing site with next-intl and Supabase admin operations
**Researched:** 2026-03-26
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                             │
│   ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐    │
│   │  Static Pages │  │  Legal Pages │  │  Account Deletion Form │    │
│   │  (SSG/CDN)    │  │  (SSG/CDN)   │  │  (Client Component)    │    │
│   └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘    │
│          │                 │                       │ useActionState  │
└──────────┼─────────────────┼───────────────────────┼────────────────┘
           │                 │                       │
┌──────────┼─────────────────┼───────────────────────┼────────────────┐
│                    Next.js App Router (Vercel Edge)                  │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │              Middleware (next-intl locale detection)        │    │
│   │   accept-language → NEXT_LOCALE cookie → URL prefix        │    │
│   └────────────────────────────────────────────────────────────┘    │
│          │                 │                       │                 │
│   ┌──────┴───────┐  ┌──────┴───────┐  ┌───────────┴────────────┐   │
│   │  Server      │  │  Server      │  │  Server Action          │   │
│   │  Components  │  │  Components  │  │  deleteAccount()        │   │
│   │  (static)    │  │  (legal)     │  │  "use server"           │   │
│   └──────────────┘  └──────────────┘  └───────────┬────────────┘   │
│                                                     │               │
│   ┌─────────────────────────────────────────────────┴──────────┐   │
│   │              lib/supabase/admin.ts                          │   │
│   │              createAdminClient() — service_role only        │   │
│   └─────────────────────────────────────────────────┬──────────┘   │
└─────────────────────────────────────────────────────┼──────────────┘
                                                       │
┌─────────────────────────────────────────────────────┼──────────────┐
│                    Supabase (existing)                │              │
│   ┌───────────────────────┐  ┌──────────────────────┴───────────┐  │
│   │  PostgreSQL (auth.*)  │  │  auth.admin.deleteUser(userId)   │  │
│   │  (unchanged)          │  │  requires service_role key       │  │
│   └───────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `middleware.ts` | Locale detection and routing | next-intl `createMiddleware` from `i18n/routing.ts` |
| `[locale]/layout.tsx` | Root layout with locale context, font, metadata | `setRequestLocale(locale)`, NextIntlClientProvider |
| `[locale]/page.tsx` | Marketing landing page | Server Component, fully static, SSG |
| `[locale]/legal/*.tsx` | Privacy policy, CGU, mentions légales | Server Component, fully static, SSG |
| `[locale]/account/delete/page.tsx` | Account deletion page | Thin page wrapper, renders Client Component |
| `components/account/DeleteAccountForm.tsx` | Interactive deletion form | Client Component, `useActionState` |
| `app/actions/account.ts` | Server action for account deletion | `"use server"`, zod validation, admin Supabase client |
| `lib/supabase/admin.ts` | Admin Supabase client factory | `createClient` with `SUPABASE_SERVICE_ROLE_KEY` |
| `i18n/routing.ts` | Locale config (locales, defaultLocale, prefix) | `defineRouting` from next-intl |
| `i18n/request.ts` | Per-request locale resolution | `getRequestConfig`, loads message JSON |
| `i18n/navigation.ts` | Type-safe Link/redirect/useRouter | Wraps next-intl navigation APIs |
| `messages/fr.json`, `messages/en.json` | Translation strings | Flat or nested key-value JSON |

## Recommended Project Structure

This is a standalone Next.js project — separate repo from the mobile monorepo.

```
ziko-web/
├── messages/
│   ├── fr.json                   # French translations (default locale)
│   └── en.json                   # English translations
├── public/
│   ├── screenshots/              # App screenshots for hero section
│   └── og-image.png              # Open Graph image
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx        # Root layout — NextIntlClientProvider, fonts, metadata
│   │   │   ├── page.tsx          # Marketing homepage (Hero + Features + Pricing)
│   │   │   ├── account/
│   │   │   │   └── delete/
│   │   │   │       └── page.tsx  # Account deletion page — renders DeleteAccountForm
│   │   │   └── legal/
│   │   │       ├── privacy/
│   │   │       │   └── page.tsx  # RGPD / Politique de confidentialité
│   │   │       ├── cgu/
│   │   │       │   └── page.tsx  # Conditions Générales d'Utilisation
│   │   │       └── mentions/
│   │   │           └── page.tsx  # Mentions légales
│   │   ├── favicon.ico
│   │   └── globals.css           # @import "tailwindcss"
│   ├── actions/
│   │   └── account.ts            # "use server" — deleteAccount server action
│   ├── components/
│   │   ├── account/
│   │   │   └── DeleteAccountForm.tsx   # "use client" — form with useActionState
│   │   ├── landing/
│   │   │   ├── Hero.tsx          # Hero section, download CTAs
│   │   │   ├── Features.tsx      # 17 plugins showcase
│   │   │   └── Pricing.tsx       # Pricing/free tier CTA
│   │   ├── legal/
│   │   │   └── LegalLayout.tsx   # Shared wrapper for legal pages
│   │   └── ui/
│   │       ├── Button.tsx        # Primary/secondary button variants
│   │       └── AppStoreBadge.tsx # App Store + Play Store badges
│   ├── i18n/
│   │   ├── routing.ts            # defineRouting — locales, defaultLocale, localePrefix
│   │   ├── request.ts            # getRequestConfig — load messages per locale
│   │   └── navigation.ts        # Type-safe Link, redirect, useRouter, usePathname
│   └── lib/
│       └── supabase/
│           └── admin.ts          # createAdminClient() — service_role only, server-only
├── middleware.ts                  # next-intl middleware (at project root, NOT in src/app/)
├── next.config.ts                 # withNextIntl plugin
├── postcss.config.mjs             # @tailwindcss/postcss
├── tsconfig.json                  # paths: "@/*": ["./src/*"]
└── .env.local                     # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### Structure Rationale

- **`messages/` at root:** next-intl convention — message files outside `src/`, loaded via `fs` in `i18n/request.ts`
- **`[locale]/` wraps all pages:** Enables locale-aware static generation with `generateStaticParams`. Every page and layout calls `setRequestLocale(locale)` for static rendering support.
- **`actions/` separate from `components/`:** Server actions are not components. Co-locating them with components causes confusion about what runs where. A dedicated `actions/` directory makes the server/client boundary explicit.
- **`lib/supabase/admin.ts` in `lib/`:** The admin client uses `SUPABASE_SERVICE_ROLE_KEY`. Placing it in `lib/` (not `actions/`) makes it a utility that can only be imported in server contexts. Add `import 'server-only'` at the top to enforce this.
- **`i18n/` directory:** next-intl's canonical location for routing config, request config, and navigation exports. Keeps i18n concerns isolated from route files.
- **`middleware.ts` at project root:** Next.js requires middleware at the project root (same level as `package.json`), not inside `src/`. Place it there regardless of whether you use a `src/` directory.
- **`components/landing/`:** Landing page sections are heavy (screenshots, feature cards). Grouping them avoids polluting the top-level `components/ui/` with page-specific compositions.

## Architectural Patterns

### Pattern 1: Locale-Prefix Routing with `as-needed`

**What:** The default locale (French) has clean URLs with no prefix (`/politique-de-confidentialite`). All other locales get the prefix (`/en/privacy`). The middleware detects locale from the URL prefix first, then `accept-language` header, then `NEXT_LOCALE` cookie.

**When to use:** When your primary audience is one locale and you want clean URLs for them. Avoids `/fr/` on every URL for French users while maintaining proper SEO for English variants.

**Trade-offs:** The default locale (`fr`) cannot be forced into the URL — it simply won't have a prefix. This is intentional and correct for this project. The `accept-language` header may redirect new English-browser visitors to `/en/` on their first visit.

**Configuration (`src/i18n/routing.ts`):**
```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
});
```

**Root layout (`src/app/[locale]/layout.tsx`):**
```typescript
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
```

### Pattern 2: Static Generation for All Marketing Pages

**What:** Every marketing page and legal page is fully static — generated at build time and served from Vercel's CDN edge. No server-side rendering at runtime. The only dynamic operation is the account deletion server action (POST, not GET).

**When to use:** Marketing pages and legal text never change at runtime. Static generation gives fastest possible TTFB, lowest Vercel cost, and best Core Web Vitals scores.

**Trade-offs:** Content updates require a redeploy. For a v1 marketing site with static legal text, this is acceptable. If content needs frequent updates without redeploy, add `revalidate` for ISR — but not needed for v1.

**Page pattern:**
```typescript
// src/app/[locale]/page.tsx — Server Component
import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale); // Required for static rendering
  return (
    <>
      <Hero />
      <Features />
      <Pricing />
    </>
  );
}
```

### Pattern 3: Server Action with `useActionState` for Account Deletion

**What:** A Client Component form calls a server action via `useActionState`. The server action validates input, looks up the user by email via Supabase admin, deletes the account, and returns a typed result object. The client component renders the appropriate success/error state.

**When to use:** Any form that requires privileged server-side operations (admin credentials, service role keys). The form degrades gracefully if JavaScript is disabled.

**Trade-offs:** The two-step confirmation (enter email, confirm) requires either two separate server action invocations or client-side state to track confirmation step. Client-side step tracking is simpler here — no sensitive data is involved in step 1 (just showing a confirmation UI).

**Server action (`src/actions/account.ts`):**
```typescript
'use server';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  email: z.string().email(),
  confirmation: z.literal('SUPPRIMER'),
});

type ActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

export async function deleteAccount(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    confirmation: formData.get('confirmation'),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Données invalides.' };
  }

  const supabase = createAdminClient();

  // Look up user by email
  const { data: users, error: lookupError } =
    await supabase.auth.admin.listUsers();
  if (lookupError) {
    return { status: 'error', message: 'Erreur lors de la recherche.' };
  }

  const user = users.users.find((u) => u.email === parsed.data.email);
  if (!user) {
    // Return success to avoid email enumeration
    return { status: 'success' };
  }

  const { error: deleteError } =
    await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return { status: 'error', message: 'Suppression échouée. Réessayez.' };
  }

  return { status: 'success' };
}
```

**Admin client (`src/lib/supabase/admin.ts`):**
```typescript
import 'server-only'; // Hard build error if imported in client bundle
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

## Data Flow

### Account Deletion Flow

```
User fills email + types "SUPPRIMER"
    ↓
<DeleteAccountForm> (Client Component)
  useActionState(deleteAccount, { status: 'idle' })
    ↓ form submission (POST)
deleteAccount() server action
  ├── zod validation → return error if invalid
  ├── createAdminClient() (service_role key, server-only)
  ├── supabase.auth.admin.listUsers() → find by email
  │   └── user not found → return success (no enumeration)
  ├── supabase.auth.admin.deleteUser(user.id)
  │   └── error → return { status: 'error', message }
  └── return { status: 'success' }
    ↓
useActionState receives ActionState
  ├── status: 'success' → render confirmation message
  └── status: 'error'   → render error message inline
```

### Locale Routing Flow

```
Request: GET /about
    ↓
middleware.ts (next-intl createMiddleware)
  ├── URL has /en/ prefix → locale = 'en'
  ├── URL has /fr/ prefix → locale = 'fr'
  ├── No prefix + NEXT_LOCALE cookie = 'en' → redirect to /en/about
  └── No prefix + accept-language: fr → locale = 'fr' (no redirect, fr is default)
    ↓
app/[locale]/about/page.tsx
  setRequestLocale('fr')
  useTranslations('about') → fr.json lookup
    ↓
Static HTML served from CDN
```

### Static Generation Flow

```
next build
    ↓
generateStaticParams() in [locale]/layout.tsx
  → [{ locale: 'fr' }, { locale: 'en' }]
    ↓
For each locale × each page:
  setRequestLocale(locale)
  render Server Component to HTML
    ↓
Output: /fr/index.html, /en/index.html (or / for default)
        /fr/legal/privacy/index.html, /en/legal/privacy/index.html
        /fr/account/delete/index.html, /en/account/delete/index.html
    ↓
Deployed to Vercel CDN edge nodes
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10k visitors/month | Current architecture is fine — static CDN, no server compute |
| 10k-500k visitors/month | No changes needed — Vercel CDN handles this trivially for static pages |
| Account deletion at scale | `listUsers()` scans all users — replace with `getUserByEmail()` if Supabase exposes it, or use a DB query `SELECT id FROM auth.users WHERE email = $1` via service role |
| Add coach dashboard (Milestone 2) | Add `src/app/[locale]/coach/` segment with dynamic rendering; doesn't affect static marketing pages |

### Scaling Priorities

1. **First bottleneck:** `auth.admin.listUsers()` for deletion lookup — it fetches all users. At scale, switch to a direct Postgres query via the service role client: `supabase.from('users').select('id').eq('email', email).single()` on the `auth` schema.
2. **Second bottleneck:** None for v1. All marketing pages are static. The account deletion action is infrequent by nature.

## Anti-Patterns

### Anti-Pattern 1: Service Role Key in Client Bundle

**What people do:** Import `createAdminClient` directly in a Client Component, or place `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable.

**Why it's wrong:** `NEXT_PUBLIC_` variables are embedded in the client JavaScript bundle and exposed to anyone who views page source. The service role key is equivalent to unrestricted database access.

**Do this instead:** Keep the service role key in a non-prefixed env var (`SUPABASE_SERVICE_ROLE_KEY`). Only use it in `lib/supabase/admin.ts` which has `import 'server-only'` at the top. Next.js will throw a build error if this file is imported in a Client Component.

### Anti-Pattern 2: Skipping `setRequestLocale` in Layouts and Pages

**What people do:** Only call `setRequestLocale` in the root layout, assuming it cascades.

**Why it's wrong:** next-intl requires `setRequestLocale` to be called in every layout and page that participates in static rendering. Missing it causes Next.js to fall back to dynamic rendering for those routes, losing the build-time static generation benefit.

**Do this instead:** Call `setRequestLocale(locale)` at the top of every `layout.tsx` and `page.tsx` inside `[locale]/`, before any translation calls.

### Anti-Pattern 3: Placing `middleware.ts` Inside `src/app/`

**What people do:** Put `middleware.ts` inside `src/app/` alongside layouts.

**Why it's wrong:** Next.js middleware must be at the project root (same level as `package.json` and `next.config.ts`), or inside `src/` if the project uses a `src/` directory. It is NOT a route file and doesn't belong inside `app/`.

**Do this instead:** Place `middleware.ts` at `<project-root>/middleware.ts` (no `src/`), or at `src/middleware.ts` if using a `src/` layout.

### Anti-Pattern 4: Email Enumeration in Account Deletion

**What people do:** Return different error messages for "user not found" vs "deletion failed" — e.g., "No account with this email exists."

**Why it's wrong:** This allows anyone to check whether any email address has a registered account, which is a privacy violation and RGPD concern.

**Do this instead:** Return `{ status: 'success' }` regardless of whether the user was found. The deletion confirmation email (if you add one later) is the appropriate place to confirm deletion.

### Anti-Pattern 5: Dynamic Rendering for Legal Pages

**What people do:** Fetch legal text from a CMS or database at request time.

**Why it's wrong:** Legal pages (RGPD, CGU, mentions légales) are static text that changes only when your lawyers revise them. Dynamic rendering adds latency and Vercel function cost for content that never changes at runtime.

**Do this instead:** Write legal content directly in the page component or import it from a local MDX/JSON file. Static generation serves these pages from CDN at zero compute cost.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | Admin client via `SUPABASE_SERVICE_ROLE_KEY` in server action only | Never expose service role in client. Use `import 'server-only'` guard. |
| Vercel | Push to git → auto-deploy. Env vars set in Vercel dashboard. | `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` set as Production env vars in Vercel UI. |
| App Store / Play Store | Static links in Hero component | Hardcoded URLs — no API needed |
| Ziko Hono API | Not used in v1 marketing site | Account deletion calls Supabase directly, not through Hono API |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Client Component ↔ Server Action | `useActionState(deleteAccount, initialState)` | `deleteAccount` imported from `@/actions/account` |
| Server Action ↔ Supabase Admin | `createAdminClient()` from `@/lib/supabase/admin` | `server-only` import prevents accidental client use |
| Pages ↔ Translations | `useTranslations()` in Server Components, `NextIntlClientProvider` wraps Client Components | Locale resolved once per request in `i18n/request.ts` |
| `middleware.ts` ↔ i18n routing | Imports `routing` from `@/i18n/routing` | Single source of truth for locale config |

### New vs Modified

**New (this project is a standalone repo):**
- Everything in `ziko-web/` is new — no files are modified in the existing `ziko-platform` mobile monorepo

**Integration with existing Supabase:**
- Uses the same Supabase project (same `SUPABASE_URL`)
- Requires `SUPABASE_SERVICE_ROLE_KEY` — different from the `SUPABASE_PUBLISHABLE_KEY` used by the Hono API
- The `auth.users` table is shared — deletion here removes the user from the mobile app too

### What is Static vs Dynamic

| Route | Rendering | Reason |
|-------|-----------|--------|
| `[locale]/page.tsx` (homepage) | Static (SSG) | Marketing content, no user data |
| `[locale]/legal/privacy/page.tsx` | Static (SSG) | Legal text, never dynamic |
| `[locale]/legal/cgu/page.tsx` | Static (SSG) | Legal text, never dynamic |
| `[locale]/legal/mentions/page.tsx` | Static (SSG) | Legal text, never dynamic |
| `[locale]/account/delete/page.tsx` | Static (SSG) page shell | Page HTML is static; the form POST hits a server action |
| Server action `deleteAccount()` | Dynamic (server action) | Runs on POST, uses admin credentials |

### Suggested Build Order for Phases

1. **Project scaffold** — `create-next-app`, Tailwind v4, next-intl routing, middleware, `generateStaticParams`, translation files stub (`fr.json`, `en.json`). Verify locale switching works before adding content.
2. **Admin Supabase client + server action** — `lib/supabase/admin.ts` + `actions/account.ts` + `DeleteAccountForm` Client Component. Test deletion against Supabase staging before building the full marketing UI. This is the riskiest piece (service role key, email enumeration), so validate it early.
3. **Landing page sections** — Hero, Features (17 plugins), Pricing. These are UI-only with no external dependencies.
4. **Legal pages** — Privacy policy, CGU, mentions légales. Pure static content.
5. **Vercel deployment + custom domain** — Set env vars, connect domain, verify HTTPS and locale routing in production.

## Sources

- [next-intl App Router setup](https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing) — official docs, HIGH confidence
- [next-intl routing configuration](https://next-intl.dev/docs/routing/configuration) — official docs, HIGH confidence
- [next-intl locale routing setup](https://next-intl.dev/docs/routing/setup) — official docs, HIGH confidence
- [Next.js Server Actions and Mutations](https://nextjs.org/docs/14/app/building-your-application/data-fetching/server-actions-and-mutations) — official docs v14, HIGH confidence
- [Supabase auth.admin.deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) — official docs, HIGH confidence
- [Supabase service role in server actions](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa) — official docs, HIGH confidence
- [Tailwind CSS v4 + Next.js setup](https://tailwindcss.com/docs/guides/nextjs) — official docs, HIGH confidence

---
*Architecture research for: Next.js 14 App Router marketing site (next-intl, Supabase admin, Vercel)*
*Researched: 2026-03-26*
