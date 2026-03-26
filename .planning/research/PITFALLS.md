# Pitfalls Research

**Domain:** Next.js 14 App Router marketing site — next-intl i18n, Supabase server actions, French legal (RGPD/CNIL), Vercel deployment
**Researched:** 2026-03-26
**Confidence:** HIGH (verified against official docs, Vercel blog, next-intl docs, CNIL guidance)

---

## Critical Pitfalls

### Pitfall 1: Service Role Key Leaking Into the Client Bundle

**What goes wrong:**
The Supabase admin client (initialized with `SUPABASE_SERVICE_ROLE_KEY`) ends up in the client JavaScript bundle. This gives anyone who visits the site full superuser access to the database — equivalent to leaking root credentials.

**Why it happens:**
A developer imports the admin client utility in a file that also contains a `'use client'` directive, or the utility file gets imported transitively through a component tree that eventually renders on the client. Without an explicit guard, Next.js will happily bundle the import.

**How to avoid:**
Add `import 'server-only'` at the top of any file that initializes the Supabase admin client. This causes a build-time error if the module is ever imported in a client context.

```typescript
// lib/supabase-admin.ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`. Verify this is absent from the Vercel environment variable list under the "Client" scope.

**Warning signs:**
- Searching the built `.next/` directory for the service role key value reveals it in static files
- The key appears in browser DevTools under Network > Response or Sources
- Environment variable is accidentally named `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`

**Phase to address:** Phase 1 (project setup, before any Supabase integration)

---

### Pitfall 2: Server Action for Account Deletion Has No Authentication or Rate Limiting

**What goes wrong:**
The account deletion server action calls `supabaseAdmin.auth.deleteUser(userId)` but does not verify the requesting user's identity. An attacker who guesses or enumerates user IDs can delete anyone's account by calling the action directly (server actions are public HTTP endpoints).

**Why it happens:**
Developers assume the action is only accessible from an authenticated page, so they skip the auth check inside the action itself. Server actions look like internal functions but are exposed as POST endpoints that can be called independently.

**How to avoid:**
Inside the deletion server action:
1. Accept the user's email as the form input, never a raw user ID
2. Verify the user's email exists in Supabase auth — do not trust the submitted email to derive a user ID directly
3. Consider adding a second confirmation step (e.g., email the user a one-time token before deletion)
4. Add rate limiting by IP address — use Vercel KV + `@upstash/ratelimit` or middleware-level rate limiting

```typescript
// app/actions/delete-account.ts
'use server'
import 'server-only'

export async function deleteAccount(formData: FormData) {
  // Rate limit by IP before anything else
  const ip = headers().get('x-forwarded-for') ?? 'anonymous'
  const { success } = await rateLimiter.limit(ip)
  if (!success) throw new Error('Too many requests')

  const email = formData.get('email') as string
  // Validate with Zod, look up user by email, then delete
}
```

**Warning signs:**
- Action accepts a `userId` directly from form data
- No rate limiter imported in the action file
- Zod or similar validation is absent from the action

**Phase to address:** Phase 2 (account deletion feature implementation)

---

### Pitfall 3: next-intl `useTranslations` Called in Async Server Components

**What goes wrong:**
React hooks cannot be called inside async functions. When a server component is async (needed to `await` data fetching), calling `useTranslations()` throws a runtime error: `"useTranslations is not callable within an async component"`.

**Why it happens:**
Developers use `useTranslations` universally without knowing that next-intl provides a separate async API for server components. The docs mention this, but it is easy to miss when starting from examples.

**How to avoid:**
Use `getTranslations` (async) from `'next-intl/server'` in async server components. Use `useTranslations` (hook) only in sync server components and client components.

```typescript
// Async server component — correct
import { getTranslations } from 'next-intl/server'

export default async function HeroSection() {
  const t = await getTranslations('Hero')
  const data = await fetchSomeData()
  return <h1>{t('title')}</h1>
}

// Sync server component or client component — correct
import { useTranslations } from 'next-intl'

export function NavBar() {
  const t = useTranslations('Nav')
  return <nav>{t('home')}</nav>
}
```

**Warning signs:**
- Build or runtime error: "useTranslations is not callable within an async component"
- Mixing `await` and `useTranslations` in the same component function

**Phase to address:** Phase 1 (i18n setup, establish component patterns)

---

### Pitfall 4: `setRequestLocale` Missing in Static Pages — Dynamic Rendering Forced

