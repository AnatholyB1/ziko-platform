# Phase 2: RGPD Compliance — Research

**Researched:** 2026-03-26
**Domain:** Next.js 15 Server Actions, Upstash Redis rate limiting, Supabase admin user deletion, French legal page content
**Confidence:** HIGH (core patterns), MEDIUM (Supabase email lookup workaround)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Legal entity name: **Ziko**
- **D-02:** Publication director: **BRICON Anatholy**
- **D-03:** SIRET: `[À COMPLÉTER]` — placeholder, fill before launch
- **D-04:** Physical address: `[À COMPLÉTER]` — placeholder, fill before launch
- **D-05:** Hosting provider: **Vercel**
- **D-06:** All three legal pages get real production content — no "coming soon" stubs
- **D-07:** French only — no English translations for legal pages
- **D-08:** Politique de confidentialité must name **Anthropic** as a data processor and document: health data, GPS data, AI coaching interactions
- **D-09:** CGU must include AI health advice liability disclaimer (AI is coaching tool, not medical device)
- **D-10:** Account deletion route: `/supprimer-mon-compte`
- **D-11:** Footer gets "Supprimer mon compte" link on every page
- **D-12:** Form flow: email input + checkbox "Je comprends que cette action est irréversible" + user must type **SUPPRIMER** to activate submit button
- **D-13:** Success: show confirmation message. Error: show inline error (not found, or rate limit exceeded)
- **D-14:** Server action uses `supabase.auth.admin.deleteUser()` with `SUPABASE_SERVICE_ROLE_KEY` — fix existing bug in `admin.ts`
- **D-15:** Rate limiting via `@upstash/ratelimit` + `@upstash/redis`
- **D-16:** 5 requests per minute per IP — sliding window
- **D-17:** IP from `x-forwarded-for` header, fallback `127.0.0.1`
- **D-18:** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` as server-only env vars

### Claude's Discretion

- Exact prose of the three legal pages (generate full French RGPD-compliant content)
- Styling of deletion page and legal pages — use established design system pattern
- Whether deletion form uses Server Action or API Route Handler — Server Action preferred
- Error handling detail wording (email not found vs already deleted)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RGPD-01 | User can enter email to request account deletion and receive success response | Server Action + useActionState pattern documented in §Architecture Patterns |
| RGPD-02 | Account deletion processed server-side via Supabase admin API — service role key never in client bundle | admin.ts fix + `import 'server-only'` guard documented in §Standard Stack |
| RGPD-03 | Deletion action rate-limited per IP | Upstash ratelimit sliding window + `await headers()` IP extraction documented in §Code Examples |
| RGPD-04 | Mentions légales page live with all legally-required fields | Static page pattern, French legal content structure in §Architecture Patterns |
| RGPD-05 | Politique de confidentialité documents all data processing | Static page pattern, Anthropic data processor requirement documented |
| RGPD-06 | CGU documents terms of use and AI liability disclaimer | Static page pattern |
</phase_requirements>

---

## Summary

Phase 2 has four distinct implementation concerns: (1) replacing legal stub pages with real static content, (2) adding a deletion page shell, (3) wiring a Server Action that validates, rate-limits, and calls the Supabase admin API, and (4) fixing the admin client's wrong env variable.

The Server Action pattern in Next.js 15 is well-established: define the action in a `"use server"` file, accept `(prevState, formData)` signature when using `useActionState`, and return a typed state object. The page itself remains statically generated — the Server Action is only invoked on POST, so build output shows `○ (static)` for the page shell.

Upstash rate limiting integrates cleanly via `Redis.fromEnv()` and `Ratelimit.slidingWindow(5, "60 s")`. The only non-obvious requirement is that in a Server Action there is no `Request` object — IP must be extracted from `await headers()` from `next/headers`.

The Supabase admin email lookup is the trickiest part: `auth.admin.getUserByEmail()` does NOT exist in `@supabase/auth-js` v2.100.1 (confirmed from source code). The TypeScript type `PageParams` only has `page` and `perPage`. The reliable pattern is: call `auth.admin.listUsers({ page: 1, perPage: 50 })` and find the user client-side, or use `fetch()` directly against the Supabase Auth REST endpoint with a `filter` query parameter. The direct fetch approach is verified to work and does not require exposing a new schema.

**Primary recommendation:** Use `fetch()` against `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}` with the service role key in the `apikey` and `Authorization` headers to find a user by email. This uses the underlying Supabase Auth REST API that `listUsers` calls, but with the undocumented `filter` query param that works server-side.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@upstash/ratelimit` | **2.0.8** (latest) | Rate limiting via sliding/fixed window algorithms | Official Upstash library, serverless-native, no persistent connections |
| `@upstash/redis` | **1.37.0** (latest) | HTTP Redis client (REST-based, works in Vercel serverless) | Required peer dependency of ratelimit; no TCP/socket needed |
| `next/headers` | (bundled with Next.js 15.5.14) | Access request headers inside Server Actions | Only way to read `x-forwarded-for` without a `Request` object |
| `@supabase/supabase-js` | **2.100.1** (already installed) | Admin user deletion | Already in `package.json`; provides `auth.admin.deleteUser()` |

