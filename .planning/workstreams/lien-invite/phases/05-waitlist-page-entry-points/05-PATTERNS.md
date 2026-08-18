# Phase 5: Waitlist Page & Entry Points - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 17 (new + modified)
**Analogs found:** 17 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/app/[locale]/(marketing)/fondateurs/page.tsx` | route (SSG page) | request-response | `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx` | exact |
| `apps/web/src/components/marketing/WaitlistFounderBanner.tsx` (server wrapper) | component | request-response | `apps/web/src/components/marketing/Hero.tsx` (+ `CoachsHero.tsx`) | exact |
| `apps/web/src/components/marketing/WaitlistFounderBannerClient.tsx` | component | request-response | `apps/web/src/components/marketing/CoachsHeroClient.tsx` | exact |
| `apps/web/src/components/marketing/WaitlistRoleForm.tsx` | component (form) | request-response | `apps/web/src/components/account/DeleteAccountForm.tsx` | exact (useActionState pattern) |
| `apps/web/src/components/marketing/WaitlistCounterClient.tsx` | component | request-response (client fetch) | none direct — closest is `HeaderClient.tsx`'s `useScroll`/client-state idiom + `credits/balance/route.ts` fetch shape | role-match |
| `apps/web/src/app/api/waitlist/count/route.ts` | route (Route Handler) | request-response | `apps/web/src/app/api/credits/balance/route.ts` | role-match (simpler: no auth/session, admin client instead) |
| `apps/web/src/actions/waitlist.ts` (EXTEND) | service (Server Action) | CRUD (insert/update via RPC) | itself (extend in place); secondary reference `apps/web/src/actions/account.ts` (generic-response anti-enumeration idiom) | exact |
| `apps/web/src/lib/ratelimit.ts` (EXTEND — add `waitlistRatelimit`) | utility | request-response | itself — mirror `rolePromotionRatelimit`/`kycUploadRatelimit` exports in same file | exact |
| `apps/web/src/components/marketing/FoundersOfferSection.tsx` (server wrapper) | component | request-response | `apps/web/src/components/marketing/Hero.tsx` | exact |
| `apps/web/src/components/marketing/FoundersOfferSectionClient.tsx` | component | request-response | `apps/web/src/components/marketing/CoachsCtaFooterClient.tsx` | exact |
| `apps/web/src/components/layout/HeaderClient.tsx` (EXTEND) | component (nav) | request-response | itself — insert new link using existing locale-link class recipe | exact |
| `apps/web/src/components/layout/FooterClient.tsx` (EXTEND) | component (nav) | request-response | itself — insert new `AnimatedLink` | exact |
| `apps/web/src/components/marketing/CoachsHeroClient.tsx` (MODIFY link target) | component | request-response | itself | exact |
| `apps/web/src/components/marketing/CoachsCtaFooterClient.tsx` (MODIFY link target) | component | request-response | itself | exact |
| `apps/web/src/app/sitemap.ts` (EXTEND) | config | batch | itself — append to `pages` array | exact |
| `apps/web/src/app/robots.ts` (verify only, likely no change) | config | batch | itself | exact |
| `test/actions/waitlist.validation.test.ts`, `test/app/fondateurs.metadata.test.ts`, `test/components/WaitlistRoleForm.test.tsx`, `test/app/api/waitlist-count.test.ts`, `test/components/entry-points.test.tsx`, `test/app/sitemap.test.ts` | test | — | `apps/web/test/actions/waitlist.concurrency.test.ts` | role-match |

## Pattern Assignments

### `apps/web/src/app/[locale]/(marketing)/fondateurs/page.tsx` (route, request-response)

**Analog:** `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx` (53 lines, read in full)

**Full SSG shape to copy** (lines 1-53):
```tsx
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import CoachsHero from '@/components/marketing/CoachsHero'
// ... more section imports

type Props = { params: Promise<{ locale: string }> }

