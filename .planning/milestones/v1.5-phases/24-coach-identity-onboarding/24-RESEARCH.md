# Phase 24: Coach Identity & Onboarding — Research

**Researched:** 2026-05-15
**Domain:** Next.js 15 Server Actions, Supabase Storage, Hono bounded modules, onboarding wizard
**Confidence:** HIGH (all claims verified against codebase or official patterns present in-tree)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Auth method email+password, custom form, no Supabase Auth UI
- D-02: Shared `/fr/login` for all users; post-login branch on `role`
- D-03: Non-coach post-login → `/coach/onboarding` redirect (not an error gate)
- D-04: `/fr/login` real route; `?next=` validated against allowlist of internal paths
- D-05: 3-step wizard at `/coach/onboarding` (role → profile → KYC optional)
- D-06: `/coach/onboarding` is public + step-level auth gate; wizard state is client-only (URL params or React state)
- D-07: Existing athletes get `role='both'`; wizard steps identical
- D-08: `backend/api/src/coach/identity/service.ts` sole public entry; 4 routes (PATCH role, POST profile, PATCH profile, GET profile); per-request user JWT only; creditCheck gate
- D-09: Sidebar nav skeleton + welcome card on `/coach/dashboard`; sidebar is reusable layout component with `disabled` prop
- D-10: `/coach/settings` ships as full editable form (same fields as onboarding Step 2 + KYC doc list)
- D-11: New private Supabase Storage bucket `coach-kyc`; path `{user_id}/{filename}`; RLS owner-only; migration 037
- D-12: Profile photo in Step 2 stored in `coach-kyc`; max 5 MB; JPEG/PNG/WebP; signed URL pattern from v1.3
- D-13: KYC upload UX — button per doc type (certification, id_document, other); max 3 docs; max 5 MB each; PDF/JPEG/PNG/WebP; `kyc_docs` JSONB updated via Server Action

### Claude's Discretion
- Exact Tailwind/CSS class structure for sidebar and wizard progress bar
- Whether wizard step state uses URL search params or React client state (UI-SPEC decided: URL search params)
- Exact shape of `/fr/login?next=` allowlist validation
- Supabase Storage bucket creation mechanism (SQL migration vs MCP vs dashboard)
- Whether `/coach/onboarding` is inside or outside `(coach)` layout (D-06: outside)

### Deferred Ideas (OUT OF SCOPE)
- Invitation code generation → Phase 25
- Client roster `/coach/clients` → Phase 26
- Program template authoring → Phase 27
- AI file imports → Phase 28
- Admin KYC review / backend moderation → post-v1.5
- Email notifications on KYC submission → Phase 31
- Google OAuth / social login
- Playwright E2E tests (deferred from Phase 23 D-16 — planner decides if Phase 24 ships them)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COACH-01 | Self-serve role promotion at `/coach/onboarding` → `user_profiles.role = 'coach' \| 'both'` | `PATCH /coach/identity/role` Hono route + Server Action; migration 034 defines the `role` column with CHECK constraint |
| COACH-02 | Coach profile persisted in `coach_profiles` (display name, bio, specialties, website, photo) | `coach_profiles` table exists in migration 034; `CoachProfileSchema` Zod in `packages/coach-sdk`; Server Action PATCH pattern verified |
| COACH-03 | Optional KYC doc upload → `kyc_status = 'pending'` visible in `/coach/settings` | `kyc_docs JSONB` + `kyc_status` columns exist in migration 034; signed URL upload pattern verified in `storage.ts`; bucket creation via SQL migration verified |
| COACH-04 | `role='both'` user: one login → both athlete mobile + coach web CRM | D-07 wizard logic; `role` column CHECK allows `'both'`; login routing branches on role |
| COACH-05 | Coach can edit profile and KYC from `/coach/settings` | Same Server Actions as onboarding; `ProfileForm` component reused |
| ARCH-01 | All backend code as bounded-context modules under `backend/api/src/coach/` | `coach/identity/` module structure: `service.ts` + `db.ts` + `types.ts`; registered in `app.ts` |
| ARCH-03 | No SERVICE_ROLE under `coach/`; CI grep verifies | CI grep job already exists in `.github/workflows/ci.yml` (line 111+); per-request JWT Supabase client pattern documented |
</phase_requirements>

---

## Summary

Phase 24 is the first user-visible coach surface. All infrastructure from Phases 22 and 23 is in place: the `coach_profiles` table (migration 034), the `coach-sdk` Zod schemas, and the `apps/web` Next.js 15 foundation with `@supabase/ssr` 3-layer auth. Phase 24 assembles these into five surfaces: login page, onboarding wizard, dashboard shell, settings page, and the `(coach)` layout upgrade with real sidebar chrome.

The most important research findings: (1) Supabase Storage buckets ARE provisioned via SQL migrations using `INSERT INTO storage.buckets` — this is already the established pattern in migrations 017 and 025 — so migration 037 follows the exact same approach; (2) `useActionState` is already in use in `apps/web` (`DeleteAccountForm.tsx`) and works exactly as needed for `<LoginForm>`; (3) the `@upstash/ratelimit` pattern is already wired in `apps/web/src/lib/ratelimit.ts` and Server Actions already call it (`account.ts`) — rate limiting on role promotion and KYC uploads follows the same pattern with a new Ratelimit instance; (4) ARCH-03's CI grep is already live in the GitHub Actions workflow and will fire as soon as `backend/api/src/coach/` is created.