### Version verification

Verified 2026-03-26 against npm registry:
```
@upstash/ratelimit  latest: 2.0.8  (published 2026)
@upstash/redis      latest: 1.37.0 (published 2026)
```

Peer dependency: `@upstash/ratelimit@2.0.8` requires `@upstash/redis ^1.34.3` — satisfied by 1.37.0.

### Installation

```bash
cd /c/ziko-web
npm install @upstash/ratelimit@2.0.8 @upstash/redis@1.37.0
```

### Environment Variables (add to Vercel + local `.env`)

```bash
# Server-only — NO NEXT_PUBLIC_ prefix
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...
SUPABASE_SERVICE_ROLE_KEY=eyJh...   # Already exists in Vercel; fix admin.ts to use this name
SUPABASE_URL=https://...supabase.co # Already set
```

`Redis.fromEnv()` reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — these exact names are required.

---

## Architecture Patterns

### New Files This Phase

```
src/
├── app/
│   └── [locale]/
│       └── supprimer-mon-compte/
│           └── page.tsx          ← Static shell, renders <DeleteAccountForm>
├── components/
│   └── account/
│       └── DeleteAccountForm.tsx ← "use client", useActionState
├── actions/
│   └── account.ts                ← "use server", rate limit + Supabase admin deletion
└── lib/
    └── ratelimit.ts              ← Ratelimit singleton (initialized once, reused)
```

### Modified Files This Phase

```
src/lib/supabase/admin.ts         ← Fix SUPABASE_PUBLISHABLE_KEY → SUPABASE_SERVICE_ROLE_KEY
src/components/layout/Footer.tsx  ← Add "Supprimer mon compte" link
messages/fr.json                  ← Add DeleteAccount.* keys + legal page keys
src/app/[locale]/mentions-legales/page.tsx       ← Replace stub with real content
src/app/[locale]/politique-de-confidentialite/page.tsx ← Replace stub with real content
src/app/[locale]/cgu/page.tsx     ← Replace stub with real content
```

### Pattern 1: Rate Limiter Singleton

Initialize once at module level — do not recreate on every request.

```typescript
// src/lib/ratelimit.ts
// Source: https://upstash.com/docs/oss/sdks/ts/ratelimit/gettingstarted
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  prefix: 'ziko:ratelimit',
});
```

Do NOT put `analytics: true` unless you have an Upstash account that supports it — it silently fails and adds latency on free tier.

### Pattern 2: Server Action with Rate Limiting and Supabase Admin Deletion