**What goes wrong:**
Without calling `setRequestLocale(locale)` at the top of every `[locale]/layout.tsx` and `[locale]/page.tsx`, next-intl opts every page into dynamic rendering. The entire marketing site — which should be statically generated — becomes dynamically rendered on every request, causing slow TTFB and Vercel function invocations for every page load.

**Why it happens:**
The next-intl docs explain this requirement, but it is a non-obvious extra call. Developers set up routing and translations correctly but forget this step, and the site appears to work fine in development (dev mode is always dynamic).

**How to avoid:**
Call `setRequestLocale(locale)` as the very first line in every layout and page that receives locale from params. Also add `generateStaticParams` to the root locale layout.

```typescript
// app/[locale]/layout.tsx
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default function LocaleLayout({ children, params: { locale } }) {
  setRequestLocale(locale)
  return <>{children}</>
}
```

**Warning signs:**
- Vercel function invocations spike for static marketing pages
- `next build` output shows all `[locale]/*` routes as `ƒ` (dynamic) instead of `○` (static)
- No `generateStaticParams` in the locale layout

**Phase to address:** Phase 1 (i18n setup)

---

### Pitfall 5: Missing `metadataBase` Causes Wrong og:image URLs in Production

**What goes wrong:**
Social sharing (Twitter, Facebook, WhatsApp, Slack previews) shows a broken image or Vercel's auto-generated preview URL instead of the production domain image. OG cards fail to render app screenshots.

**Why it happens:**
When `metadataBase` is not set, Next.js uses `VERCEL_URL` (which looks like `project-name-xyz.vercel.app`) to resolve relative OG image paths. This URL changes per deployment and is not the production domain.

**How to avoid:**
Set `metadataBase` in the root layout using an environment variable for the production domain.

```typescript
// app/[locale]/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? `https://${process.env.VERCEL_URL}`
  ),
}
```

Set `NEXT_PUBLIC_SITE_URL=https://ziko.app` (or whatever the production domain is) in Vercel's production environment scope. Leave it unset in preview deployments so they use `VERCEL_URL` automatically.

**Warning signs:**
- Next.js build warning: "metadata.metadataBase is not set for resolving social open graph or twitter images"
- Sharing a page link on Slack shows the preview Vercel URL image, not the production image
- Running the Facebook Sharing Debugger shows wrong image URL

**Phase to address:** Phase 2 (SEO and metadata setup)

---

### Pitfall 6: RGPD Cookie Consent Banner Missing "Reject All" at the Same Level as "Accept All"