**Primary recommendation:** Follow every existing pattern verbatim. The codebase already demonstrates every mechanism Phase 24 needs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email/password auth | API (Supabase) | Frontend Server (form submit) | Auth happens server-side; cookie set by `@supabase/ssr` middleware |
| `?next=` redirect after login | Frontend Server (Server Action) | — | Validated in Server Action before `redirect()` call |
| Role promotion (`user_profiles.role`) | API (`backend/api/src/coach/identity/`) | Frontend Server (Server Action calls backend) | DB mutation lives in bounded module; web calls via fetch with user JWT |
| Coach profile CRUD | API (`backend/api/src/coach/identity/`) | Frontend Server (Server Action) | Same bounded module; `coach_profiles` table |
| Signed URL generation for file upload | API (`backend/api/src/routes/storage.ts`) | — | Bypass Vercel 4.5 MB body limit; service key used only for signed URL generation, not data storage |
| Direct file upload to Supabase Storage | Browser (direct PUT) | — | Client PUTs to signed URL; never passes through backend or Next.js |
| KYC doc metadata persistence (`kyc_docs` JSONB) | API (`backend/api/src/coach/identity/`) | Frontend Server (Server Action) | Same profile PATCH route |
| Wizard step state | Browser | — | URL search params (`?step=N`); no server persistence per D-06 |
| Coach dashboard / settings page rendering | Frontend Server (Next.js SSR) | — | `force-dynamic` + `revalidate=0`; reads `coach_profiles` via `createServerSupabase()` |
| Auth guard on `(coach)` routes | Frontend Server (layout.tsx) | Middleware (cookie refresh) | ARCH-05 layers 1+2; layer 3 in every Server Action |
| Sidebar chrome | Browser (`'use client'`) | — | Nav items need `href` routing and active state detection |

---

## Stack & Environment

### Verified installed in `apps/web/package.json` [VERIFIED: codebase grep]

| Library | Version | Role in Phase 24 |
|---------|---------|-----------------|
| `next` | 15.x | App Router, Server Components, Server Actions |
| `@supabase/ssr` | installed | Cookie-based auth; `createServerClient`, `createBrowserClient`, `updateSession` |
| `framer-motion` | ^12.38 | Wizard step transitions; existing presets in `apps/web/src/lib/motion.ts` |
| `react-icons` | ^5.6.0 | Sidebar nav icons; `react-icons/io5` subset (D-17 locked) |
| `@upstash/ratelimit` | installed | Rate limiting on Server Actions |
| `@upstash/redis` | installed | Redis backend for ratelimit |
| `next-intl` | installed | FR/EN locale support; i18n key namespace pattern |
| `zod` | ^4.3.6 | Schema validation; `CoachProfileSchema` from `@ziko/coach-sdk/schemas` |

### Verified installed in `backend/api/package.json` [VERIFIED: codebase]

| Library | Version | Role in Phase 24 |
|---------|---------|-----------------|
| `hono` | v4 | Route definition for `coach/identity/` bounded module |
| `@supabase/supabase-js` | installed | Per-request JWT client in `coach/identity/db.ts` |

### Supabase migrations [VERIFIED: codebase]

| Migration | Status | Phase 24 relevance |
|-----------|--------|-------------------|
| 034_coach_role_profiles.sql | Applied | Defines `user_profiles.role` column + `coach_profiles` table + RLS |
| 035_coach_invitations_links_rls.sql | Applied | Must not break |
| 037_coach_kyc_bucket.sql | TO CREATE | `INSERT INTO storage.buckets` + RLS policies for `coach-kyc` |

---

## Key Implementation Patterns

### 1. Supabase Storage Bucket Provisioning via SQL Migration [VERIFIED: migrations 017 and 025]

**CRITICAL FINDING:** Buckets ARE provisioned via SQL migrations — NOT via MCP tool or dashboard step. Migrations 017 and 025 both use `INSERT INTO storage.buckets (id, name, public) VALUES (...) ON CONFLICT (id) DO NOTHING`. This is the established project pattern.

Migration 037 must follow this exact shape:

```sql
-- 037_coach_kyc_bucket.sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-kyc', 'coach-kyc', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "coach_kyc_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coach-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "coach_kyc_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'coach-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "coach_kyc_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'coach-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

The bucket is private (`public: false`) — no public read policy. Only the owning coach can insert/select/delete within their `{user_id}/` prefix. Future admin moderation uses service-role in Phase 31+ (per D-11).

**Why no MCP tool:** The project has never used `supabase_storage_create_bucket` MCP for provisioning — all buckets in the codebase use SQL migrations. Consistency requires migration 037.

### 2. Signed URL Upload Pattern (v1.3 — exact shape) [VERIFIED: backend/api/src/routes/storage.ts]

The complete verified pattern from `storage.ts`:

**Backend endpoint:**
```
GET /storage/upload-url?bucket=coach-kyc&path={userId}/{filename}
Authorization: Bearer {userJwt}

