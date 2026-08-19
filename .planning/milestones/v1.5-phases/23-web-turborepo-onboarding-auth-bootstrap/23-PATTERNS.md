# Phase 23: Web Turborepo Onboarding & Auth Bootstrap — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 27 (create + modify)
**Analogs found:** 22 / 27 (5 marked novel — see "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/coach-sdk/package.json` | workspace package config | tsup build → dist/* | `packages/plugin-sdk/package.json` + `packages/ai-client/package.json` (shape) | role-match (workspace shape) — diverges on `exports` map (sub-path) and `tsup` build; no in-repo workspace currently uses `tsup` |
| `packages/coach-sdk/tsup.config.ts` | bundler config | TS src → ESM+CJS+.d.ts in `dist/` | none in repo | **novel** — copy from RESEARCH §4.2 verbatim |
| `packages/coach-sdk/tsconfig.json` | TS compiler config | TS → type-check only | `backend/api` tsconfig pattern (implicit) — moduleResolution:bundler matches `c:/ziko-web/tsconfig.json` | role-match |
| `packages/coach-sdk/vitest.config.ts` | test config | test/*.spec.ts → vitest run | `backend/api/vitest.config.ts` | **exact** (shape) |
| `packages/coach-sdk/src/index.ts` | barrel module | re-exports schemas + types | none — trivial 2-line file | novel-trivial |
| `packages/coach-sdk/src/schemas/index.ts` | barrel module | re-exports 3 Zod schemas | none — trivial | novel-trivial |
| `packages/coach-sdk/src/schemas/imported-program.ts` | zod schema module | object → Zod parse → typed | DB columns in `036_workout_programs_ai_imports.sql` + Phase 22 D-11 | role-match (DDL → Zod mirror) |
| `packages/coach-sdk/src/schemas/coach-client-link.ts` | zod schema module | object → Zod parse → typed | `035_coach_invitations_links_rls.sql` rows 43–51 | role-match (DDL → Zod mirror) |
| `packages/coach-sdk/src/schemas/coach-profile.ts` | zod schema module | object → Zod parse → typed | `034_coach_role_profiles.sql` rows 29–41 | role-match (DDL → Zod mirror) |
| `packages/coach-sdk/src/types/index.ts` | type re-export module | `z.infer<typeof S>` → exported types | none — pattern is canonical Zod usage | novel-trivial |
| `packages/coach-sdk/test/schemas.spec.ts` | unit test | golden inputs → safeParse assertions | `backend/api/test/rls/coach-rls.spec.ts` (fixture shape) | partial — same vitest shape, no admin client needed |
| `apps/web/` (move from `c:/ziko-web/`) | migrated workspace | git subtree merge | none (one-time op) | spike — RESEARCH §1 verbatim |
| `apps/web/middleware.ts` (MODIFY existing) | edge middleware | NextRequest → updateSession → next-intl OR supaResponse | `c:/ziko-web/middleware.ts` (4-line existing) | **exact** (composes the existing call site) |
| `apps/web/src/lib/supabase/middleware.ts` | factory module (edge) | NextRequest → cookie refresh → NextResponse | `c:/ziko-web/src/lib/supabase/admin.ts` (server-only discipline pattern) | partial — shares `server-only`/no-client discipline, different surface |
| `apps/web/src/lib/supabase/server.ts` | factory module (RSC) | next/headers cookies → SupabaseClient | `c:/ziko-web/src/lib/supabase/admin.ts` | partial — `import 'server-only'` discipline matches |
| `apps/web/src/lib/supabase/client.ts` | factory module (browser) | env → SupabaseClient | none — single-line wrapper | novel-trivial (RESEARCH §3 code-example 4) |
| `apps/web/src/lib/supabase/admin.ts` | legacy factory (preserved verbatim) | env → service-role SupabaseClient | `c:/ziko-web/src/lib/supabase/admin.ts` | **exact (no-op preservation)** |
| `apps/web/src/lib/supabase/__tests__/factories.spec.ts` | unit test (web) | mocked next/headers → factory invocation | `backend/api/test/rls/coach-rls.spec.ts` shape | partial — different mocking surface |
| `apps/web/src/app/[locale]/(coach)/layout.tsx` | server component (layout guard) | cookies → getUser → redirect OR children | none in repo | **novel** — RESEARCH §0 architecture diagram |
| `apps/web/src/app/[locale]/(coach)/_smoke/page.tsx` | server component | createServerSupabase → getUser → JSX | RESEARCH §Code Example 5 | novel — RESEARCH code-example only |
| `apps/web/src/app/[locale]/(coach)/_smoke/action.ts` | server action | cookies → getUser → JSON result | `c:/ziko-web/src/actions/account.ts` | role-match (Server Action shape) |
| `apps/web/src/app/[locale]/(coach)/_smoke/SmokeButton.tsx` | client component | onClick → server action → display | none in repo | novel-trivial |
| `apps/web/src/app/api/_debug/limits/route.ts` | route handler | env-gated → sleep 30s → JSON | `c:/ziko-web/src/actions/account.ts` (env-gated guard pattern) | partial — runtime config (`maxDuration`) is new |
| `apps/web/eslint.config.mjs` (MODIFY existing) | ESLint flat config | source files → lint diagnostics | `c:/ziko-web/eslint.config.mjs` (base to extend) | **exact** (extension target) |
| `apps/web/next.config.ts` (MODIFY existing) | Next.js config | env ANALYZE=true → bundle-analyzer wrap | `c:/ziko-web/next.config.ts` (current next-intl wrap) | **exact** (composition target) |
| `apps/web/vercel.json` | Vercel project config | git diff → ignoreCommand exit code | `backend/api/vercel.json` | role-match (shape) |
| `backend/api/vercel.json` (MODIFY existing) | Vercel project config | git diff → ignoreCommand exit code | self (add one field) | **exact** |
| `.github/workflows/ci.yml` (MODIFY existing) | CI workflow | PR/push → 4 jobs (type-check/lint/test, grep, bundle, zod-drift) | `.github/workflows/ci.yml` + `.github/workflows/test-rls.yml` (grep guard pattern) | **exact** (extension target) |
| `.github/workflows/publish-coach-sdk.yml` | CI workflow (insurance) | path filter `packages/coach-sdk/**` → conditional publish | `.github/workflows/test-rls.yml` (path-filter shape) | partial |

## Pattern Assignments

### `packages/coach-sdk/package.json` (workspace package config, build → dist/*)

**Analog:** `packages/plugin-sdk/package.json` (shape/scripts) + `packages/ai-client/package.json` (workspace `*` linkage)

**Existing pattern — workspace package shape** (`packages/plugin-sdk/package.json` lines 1–24):
```json
{
  "name": "@ziko/plugin-sdk",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "echo 'lint: no eslint config, skipped'"
  },
  "devDependencies": { "typescript": "^5.7.0" },
  "peerDependencies": { "react": ">=18.0.0" }
}
```

**Deviations (locked by RESEARCH §4.1):**
- `main`/`module`/`types` point at `dist/index.{cjs,mjs,d.ts}` (built output), not `src/` — because coach-sdk is consumed by **3 bundlers** (web RSC, Hono backend, Metro RN); pre-built dual format avoids each bundler re-transpiling TS.
- `exports` is a **sub-path map** (`.`, `./schemas`, `./types`) per D-06 — enables `import {…} from '@ziko/coach-sdk/schemas'` tree-shaking.
- Adds `"build": "tsup"`, `"test": "vitest run --passWithNoTests"`, `"clean": "rm -rf dist"` scripts.
- `peerDependencies: { zod: "^4.0.0" }` (D-08) — prevents drift across 3 consumers.
- Includes `"files": ["dist"]` (publish surface for D-04 insurance).

---

### `packages/coach-sdk/tsup.config.ts` (bundler config, TS → dual ESM/CJS/.d.ts)

**Analog:** none — no in-repo workspace currently uses `tsup`.

**Action:** Copy verbatim from RESEARCH §4.2. Key invariants:
- `entry: ['src/index.ts', 'src/schemas/index.ts', 'src/types/index.ts']` — must produce `dist/schemas/index.{mjs,cjs,d.ts}` to match `exports` map.
- `external: ['zod']` (D-08 + Pitfall 6) — zod is a peerDep, not bundled.
- `format: ['esm', 'cjs']`, `dts: true`, `clean: true`, `splitting: false`.

---

### `packages/coach-sdk/vitest.config.ts` (test config, mirrors backend pattern)

**Analog:** `backend/api/vitest.config.ts`

**Existing pattern** (`backend/api/vitest.config.ts` lines 1–17):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{spec,test}.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    reporters: 'default',
  },
});
```

**Deviations (RESEARCH §4.7):**
- **Remove** `setupFiles` — coach-sdk schemas are pure functions; no env/admin-client bootstrap needed.
- **Remove** `fileParallelism: false`/`sequence` — no auth.users mutation race.
- **Reduce** `testTimeout`/`hookTimeout` from 30s to 10s — pure Zod parse is microsecond-fast.
- Keep `environment: 'node'`, `include: ['test/**/*.{spec,test}.ts']`, `reporters: 'default'` verbatim.

---

### `packages/coach-sdk/src/schemas/imported-program.ts` (Zod schema for `weeks_data` JSONB)

**Analog:** Migration `036_workout_programs_ai_imports.sql` line 24 (`weeks_data JSONB`) + Phase 22 D-11 (Zod is the only guard — no DB CHECK).

**Source of truth:** RESEARCH §5.1 has the verbatim schema. Composed of `ExerciseSchema` → `SessionSchema` → `WeekSchema` → top-level `ImportedProgramSchema`. All `.strict()`. Top-level has 9 fields (`name`, `description`, `goal`, `equipment`, `weeks`, `source`, `overall_confidence`, with nested `weeks: z.array(WeekSchema).min(1).max(30)` per IMPORT-07).

**Deviations:** none — schema IS the source of truth per Phase 22 D-11.

---

### `packages/coach-sdk/src/schemas/coach-client-link.ts` (Zod schema for `coach_client_links`)

**Analog:** Migration `035_coach_invitations_links_rls.sql` rows 43–51 (`coach_client_links` table — 6 columns).

**Source of truth:** RESEARCH §5.2 verbatim. Six fields (`id`, `coach_id`, `client_id`, `expires_at` nullable, `revoked_at` nullable, `created_at`), all UUIDs/ISO datetimes, `.strict()` with `.refine()` enforcing `coach_id !== client_id` (matches the DB CHECK). Also exports `isLinkActive(link, now)` predicate (D-01 active-link semantics).

**Deviations:** none.

---

### `packages/coach-sdk/src/schemas/coach-profile.ts` (Zod schema for `coach_profiles`)

**Analog:** Migration `034_coach_role_profiles.sql` rows 29–41 (`coach_profiles` table — 10 columns per Phase 22 D-05).

**Source of truth:** RESEARCH §5.3 verbatim. Three exported schemas: `CoachKycStatusSchema` (enum: pending/submitted/verified/rejected), `CoachKycDocSchema` (type/url/uploaded_at/filename), `CoachProfileSchema` (10 fields, all `.strict()`). `specialties: z.array(...).max(20)`, `kyc_docs: z.array(CoachKycDocSchema)`.

**Deviations:** none.

---

### `packages/coach-sdk/src/types/index.ts` (z.infer type re-exports)

**Analog:** canonical Zod pattern — `z.infer<typeof Schema>` per RESEARCH §4.6.

```typescript
import type { z } from 'zod';
import type {
  ImportedProgramSchema,
  CoachClientLinkSchema,
  CoachProfileSchema,
} from '../schemas/index.js';

export type ImportedProgram = z.infer<typeof ImportedProgramSchema>;
export type CoachClientLink = z.infer<typeof CoachClientLinkSchema>;
export type CoachProfile = z.infer<typeof CoachProfileSchema>;
```

**Deviations:** `import type` (not `import`) so the `types` sub-path bundle stays purely type-only; tsup will emit only `.d.ts` for this file when consumed via `./types`.

---

### `packages/coach-sdk/test/schemas.spec.ts` (golden parse/safeParse)

**Analog:** `backend/api/test/rls/coach-rls.spec.ts` (Vitest fixture shape)

**Existing pattern** (`backend/api/test/rls/coach-rls.spec.ts` lines 1, 62–79 — fixture + `describe`/`it`/`expect` shape):
```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// ...
describe('coach RLS — 4 mandated cases + additional scenarios', () => {
  it('linked client: coach reads habit_logs → rows returned …', async () => {
    const { data, error } = await coach.client.from('habit_logs').select('id')...;
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });
});
```

**Deviations (RESEARCH §4.8):**
- **No** `beforeAll`/`afterAll` (no auth.users to create/clean).
- **No** admin client import — pure schema parsing.
- Uses `Schema.safeParse(input)` → `expect(r.success).toBe(true/false)`.
- Adds `expect(r.error).toBeInstanceOf(z.ZodError)` cross-boundary instanceof check (Pitfall 6 — proves single zod resolution).
- 3 `describe` blocks (one per schema), 6+ `it` cases total.

---

### `apps/web/middleware.ts` (composed Supabase + next-intl middleware) — MODIFY EXISTING

**Analog:** `c:/ziko-web/middleware.ts` (existing 4-line file — base to wrap)

**Existing (verbatim, `c:/ziko-web/middleware.ts` lines 1–12):**
```typescript
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    '/',
    '/(fr|en)/:path*',
    '/((?!_next|_vercel|.*\\..*).*)'
  ]
};
```

**Deviations (RESEARCH §3 + D-10 locked):**
- Convert the default export from a direct `createMiddleware(routing)` call to a wrapper function. `createMiddleware(routing)` becomes `const intlMiddleware = createIntlMiddleware(routing);`.
- New default-export async function: (1) `await updateSession(request)` FIRST, (2) `if (/^\/(fr|en)\/coach(\/|$)/.test(pathname)) return supaResponse`, (3) else `return intlMiddleware(request)`.
- **Matcher gains `api`** in negative lookahead (`/((?!_next|_vercel|api|.*\\..*).*)`) — locks `api` routes out so `/api/_debug/limits` is not double-middlewared (RESEARCH §3).
- Imports `updateSession` from new file `./src/lib/supabase/middleware`.

---

### `apps/web/src/lib/supabase/middleware.ts` (updateSession factory — NEW)

**Analog:** `c:/ziko-web/src/lib/supabase/admin.ts` (closest in the repo for the **server-only-factory** discipline)

**Existing discipline pattern** (`c:/ziko-web/src/lib/supabase/admin.ts` lines 1–16):
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

**Deviations (RESEARCH §2 — Context7 2026-05 canonical):**
- **NOT** `import 'server-only'` — middleware runs in Edge/Node middleware runtime, not RSC. (Server-only is for `server.ts`, not this file.)
- Imports `createServerClient` from `@supabase/ssr` (not `createClient` from `@supabase/supabase-js`).
- Uses `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (not service role).
- Exports `async function updateSession(request: NextRequest): Promise<NextResponse>`.
- Implements the **dual-store cookie mirror** pattern (Pitfall 1) — `setAll` mirrors writes to BOTH `request.cookies.set(...)` AND `response.cookies.set(...)`, rebuilding response via `NextResponse.next({ request })` between mirrors.
- Calls `await supabase.auth.getUser()` to trigger refresh — **no try/catch** (Pitfall 1 anti-pattern).

---

### `apps/web/src/lib/supabase/server.ts` (createServerSupabase for RSC/Actions)

**Analog:** `c:/ziko-web/src/lib/supabase/admin.ts` (server-only discipline)

**Reused from analog:**
```typescript
import 'server-only';
```

**Deviations (RESEARCH §2 code example 3):**
- Uses `createServerClient` from `@supabase/ssr` + `cookies` from `next/headers`.
- `cookies()` is awaited (Next 15 async dynamic API).
- `setAll` callback wraps `cookieStore.set(...)` in try/catch — Server Components cannot write cookies; the try/catch is **intentional no-op** (middleware refreshes; per RESEARCH anti-pattern list, Server Components MAY read but not WRITE cookies).
- Uses anon key, not service role.

---

### `apps/web/src/lib/supabase/client.ts` (createClientSupabase for browser)

**Analog:** none — single-purpose 6-line wrapper.

**Source of truth:** RESEARCH §Code Example 4. `import { createBrowserClient } from '@supabase/ssr'` + env vars; **no** `'server-only'` (this is the only file in `lib/supabase/` that runs in the browser).

---

### `apps/web/src/lib/supabase/admin.ts` (legacy service-role — PRESERVE VERBATIM)

**Analog:** `c:/ziko-web/src/lib/supabase/admin.ts` (itself)

**Action:** **No edits.** File survives the `git subtree` move verbatim. Goes onto ESLint allowlist (D-11) so `@supabase/supabase-js` import does not lint-fail.

**Deviations:** none. Phase 24 MUST NOT extend this pattern (legacy GDPR delete only).

---

### `apps/web/src/lib/supabase/__tests__/factories.spec.ts` (unit tests for factories)

**Analog:** `backend/api/test/rls/coach-rls.spec.ts` (Vitest shape — describe/it/expect)

**Deviations:**
- **No** admin client / no `auth.users` fixtures.
- Mocks `next/headers` via `vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }) }))`.
- Asserts (a) `updateSession(mockedNextRequest)` returns a `NextResponse` instance, (b) `createServerSupabase()` returns a client with `.auth.getUser` method.
- Used for SC2 row in RESEARCH §10 — "updateSession returns NextResponse".

---

### `apps/web/src/app/[locale]/(coach)/layout.tsx` (server-component layout guard)

**Analog:** none in repo — novel pattern.

**Source of truth:** RESEARCH "Architecture Diagram" + D-13. Calls `createServerSupabase()`, then `const { data: { user } } = await supabase.auth.getUser()`. If `!user` → `redirect('/fr/login')` (Phase 24 ships `/fr/login`; Phase 23 redirect target is intentionally a 404 placeholder). Declares `export const dynamic = 'force-dynamic'; export const revalidate = 0;` per D-09 + ARCH-06. Renders `{children}`.

**Deviations:** none — write verbatim from RESEARCH; do NOT use `searchParams.next` (RESEARCH Security Domain — open-redirect mitigation).

---

### `apps/web/src/app/[locale]/(coach)/_smoke/page.tsx` (server component)

**Analog:** RESEARCH §Code Example 5 — verbatim.

**Source of truth:**
```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { createServerSupabase } from '@/lib/supabase/server';
import { SmokeButton } from './SmokeButton';

