---
phase: 24-coach-identity-onboarding
plan: GAP
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/actions/login.ts
  - apps/web/src/app/[locale]/login/LoginForm.tsx
  - apps/web/src/components/coach/PhotoUpload.tsx
  - apps/web/src/components/coach/FileUploadRow.tsx
  - apps/web/src/app/[locale]/layout.tsx
autonomous: true
gap_closure: true
requirements: [SC1, SC2, SC3]

must_haves:
  truths:
    - "After login, redirect lands on /{locale}/coach/onboarding or /{locale}/coach/dashboard (no 404)"
    - "Photo/avatar upload via signed URL completes successfully — preview shown, path persisted"
    - "KYC document upload completes — filename pill appears, status flips to Soumis"
    - "Coach dashboard pages render without the marketing Header overlapping the sidebar"
  artifacts:
    - path: "apps/web/src/app/[locale]/login/LoginForm.tsx"
      provides: "useLocale() prefixes redirectTo before router.push"
    - path: "apps/web/src/components/coach/PhotoUpload.tsx"
      provides: "uploadToSignedUrl(path, token, file) replaces raw fetch PUT"
    - path: "apps/web/src/components/coach/FileUploadRow.tsx"
      provides: "uploadToSignedUrl(path, token, file) replaces raw fetch PUT"
    - path: "apps/web/src/app/[locale]/layout.tsx"
      provides: "Header/Footer suppressed for /coach/* routes"
  key_links:
    - from: "LoginForm.tsx"
      to: "router.push"
      via: "useLocale() + template literal `/${locale}${state.redirectTo}`"
    - from: "PhotoUpload.tsx / FileUploadRow.tsx"
      to: "supabase.storage.from('coach-kyc').uploadToSignedUrl"
      via: "token field returned by /storage/upload-url"
---

<objective>
Close all four UAT gaps from Phase 24: locale-prefixed login redirects, silent upload failures
(photo + KYC), and the marketing Header overlapping coach layout pages.

Purpose: UAT tests 3, 4, 5, 7 are currently failing — three major, one minor. These gaps block
the coach onboarding flow end-to-end.

Output: Three file-level fixes — LoginForm locale prefix, upload components using Supabase SDK
method, locale layout suppressing Header for coach routes.
</objective>

<execution_context>
@/root/.claude/get-shit-done/workflows/execute-plan.md
@/root/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/24-coach-identity-onboarding/24-01-SUMMARY.md
@.planning/phases/24-coach-identity-onboarding/24-02-SUMMARY.md
@.planning/phases/24-coach-identity-onboarding/24-03-SUMMARY.md

<interfaces>
<!-- Key contracts for this plan. Extracted from codebase. -->

From apps/web/src/actions/login.ts (current):
```typescript
export type LoginState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  redirectTo?: string;   // returned as locale-less path: '/coach/dashboard' etc.
};
// safeNext() returns from NEXT_PARAM_ALLOWLIST — all paths without locale prefix
```

From backend/api/src/routes/storage.ts (upload-url response):
```typescript
// GET /storage/upload-url?bucket=coach-kyc&path={userId}/{filename}
// Response JSON:
{ upload_url: string; path: string; token: string }
// token is the Supabase signed upload token — required for uploadToSignedUrl()
```

Supabase JS SDK uploadToSignedUrl signature:
```typescript
supabase.storage.from(bucket).uploadToSignedUrl(path: string, token: string, file: File)
// Returns: { data: { path: string } | null, error: StorageError | null }
// The SDK sets Content-Type from file.type automatically
```

next-intl useLocale:
```typescript
import { useLocale } from 'next-intl';
const locale = useLocale(); // e.g. 'fr', 'en'
```