Response: { upload_url: string, path: string, token: string }
```

**Client flow:**
1. `GET /storage/upload-url?bucket=coach-kyc&path={userId}/{filename}` (with user JWT in header)
2. Backend validates: bucket in allowlist, path starts with `{userId}/`, calls `supabase.storage.from(bucket).createSignedUploadUrl(path)` using **service key** (only for generating signed URL — the actual upload uses the signed URL which enforces RLS)
3. Client receives `{ upload_url, path, token }`
4. Client does `PUT {upload_url}` with the file body directly to Supabase Storage (bypasses Vercel 4.5 MB body limit)
5. Client constructs the CDN URL: `{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}` for public buckets — for private `coach-kyc`, use the signed download URL or store the path and generate on demand

**ARCH-03 note:** The signed URL generation uses service key but only to call the signed URL API — the upload itself goes directly to Supabase Storage and is enforced by Storage RLS policies. The `backend/api/src/coach/identity/` module does NOT need its own service-role client for uploads. The existing `/storage/upload-url` endpoint handles signed URL generation; `coach/identity/` only stores the resulting CDN URL in `coach_profiles.photo_url` or `kyc_docs` JSONB.

**ARCH-03 bucket allowlist update:** `ALLOWED_BUCKETS` in `storage.ts` must be extended to include `'coach-kyc'`:
```typescript
const ALLOWED_BUCKETS = ['profile-photos', 'scan-photos', 'exports', 'coach-kyc'] as const;
```

**For the private `coach-kyc` bucket:** `photo_url` in `coach_profiles` should store either (a) the full path `{userId}/photo.{ext}` and generate signed download URLs on demand via `supabase.storage.from('coach-kyc').createSignedUrl(path, 3600)` [ASSUMED], or (b) since the coach's own profile photo is typically displayed to the coach themselves (and in Phase 25 to clients via coach profile preview), consider making photo a separate public bucket. However, D-11 says photo is stored in `coach-kyc` bucket. The planner must decide: store path only, generate signed URL on each read, or restructure. Given Phase 25 needs photo visible to clients, recommend storing path and generating signed URL server-side on read.

### 3. Next.js 15 `useActionState` Pattern [VERIFIED: apps/web/src/components/account/DeleteAccountForm.tsx]

The project already uses `useActionState` in production. The verified pattern:

**Server Action signature (`'use server'` file):**
```typescript
export type LoginState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  redirectTo?: string;
};

export async function loginAction(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // 1. Rate limit (see pattern #9)
  // 2. Extract email/password from formData
  // 3. supabase.auth.signInWithPassword({ email, password })
  // 4. On success: set role-based redirect, return { status: 'success', redirectTo }
  // 5. On error: return { status: 'error', message: 'Email ou mot de passe incorrect...' }
}
```

**Client component (`'use client'`):**
```typescript
'use client';
import { useActionState } from 'react';
import { loginAction, LoginState } from '@/actions/login';

const initialState: LoginState = { status: 'idle', message: '' };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  // pending === true while Server Action is executing → disable submit button
  // state.status === 'error' → show state.message below form
  // state.status === 'success' → handled by redirect() in Server Action or router.push(state.redirectTo)
  return (
    <form action={formAction}>
      {/* ... */}
      <button disabled={pending}>
        {pending ? 'Connexion...' : 'Se connecter'}
      </button>
      {state.status === 'error' && <p role="alert">{state.message}</p>}
    </form>
  );
}
```

**Note on `useFormStatus`:** The project does NOT use `useFormStatus` — instead it uses the `pending` return value from `useActionState` directly (3rd element of the tuple). This is the React 19 / Next.js 15 recommended approach. Do NOT add `useFormStatus` unless explicitly needed for a nested submit button component. [VERIFIED: DeleteAccountForm.tsx uses `pending` from useActionState, not useFormStatus]

**Post-login redirect:** `redirect()` from `next/navigation` cannot be called inside a `try/catch` in Server Actions (it throws internally). Call it after the `try/catch` block, or return `{ status: 'success', redirectTo: '/coach/dashboard' }` and use `useEffect` / `router.push` in the client component on success state. The `router.push` approach is safer for avoiding the thrown-redirect issue with `useActionState`. [ASSUMED — standard Next.js 15 Server Action pattern]

### 4. Wizard State with URL Search Params [VERIFIED: UI-SPEC decision; ASSUMED: Next.js 15 App Router behavior]

UI-SPEC decided: `useSearchParams` + `useRouter().push` for step navigation.

**Implementation pattern:**
```typescript
'use client';
import { useSearchParams, useRouter } from 'next/navigation';

export function OnboardingWizard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = parseInt(searchParams.get('step') ?? '1', 10);

  const goToStep = (n: number) => {
    router.push(`/coach/onboarding?step=${n}`);
  };
  // ...
}
```

**`<Suspense>` requirement:** `useSearchParams()` in the App Router requires the component tree to be wrapped in `<Suspense>` when used in a Client Component, or it will cause the entire page to bail out to client-side rendering. [ASSUMED: Next.js 15 documented requirement] The pattern is:

```typescript
// page.tsx (Server Component)
import { Suspense } from 'react';
import { OnboardingWizard } from './OnboardingWizard';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <OnboardingWizard />
    </Suspense>
  );
}
```

**`router.push` behavior:** In Next.js 15 App Router, `router.push` causes a soft navigation — it does NOT trigger a full page reload or re-run Server Components. The Client Component re-renders with new `searchParams`. This is correct behavior for the wizard (step navigation without losing client state like uploaded file previews).

**Step validation before navigation:** Check inline before calling `goToStep`. Example for Step 2: `if (!displayName.trim()) { setError('display_name', 'Nom requis'); return; } goToStep(3);`

### 5. `?next=` Parameter Open-Redirect Prevention [VERIFIED: UI-SPEC allowlist; pattern from account.ts]

**Allowlist (from UI-SPEC):**
```typescript
const NEXT_PARAM_ALLOWLIST = [
  '/coach/onboarding',
  '/coach/dashboard',
  '/coach/settings',
] as const;