```typescript
// src/actions/account.ts
// Source: https://nextjs.org/docs/app/guides/forms (official Next.js docs, fetched 2026-03-25)
'use server';

import { headers } from 'next/headers';
import { ratelimit } from '@/lib/ratelimit';
import { createAdminClient } from '@/lib/supabase/admin';

export type DeleteAccountState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export async function deleteAccount(
  prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  // 1. Extract IP for rate limiting
  const headerList = await headers();
  const ip = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();

  // 2. Rate limit check
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return { status: 'error', message: 'Trop de tentatives. Réessayez dans une minute.' };
  }

  // 3. Validate form input
  const email = formData.get('email')?.toString().trim().toLowerCase();
  const confirmation = formData.get('confirmation')?.toString();
  if (!email || confirmation !== 'SUPPRIMER') {
    return { status: 'error', message: 'Formulaire invalide.' };
  }

  // 4. Find user by email (see §User Lookup Pattern below)
  const admin = createAdminClient();
  const userId = await findUserIdByEmail(admin, email);

  if (!userId) {
    // Return success to prevent email enumeration (RGPD anti-enumeration)
    return { status: 'success', message: 'Si ce compte existe, il a été supprimé.' };
  }

  // 5. Delete user
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return { status: 'error', message: 'Erreur lors de la suppression. Contactez le support.' };
  }

  return { status: 'success', message: 'Votre compte a été supprimé définitivement.' };
}
```

### Pattern 3: Client Component Form with useActionState

```typescript
// src/components/account/DeleteAccountForm.tsx
// Source: https://nextjs.org/docs/app/guides/forms
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
    return <p className="text-green-700">{state.message}</p>;
  }

  return (
    <form action={formAction} className="space-y-4 max-w-md">
      <input type="email" name="email" required placeholder="votre@email.com" />
      <label>
        <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />
        Je comprends que cette action est irréversible
      </label>
      {/* Hidden field — real confirmation value passed via formData */}
      <input type="hidden" name="confirmation" value={typed} />
      <div>
        <label>Tapez SUPPRIMER pour confirmer</label>
        <input
          type="text"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="SUPPRIMER"
        />
      </div>
      {state.status === 'error' && <p className="text-red-600">{state.message}</p>}
      <button type="submit" disabled={!canSubmit}>
        {pending ? 'Suppression...' : 'Supprimer mon compte'}
      </button>
    </form>
  );
}
```

### Pattern 4: User Lookup by Email

`auth.admin.getUserByEmail()` does not exist in `@supabase/auth-js` v2.100.1 (confirmed from source: `GoTrueAdminApi.d.ts`). The underlying Supabase Auth REST API supports a `filter` query parameter on `GET /auth/v1/admin/users`. Use `fetch()` directly:

```typescript
// Inside actions/account.ts
async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<string | null> {
  // The auth REST API supports ?filter= for email lookup
  // This is the internal API that listUsers() calls but without JS SDK filter support
  const url = `${process.env.SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`;
  const response = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  });
  if (!response.ok) return null;
  const data = await response.json();
  // Response shape: { users: User[], aud: string }
  const users: Array<{ id: string; email: string }> = data.users ?? [];
  const match = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}
```

**Alternative (simpler, safe for small user bases):** Use `listUsers()` with a large page size and filter in JavaScript. Acceptable when user count is < 10,000 (small SaaS). Not recommended for scale.

```typescript
// Simpler alternative — works but fetches 50 users per call
const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error || !data) return null;
return data.users.find(u => u.email === email)?.id ?? null;
```

### Pattern 5: Static Deletion Page Shell

The page itself is statically rendered. The Server Action only executes on form POST.

```typescript
// src/app/[locale]/supprimer-mon-compte/page.tsx
import { setRequestLocale } from 'next-intl/server';
import { DeleteAccountForm } from '@/components/account/DeleteAccountForm';

type Props = { params: Promise<{ locale: string }> };

export default async function SupprimerMonComptePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="max-w-screen-xl mx-auto px-8 py-16">
      <h1 className="text-2xl font-semibold mb-4">Supprimer mon compte</h1>
      <DeleteAccountForm />
    </main>
  );
}
```

This page shows as `○ (static)` in `next build` output. The Server Action is a separate POST endpoint, not part of the static HTML.

### Pattern 6: Admin Client Fix

```typescript
// src/lib/supabase/admin.ts — CORRECTED
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,   // ← was SUPABASE_PUBLISHABLE_KEY (wrong)
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

**Why this matters:** `auth.admin.deleteUser()` returns a 403 error when called with the publishable key because only the service_role key grants admin API access.

### Pattern 7: Legal Pages — Hardcoded JSX (No Translation Keys)

Per D-07 (French only), and since legal pages are static prose with no i18n requirement:

```typescript
// src/app/[locale]/mentions-legales/page.tsx
import { setRequestLocale } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export default async function MentionsLegalesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="max-w-screen-xl mx-auto px-8 py-16 space-y-8">
      <h1 className="text-3xl font-semibold">Mentions légales</h1>
      {/* Real content — hardcoded FR prose */}
    </main>
  );
}
```

Do NOT use `getTranslations('LegalContent')` for legal pages. The existing `LegalStub.comingSoon` key can be removed from `fr.json` once replaced. Only the `DeleteAccount.*` keys need to be added to `fr.json` for the deletion form client messages.

### Anti-Patterns to Avoid

- **Recreating `Ratelimit` on every request:** Creates a new Redis connection each call. Put the singleton in `lib/ratelimit.ts`, import it.
- **Using `headers()` synchronously:** In Next.js 15, `headers()` returns a Promise. Always `await headers()`.
- **`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`:** The `NEXT_PUBLIC_` prefix embeds the value in the client bundle. Never prefix the service role key.
- **Calling `createAdminClient()` from a Client Component:** The `import 'server-only'` guard prevents this at build time, which is correct. The guard must stay.
- **Returning different errors for "not found" vs "deleted":** Email enumeration vulnerability. Always return the same success-looking message regardless.
- **Putting the Server Action directly inside a Server Component function body:** For actions called from Client Components, the action MUST be in a separate `"use server"` module file (not an inline `'use server'` inside a Server Component function).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom Redis counter + TTL logic | `@upstash/ratelimit` | Handles race conditions, sliding window math, atomic increments |
| IP extraction | Custom header parsing | `(await headers()).get('x-forwarded-for')` pattern | Vercel sets this correctly; the split+trim handles proxy chains |
| Form pending state | `useState(loading)` + manual fetch | `useActionState` third return value `pending` | Built into React 19, auto-handles concurrent submissions |
| Admin user lookup | Manual pagination loop over `listUsers` | Direct fetch to auth REST API with `?filter=` | O(1) vs O(n) — no user count dependency |

**Key insight:** `@upstash/ratelimit` uses atomic Lua scripts in Redis — a hand-rolled counter would have a TOCTOU race condition under concurrent requests.

---

## Common Pitfalls

### Pitfall 1: `headers()` Must Be Awaited in Next.js 15

**What goes wrong:** `const ip = headers().get('x-forwarded-for')` throws a runtime error or returns a stale value in Next.js 15.

**Why it happens:** Next.js 15 made all dynamic APIs (`headers`, `cookies`, `params`, `searchParams`) async. This was a breaking change from Next.js 14.

**How to avoid:** Always `const headerList = await headers();` before reading any values.

**Warning signs:** TypeScript error "Property 'get' does not exist on type 'Promise<ReadonlyHeaders>'" if you forget the await.

### Pitfall 2: `SUPABASE_PUBLISHABLE_KEY` vs `SUPABASE_SERVICE_ROLE_KEY`

**What goes wrong:** `admin.auth.admin.deleteUser()` returns a 403 Forbidden error at runtime even though the client initializes without error.

**Why it happens:** The publishable key (also called anon key) does not grant admin API access. The current `admin.ts` in ziko-web incorrectly uses `SUPABASE_PUBLISHABLE_KEY`. This bug is already documented in D-14 of CONTEXT.md.

**How to avoid:** Fix the env var name in `admin.ts` on the first task of this phase, before any other work. Verify by checking that `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel environment variables.

**Warning signs:** The `createClient()` call succeeds but all `admin.*` calls return 403.

### Pitfall 3: Server Action File Placement

**What goes wrong:** "Server Action" in a Client Component fails with "Error: Server Actions cannot be used in Client Components unless exported from a 'use server' module."

**Why it happens:** Next.js requires that Server Actions called from Client Components are exported from a module-level `'use server'` file. An inline `'use server'` directive inside a Server Component function body does not work for this case.

**How to avoid:** Put the action in `src/actions/account.ts` with `'use server'` at the top of the file. Import and pass the action to `useActionState` in the Client Component.

### Pitfall 4: IP Extraction on Local Dev