**What goes wrong:**
The CNIL (France's data protection authority) requires a "Reject All" button to appear at the same prominence as "Accept All" in the cookie consent banner. Sites that bury the reject option behind a "Manage preferences" click have been fined by the CNIL. A December 2024 enforcement update explicitly prohibits dark patterns that discourage rejection.

**Why it happens:**
Many cookie consent widget libraries and templates default to a two-step flow (accept is one click, reject requires entering preferences). Developers ship what the library gives them by default.

**How to avoid:**
Use a consent library that exposes a first-level "Reject All" button alongside "Accept All". Verify in the banner's visual output that both buttons are at the same click depth. If using a custom implementation, both buttons must be present in the initial banner — not in a second modal.

For a static marketing site with no analytics trackers yet, the safest CNIL-compliant approach is: no non-essential cookies → no cookie banner required. Only add a banner when third-party analytics (Google Analytics, etc.) are added.

**Warning signs:**
- Cookie banner only shows "Accept" and "Preferences" — reject requires two clicks
- Any Google Analytics or Meta Pixel script loads before consent
- `document.cookie` in the browser console shows analytics cookies before the user has accepted

**Phase to address:** Phase 1 (if any analytics are added from the start); before launch for any third-party scripts

---

### Pitfall 7: Mentions Légales Page Missing Mandatory Content

**What goes wrong:**
The mentions légales page is incomplete. French law (Loi pour la Confiance dans l'Économie Numérique, LCEN) requires specific information. Missing content exposes the site operator to a fine of up to €75,000 and 1 year imprisonment for individuals.

**Why it happens:**
Developers copy a generic mentions légales template that covers some fields but miss others, or the entity details (SIREN, registered address, hosting provider details) are left as placeholders.

**How to avoid:**
The mentions légales page must include all of the following:
- Publisher identity: full legal name, address, company form (SARL, SAS, auto-entrepreneur, etc.)
- SIREN/SIRET number if a registered business
- Contact email or phone
- Name and address of the hosting provider (in this case: Vercel Inc., 340 Pine Street Suite 601, San Francisco, CA 94104, USA)
- Publication director name
- If collecting personal data: link to the politique de confidentialité and CNIL registration number if applicable

Additionally, the French language law (Loi Toubon) requires all written content directed at a French audience to be in French — including legal pages. The site can offer English, but French must be available and default.

**Warning signs:**
- Hosting provider details show "À compléter" or similar placeholder text
- Company registration number (SIREN) is absent or generic
- The page was generated from a template with unfilled brackets like `[NOM]` or `[SIRET]`
- No publication director named

**Phase to address:** Phase 2 (legal pages implementation), must be verified before launch

---

### Pitfall 8: Middleware Matcher Misses Routes With Dots — next-intl Locale Detection Breaks

**What goes wrong:**
Routes containing a dot in the URL segment (e.g., `/sitemap.xml`, `/robots.txt`, static asset paths like `/_next/static/...`) do not pass through the next-intl middleware by default. If the matcher is too broad, it can cause errors on static file requests. If it is too narrow, legitimate pages with dots in slugs silently skip locale detection.

**Why it happens:**
The default next-intl middleware matcher pattern `/((?!_next|[^?]*\\.(?:...))).*` is subtle and easy to get wrong. Developers copy partial examples or modify the matcher without understanding the dot-extension exclusion regex.

**How to avoid:**
Use the exact matcher from the next-intl documentation without modification, and test with `next.config.ts` path inspection to confirm static file requests are excluded.

```typescript
// middleware.ts
export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
}
```

Never run next-intl middleware on `/api/*` routes — this will interfere with any future API routes and causes unnecessary overhead.

**Warning signs:**
- `/favicon.ico` returns a redirect to `/fr/favicon.ico`
- `/_next/static/` assets are being processed through the middleware (visible in server logs)
- Any route ending in a file extension returns a 404 or redirect loop

**Phase to address:** Phase 1 (i18n setup)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode French as default locale without proper routing | Faster initial setup | Broken English routes, rewrite needed when `/en/` is added | Never — set up `[locale]` routing from day one |
| Use `any` for Supabase query return types | Skip writing types | Silent runtime errors when schema changes | Never — use generated Supabase types |
| Skip `setRequestLocale` and accept dynamic rendering | No extra boilerplate | Every marketing page hits a serverless function on load | Only acceptable in dev/prototype; fix before production |
| Put legal page content directly in JSX as hardcoded text | Simple to write | No i18n, can't update without code deploy | Acceptable for v1 if French-only initially |
| Inline Supabase admin credentials in server action directly | One less file | Violates single responsibility, risky if file later moved | Never |
| Use `console.log` for delete action debugging | Easy troubleshooting | Risk of logging user emails or IDs in Vercel log streams | Never in production — use structured, non-PII logging |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| next-intl + App Router | Calling `useTranslations` in async server components | Use `getTranslations` from `'next-intl/server'` in async components |
| next-intl + App Router | Forgetting `setRequestLocale` in every layout and page | Call `setRequestLocale(locale)` as the first statement in each route segment |
| next-intl + App Router | Not wrapping root layout children with `NextIntlClientProvider` | Wrap in root layout so client components can access translations |
| next-intl + Vercel | `createNextIntlPlugin()` omitted from `next.config.ts` | Always wrap the config export: `export default createNextIntlPlugin()(nextConfig)` |
| Supabase admin + Server Actions | Admin client initialized outside `'use server'` file | Always create the admin client inside a file with `import 'server-only'` |
| Supabase admin + Server Actions | Accepting user-submitted `userId` to delete | Look up user by email on the server side; never trust client-submitted IDs |
| Vercel + env vars | `NEXT_PUBLIC_` variable added to Vercel dashboard after build | `NEXT_PUBLIC_` vars are baked in at build time — must redeploy after adding |
| Vercel + env vars | Setting service role key in wrong environment scope | Ensure `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix and is scoped to "Server" only |
| Next.js Metadata + Vercel | Relative og:image paths without `metadataBase` set | Set `metadataBase` using `NEXT_PUBLIC_SITE_URL` env var pointing to production domain |
| Next.js Image + marketing | Using `fill` layout without a constrained parent height | Always provide explicit `height`/`width` or a sized parent for `fill` to prevent CLS |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Forced dynamic rendering due to missing `setRequestLocale` | High TTFB on all pages, Vercel functions invoked per page load | Add `setRequestLocale` + `generateStaticParams` to all `[locale]` routes | Immediately visible in Vercel function usage dashboard |
| `next/image` with wrong or missing `sizes` prop | Desktop images downloaded on mobile (4-10x larger than needed), LCP regression | Always set `sizes` to match the CSS layout width (`"100vw"` for full-width, `"(max-width: 768px) 100vw, 50vw"` for responsive) | Noticeable at real mobile traffic volume |
| App screenshots loaded as unoptimized PNGs without `priority` on hero | LCP of 4-6s because hero image is not preloaded | Add `priority` prop to the primary above-the-fold hero image | Every page load |
| Unnecessary Client Components (`'use client'` on static content components) | Larger JS bundle, slower TTI for a mostly-static marketing site | Default to Server Components; only add `'use client'` when using state, effects, or browser APIs | As component count grows |
| Defining Server Actions inside Client Component render functions | Action captures variables in closure and may serialize env vars into the bundle | Always define server actions in separate `'use server'` files | Immediately — build-time or security concern |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service role key without `import 'server-only'` guard | Full database superuser access leaked to browser | Add `import 'server-only'` to admin client module |
| Account deletion action with no auth confirmation | Attacker can delete any account by submitting emails | Require email lookup + optional OTP confirmation; never accept userId from form |
| No rate limiting on account deletion endpoint | Attacker scrapes user base by submitting known emails, infers account existence | Add IP-based rate limiting (5 requests/min per IP) using Upstash Redis or Vercel KV |
| No Zod validation in server action inputs | Malformed email bypasses database lookup, potential injection | Validate all inputs with Zod before any database call |
| NEXT_PUBLIC prefix on server-only env vars | Secret key inlined into JS bundle during build | Audit all env vars — anything without `NEXT_PUBLIC_` stays server-only |
| Analytics (GA4, Meta Pixel) loaded without CNIL-compliant consent | CNIL fine up to 4% of global revenue; recent €325M fine precedent (Google) | No tracking scripts without consent banner; or ship v1 with no analytics at all |
| Google Fonts loaded from Google CDN without consent disclosure | Transmits user IP to Google servers — CNIL has fined this without consent | Self-host fonts using `next/font` (downloads and serves fonts from Vercel automatically) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Account deletion form shows only a success message without immediate feedback | User uncertain if deletion happened; may submit multiple times | Show clear loading state, confirm deletion in-line, explain data deletion timeline (RGPD: 30 days) |
| Language switcher changes locale but does not preserve current page path | User is redirected to the home page on every language change | Use `useRouter().replace()` with the translated pathname, preserving the current route |
| Legal pages (RGPD, CGU) render as one long unstructured block | Users cannot find the section they are looking for; bad for CNIL audits | Use clear numbered sections with anchor links; structure matches standard French legal templates |
| App Store / Play Store links hardcoded without a UA sniff | Android users see an iOS App Store link and vice versa; broken UX on mobile | Show both buttons on desktop; auto-detect mobile UA to highlight the relevant store link |
| Cookie consent banner appears but no mechanism to change consent later | CNIL requires withdrawal of consent to be as easy as giving it | Add a persistent "Manage cookies" link in the footer that re-opens the consent panel |

---

## "Looks Done But Isn't" Checklist

- [ ] **next-intl setup:** Translations load in dev — verify `setRequestLocale` is called in every route segment and all pages show as `○` (static) in `next build` output
- [ ] **Service role security:** Admin client file exists — verify it starts with `import 'server-only'` and `SUPABASE_SERVICE_ROLE_KEY` does NOT appear in the built `.next/` artifacts
- [ ] **Account deletion:** Form submits successfully — verify the action validates email with Zod, looks up the user by email server-side, and has a rate limiter in place
- [ ] **OG metadata:** Metadata objects defined — verify og:image URLs in the built HTML use the production domain, not a Vercel preview URL
- [ ] **Mentions légales:** Page exists — verify all mandatory LCEN fields are filled (publisher identity, SIREN, hosting provider = Vercel, publication director) with real data, not placeholders
- [ ] **RGPD privacy page:** Exists and links from footer — verify it names all data processors (Supabase, Vercel, any analytics), specifies retention periods, and includes CNIL complaint link
- [ ] **Cookie compliance:** Site appears to work — verify no non-essential cookies are set before consent by checking `document.cookie` on first load in a private window
- [ ] **Google Fonts:** Fonts load correctly — verify they are served from `/_next/static/` (self-hosted via `next/font`), not from `fonts.googleapis.com`
- [ ] **Env vars:** Build succeeds locally — verify all required env vars are also set in Vercel dashboard for the production environment, with correct scopes (server vs. client)
- [ ] **Middleware matcher:** Routing works — verify `/favicon.ico` and `/_next/static/` requests are NOT redirected through the locale middleware

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Service role key leaked in bundle | HIGH | Rotate the key in Supabase dashboard immediately, then add `import 'server-only'` guard and redeploy |
| Dynamic rendering on all pages | LOW | Add `setRequestLocale` + `generateStaticParams` to all locale route segments; pages become static after next build |
| Missing `metadataBase` | LOW | Add env var `NEXT_PUBLIC_SITE_URL` in Vercel, set `metadataBase` in root layout, redeploy |
| Incomplete mentions légales | MEDIUM | Fill all required fields, republish — this must be done before public launch |
| Cookie banner without Reject All | MEDIUM | Replace or configure the consent library to surface Reject All at first level; requires design change |
| Account deletion action abuse | MEDIUM | Add Upstash Redis rate limiter to the action; requires adding Vercel KV integration |
| Wrong locale matcher (missing routes) | MEDIUM | Update middleware matcher regex, test all route types, redeploy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Service role key exposure | Phase 1 (project setup) | Search built `.next/` for key value; confirm `import 'server-only'` present |
| next-intl async component API mismatch | Phase 1 (i18n setup) | Build succeeds without async/hook errors; all components reviewed |
| Missing `setRequestLocale` / forced dynamic | Phase 1 (i18n setup) | `next build` output shows `○` for all `[locale]` routes |
| Middleware matcher dot-route bug | Phase 1 (i18n setup) | Favicon, robots.txt, sitemap load without locale redirect |
| Missing `metadataBase` | Phase 2 (content + SEO) | OG image URLs in built HTML use production domain |
| Account deletion security (auth + rate limit) | Phase 2 (account deletion feature) | Manual testing: submit unknown email, submit many times in one minute |
| Mentions légales incomplete | Phase 2 (legal pages) | Manual checklist against LCEN requirements before launch |
| Cookie consent (CNIL Reject All) | Phase 2 (legal pages / if analytics added) | Check first load in private window, confirm no tracking cookies pre-consent |
| Google Fonts served from Google CDN | Phase 1 (project setup) | Network tab on first load shows fonts from `/_next/static/` not googleapis.com |
| Env vars wrong scope on Vercel | Phase 1 (infra setup) | Verify Vercel dashboard env var scopes match production/preview/dev needs |

---

## Sources

- [Vercel — Common mistakes with the Next.js App Router](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them)
- [next-intl — App Router getting started](https://next-intl.dev/docs/getting-started/app-router)
- [next-intl — Server & Client Components](https://next-intl.dev/docs/environments/server-client-components)
- [next-intl — Middleware routing](https://next-intl.dev/docs/routing/middleware)
- [next-intl GitHub issue — useTranslations not callable in async component](https://github.com/amannn/next-intl/issues/733)
- [Supabase Docs — Performing admin tasks with service_role](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa)
- [Makerkit — Next.js Server Actions: 5 Vulnerabilities](https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions)
- [Next.js — Security in Server Components and Actions](https://nextjs.org/blog/security-nextjs-server-components-actions)
- [Next.js — generateMetadata / metadataBase](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [CNIL — Cookie consent requirements for France](https://www.consentmo.com/blog-posts/maximizing-compliance-with-gdpr-and-cnil-regulations-in-france)
- [Najumi — Mentions légales, CGU required content 2025](https://najumi.fr/en/article/mentions-legales-cgu-confidentialite-site-web-2025/)
- [Economie.gouv.fr — Mentions légales mandatory fields](https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter)
- [DEV.to — Pitfalls of NEXT_PUBLIC_ environment variables](https://dev.to/koyablue/the-pitfalls-of-nextpublic-environment-variables-96c)
- [Pagepro — Common Next.js mistakes hurting Core Web Vitals](https://pagepro.co/blog/common-nextjs-mistakes-core-web-vitals/)
- [next-intl — setRequestLocale / static rendering](https://next-intl.dev/docs/routing/setup)

---
*Pitfalls research for: Next.js 14 App Router marketing site — next-intl, Supabase server actions, RGPD/CNIL, Vercel*
*Researched: 2026-03-26*