export async function generateStaticParams() {
  return [{ locale: 'fr' }, { locale: 'en' }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'coachs' })
  return {
    title: { absolute: t('meta.title') },
    description: t('meta.description'),
    alternates: {
      canonical: `/${locale}/coachs`,
      languages: { fr: '/fr/coachs', en: '/en/coachs' },
    },
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      url: `/${locale}/coachs`,
      siteName: 'Ziko',
      images: [{ url: '/og-coachs.png', width: 1200, height: 630 }],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
  }
}

export default async function CoachsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <main>
      <CoachsHero locale={locale} />
      {/* ...more sections */}
    </main>
  )
}
```
**For `/fondateurs`:** rename namespace to `fondateurs`, canonical/OG paths to `/${locale}/fondateurs`,
OG image to a new `/og-fondateurs.png` asset (ENTRY-04). Read `?preselect=coach` search param (or a route
param) in the page component and forward `preselected="coach"` to `WaitlistRoleForm` to satisfy D-08's
`/coachs`-redirect pre-pick — this page is otherwise 100% static per WAIT-08, so keep this a plain prop
threaded through server components, not client-side state derived from `usePathname`.

---

### `apps/web/src/components/marketing/WaitlistFounderBanner.tsx` + `WaitlistFounderBannerClient.tsx` (component, request-response)

**Analog:** `apps/web/src/components/marketing/Hero.tsx` (server, 18 lines) wrapping
`HeroClient.tsx` (client, 205 lines) — and `CoachsHero.tsx`/`CoachsHeroClient.tsx` for the two-column,
badge + headline + CTA layout closer to this phase's page-hero role.

**Server/client split pattern** (`Hero.tsx`, full file):
```tsx
import { getTranslations } from 'next-intl/server'
import { HeroClient } from './HeroClient'

export async function Hero() {
  const t = await getTranslations('Home')
  return (
    <HeroClient
      badge={t('hero.badge')}
      headline1={t('hero.headline1')}
      // ...
    />
  )
}
```
The server component only resolves `next-intl` translations and passes plain strings as props; all
animation/interactivity lives in the `'use client'` file. `WaitlistFounderBannerClient.tsx` should follow
`CoachsHeroClient.tsx`'s badge → stagger-headline → subtitle → CTA-group structure (lines 36-93 of that
file) but swap the CTA group for the role-picker (`WaitlistRoleForm`) per UI-SPEC §Focal points ("the
role-picker card pair is the primary visual anchor, not the headline").

---

### `apps/web/src/components/marketing/WaitlistRoleForm.tsx` (component/form, request-response)

**Analog:** `apps/web/src/components/account/DeleteAccountForm.tsx` (79 lines, read in full) —
established house pattern for `useActionState` + Server Action forms.

**`useActionState` wiring pattern** (lines 1-21):
```tsx
'use client';

import { useActionState, useState } from 'react';
import { deleteAccount, DeleteAccountState } from '@/actions/account';

const initialState: DeleteAccountState = { status: 'idle', message: '' };

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);

  const canSubmit = typed === 'SUPPRIMER' && checked && !pending;

  if (state.status === 'success') {
    return (
      <div className="rounded-lg bg-success-subtle border border-success/30 p-6">
        <p className="text-success font-medium">{state.message}</p>
      </div>
    );
  }
  // ...form JSX