**What goes wrong:** Rate limiter uses `127.0.0.1` for all requests in local dev — all requests count against the same IP, so the 5th test submission is rate-limited.

**Why it happens:** `x-forwarded-for` is not set by the local Next.js dev server. The fallback `127.0.0.1` is correct but means all local requests share a bucket.

**How to avoid:** Accept this behavior in dev. Alternatively, skip rate limiting when `process.env.NODE_ENV === 'development'`. Do not hardcode this skip in production code — use a clearly named env var like `SKIP_RATE_LIMIT=true` for local use only.

### Pitfall 5: `useFormState` vs `useActionState`

**What goes wrong:** Importing `useFormState` from `react-dom` in a Next.js 15 / React 19 project triggers a deprecation warning.

**Why it happens:** `useFormState` was renamed to `useActionState` and moved to `react` (not `react-dom`) in React 19. Next.js 15 ships React 19.

**How to avoid:** Import `useActionState` from `'react'` — not from `'react-dom'`. The `ziko-web/package.json` already has `react: 19.1.0`.

### Pitfall 6: Email Enumeration via Error Messages

**What goes wrong:** Server action returns `"Aucun compte trouvé avec cet email"` for unknown emails, and a different success message for known emails. An attacker can probe any email address to learn if an account exists.

**Why it happens:** Natural developer instinct to give helpful error messages.

**How to avoid:** Return identical success-looking message regardless of whether the email exists: `"Si ce compte existe, il a été supprimé."` This is documented in the architecture research as Anti-Pattern 4 and is required for RGPD compliance.

---

## Static vs Dynamic — Deletion Page Answer

**The deletion page (`/supprimer-mon-compte`) is STATIC in the build output.**

The page component (`page.tsx`) renders a static HTML shell with `<DeleteAccountForm />`. No dynamic data is fetched at request time by the page. `setRequestLocale(locale)` + `generateStaticParams` in the parent layout already handles this.

The Server Action (`actions/account.ts`) is a separate POST endpoint generated by Next.js and is inherently dynamic — but it is NOT part of the page's static HTML. Next.js generates a POST handler for the action separately from the static page.

**Expected build output:**
```
Route (app)                             Size
○ /                                     static
○ /mentions-legales                     static
○ /politique-de-confidentialite         static
○ /cgu                                  static
○ /supprimer-mon-compte                 static  ← correct
```

The `○` symbol confirms static generation. The page does NOT become `ƒ (dynamic)` just because it includes a Server Action.

**Confirmation:** Official Next.js docs (fetched 2026-03-25) show `Signup` page example with `useActionState` — the page is a standard static render; only the action POST endpoint is server-side.

---

## Legal Page Translation Approach

**Decision: Hardcode French prose directly in JSX. Do not use translation keys.**

Rationale:
1. D-07 locks these pages to French only — no `en.json` equivalent will ever be written.
2. Legal text is long-form prose unsuitable for translation key fragmentation.
3. Legal text changes rarely and only by legal revision — no runtime key lookup needed.
4. `fr.json` keys add indirection with zero benefit for single-locale static content.

**What stays in `fr.json`:**
- `Footer.deleteAccount` — the link label "Supprimer mon compte" (Footer is reused across all locales including future English pages)
- `DeleteAccount.*` keys — form labels and messages shown in the Client Component (which needs `NextIntlClientProvider` context for potential future EN translation)

**What goes directly in JSX:**
- All three legal pages — pure hardcoded French prose

**The `LegalStub.comingSoon` key** in `fr.json` can be removed once all stubs are replaced.

---

## Code Examples

### Full Rate Limiter Initialization

```typescript
// src/lib/ratelimit.ts
// Source: https://upstash.com/docs/oss/sdks/ts/ratelimit/gettingstarted
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Singleton — module is cached by Node.js module system
// Redis.fromEnv() reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  prefix: 'ziko:delete',
});
```

### Rate Limit Check in Server Action