Supabase browser client (already available in web app):
```typescript
import { createBrowserClient } from '@supabase/ssr';
// or: import { supabase } from '@/lib/supabase/client'; — check existing client export
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix login redirect — prepend locale in LoginForm.tsx</name>
  <files>apps/web/src/app/[locale]/login/LoginForm.tsx</files>
  <action>
Gap 1 root cause: `router.push(state.redirectTo)` pushes a locale-less path like
`/coach/dashboard`, causing 404 because next-intl requires `/{locale}/coach/dashboard`.

Fix in `LoginForm.tsx`:

1. Add `useLocale` import from `next-intl`:
   ```typescript
   import { useLocale } from 'next-intl';
   ```

2. Inside the `LoginForm` component body, after `const router = useRouter()`:
   ```typescript
   const locale = useLocale();
   ```

3. Change line 20 from:
   ```typescript
   router.push(state.redirectTo);
   ```
   to:
   ```typescript
   router.push(`/${locale}${state.redirectTo}`);
   ```

No changes to `login.ts` are needed — the action correctly returns locale-less paths (e.g.
`/coach/dashboard`). The locale prefix belongs in the client component that has access to
`useLocale()`, not the server action.

Also note: `(coach)/coach/layout.tsx` line 26 has `redirect('/coach/onboarding')` without locale
prefix — fix this too while touching related files:
In `apps/web/src/app/[locale]/(coach)/coach/layout.tsx`, change:
   ```typescript
   redirect('/coach/onboarding');
   ```
   to:
   ```typescript
   redirect('/fr/coach/onboarding');
   ```
Wait — that layout is a Server Component with access to params. Instead import `getLocale`:
   ```typescript
   import { getLocale } from 'next-intl/server';
   // in the function body, after existing supabase calls:
   const locale = await getLocale();
   redirect(`/${locale}/coach/onboarding`);
   ```
Apply this fix to `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` as well.
  </action>
  <verify>
    <automated>cd /c/ziko-platform/apps/web && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
LoginForm.tsx imports useLocale and constructs `/${locale}${state.redirectTo}` before router.push.
TypeScript check passes with no errors on these files. Login redirects land on /fr/coach/dashboard
instead of /coach/dashboard.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix silent upload failures — use uploadToSignedUrl in PhotoUpload and FileUploadRow</name>
  <files>
    apps/web/src/components/coach/PhotoUpload.tsx
    apps/web/src/components/coach/FileUploadRow.tsx
  </files>
  <action>
Gap 2+3 root cause: `fetch(upload_url, { method: 'PUT', body: file })` without Content-Type header.
Supabase Storage rejects it with 400 but catch blocks swallow errors silently.

Fix: replace raw fetch PUT with `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`.
The backend `/storage/upload-url` already returns a `token` field — we just need to use it.

First, check whether a browser Supabase client is already exported from a shared location:
```bash
grep -r "createBrowserClient\|export.*supabase" apps/web/src/lib/supabase/ 2>/dev/null
```
If `src/lib/supabase/client.ts` exports a `supabase` singleton (or a `createBrowserSupabase`
function), import that. If not, create the upload call inline using `createBrowserClient` from
`@supabase/ssr`.

**Changes to `PhotoUpload.tsx`:**

1. Import the Supabase browser client (use existing export or create inline):
   ```typescript
   import { createBrowserClient } from '@supabase/ssr';
   ```

2. Inside `handleFile`, after getting `upload_url` and `path` from the upload-url response,
   also extract `token`:
   ```typescript
   const { upload_url, path, token } = await urlRes.json() as {
     upload_url: string; path: string; token: string
   };
   ```

3. Replace lines 47-48 (the raw `fetch` PUT) with:
   ```typescript
   const supabase = createBrowserClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
   );
   const { error: uploadError } = await supabase.storage
     .from('coach-kyc')
     .uploadToSignedUrl(path, token, file);
   if (uploadError) throw uploadError;
   ```

4. Update the catch block (line 51) to log the error:
   ```typescript
   } catch (err) {
     console.error('[PhotoUpload] upload failed:', err);
     setError('Échec du transfert. Réessayez.');
     setPreview(null);
   }
   ```

**Changes to `FileUploadRow.tsx`:**

1. Same `createBrowserClient` import.

2. Extract `token` from the upload-url JSON response alongside `upload_url` and `path` (line 55):
   ```typescript
   const { upload_url, path, token } = await urlRes.json() as {
     upload_url: string; path: string; token: string
   };
   ```

3. Replace the raw `fetch` PUT (line 56) with:
   ```typescript
   const supabase = createBrowserClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
   );
   const { error: uploadError } = await supabase.storage
     .from('coach-kyc')
     .uploadToSignedUrl(path, token, file);
   if (uploadError) throw uploadError;
   ```

4. Update the catch block (line 65) to log:
   ```typescript
   } catch (err) {
     console.error('[FileUploadRow] upload failed:', err);
     setError('Échec du transfert. Réessayez.');
   }
   ```

Note: The `upload_url` variable is no longer used after this change — remove it from the
destructured response to keep the code clean (or keep it unused if preferred — TypeScript will
warn with noUnusedLocals). Remove `upload_url` from the destructure to avoid lint errors.

Check whether `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the correct env var name for the web app.
From CLAUDE.md the web app uses `EXPO_PUBLIC_SUPABASE_KEY` for mobile — check `apps/web/.env.example`
or existing web client code to confirm the correct var name (`NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are standard for Next.js + Supabase SSR).
  </action>
  <verify>
    <automated>cd /c/ziko-platform/apps/web && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
Both PhotoUpload.tsx and FileUploadRow.tsx use `uploadToSignedUrl(path, token, file)` with the
token from the backend response. Catch blocks log errors to console. TypeScript check passes.
  </done>
</task>

<task type="auto">
  <name>Task 3: Fix coach layout — suppress marketing Header/Footer for /coach/* routes</name>
  <files>apps/web/src/app/[locale]/layout.tsx</files>
  <action>
Gap 4 root cause: `[locale]/layout.tsx` renders `&lt;Header /&gt;` and `&lt;Footer /&gt;`
unconditionally. Coach pages inherit this layout, causing the sticky 56px Header to overlap the
CoachSidebar.

Fix approach: Use `usePathname` (or server-side pathname detection) to suppress Header/Footer
for coach routes. Since this is a Server Component (async function), use `headers()` to read the
pathname, or restructure using Next.js route groups.

**Recommended fix — route group restructure (cleanest, no runtime check needed):**

The `[locale]` directory currently has:
```
[locale]/
  layout.tsx          ← renders Header + Footer for ALL routes
  (coach)/            ← coach route group (already exists)
  login/
  page.tsx
  cgu/ mentions-legales/ politique-de-confidentialite/ supprimer-mon-compte/
```

The coach group already has its own layout at `(coach)/coach/layout.tsx`. The fix is to make
the parent `[locale]/layout.tsx` NOT wrap coach routes in Header/Footer.

**Implementation:**

1. Read the current `[locale]/layout.tsx` to see its full content (already read — it wraps all
   children in Header + Footer unconditionally).

2. Create a new route group `[locale]/(marketing)/` for pages that need Header/Footer. Move
   marketing pages into it — BUT this requires moving files which is complex and risks breaking
   routing.

**Simpler alternative — pathname-based suppression using `headers()`:**

Since `[locale]/layout.tsx` is an async Server Component, read the pathname via `headers()`:

```typescript
import { headers } from 'next/headers';

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  
  const headersList = await headers();
  const pathname = headersList.get('x-invoke-path') ?? headersList.get('x-pathname') ?? '';
  const isCoachRoute = pathname.includes('/coach/');

  return (
    <NextIntlClientProvider>
      <div className={`${inter.className} bg-background text-text min-h-screen flex flex-col`}>
        {!isCoachRoute && <Header />}
        <div className="flex-1">
          {children}
        </div>
        {!isCoachRoute && <Footer />}
      </div>
    </NextIntlClientProvider>
  );
}
```

However, Next.js App Router does not reliably expose raw pathname via headers in all deployment
environments. The cleaner, guaranteed approach is a **route group split**.

**Use the route group approach:**

1. Create `apps/web/src/app/[locale]/(marketing)/layout.tsx`:
   ```typescript
   import { Header } from '@/components/layout/Header';
   import { Footer } from '@/components/layout/Footer';

   export default function MarketingLayout({ children }: { children: React.ReactNode }) {
     return (
       <>
         <Header />
         <div className="flex-1">
           {children}
         </div>
         <Footer />
       </>
     );
   }
   ```

2. Move these files/folders into `[locale]/(marketing)/`:
   - `[locale]/page.tsx` → `[locale]/(marketing)/page.tsx`
   - `[locale]/cgu/` → `[locale]/(marketing)/cgu/`
   - `[locale]/mentions-legales/` → `[locale]/(marketing)/mentions-legales/`
   - `[locale]/politique-de-confidentialite/` → `[locale]/(marketing)/politique-de-confidentialite/`
   - `[locale]/supprimer-mon-compte/` → `[locale]/(marketing)/supprimer-mon-compte/`
   - Keep `[locale]/login/` as-is OR move to `(marketing)` — login page may or may not want Header

3. Update `[locale]/layout.tsx` to remove `&lt;Header /&gt;`, `&lt;Footer /&gt;`, and their imports:
   ```typescript
   import { Inter } from 'next/font/google';
   import { setRequestLocale } from 'next-intl/server';
   import { NextIntlClientProvider } from 'next-intl';
   import { routing } from '@/i18n/routing';
   import '../globals.css';

   const inter = Inter({ subsets: ['latin'], display: 'swap' });

   export function generateStaticParams() {
     return routing.locales.map((locale) => ({ locale }));
   }

   type Props = {
     children: React.ReactNode;
     params: Promise<{ locale: string }>;
   };

   export default async function LocaleLayout({ children, params }: Props) {
     const { locale } = await params;
     setRequestLocale(locale);

     return (
       <NextIntlClientProvider>
         <div className={`${inter.className} bg-background text-text min-h-screen flex flex-col`}>
           {children}
         </div>
       </NextIntlClientProvider>
     );
   }
   ```

Check whether `login/` should go into `(marketing)` — from UAT test 2, login page loads fine,
so it does NOT need Header. Leave `login/` at `[locale]/login/` (outside marketing group) to
keep its current layout (no Header is correct for a login page — the ZIKO logo is already in
LoginForm.tsx).
  </action>
  <verify>
    <automated>cd /c/ziko-platform/apps/web && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
`[locale]/layout.tsx` no longer renders Header or Footer. Marketing pages (`/`, `/cgu`, etc.) are
in `[locale]/(marketing)/` with their own layout that includes Header + Footer. Coach pages at
`/coach/*` no longer inherit the sticky 56px Header. TypeScript check passes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → router.push | redirectTo originates from server action which validates against allowlist — locale prefix added client-side does not expand attack surface |
| Client → Supabase Storage | signed upload token is scoped to path/bucket by backend; switching from raw fetch to SDK does not change trust model |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-GAP-01 | Spoofing | LoginForm locale prepend | accept | locale comes from next-intl routing config (fr/en), not user input — cannot be spoofed to inject path traversal |
| T-GAP-02 | Tampering | uploadToSignedUrl token | accept | token is backend-generated, scoped to userId/path, 60s TTL — SDK validates server-side |
| T-GAP-03 | Info Disclosure | console.error in catch | accept | logs to server console only in dev; in prod, Vercel logs are private — no PII in error objects |
</threat_model>

<verification>
After all three tasks complete:

1. TypeScript: `cd apps/web && npx tsc --noEmit` — zero errors
2. Login redirect: logging in with a new client-role account redirects to `/fr/coach/onboarding` (not `/coach/onboarding`)
3. Photo upload: selecting a JPG in Step 2 onboarding — preview appears, no "Échec du transfert" error, path persisted on save+reload
4. KYC upload: uploading PDF in Step 3 — filename pill appears, KYC chip shows "Soumis", persists on reload
5. Coach dashboard: visiting `/fr/coach/dashboard` shows no marketing Header above the sidebar — layout is clean
6. Marketing pages: visiting `/fr` and `/fr/cgu` still show Header + Footer
</verification>

<success_criteria>
- UAT test 3 passes: login → `/fr/coach/onboarding` (locale prefix present, no 404)
- UAT test 4 passes: photo upload completes, fields pre-populated on reload
- UAT test 5 passes: KYC upload completes, filename pill + "Soumis" chip, persists
- UAT test 7 passes: coach dashboard renders without marketing Header overlay
- TypeScript check (`npx tsc --noEmit`) reports zero errors on changed files
</success_criteria>

<output>
After completion, create `.planning/phases/24-coach-identity-onboarding/24-GAP-SUMMARY.md`
</output>