export default async function SmokePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main style={{ padding: 24 }}>
      <h1>Phase 23 smoke route</h1>
      <p>Signed in as <code>{user!.id}</code></p>
      <SmokeButton />
    </main>
  );
}
```

**Deviations:** none. `user!.id` non-null assertion is safe because the parent layout already redirected on null.

---

### `apps/web/src/app/[locale]/(coach)/_smoke/action.ts` (Server Action — re-check layer)

**Analog:** `c:/ziko-web/src/actions/account.ts` (existing Server Action — shape for `'use server'` + admin-client invocation)

**Existing pattern** (`c:/ziko-web/src/actions/account.ts` lines 1–10, 44–98 — `'use server'` directive, return-state shape):
```typescript
'use server';

import { headers } from 'next/headers';
import { ratelimit } from '@/lib/ratelimit';
import { createAdminClient } from '@/lib/supabase/admin';

export type DeleteAccountState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export async function deleteAccount(prevState: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  // …rate limit, validate, find user, delete
}
```

**Deviations (RESEARCH §Code Example 6):**
- **No** `createAdminClient` import — Server Action uses cookie-bound `createServerSupabase` from `@/lib/supabase/server`, NOT service role.
- **No** rate limiting (Phase 25 territory; smoke is dev-only).
- **No** `FormData` parameter — simple parameterless `smokeReCheck()` invoked by client `<SmokeButton/>`.
- Returns `{ ok: true, userId, ts }` or `{ ok: false, error }` discriminated union (vs analog's `{ status, message }`).
- Re-calls `supabase.auth.getUser()` — this IS the ARCH-05 layer-3 re-check (Pitfall 7 mitigation).

---

### `apps/web/src/app/[locale]/(coach)/_smoke/SmokeButton.tsx` (client component)

**Analog:** none — trivial click-handler component.

**Source of truth:** `'use client'`, imports `smokeReCheck` from `./action`, button onClick → `await smokeReCheck()` → `useState` to render JSON. Plain inline styles per project convention (no NativeWind — web uses Tailwind v4 or inline style).

---

### `apps/web/src/app/api/_debug/limits/route.ts` (route handler — Vercel Pro probe)

**Analog:** `c:/ziko-web/src/actions/account.ts` (env-gated guard pattern is the closest in-repo behavioral analog — both gate behavior on a server-side condition).

**Source of truth (RESEARCH §Code Example 7):**
```typescript
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  if (process.env.DEBUG_LIMITS !== 'on') {
    return new Response('Not Found', { status: 404 });
  }
  await new Promise((r) => setTimeout(r, 30_000));
  return Response.json({ ok: true, tier: 'pro-confirmed', durationSec: 30 });
}
```

**Deviations:** `maxDuration = 60` is novel in this repo (no other Vercel route declares it). Set `DEBUG_LIMITS=on` env on **preview** scope ONLY (not production). Route is deletable as Phase 24's first task.

---

### `apps/web/eslint.config.mjs` (D-11 + D-12 rules layered) — MODIFY EXISTING

**Analog:** `c:/ziko-web/eslint.config.mjs` (existing flat config — base to extend)

**Existing (verbatim, `c:/ziko-web/eslint.config.mjs` lines 1–25):**
```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
```

**Deviations (RESEARCH §7.1):**
- Insert a new config block AFTER the `compat.extends(...)` spread and BEFORE the `ignores` block, with:
  - `rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@supabase/supabase-js', message: '…' }, { name: '@supabase/auth-helpers-nextjs', message: '…' }], patterns: [{ group: ['**/coach/*/db/**'], … }, { group: ['**/coach/*/internal/**'], … }] }] }`.
- Insert a SECOND new config block with `files: ['src/lib/supabase/admin.ts', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}']` and `rules: { 'no-restricted-imports': 'off' }` — the allowlist (D-11).
- Insert a THIRD block with `files: ['**/coach/*/service.ts']` and `rules: { 'no-restricted-imports': 'off' }` — Phase 24+ activation (no matches in Phase 23 — safe to ship now).
- Keep `ignores` block unchanged.

---

### `apps/web/next.config.ts` (bundle-analyzer wrap) — MODIFY EXISTING

**Analog:** `c:/ziko-web/next.config.ts` (existing next-intl wrap — base to extend)

**Existing (verbatim, `c:/ziko-web/next.config.ts` lines 1–7):**
```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {};

export default withNextIntl(nextConfig);
```

**Deviations (RESEARCH §8.2):**
- Add `import withBundleAnalyzer from '@next/bundle-analyzer';`
- Add `const analyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true', openAnalyzer: false, analyzerMode: 'static', generateStatsFile: true, statsFilename: 'stats.json' });`
- Change export from `withNextIntl(nextConfig)` to `analyzer(withNextIntl(nextConfig))` — analyzer is the OUTERMOST wrap.
- `generateStatsFile: true` is **load-bearing** — produces the `.next/analyze/stats.json` artifact that D-02 step 3 greps for `react-native(?!-web)`.

---

### `apps/web/vercel.json` (Vercel project A config — NEW)

**Analog:** `backend/api/vercel.json`

**Existing pattern** (`backend/api/vercel.json` lines 1–16):
```json
{
  "buildCommand": "",
  "rewrites": [{ "source": "/(.*)", "destination": "/api/app" }],
  "crons": [
    { "path": "/supplements/cron/scrape", "schedule": "0 3 * * 1" },
    { "path": "/storage/cron/cleanup", "schedule": "0 4 * * *" }
  ]
}
```

**Deviations (RESEARCH §6.1):**
- **Different fields:** `framework: "nextjs"`, `buildCommand: "cd ../.. && turbo run build --filter=web"`, `installCommand: "cd ../.. && npm install"`, `outputDirectory: ".next"` — Next.js-specific.
- **No** `rewrites`/`crons` (those are Hono-specific).
- **Add** `ignoreCommand: "git diff --quiet HEAD^ HEAD -- ."` (D-14 — Pitfall 4 — must be combined with Vercel dashboard "Root Directory = `apps/web`").

---

### `backend/api/vercel.json` (MODIFY — add ignoreCommand)

**Analog:** itself (single-field addition)

**Existing (verbatim):**
```json
{
  "buildCommand": "",
  "rewrites": [{ "source": "/(.*)", "destination": "/api/app" }],
  "crons": [
    { "path": "/supplements/cron/scrape", "schedule": "0 3 * * 1" },
    { "path": "/storage/cron/cleanup", "schedule": "0 4 * * *" }
  ]
}
```

**Deviation:** Add single field `"ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."` per RESEARCH §6.2. Identical command to `apps/web/vercel.json`; the Vercel-dashboard Root Directory difference (`backend/api` here, `apps/web` there) makes each project's diff scoped to its own root.

---

### `.github/workflows/ci.yml` (extend existing) — MODIFY

**Analog:** `.github/workflows/ci.yml` (existing 3-job workflow) + `.github/workflows/test-rls.yml` (grep-guard pattern at lines 55–60)

**Existing pattern A** (`.github/workflows/ci.yml` lines 1–28):
```yaml
name: CI
on:
  push:
    branches: [main]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - name: Install dependencies
        run: npm ci
      - name: Type-check
        run: npm run type-check
      - name: Lint
        run: npm run lint
```

**Existing pattern B — grep guard** (`.github/workflows/test-rls.yml` lines 55–60):
```yaml
- name: Guard — no service-role references under src/
  run: |
    if grep -rE 'SUPABASE_SERVICE_ROLE_KEY|service[_-]role' backend/api/src/ ; then
      echo "::error::service-role reference detected under backend/api/src/. ARCH-03 violation."
      exit 1
    fi
```

**Deviations (RESEARCH §9):**
- **Extend `on:` trigger** to include `pull_request: branches: [main]` and `fetch-depth: 2` on checkout (for `git diff HEAD^ HEAD`).
- Switch root-level `npm run type-check`/`npm run lint` to `npx turbo run type-check` / `npx turbo run lint` / `npx turbo run test` so all workspaces are covered (including new `apps/web` and `packages/coach-sdk`).
- **Add Job 2** — `no-service-role-in-coach`: grep guard on `backend/api/src/coach/` (mirrors pattern B but scoped to coach/, with a `[ -d backend/api/src/coach ]` directory existence check for Phase 23 where the dir doesn't exist yet).
- **Add Job 3** — `bundle-hygiene`: runs `ANALYZE=true npx turbo run build --filter=web`, then greps `apps/web/.next/analyze/stats.json` for `"name":\s*"[^"]*react-native(?!-web)` (D-02 step 3 — HARD gate).
- **Add Job 4** — `zod-drift`: `node -e "require.resolve('zod')"` vs `node -e "require.resolve('zod', { paths: ['packages/coach-sdk'] })"` — paths must match (D-08 / Pitfall 6).
- Keep existing `deploy-backend` + `migrate-supabase` jobs unchanged.

---

### `.github/workflows/publish-coach-sdk.yml` (D-04 insurance — NEW)

**Analog:** `.github/workflows/test-rls.yml` (path-filter trigger pattern, lines 12–19):
```yaml
on:
  pull_request:
    paths:
      - 'supabase/migrations/**'
      - 'backend/api/test/rls/**'
  workflow_dispatch:
```

**Deviations (RESEARCH §12.2):**
- Trigger on `push: branches: [main]` with `paths: ['packages/coach-sdk/**']` + `workflow_dispatch`.
- **Conditional publish:** `if: ${{ vars.PUBLISH_COACH_SDK == 'true' }}` — ships disabled on monorepo path; flipping the repo var activates dual-repo insurance without code change.
- Auth step writes `.npmrc` with `@ziko:registry=https://npm.pkg.github.com` + `${{ secrets.GITHUB_TOKEN }}`.
- Build via `npm run build --workspace=@ziko/coach-sdk`, publish via `npm publish --workspace=@ziko/coach-sdk`.

---

## Shared Patterns

### Server-only discipline
**Source:** `c:/ziko-web/src/lib/supabase/admin.ts` line 1 (`import 'server-only';`)
**Apply to:**
- `apps/web/src/lib/supabase/server.ts` — REQUIRED (RSC factory must not bleed into client bundles)
- `apps/web/src/lib/supabase/admin.ts` — PRESERVED (already has it)
- `apps/web/src/lib/supabase/middleware.ts` — NOT required (middleware runtime, not RSC)
- `apps/web/src/lib/supabase/client.ts` — NOT applied (browser runtime)

### Force-dynamic + revalidate=0 (ARCH-06)
**Source:** RESEARCH §Code Example 5 (smoke page), §Code Example 7 (debug route)
**Apply to:** every page/route under `apps/web/src/app/[locale]/(coach)/**/*.tsx` AND `apps/web/src/app/api/_debug/limits/route.ts`
```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```
**Validation:** SC5 grep — `grep -L 'force-dynamic' apps/web/src/app/\[locale\]/\(coach\)/**/page.tsx` must list zero files.

### Zod `.strict()` everywhere
**Source:** RESEARCH §5.1, §5.2, §5.3
**Apply to:** every Zod schema in `packages/coach-sdk/src/schemas/*.ts` — `.strict()` rejects unknown keys (defense against schema drift / forged AI imports).

### Vitest config minimal shape
**Source:** `backend/api/vitest.config.ts`
**Apply to:** `packages/coach-sdk/vitest.config.ts`
- Always `environment: 'node'`, `reporters: 'default'`
- Always include `'test/**/*.{spec,test}.ts'`
- Strip `setupFiles`/`fileParallelism` unless the suite mutates `auth.users` (coach-sdk does not — pure functions).