```typescript
// Source: https://nextjsweekly.com/blog/rate-limiting-server-actions
import { headers } from 'next/headers';
import { ratelimit } from '@/lib/ratelimit';

// Inside the server action:
const headerList = await headers();
const rawIp = headerList.get('x-forwarded-for') ?? '127.0.0.1';
const ip = rawIp.split(',')[0].trim();

const { success, limit, remaining, reset } = await ratelimit.limit(ip);
if (!success) {
  return { status: 'error', message: 'Trop de tentatives. Réessayez dans une minute.' };
}
```

### useActionState Wiring (Official Pattern)

```typescript
// Source: https://nextjs.org/docs/app/guides/forms (fetched 2026-03-25, version 16.2.1)
'use client';

import { useActionState } from 'react';  // NOT from 'react-dom'
import { deleteAccount, DeleteAccountState } from '@/actions/account';

const initialState: DeleteAccountState = { status: 'idle', message: '' };

const [state, formAction, pending] = useActionState(deleteAccount, initialState);
// state    → last return value from the action
// formAction → pass this as the form's action prop
// pending  → true while the action is executing
```

### Footer Extension

```typescript
// src/components/layout/Footer.tsx — add deletion link
// The existing Footer uses Link from '@/i18n/navigation' and getTranslations('Footer')
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

// Inside the nav element, add:
<Link href="/supprimer-mon-compte" className="text-sm text-muted hover:underline">
  {t('deleteAccount')}
</Link>
```

Add to `fr.json`: `"Footer": { ..., "deleteAccount": "Supprimer mon compte" }`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useFormState` from `react-dom` | `useActionState` from `react` | React 19 (Next.js 15) | Import source changed; old name deprecated but still works with warning |
| `headers()` synchronous | `await headers()` | Next.js 15 | Breaking change — must await or TypeScript errors |
| Inline Server Action in Server Component | Separate `"use server"` file for Client Component actions | Next.js App Router stable | Architecture requirement, not optional |
| `SUPABASE_SERVICE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase naming convention | The current `admin.ts` uses the wrong name `SUPABASE_PUBLISHABLE_KEY` — must fix |

---

## Open Questions

1. **Supabase `?filter=` REST endpoint reliability**
   - What we know: GitHub issue #880 confirms the auth REST API accepts `?filter=email@example.com`; this is NOT exposed in the `supabase-js` TypeScript SDK as of v2.100.1
   - What's unclear: Whether Supabase's hosted auth server version (which may differ from the open-source version) supports the same filter parameter
   - Recommendation: Test with a known email against the project's Supabase instance before finalizing the implementation. If `?filter=` fails, fall back to the `listUsers({ page: 1, perPage: 1000 })` approach with a JS `.find()`.

2. **Upstash free tier limits for analytics**
   - What we know: `analytics: true` in the ratelimit config enables Upstash analytics dashboard tracking
   - What's unclear: Whether the free tier supports analytics without billing
   - Recommendation: Omit `analytics: true` in the initial implementation to keep config minimal. Add only if explicitly needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js build + dev | ✓ | (in ziko-web via npm scripts) | — |
| `@upstash/ratelimit` | RGPD-03 rate limiting | ✗ (not installed) | needs 2.0.8 | — (blocking) |
| `@upstash/redis` | `@upstash/ratelimit` peer | ✗ (not installed) | needs 1.37.0 | — (blocking) |
| `@supabase/supabase-js` | RGPD-01/02 admin deletion | ✓ | 2.100.1 | — |
| `SUPABASE_SERVICE_ROLE_KEY` env var | Admin deletion | Unknown (Vercel: set per FOUND-06, local: check `.env`) | — | Blocks deletion; must be set |
| `UPSTASH_REDIS_REST_URL` env var | Rate limiting | ✗ (not set) | — | Blocks rate limiting; must be provisioned |
| `UPSTASH_REDIS_REST_TOKEN` env var | Rate limiting | ✗ (not set) | — | Blocks rate limiting; must be provisioned |

**Missing dependencies with no fallback (blocking):**
- `@upstash/ratelimit@2.0.8` — install in Wave 0
- `@upstash/redis@1.37.0` — install in Wave 0
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — provision an Upstash Redis database and add to Vercel env vars + local `.env` before the rate limiter task