```
**For `WaitlistRoleForm`:** replace `deleteAccount`/`DeleteAccountState` with
`claimWaitlistSpot`/`WaitlistState` (`@/actions/waitlist`), add local `role` state
(`useState<'athlete' | 'coach' | null>(preselected ?? null)` per RESEARCH.md's progressive-disclosure
snippet), gate the email `<input>` render on `role !== null` (WAIT-02), add the consent checkbox (verbatim
copy from `content/legal/founder-offer.ts`), a hidden honeypot input, and a hidden `role`/`locale` field
alongside `email`. Success branch: reuse the exact `bg-success-subtle border border-success/30 rounded-lg
p-6` card recipe (UI-SPEC §5), rendering `state.message` — never echo the submitted email (UI-SPEC
long-text row). Pending state: `{pending ? 'Envoi…' : 'Réserver ma place'}` matching
`DeleteAccountForm.tsx`'s `{pending ? '...' : ...}` idiom exactly.

**Error rendering pattern** (lines 66-68):
```tsx
{state.status === 'error' && (
  <p className="text-danger text-sm">{state.message}</p>
)}
```

**Input styling pattern** (lines 29-37) — reuse verbatim for the email field:
```tsx
<input
  id="email"
  type="email"
  name="email"
  required
  placeholder="votre@email.com"
  className="w-full rounded-lg border border-border px-4 py-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
/>
```

---

### `apps/web/src/components/marketing/WaitlistCounterClient.tsx` (component, client fetch)

**No exact analog** — this codebase has no existing "Client Component that fetches its own data from an
internal Route Handler and renders a small stateful badge" pattern. Closest partial references:
- `apps/web/src/app/api/credits/balance/route.ts` — shows the internal `fetch()` + `NextResponse.json`
  shape (see Route Handler section below) for what the Route Handler side returns.
- `CoachsHeroClient.tsx`'s badge markup (line 44-47: `inline-block bg-primary text-white text-xs
  font-bold px-3 py-1 rounded-full`) — the visual badge shape to adapt per UI-SPEC §4's three-state table
  (`text-sm`, not `text-xs`, per the documented Typography deviation).
- `HeroClient.tsx`'s `useReducedMotion`/`fadeIn` client-state idioms (`lib/motion.ts` import) for the
  loading-pulse animation.

**Build from scratch using this shape** (per `05-RESEARCH.md` Pattern 3 and Architecture Diagram):
```tsx
'use client';
import { useEffect, useState } from 'react';

type CounterResponse = { shouldDisplay: boolean; remaining: number | null; isFull: boolean };

export function WaitlistCounterClient({ fr, en, locale }: { /* copy props */ }) {
  const [data, setData] = useState<CounterResponse | null>(null);
  useEffect(() => {
    fetch('/api/waitlist/count', { next: { revalidate: 30 } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ shouldDisplay: false, remaining: null, isFull: false }));
  }, []);
  // three-state badge render per UI-SPEC §4 (pre-threshold / counter-visible / complete),
  // loading skeleton while data === null
}
```

---

### `apps/web/src/app/api/waitlist/count/route.ts` (Route Handler, request-response)

**Analog:** `apps/web/src/app/api/credits/balance/route.ts` (23 lines, read in full) — establishes the
`export async function GET()` + `NextResponse.json` Route Handler convention under `app/api/`.

**Convention to follow (session/auth omitted — this route is public)** (full file):
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const upstream = await fetch(`${API_URL}/credits/balance`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const data = await upstream.text();
  return new NextResponse(data, { status: upstream.status, ... });
}
```
**For the waitlist counter:** drop the session/auth block entirely (public route), call
`createAdminClient()` (`@/lib/supabase/admin`) instead of proxying to the Hono backend, call
`admin.rpc('get_waitlist_founder_status')` directly (no upstream fetch — this stays inside `apps/web`, no
`backend/api` involvement), and add `export const revalidate = 30;` at module scope per WAIT-08/FOND-03.
Exact target shape already drafted in `05-RESEARCH.md` Pattern 3 — copy that snippet directly:
```typescript
import { createAdminClient } from '@/lib/supabase/admin';
export const revalidate = 30;
export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_waitlist_founder_status');
  if (error || !data?.[0]) {
    return Response.json({ shouldDisplay: false, remaining: null, isFull: false }, { status: 200 });
  }
  const row = data[0] as { should_display: boolean; remaining: number; is_full: boolean };
  return Response.json({ shouldDisplay: row.should_display, remaining: row.remaining, isFull: row.is_full });
}
```

---

### `apps/web/src/actions/waitlist.ts` (EXTEND — service, CRUD)