### `'use server'` directive + typed return state
**Source:** `c:/ziko-web/src/actions/account.ts` lines 1, 7–10
**Apply to:** all server actions in `apps/web/src/app/**/action.ts`
```typescript
'use server';
// …
export async function actionName(...): Promise<TypedResult> { … }
```

### CI grep guard pattern (architectural enforcement)
**Source:** `.github/workflows/test-rls.yml` lines 55–60
**Apply to:** new `no-service-role-in-coach` job in `.github/workflows/ci.yml`
```yaml
- name: Guard — no SERVICE_ROLE under coach/
  run: |
    if [ -d backend/api/src/coach ]; then
      if grep -r 'SERVICE_ROLE' backend/api/src/coach/; then
        echo "::error::ARCH-02 violation"
        exit 1
      fi
    fi
```

### ESLint flat config extension via FlatCompat
**Source:** `c:/ziko-web/eslint.config.mjs` lines 1–10 (the `FlatCompat` setup + `compat.extends(...)` spread)
**Apply to:** `apps/web/eslint.config.mjs` after migration — layer `rules` and `files`-scoped allowlist objects after the spread, before the `ignores` block.

---

## No Analog Found

Files with no close in-repo match — planner writes from RESEARCH verbatim:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/coach-sdk/tsup.config.ts` | bundler config | TS src → ESM+CJS+.d.ts | No existing workspace uses `tsup`. Copy from RESEARCH §4.2. |
| `packages/coach-sdk/src/index.ts` | barrel | 2-line re-export | Trivial; canonical Zod monorepo pattern. |
| `packages/coach-sdk/src/schemas/index.ts` | barrel | 3-line re-export | Trivial. |
| `apps/web/src/lib/supabase/client.ts` | browser factory | env → SupabaseClient | 6-line `createBrowserClient` wrapper; no in-repo browser-side Supabase factory exists. |
| `apps/web/src/app/[locale]/(coach)/layout.tsx` | layout guard | cookies → getUser → redirect | First instance of a server-component auth guard in this repo. |
| `apps/web/src/app/[locale]/(coach)/_smoke/SmokeButton.tsx` | client component | onClick → server action | Trivial `'use client'` button + useState; no in-repo equivalent. |

For each: planner copies the relevant RESEARCH §code-example verbatim into the action section of the corresponding PLAN.md task.

---

## Metadata

**Analog search scope:** `packages/`, `backend/api/`, `.github/workflows/`, `c:/ziko-web/` (source repo being onboarded), `supabase/migrations/` (DDL for Zod source-of-truth).
**Files scanned:** `packages/plugin-sdk/package.json`, `packages/ai-client/package.json`, `backend/api/package.json`, `backend/api/vitest.config.ts`, `backend/api/vercel.json`, `backend/api/test/setup.ts`, `backend/api/test/rls/coach-rls.spec.ts`, `.github/workflows/ci.yml`, `.github/workflows/test-rls.yml`, `c:/ziko-web/package.json`, `c:/ziko-web/middleware.ts`, `c:/ziko-web/eslint.config.mjs`, `c:/ziko-web/next.config.ts`, `c:/ziko-web/tsconfig.json`, `c:/ziko-web/src/lib/supabase/admin.ts`, `c:/ziko-web/src/actions/account.ts`, `c:/ziko-web/src/i18n/routing.ts`. RESEARCH.md §§1–12 + Code Examples 1–7.
**Pattern extraction date:** 2026-05-14

## PATTERN MAPPING COMPLETE