**Note on SUPABASE_SERVICE_ROLE_KEY:** Per FOUND-06 in REQUIREMENTS.md, this is marked complete and was set in Vercel during Phase 1. Must also exist in local `.env` for development.

---

## Validation Architecture

> workflow.nyquist_validation not found in config — treating as enabled.

No `jest.config.*`, `vitest.config.*`, or test directories found in `/c/ziko-web/`. No test framework is configured.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RGPD-01 | Email form submits and returns success state | manual-only | — | ❌ (no test infra) |
| RGPD-02 | Service role key never in client bundle | build verify | `rtk next build` + inspect bundle | build only |
| RGPD-03 | 6th request within 60s returns rate-limit error | manual-only | — | ❌ (no test infra) |
| RGPD-04 | Mentions légales page renders with required fields | visual | `npm run dev` + navigate | — |
| RGPD-05 | Politique de confidentialité names Anthropic | visual | `npm run dev` + navigate | — |
| RGPD-06 | CGU includes AI liability disclaimer | visual | `npm run dev` + navigate | — |

### Sampling Rate
- **Per task:** `rtk next build` — verifies no TypeScript errors and static output
- **Per wave:** Manual smoke test of deletion form in browser
- **Phase gate:** All routes show `○ (static)` in build output; deletion form accepts email + shows success message in dev

### Wave 0 Gaps

No test framework is present in ziko-web. Given the marketing-site scope and the nature of this phase (static content + one server action), the verification strategy is:

1. TypeScript strict compilation (`rtk npx tsc --noEmit`) — catches type errors in Server Action signature
2. `rtk next build` — verifies static output and no bundle leakage
3. Manual browser testing of the deletion flow

A full test framework (Vitest + Playwright) is not in scope for Phase 2 and would be a significant setup cost for minimal gain on a 5-page static marketing site.

---

## Sources

### Primary (HIGH confidence)
- Next.js official docs `https://nextjs.org/docs/app/guides/forms` — fetched 2026-03-25 (version 16.2.1) — `useActionState` signature, Server Action file placement, form patterns
- `@supabase/auth-js` source code — `/c/ziko-web/node_modules/@supabase/auth-js/dist/main/GoTrueAdminApi.d.ts` — confirmed admin API methods: `listUsers(params?: PageParams)`, `deleteUser(id, shouldSoftDelete?)`, no `getUserByEmail`
- `npm view @upstash/ratelimit version` — confirmed 2.0.8 latest (2026-03-26)
- `npm view @upstash/redis version` — confirmed 1.37.0 latest (2026-03-26)
- `npm view @upstash/ratelimit@2.0.8 peerDependencies` — confirmed `@upstash/redis ^1.34.3`
- Upstash official docs `https://upstash.com/docs/oss/sdks/ts/ratelimit/gettingstarted` — `Redis.fromEnv()`, `Ratelimit.slidingWindow()`, response fields

### Secondary (MEDIUM confidence)
- `https://nextjsweekly.com/blog/rate-limiting-server-actions` — IP extraction from `await headers()` in Server Actions, verified against Next.js 15 async headers pattern
- `https://github.com/upstash/ratelimit-js` — `{ success, limit, remaining, reset }` response shape
- `https://github.com/supabase/auth/issues/880` — `?filter=` query param on auth REST API, merged July 2024

### Tertiary (LOW confidence — flag for validation)
- Multiple community sources suggest `auth.admin.getUserByEmail()` exists — **REFUTED** by source code inspection. Do not use this method name.
- `?filter=` REST param behavior on Supabase hosted instances — confirmed in auth open-source repo but untested against this project's instance

---

## Metadata

**Confidence breakdown:**
- Standard stack (Upstash versions): HIGH — verified against npm registry 2026-03-26
- Server Action patterns: HIGH — verified against official Next.js docs fetched 2026-03-25
- Supabase admin deletion: HIGH for `deleteUser(id)`; MEDIUM for email lookup approach
- `getUserByEmail` absence: HIGH — confirmed from installed source code
- Rate limit IP extraction: HIGH — confirmed `await headers()` from Next.js 15 docs + community
- Static vs dynamic page: HIGH — confirmed from Next.js architecture documentation

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (30 days — Upstash and Next.js APIs are stable)