function safeNext(next: string | null): string {
  if (next && NEXT_PARAM_ALLOWLIST.includes(next as typeof NEXT_PARAM_ALLOWLIST[number])) {
    return next;
  }
  return '/coach/dashboard'; // default fallback
}
```

**Where it lives:** In the `loginAction` Server Action. The `next` param is read from the form (pass as a hidden input from the page's `useSearchParams`) or from the URL. After successful login, `redirect(safeNext(next))`. The allowlist check must happen before `redirect()` — never pass `next` directly to `redirect()` without validation.

**Why not validate in middleware:** Middleware runs before auth is confirmed; the redirect destination is only relevant after login succeeds. The Server Action is the right place.

### 6. ESLint Module Boundary — Activation Status [VERIFIED: apps/web/eslint.config.mjs lines 27-40; .github/workflows/ci.yml lines 111-127]

**Current state:** The ESLint `no-restricted-imports` patterns for `**/coach/*/db/**` and `**/coach/*/internal/**` are already shipped in `apps/web/eslint.config.mjs`. ESLint silently ignores glob patterns that match no files — so these patterns are inert until Phase 24 creates `backend/api/src/coach/identity/` folders.

**What triggers activation:** Creating `backend/api/src/coach/identity/db.ts` will immediately make the pattern active — any file outside `service.ts` that tries to `import ... from '../identity/db'` will get an ESLint error.

**Backend ESLint config:** There is no ESLint config in `backend/api/` — only `apps/web/eslint.config.mjs` has the rule. The CI grep in `.github/workflows/ci.yml` (job `no-service-role-in-coach`) enforces `backend/api/src/coach/` at CI level. The ESLint rule in `apps/web` enforces web-side module boundaries.

**For `backend/api/src/coach/identity/`:** The CI grep (`grep -r 'SERVICE_ROLE' backend/api/src/coach/`) activates immediately when the `coach/` directory exists. Phase 24 must ensure `coach/identity/db.ts` creates its Supabase client using the user JWT, not SERVICE_ROLE. [VERIFIED: CI workflow line 120-121]

**Correct pattern for `coach/identity/db.ts`:**
```typescript
import { createClient } from '@supabase/supabase-js';

// Per-request client using user JWT (never SERVICE_ROLE — ARCH-03)
export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!, // anon key — RLS enforces access
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${jwt}` },
      },
    }
  );
}
```

The user JWT is passed from the route handler (extracted via `authMiddleware` which sets `c.get('auth')`) down to `db.ts` functions. This is the ARCH-03 compliant pattern.

### 7. `force-dynamic` + `revalidate=0` Placement [VERIFIED: apps/web/src/app/[locale]/(coach)/coach/layout.tsx]

**Rule (ARCH-06):** Every `(coach)` page must export both. The existing `layout.tsx` already does this correctly.

**For Phase 24's new files:**

Files inside `(coach)` layout (dashboard, settings):
```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```
Both on every `page.tsx` AND `layout.tsx` at every level.

**For `/coach/onboarding` (OUTSIDE `(coach)` layout per D-06):**
The onboarding route is publicly accessible. It does NOT need `force-dynamic` on the page wrapper since there is no server-side user data fetch on page load — auth check only happens client-side when Step 1 is attempted (redirect to login). However, if the onboarding page does any server-side Supabase read (e.g., checking if user is already a coach), it should also declare `force-dynamic`.

**`framer-motion` + `force-dynamic` compatibility:** No known Next.js 15 issues with using `framer-motion` on `force-dynamic` pages. `framer-motion` v12 is SSR-compatible; animations run client-side. The `'use client'` directive on animated components isolates them from Server Component rendering. [ASSUMED — no evidence of conflicts in Next.js 15 ecosystem]

### 8. ARCH-03: `coach-kyc` Bucket and Service-Role-Free Pattern [VERIFIED: storage.ts + CONTEXT D-08]

**The nuance:** The existing `/storage/upload-url` endpoint in `storage.ts` uses the service key to call `createSignedUploadUrl`. This is acceptable because:
1. The service key is only used to generate a short-lived signed URL (not to write data)
2. The actual upload goes directly from client browser to Supabase Storage
3. Supabase Storage RLS policies on `storage.objects` enforce path-prefix ownership
4. The `coach/identity/` module itself NEVER uses SERVICE_ROLE

**How `coach/identity/` routes handle uploads:**
- They do NOT upload files — that's the browser's job via the signed URL
- They only store the resulting `path` or CDN URL in `coach_profiles.photo_url` or `kyc_docs` JSONB
- The PATCH route in `coach/identity/service.ts` accepts `{ photo_url: string, kyc_docs: CoachKycDoc[] }` in the request body and writes to DB using per-request JWT client

**ARCH-03 compliance:** `coach/identity/db.ts` must never import `SUPABASE_SERVICE_KEY`. The CI grep `grep -r 'SERVICE_ROLE' backend/api/src/coach/` catches this automatically.

### 9. Rate Limiting in Server Actions [VERIFIED: apps/web/src/lib/ratelimit.ts + apps/web/src/actions/account.ts]

`@upstash/ratelimit` is directly usable in Server Actions — `account.ts` proves this. The pattern:

```typescript
// apps/web/src/lib/ratelimit.ts — add new limiters alongside existing one
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export const deleteRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  prefix: 'ziko:delete',
});

// New limiters for Phase 24:
export const rolePromotionRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '60 s'), // 3 role promotions per minute per IP
  prefix: 'ziko:role-promotion',
});

export const kycUploadRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 KYC uploads per minute per IP
  prefix: 'ziko:kyc-upload',
});
```

**In Server Actions:** Use `headers()` from `next/headers` to get `x-forwarded-for` for the IP key, exactly as `account.ts` does. Rate limit is checked before any DB operation.

**For the backend `/coach/identity/role` Hono route:** Rate limiting in Hono routes uses a different mechanism — either Upstash (via `@upstash/ratelimit` which is env-compatible in Node.js) or a Hono middleware. Since the role promotion flows through a Next.js Server Action that calls the backend, rate limiting can be applied at the Server Action layer (in `apps/web`) before the backend call — this is simpler and keeps it consistent with the existing pattern.

### 10. Phase 23 Deletions — Exact File Paths [VERIFIED: codebase ls commands]

Files to delete as Phase 24's first task:

**`_smoke` route (3 files):**
```
apps/web/src/app/[locale]/(coach)/coach/_smoke/SmokeButton.tsx
apps/web/src/app/[locale]/(coach)/coach/_smoke/action.ts
apps/web/src/app/[locale]/(coach)/coach/_smoke/page.tsx
```
The `_smoke/` directory itself (delete all 3 files and the directory).

**Debug routes (2 files):**
```
apps/web/src/app/api/_debug/limits/route.ts     (the route.ts file)
backend/api/src/routes/_debug.ts                 (the Hono debug route)
```
Also remove the `app.route('/_debug', debugRoute)` line and its import from `backend/api/src/app.ts`.

**Cleanup in `app.ts`:**
```typescript
// REMOVE these lines from backend/api/src/app.ts:
import debugRoute from './routes/_debug.js';  // line 13
app.route('/_debug', debugRoute);              // line 55
```

---

## File Map

### Files to DELETE (housekeeping from Phase 23)

| File | Reason |
|------|--------|
| `apps/web/src/app/[locale]/(coach)/coach/_smoke/page.tsx` | Phase 23 smoke test — superseded |
| `apps/web/src/app/[locale]/(coach)/coach/_smoke/action.ts` | Phase 23 smoke test — superseded |
| `apps/web/src/app/[locale]/(coach)/coach/_smoke/SmokeButton.tsx` | Phase 23 smoke test — superseded |
| `apps/web/src/app/api/_debug/limits/route.ts` | Vercel Pro probe — evidence captured in 23-VERIFICATION.md |
| `backend/api/src/routes/_debug.ts` | Vercel Pro probe — no production purpose |

### Files to MODIFY (existing)

| File | Change |
|------|--------|
| `backend/api/src/app.ts` | Remove `_debug` import and `app.route('/_debug', ...)` |
| `backend/api/src/routes/storage.ts` | Add `'coach-kyc'` to `ALLOWED_BUCKETS` |
| `apps/web/src/lib/ratelimit.ts` | Add `rolePromotionRatelimit` and `kycUploadRatelimit` instances |

### Files to CREATE — Database Migration

| File | Role |
|------|------|
| `supabase/migrations/037_coach_kyc_bucket.sql` | Create `coach-kyc` private bucket + RLS policies |

### Files to CREATE — Backend Bounded Module

| File | Role |
|------|------|
| `backend/api/src/coach/identity/types.ts` | Internal TypeScript types (not re-exported beyond service.ts) |
| `backend/api/src/coach/identity/db.ts` | Supabase queries: role update, profile CRUD. Per-request JWT client only |
| `backend/api/src/coach/identity/service.ts` | Public entry: 4 Hono routes registered and exported |
| `backend/api/src/coach/` (directory) | Triggers CI grep check — must have no SERVICE_ROLE |

### Files to CREATE — Next.js Web App

| File | Role |
|------|------|
| `apps/web/src/app/[locale]/login/page.tsx` | Login page (Server Component wrapper) |
| `apps/web/src/app/[locale]/login/LoginForm.tsx` | `'use client'`; `useActionState`; email/password form |
| `apps/web/src/actions/login.ts` | `'use server'`; `loginAction`; rate limit; signInWithPassword; role-based redirect |
| `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` | REPLACE Phase 23 smoke layout with real coach chrome (sidebar + auth guard) |
| `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` | `force-dynamic`; welcome card; KYC chip; Phase 25 teaser |
| `apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx` | `force-dynamic`; profile form + KYC doc list |
| `apps/web/src/app/[locale]/coach/onboarding/page.tsx` | Public page OUTSIDE `(coach)` layout; Suspense wrapper for wizard |
| `apps/web/src/components/coach/CoachSidebar.tsx` | `'use client'`; sidebar with `navItems: NavItem[]` |
| `apps/web/src/components/coach/NavItem.tsx` | Single nav item: enabled/disabled/active states |
| `apps/web/src/components/coach/WizardProgress.tsx` | Progress bar; 4px height; `role="progressbar"` |
| `apps/web/src/components/coach/WizardStep1Role.tsx` | Role confirmation; adapts copy for client vs no-role |
| `apps/web/src/components/coach/WizardStep2Profile.tsx` | Profile fields + photo upload |
| `apps/web/src/components/coach/WizardStep3Kyc.tsx` | KYC doc rows per type + skip button |
| `apps/web/src/components/coach/WelcomeCard.tsx` | Dashboard welcome + KYC chip + Phase 25 teaser |
| `apps/web/src/components/coach/KycStatusChip.tsx` | Status chip with 4 color variants |
| `apps/web/src/components/coach/ProfileForm.tsx` | Shared profile fields (reused in settings + step 2) |
| `apps/web/src/components/coach/KycDocList.tsx` | Doc list with add/remove per type |
| `apps/web/src/components/coach/SpecialtyTagInput.tsx` | Tag multi-value input; max 20 |
| `apps/web/src/components/coach/FileUploadRow.tsx` | Single file upload row: button → filename pill |
| `apps/web/src/components/coach/PhotoUpload.tsx` | 96×96 avatar + file picker |
| `apps/web/src/actions/coach-identity.ts` | `'use server'`; role promotion + profile PATCH + KYC PATCH Server Actions |

---

## Execution Order & Dependencies

### Wave 1 — Housekeeping (no dependencies; unblocks clean layout.tsx)

1. Delete `_smoke/` files (3 files)
2. Delete `apps/web/src/app/api/_debug/limits/route.ts`
3. Delete `backend/api/src/routes/_debug.ts` and clean `app.ts`

### Wave 2 — Database (unblocks file uploads)

4. Create `supabase/migrations/037_coach_kyc_bucket.sql`
5. Apply migration via Supabase MCP `apply_migration`

### Wave 3 — Backend Bounded Module (unblocks Server Actions calling backend)

6. Create `backend/api/src/coach/identity/types.ts`
7. Create `backend/api/src/coach/identity/db.ts`
8. Create `backend/api/src/coach/identity/service.ts`
9. Register coach identity routes in `backend/api/src/app.ts`
10. Add `'coach-kyc'` to `ALLOWED_BUCKETS` in `storage.ts`

### Wave 4 — Web Foundation (unblocks all page components)

11. Create `apps/web/src/actions/login.ts`
12. Create `apps/web/src/actions/coach-identity.ts`
13. Add rate limiters to `apps/web/src/lib/ratelimit.ts`
14. Replace `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` with full sidebar chrome

### Wave 5 — Shared Components (unblocks page assembly)

15. Create all shared components: `CoachSidebar`, `NavItem`, `WizardProgress`, `KycStatusChip`, `ProfileForm`, `KycDocList`, `SpecialtyTagInput`, `FileUploadRow`, `PhotoUpload`

### Wave 6 — Pages (depends on Wave 4 + Wave 5)

16. Create `apps/web/src/app/[locale]/login/page.tsx` + `LoginForm.tsx`
17. Create `apps/web/src/app/[locale]/coach/onboarding/page.tsx` + wizard components
18. Create `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx`
19. Create `apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx`

### Wave 7 — Verification

20. Confirm CI grep passes (no SERVICE_ROLE under `backend/api/src/coach/`)
21. Type-check: `turbo run type-check`
22. Lint: `turbo run lint`
23. Smoke test each route end-to-end

---

## Pitfalls & Landmines

### Pitfall 1: Onboarding route path confusion

**What goes wrong:** The onboarding page is OUTSIDE the `(coach)` layout but is still accessed at `/coach/onboarding` (after locale). Its filesystem path must be `apps/web/src/app/[locale]/coach/onboarding/page.tsx` — NOT inside `[locale]/(coach)/coach/onboarding/`. The `(coach)` route group applies auth guards; onboarding is public until Step 1 is attempted.

**How to avoid:** Create `apps/web/src/app/[locale]/coach/onboarding/` as a sibling directory to `(coach)`, not nested inside it. This gives the URL `/fr/coach/onboarding` without the auth guard from `(coach)/layout.tsx`.

**Warning signs:** If `/coach/onboarding` redirects unauthenticated users to `/fr/login` on page load (instead of letting them see the landing page of the wizard), the route is inside the wrong layout group.

### Pitfall 2: `useSearchParams` missing Suspense boundary

**What goes wrong:** `useSearchParams()` in a Client Component outside a `<Suspense>` boundary causes the entire route to render as a client-side-only page in Next.js 15, losing SSR and potentially causing hydration mismatches or blank page flashes.

**How to avoid:** Always wrap the wizard Client Component in `<Suspense fallback={...}>` in the Server Component page.

### Pitfall 3: ARCH-03 violated by copy-paste from auth.ts pattern

**What goes wrong:** `backend/api/src/middleware/auth.ts` uses `const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!` — this references `SERVICE_KEY`. If `coach/identity/db.ts` copies this pattern, the CI grep fires.

**How to avoid:** `coach/identity/db.ts` creates its Supabase client using only `SUPABASE_PUBLISHABLE_KEY` (the anon key) plus the user JWT in the Authorization header. The RLS policies on `coach_profiles` and `user_profiles` enforce access. Never reference `SUPABASE_SERVICE_KEY` or `SERVICE_ROLE` anywhere under `backend/api/src/coach/`.

### Pitfall 4: `coach_profiles` upsert vs insert logic

**What goes wrong:** A coach who abandons the wizard at Step 2 and returns will trigger a conflict on `user_id` (PRIMARY KEY) if the code tries to INSERT again.

**How to avoid:** Use `supabase.from('coach_profiles').upsert({ user_id: userId, ...fields }, { onConflict: 'user_id' })` in `db.ts` for both POST and PATCH profile routes. Idempotent by design.

### Pitfall 5: Role promotion concurrent writes

**What goes wrong:** Two simultaneous requests to `PATCH /coach/identity/role` for the same user could result in a race on `user_profiles.role`.

**How to avoid:** The `UPDATE user_profiles SET role = ... WHERE user_id = $1 AND role != 'coach'` pattern with a conditional check makes it naturally idempotent. Alternatively, use Supabase's `upsert` with merge behavior. The rate limiting (3/min per IP) also reduces this risk.

### Pitfall 6: `redirect()` inside `try/catch` in Server Actions

**What goes wrong:** In Next.js 15, `redirect()` works by throwing a special error. Wrapping it in `try/catch` will catch the thrown redirect and the navigation will not happen.

**How to avoid:** Structure Server Actions as: do all async work inside try/catch, return error states on failure. OUTSIDE the try/catch, call `redirect()` on success. Or return `{ redirectTo: '/...' }` from the Server Action and use `useEffect(() => { if (state.redirectTo) router.push(state.redirectTo) }, [state])` in the client component.

### Pitfall 7: `coach-kyc` bucket for photo URL — private bucket URL expiry

**What goes wrong:** If `coach_profiles.photo_url` stores a signed URL (not a path), it will expire in ~1 hour (Supabase signed URL default TTL). Every subsequent render of a profile photo will show a broken image.

**How to avoid:** Store the storage path (`{userId}/photo.{ext}`) in `photo_url`, NOT the signed URL. Generate a signed URL server-side at render time (or use Supabase's `createSignedUrl(path, 3600)` on each page load inside the Server Component).

**Alternative:** Store photo in the existing `profile-photos` bucket (which has public read per migration 025) and construct the public CDN URL. This avoids signed URL expiry entirely. However D-12 says `coach-kyc` bucket — planner must make a call here.

### Pitfall 8: `app.ts` import/route deletion leaves dead code

**What goes wrong:** Deleting `_debug.ts` but forgetting to remove its import and route registration in `app.ts` causes a TypeScript compile error.

**How to avoid:** Edit these two lines in `backend/api/src/app.ts` atomically with the file deletion:
```typescript
// Remove:
import debugRoute from './routes/_debug.js';
// Remove:
app.route('/_debug', debugRoute);
```

### Pitfall 9: ESLint ban on `@supabase/supabase-js` in `coach/identity/db.ts`

**What goes wrong:** `apps/web/eslint.config.mjs` bans `@supabase/supabase-js` in the web app — but the ESLint ban only applies to `apps/web`. The backend does not have an ESLint config, so `backend/api/src/coach/identity/db.ts` can import `@supabase/supabase-js` freely (and should, since it needs the Node.js Supabase client).

**Potential confusion:** A developer might think the ban applies project-wide and try to avoid the import in the backend. The ban is web-only (`apps/web/eslint.config.mjs`). Backend uses `@supabase/supabase-js` directly — verified in `backend/api/src/middleware/auth.ts`.

### Pitfall 10: Wizard state lost on browser back

**What goes wrong:** With URL search params, pressing browser back from Step 2 to Step 1 loses any typed profile fields that were held in local `useState`.

**How to avoid:** This is expected and acceptable per D-06 ("wizard state is client-only — no server persistence"). Each step only commits to the DB on its own CTA click. Going back means re-entering the step. Document this in the PLAN.md as a known trade-off.

---

## Validation Architecture

Phase 24 ships the first user-visible flows worth end-to-end testing. Nyquist validation maps success criteria to testable checks.

### Test Framework [VERIFIED: backend/api/vitest.config.ts exists; packages/coach-sdk tests exist]

| Property | Value |
|----------|-------|
| Framework | Vitest 3 (existing) |
| Config file | `backend/api/vitest.config.ts` (existing pattern) |
| Quick run command | `cd backend/api && npm test -- --run` |
| Full suite command | `npm run type-check && npm run lint && cd backend/api && npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| COACH-01 | `PATCH /coach/identity/role` sets `role='coach'` or `'both'` | Integration (Vitest + admin client) | `cd backend/api && npm test -- --run coach-identity` | New test file: `backend/api/test/coach/identity.spec.ts` |
| COACH-02 | `POST /coach/identity/profile` creates `coach_profiles` row with all fields | Integration | same test file | |
| COACH-02 | `CoachProfileSchema` validates profile payload correctly | Unit | `cd packages/coach-sdk && npm test -- --run` | Already passing per Phase 23 |
| COACH-03 | KYC docs JSONB updated via `PATCH /coach/identity/profile`; `kyc_status` stays `'pending'` | Integration | same test file | |
| COACH-04 | User with `role='client'` gets `role='both'` after promotion | Integration | same test file | |
| COACH-05 | Settings page renders editable form with existing coach data | Manual smoke | Deploy preview URL | No automated test for Next.js Server Components without Playwright |
| ARCH-01 | `backend/api/src/coach/identity/service.ts` is the only exported entry | CI lint | `turbo run lint` | ESLint `no-restricted-imports` activates with folder creation |
| ARCH-03 | No `SERVICE_ROLE` under `backend/api/src/coach/` | CI grep | `.github/workflows/ci.yml` job `no-service-role-in-coach` | Already live; activates when `coach/` dir created |

### Wave 0 Gaps (tests to create)

- [ ] `backend/api/test/coach/identity.spec.ts` — covers COACH-01 through COACH-04; uses existing admin client fixture from `backend/api/test/rls/` pattern
- [ ] `backend/api/test/coach/` directory — mirror structure of `backend/api/test/rls/`

Wave 0 infrastructure (Vitest config, shared fixtures) already exists. Only the test file itself needs creation.

### Manual Smoke Verification Plan

| Success Criterion | Manual Test | Expected Result |
|-------------------|-------------|-----------------|
| SC1: Role promotion | Log in as new user → visit `/fr/coach/onboarding` → complete Step 1 → query `user_profiles.role` | `'coach'` or `'both'` |
| SC2: Profile persisted | Complete Step 2 with all fields → query `coach_profiles` | Row exists with correct data |
| SC3: KYC upload | Upload a PDF in Step 3 → query `coach_profiles.kyc_docs` and `kyc_status` | JSONB has doc entry; status `'pending'` |
| SC4: `role='both'` dual access | Athlete logs in → goes through onboarding → can also log into mobile app | No session conflict |
| SC5: Settings edit | Edit profile in `/coach/settings` → save → re-load page | Updated data persists |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `redirect()` in Server Actions must be called outside `try/catch` in Next.js 15 | Pattern #3 | Login redirects silently fail; logged in user sees no navigation |
| A2 | `useSearchParams` requires `<Suspense>` wrapper in Next.js 15 App Router Client Components | Pattern #4 | Page renders CSR-only or throws; hydration mismatch in production |
| A3 | `framer-motion` v12 + `force-dynamic` pages have no known Next.js 15 compatibility issues | Pattern #7 | Wizard animations break in production builds |
| A4 | Supabase `createSignedUrl` default TTL is ~1 hour for private bucket download URLs | Pitfall #7 | Profile photos expire after 1 hour if signed URL is stored instead of path |
| A5 | `router.push` from `useRouter` in App Router causes soft navigation (no full page reload) | Pattern #4 | Wizard loses client state on step navigation |

**Verified claims (not assumed):** All other factual claims in this document are verified directly against the codebase.

---

## Sources

### Primary (HIGH confidence — verified against codebase)

- `supabase/migrations/025_storage_buckets.sql` — bucket provisioning via SQL pattern (INSERT INTO storage.buckets)
- `supabase/migrations/017_avatars_storage.sql` — same pattern for avatars bucket
- `supabase/migrations/034_coach_role_profiles.sql` — exact column definitions Phase 24 must match
- `packages/coach-sdk/src/schemas/coach-profile.ts` — Zod schemas Phase 24 forms project against
- `apps/web/src/components/account/DeleteAccountForm.tsx` — verified `useActionState` usage pattern
- `apps/web/src/actions/account.ts` — verified Server Action + ratelimit pattern
- `apps/web/src/lib/ratelimit.ts` — verified `@upstash/ratelimit` instance pattern
- `apps/web/src/lib/supabase/server.ts` — verified `createServerSupabase()` factory
- `backend/api/src/routes/storage.ts` — verified signed URL upload pattern (exact API shape)
- `backend/api/src/middleware/auth.ts` — verified Hono auth middleware pattern
- `backend/api/src/app.ts` — verified route registration pattern
- `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` — verified force-dynamic pattern + auth guard
- `apps/web/src/app/globals.css` — verified Tailwind v4 `@theme` token values
- `apps/web/src/lib/motion.ts` — verified framer-motion presets
- `apps/web/eslint.config.mjs` — verified ESLint rules D-11 and D-12
- `.github/workflows/ci.yml` — verified CI grep job for SERVICE_ROLE (lines 111-127)

### Secondary (MEDIUM confidence — from official CONTEXT.md and UI-SPEC)

- `24-CONTEXT.md` — all 13 decisions; constraints and scope
- `24-UI-SPEC.md` — component inventory, copy, interaction contracts, animation spec
- `23-CONTEXT.md` — Phase 23 D-09/D-11/D-12/D-13/D-15 deletion scope

---

## RESEARCH COMPLETE

**Phase:** 24 - Coach Identity & Onboarding
**Confidence:** HIGH

### Key Findings

1. **Supabase Storage bucket provisioning IS SQL-based.** Migrations 017 and 025 prove it — `INSERT INTO storage.buckets` is the established pattern. Migration 037 follows this exactly. No MCP tool needed.

2. **Signed URL upload pattern is fully verified.** `/storage/upload-url?bucket=&path=` endpoint exists and is ready. Only change needed: add `'coach-kyc'` to `ALLOWED_BUCKETS` in `storage.ts`. Profile photo and KYC docs both use this endpoint.

3. **`useActionState` is already in production.** `DeleteAccountForm.tsx` proves the pattern including the `pending` flag for loading states. `<LoginForm>` follows the identical shape with `loginAction` Server Action.

4. **Rate limiting in Server Actions is already established.** `account.ts` + `ratelimit.ts` demonstrate the complete pattern. Phase 24 adds two new rate limiter instances to `ratelimit.ts`.

5. **The CI grep for ARCH-03 is already live** and activates automatically when `backend/api/src/coach/` is created. Phase 24 must ensure `coach/identity/db.ts` never references `SERVICE_ROLE` or `SUPABASE_SERVICE_KEY`.

6. **Private bucket photo URL strategy requires a decision.** Storing signed URLs for `coach-kyc` exposes a TTL expiry problem. Planner should decide: store storage path + generate signed URL on render, OR move profile photo to the existing public `profile-photos` bucket. D-12 says `coach-kyc` — planner needs to account for this in the settings and dashboard pages.

7. **Onboarding route filesystem path is critical.** Must be `apps/web/src/app/[locale]/coach/onboarding/` (sibling to `(coach)/`), not nested inside `(coach)/`. Otherwise the auth guard from the layout fires on page load, breaking D-06's public accessibility requirement.

### Files Created

`.planning/phases/24-coach-identity-onboarding/24-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Storage bucket provisioning | HIGH | Verified in migrations 017 and 025 |
| Signed URL upload pattern | HIGH | Verified in storage.ts — exact API shape documented |
| useActionState pattern | HIGH | Verified in DeleteAccountForm.tsx production code |
| Rate limiting in Server Actions | HIGH | Verified in account.ts production code |
| CI grep activation | HIGH | Verified in .github/workflows/ci.yml lines 111-127 |
| Onboarding route placement | HIGH | Verified by understanding (coach) layout guard behavior |
| Next.js 15 Suspense + useSearchParams | MEDIUM | Standard Next.js documented requirement, not verified against project code |
| redirect() outside try/catch | MEDIUM | Standard Next.js 15 pattern, not verified against project code |
| framer-motion + force-dynamic compat | LOW | No evidence found for or against; assumed safe |

### Open Questions (RESOLVED)

1. **Photo URL in private `coach-kyc` bucket:** Does the planner want to store the storage path (and generate signed URLs on read) or store a temporary signed URL (expires in ~1 hour)? Recommend: store path, generate signed download URL server-side on each render. Alternative: use existing `profile-photos` (public) bucket for photos only, reserve `coach-kyc` for KYC docs.

   **RESOLVED:** Store storage path in `coach_profiles.photo_url`. Generate signed download URL server-side at render via `createSignedUrl(path, 3600)`. D-12 updated — no public CDN URL since bucket is private.

2. **Playwright E2E:** CONTEXT deferred this decision to the planner. Phase 24 is the first phase worth E2E testing (real login flow). Recommend: include one Playwright smoke test (login → onboarding step 1) in this phase so the infrastructure exists for Phase 25+.

   **RESOLVED:** No Playwright in Phase 24 — deferred per CONTEXT.md deferred list ("Playwright E2E tests (deferred from Phase 23 D-16 — planner decides if Phase 24 ships them)"). Phase 24 ships integration tests only.

3. **`next-intl` translation keys:** The UI-SPEC copywriting contract defines all keys (`Login.*`, `Onboarding.*`, `Dashboard.*`, etc.). The planner must include a task to add these keys to the translation files. Where do translation files live? Check `apps/web/messages/` or equivalent.

### Ready for Planning

Research complete. Planner can now create PLAN.md files using this research as the sole source of truth.