**Analog:** itself (56 lines, read in full) — this is an extension, not a new file. Preserve the exact
exported signature `(prevState, formData) => Promise<WaitlistState>` untouched.

**Current shape to extend** (full file, lines 1-56, reproduced above in RESEARCH.md) — insert new
server-side checks (honeypot, `checkBotId()`, `waitlistRatelimit.limit()`, `z.email()`, `mailchecker`)
**before** the existing `admin.rpc('claim_waitlist_signup', ...)` call at lines 26-31, and the
consent-recording `UPDATE` **after** the existing D-03/D-04 filter block (lines 43-55), never touching
that filter's logic. Do not add `import { headers } from 'next/headers'` unconditionally at module scope
— the file's own header comment (lines 1-4) is a load-bearing constraint protecting
`test/actions/waitlist.concurrency.test.ts`'s plain-Vitest importability (Pitfall 3). If IP extraction is
needed for rate limiting, wrap the `next/headers` import so the concurrency test's `vi.mock('server-only',
...)` shim still resolves — verify by re-running that test file after the edit.

---

### `apps/web/src/lib/ratelimit.ts` (EXTEND — utility, request-response)

**Analog:** itself — the existing `rolePromotionRatelimit`/`kycUploadRatelimit` exports (lines 47-61) are
the exact template for the new `waitlistRatelimit` export.

**Pattern to copy verbatim, renamed:**
```typescript
let _waitlistRatelimit: Ratelimit | null = null;

export const waitlistRatelimit = {
  limit: async (identifier: string) => {
    if (!isUpstashConfigured()) return noopLimiter.limit(identifier);
    if (!_waitlistRatelimit) _waitlistRatelimit = makeRatelimit(Ratelimit.slidingWindow(5, '60 s'), 'ziko:waitlist');
    return _waitlistRatelimit.limit(identifier);
  },
};
```
Add the `let _waitlistRatelimit` declaration alongside the other two singletons (line 33 area) and the
export alongside `kycUploadRatelimit` (after line 61) — do not create a second ratelimit file.

---

### `apps/web/src/components/marketing/FoundersOfferSection.tsx` + `FoundersOfferSectionClient.tsx` (component, request-response)

**Analog:** `apps/web/src/components/marketing/CoachsCtaFooterClient.tsx` (44 lines, read in full) — a
centered heading/subheading/CTA-button section with `useInView` scroll-triggered fade, the closest
existing shape to a homepage teaser section that routes to another page.

**Full pattern to copy** (lines 1-44):
```tsx
'use client'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { ctaHover, ctaTap } from '@/lib/motion'

export function CoachsCtaFooterClient({ locale, heading, subheading, button, note }: Props) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  return (
    <section className="py-24 bg-background">
      <div ref={ref} className="max-w-screen-xl mx-auto px-8 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}>
          <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">{heading}</h2>
          <p className="text-base text-muted mb-8">{subheading}</p>
          <motion.div whileHover={ctaHover} whileTap={ctaTap} className="inline-block">
            <Link href={`/${locale}/coach/onboarding`} className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-xs inline-block" style={{ boxShadow: '0 4px 20px rgba(255,92,26,0.30)' }}>
              {button}
            </Link>
          </motion.div>
          <p className="text-xs text-muted mt-3">{note}</p>
        </motion.div>
      </div>
    </section>
  )
}
```
**For `FoundersOfferSectionClient.tsx`:** swap `href` to `/${locale}/fondateurs`, button copy to
"Devenir fondateur →" / "Become a founder →" (UI-SPEC Copywriting Contract), and optionally render the
same `WaitlistCounterClient` badge above the heading as justification copy (UI-SPEC §Focal points: "the
CTA button is the primary anchor, counter/offer copy sits above it as justification"). Mount between
`<Hero />` and `<HowItWorks />` in `apps/web/src/app/[locale]/(marketing)/page.tsx` per D-05 — read that
file to confirm exact section order before inserting.

---

### `apps/web/src/components/layout/HeaderClient.tsx` (EXTEND — component/nav)

**Analog:** itself (56 lines, read in full).

**Exact class recipe to copy for the new "Fondateurs" link** (locale-link unselected state, lines 39-44):
```tsx
<Link
  href="/"
  locale="en"
  className="text-sm text-muted hover:text-text transition-colors px-2 py-2 min-h-[44px] inline-flex items-center rounded"
>
  {localeEN}
</Link>
```
Per UI-SPEC §1, insert a new `<Link href="/fondateurs">{founders}</Link>` using this exact class string,
positioned between the logo (line 26-28) and the locale-switcher `<div>` (line 30), and add
`flex-wrap justify-end gap-y-2` to the right-hand wrapper's className (currently `flex items-center
gap-4` at line 29) to handle narrow-viewport wrapping. `founders` must be threaded as a new prop from
whatever server component renders `<HeaderClient>` (find via `Grep "HeaderClient" apps/web/src/components/layout`
if not colocated) — likely a `layout.tsx` resolving `next-intl` translations, same pattern as `Hero.tsx`
resolving `t('hero.badge')` etc.

---

### `apps/web/src/components/layout/FooterClient.tsx` (EXTEND — component/nav)

**Analog:** itself (50 lines, read in full).

**`AnimatedLink` pattern to reuse verbatim** (lines 6-18, the same helper already defined in this file):
```tsx
function AnimatedLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative text-sm text-text inline-block overflow-hidden">
      {children}
      <motion.span
        className="absolute bottom-0 left-0 h-px bg-primary w-full origin-left"
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      />
    </Link>
  )
}
```
Per UI-SPEC §2, add `<AnimatedLink href="/fondateurs">{founders}</AnimatedLink>` as the **first** item in
the `<nav>` list (line 38-46), before `{legal}` — add a `founders` prop to the `Props` type (line 20-27)
and pass it from the server component invoking `<FooterClient>`.

---

### `apps/web/src/components/marketing/CoachsHeroClient.tsx` / `CoachsCtaFooterClient.tsx` (MODIFY link target, D-01)

**Exact lines to change:**
- `CoachsHeroClient.tsx:84` — `href={`/${locale}/coach/onboarding`}` → `href={`/${locale}/fondateurs?role=coach`}`
  (or equivalent preselect mechanism matching whatever `page.tsx` reads for D-08).
- `CoachsCtaFooterClient.tsx:32` — same change.

No other lines in either file need to change — `cta`/`ctaNote`/`button`/`note` copy props are passed from
the parent server component (`CoachsHero.tsx`, not read this session but same split pattern as `Hero.tsx`)
and may or may not need copy updates depending on whether "Devenir client" style CTA copy still reads
correctly pointed at the waitlist; confirm during planning against `coachs` i18n namespace.

---

### `apps/web/src/app/sitemap.ts` (EXTEND — config, batch)

**Analog:** itself (27 lines, read in full).

**Exact array entry pattern to add** (`pages` array, lines 6-11):
```typescript
const pages = [
  { path: '', changeFrequency: 'weekly' as const, priority: 1.0 },
  { path: '/mentions-legales', changeFrequency: 'monthly' as const, priority: 0.3 },
  { path: '/politique-de-confidentialite', changeFrequency: 'monthly' as const, priority: 0.3 },
  { path: '/cgu', changeFrequency: 'monthly' as const, priority: 0.3 },
  { path: '/fondateurs', changeFrequency: 'daily' as const, priority: 0.9 }, // NEW — ENTRY-05
]
```
`changeFrequency: 'daily'`/high `priority` reflects the counter changing frequently during the live
offer window (planner's judgment call, not dictated by any file read this session — reasonable given
FOND-02's live remaining-count). The rest of the file (`flatMap` over `routing.locales`, `alternates`)
needs zero changes — it already generically handles any new `pages` entry.

## Shared Patterns

### Admin (service-role) Supabase client
**Source:** `apps/web/src/lib/supabase/admin.ts` (full file, 16 lines)
**Apply to:** `actions/waitlist.ts` (already uses it), `app/api/waitlist/count/route.ts` (new)
```typescript
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}
```
Never use `createServerSupabase()` (anon key) for either waitlist RPC — both are `service_role`-only
(RESEARCH.md Pitfall 1).

### Upstash lazy-singleton rate limiter
**Source:** `apps/web/src/lib/ratelimit.ts` (full file, 61 lines)
**Apply to:** `actions/waitlist.ts` (new `waitlistRatelimit` call site)
See "Pattern Assignments" section above for the exact export to add.

### Server Action + `useActionState` form idiom
**Source:** `apps/web/src/components/account/DeleteAccountForm.tsx` (full file, 79 lines) +
`apps/web/src/actions/account.ts` (referenced by RESEARCH.md as the generic-response
anti-enumeration philosophy source — not read line-by-line this session, but its `DeleteAccountState`
shape is directly mirrored by `waitlist.ts`'s `WaitlistState`)
**Apply to:** `WaitlistRoleForm.tsx`

### Server/Client component split for marketing sections
**Source:** `apps/web/src/components/marketing/Hero.tsx` (server, resolves `next-intl`) +
`HeroClient.tsx` / `CoachsHeroClient.tsx` (client, `framer-motion` + `lib/motion.ts` variants)
**Apply to:** `WaitlistFounderBanner.tsx`/`WaitlistFounderBannerClient.tsx`,
`FoundersOfferSection.tsx`/`FoundersOfferSectionClient.tsx`

### Motion variants
**Source:** `apps/web/src/lib/motion.ts` (full file, 39 lines) — `fadeUp`, `fadeIn`, `ctaHover`, `ctaTap`,
`easeOut`
**Apply to:** every new client component in this phase — reuse these exports, do not define new
animation primitives (UI-SPEC §3 explicitly calls out reusing `fadeUp` for the role-picker email-field
reveal).

### Route Handler shape (GET, `NextResponse`/`Response.json`)
**Source:** `apps/web/src/app/api/credits/balance/route.ts` (full file, 23 lines)
**Apply to:** `app/api/waitlist/count/route.ts`

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/components/marketing/WaitlistCounterClient.tsx` | component | client-side fetch + revalidate | No existing Client Component in this codebase self-fetches from an internal Route Handler on mount with a 30s revalidate contract — build from `05-RESEARCH.md` Pattern 3's drafted snippet + the badge visual recipe borrowed from `CoachsHeroClient.tsx`'s badge span (see Pattern Assignments above) |
| Honeypot field + `botid`/`mailchecker` integration inside `actions/waitlist.ts` | inline logic, not a file | server-side validation | No existing bot-protection code exists anywhere in `apps/web` to pattern-match against; follow `05-RESEARCH.md`'s Architecture Diagram step list (honeypot → `checkBotId()` → rate limit → `z.email()` → `mailchecker`) verbatim, each a ~3-5 line guard clause before the existing RPC call |

## Metadata

**Analog search scope:** `apps/web/src/app/[locale]/(marketing)/`, `apps/web/src/app/api/`,
`apps/web/src/components/marketing/`, `apps/web/src/components/layout/`, `apps/web/src/components/account/`,
`apps/web/src/actions/`, `apps/web/src/lib/`, `apps/web/src/content/legal/`
**Files scanned:** 15 read in full (waitlist.ts, ratelimit.ts, admin.ts, coachs/page.tsx,
credits/balance/route.ts, HeaderClient.tsx, FooterClient.tsx, sitemap.ts, DeleteAccountForm.tsx,
founder-offer.ts, CoachsHeroClient.tsx, CoachsCtaFooterClient.tsx, CoachsFeatureBlocksClient.tsx,
HeroClient.tsx, Hero.tsx, motion.ts)
**Pattern extraction date:** 2026-08-17
