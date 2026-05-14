# Phase 23: Web Turborepo Onboarding & Auth Bootstrap — Research

**Researched:** 2026-05-14
**Domain:** Next.js 15 monorepo onboarding + `@supabase/ssr` layered auth + shared Zod SDK + Vercel multi-project + bundle hygiene
**Confidence:** HIGH (Supabase SSR pattern, next-intl composition, tsup config, package.json conventions verified via Context7 + on-disk audit) · MEDIUM (`@next/bundle-analyzer` Turbopack compatibility — verified by version check but recommend smoke test in spike) · LOW (none — Phase 23 is plumbing, no novel territory)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Spike & Integration**
- **D-01** — Spike scope: full move + smoke. The spike attempts the real `apps/web` move (git mv from `c:/ziko-web` with subtree history preservation), wires `next-intl` + `@supabase/ssr` middleware composition, ships `/fr/coach/_smoke` route calling `supabase.auth.getUser()`, and runs `apps/mobile` build to detect RN/web cross-contamination.
- **D-02** — Go/no-go: **triple-green checklist**. Monorepo wins iff ALL three are green: (1) `turbo run build --filter=web` succeeds; (2) `cd apps/mobile && npx expo prebuild --clean` still succeeds; (3) bundle analysis shows zero `react-native(?!-web)` modules in web client bundle. Any red → fall back to dual-repo per D-04.
- **D-03** — Migration: `git mv` preserving history via `git subtree add --prefix=apps/web <ziko-web-remote> main` OR `git filter-repo --to-subdirectory-filter apps/web` on a clone, then merge.
- **D-04** — Dual-repo fallback: publish `@ziko/coach-sdk` to GitHub Packages (private scoped). **Ship the GHA release workflow even on monorepo path** as low-cost insurance.

**coach-sdk Packaging**
- **D-05** — Build output: `tsup` → dual ESM + CJS + `.d.ts`. Entries: `src/index.ts`, `src/schemas/index.ts`, `src/types/index.ts`. `external: ['zod']`.
- **D-06** — Exports surface: sub-path exports — `.`, `./schemas`, `./types`. Each maps to ESM + CJS + types.
- **D-07** — Supabase client factories live in `apps/web/src/lib/supabase/` ONLY. `coach-sdk` does NOT export `createBrowserClient` / `createServerClient`. coach-sdk stays bundler-agnostic: Zod schemas + pure TS types only.
- **D-08** — Zod `peerDependency: "^4.0.0"` + matching devDependency. Root already pins `zod@^4.3.6`.

**Auth + i18n + ESLint**
- **D-09** — `(coach)` route position: inside `[locale]` → `app/[locale]/(coach)/...`. All `(coach)` pages declare `export const dynamic = 'force-dynamic'; export const revalidate = 0;` + `cache: 'no-store'` on Supabase reads.
- **D-10** — `middleware.ts` composition: Supabase-first (`updateSession`), then `next-intl` delegated. Matcher: `['/', '/(fr|en)/:path*', '/((?!_next|_vercel|api|.*\\..*).*)']`.
- **D-11** — ESLint ban on `@supabase/supabase-js`: strict via `no-restricted-imports`. Allowlist: `src/lib/supabase/admin.ts`, `**/*.test.ts`, `**/*.spec.ts`. Errors (not warnings).
- **D-12** — ARCH-02 enforcement: ESLint `no-restricted-imports` on `**/coach/*/db/**` and `**/coach/*/internal/**` (activates Phase 24+) + CI grep step `grep -r 'SERVICE_ROLE' backend/api/src/coach/`.

**Thin Slice + Vercel + Tests**
- **D-13** — Phase 23 thin slice: `/fr/coach/_smoke/` — `page.tsx` (Server Component) + `action.ts` (Server Action) + `SmokeButton.tsx` (client). Layout (`app/[locale]/(coach)/layout.tsx`) guards with `getUser()` → `redirect()`. Exercises all 3 ARCH-05 layers. **Deleted as first task of Phase 24.**
- **D-14** — Vercel topology: two projects. Project A `ziko-web` (root `apps/web`); Project B `ziko-api-lilac` (root `backend/api`, existing). Each ignores changes outside its root via `vercel.json` `ignoreBuildStep`.
- **D-15** — Vercel Pro proof: `/api/_debug/limits` route, gated by `process.env.DEBUG_LIMITS === 'on'`, `maxDuration = 60`, sleeps 30s then returns `{ ok: true, tier: 'pro-confirmed' }`. **Removed in Phase 24.**
- **D-16** — Tests: Vitest unit (`packages/coach-sdk/test/schemas.spec.ts`, `apps/web/src/lib/supabase/__tests__/factories.spec.ts`) + `turbo run type-check` + `turbo run lint` + CI grep + smoke deploy curl. **No Playwright** in Phase 23.

**Icon Library**
- **D-17** — `react-icons@^5.6.0` locked. Audit of `c:/ziko-web/package.json` confirms `react-icons: ^5.6.0` already installed. No migration.

### Claude's Discretion
- Exact `git subtree`/`git filter-repo` command shape — researcher recommends. (Locked below in §1.)
- Exact `@supabase/ssr` `updateSession()` implementation — researcher locks against 2026-05 Context7 docs. (Locked below in §2.)
- Bundle-analyzer choice — researcher recommends and locks command + grep. (Locked below in §8.)
- Vercel `vercel.json` ignored-build-step script — researcher locks both projects. (Locked below in §6.)
- `.npmrc` shape for GitHub Packages — researcher locks (D-04 insurance path). (Locked below in §12.)
- Whether `apps/web/eslint.config.mjs` extends migrated base — researcher locks: extend the migrated `c:/ziko-web/eslint.config.mjs`, layer D-11/D-12 on top. (Locked below in §7.)
- Vitest config location for `coach-sdk` — researcher locks: `packages/coach-sdk/vitest.config.ts` mirroring `backend/api/vitest.config.ts` shape. (Locked below in §4.)

### Deferred Ideas (OUT OF SCOPE)
- GitHub Packages `.npmrc` activation (only needed if D-02 fails — workflow ships but publish step is conditional)
- Login / signup UI (Phase 24)
- Coach profile form, KYC upload (Phase 24)
- Mobile "Mon coach" code redemption (Phase 25)
- TanStack Table client list, signal filters (Phase 26)
- Program template authoring, `weeks_data` editor (Phase 27)
- AI import upload flow (Phase 28)
- `weeks_data JSONB` editor UI (Phase 27)
- lucide-react / @heroicons migration (revisit only if Phase 24 UI contract requires)
- Playwright E2E (Phase 24+)
- `_smoke` and `_debug/limits` deletion (Phase 24 first task)
- SEO / robots / sitemap on `(coach)` routes (Phase 31)
- Bundle size budgets / Lighthouse thresholds (post-v1.5)
- Strava callback host (Phase 30)
- Multi-tenant team coaches (v1.6+)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **ARCH-02** | Cross-module imports restricted to each module's `service.ts` — ESLint `no-restricted-imports` blocks direct `db/*` or `internal/*` imports. | §7 (ESLint `no-restricted-imports` rule with `**/coach/*/db/**` and `**/coach/*/internal/**` patterns + CI grep) |
| **ARCH-04** | `packages/coach-sdk` provides shared Zod schemas (`ImportedProgramSchema`, `CoachClientLinkSchema`, `CoachProfileSchema`) consumed by backend, web, mobile. | §4 + §5 (full package shape, three schemas mirroring migrations 034/035/036, sub-path exports, peerDep zod ^4) |
| **ARCH-05** | Next.js web app at `apps/web/` with `@supabase/ssr` cookie-based layered auth (middleware refresh + layout `getUser()` + Server Action re-check). | §1 (repository onboarding) + §2 (updateSession ref impl) + §3 (composed middleware) + §11 (spike) |
| **ARCH-06** | All `(coach)` web pages: `dynamic = 'force-dynamic'`, `revalidate = 0`, `cache: 'no-store'` on all Supabase reads. | §10.SC5 (validation grep) + §11.SC4 (smoke route asserts dynamic export) |
| **ARCH-08** | Vercel Pro tier enabled on both `apps/web/` and backend; `/coach/imports/:id/parse` has `maxDuration = 60`. | §6 (Vercel topology) + §11 (probe `/api/_debug/limits` confirms Pro) |
</phase_requirements>

## Summary

Phase 23 onboards a Next.js 15.5 + React 19 + Tailwind v4 + `next-intl` v4 web app from a separate repo (`c:/ziko-web`) into the ziko-platform Turborepo as `apps/web/`, scaffolds three-layer cookie auth via `@supabase/ssr@0.10.3`, and ships a new `packages/coach-sdk` workspace package containing the v1.5 Zod contracts (`ImportedProgramSchema`, `CoachClientLinkSchema`, `CoachProfileSchema`) consumed by web, backend, and mobile. The phase ships exactly one user-visible route (`/fr/coach/_smoke`) plus one dev-only probe (`/api/_debug/limits`), both deletable in Phase 24. Validation is Vitest unit + type-check + lint + CI grep + smoke-deploy curl — no Playwright.

**Primary recommendation:** Mirror existing workspace conventions (`packages/plugin-sdk`, `packages/ai-client`, `backend/api/vitest.config.ts`, `backend/api/vercel.json`) exactly. The user accepted the recommended option on 16/16 discuss-phase questions — that ratifies "match what exists" as the default. Use `git subtree add --prefix=apps/web` with a `--squash=false` parent commit (rollback tag `pre-web-onboarding` on `main` before the merge). Use `tsup` with the Phase 23 multi-entry config locked in §4. Compose the Supabase `updateSession` middleware against the canonical Context7 2026-05 Next 15 example (locked in §2) and chain `next-intl` after it via the single-handler pattern (locked in §3).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cookie-based session refresh | Frontend Server (Next.js middleware) | — | Cookie reads/writes need access to request+response; only the edge/middleware tier can refresh tokens for downstream Server Components |
| Coach UI rendering (`/fr/coach/*`) | Frontend Server (Next.js RSC) | — | Server-rendered, `force-dynamic`, reads via cookie-bound Supabase client |
| Auth re-verification (defense-in-depth) | Frontend Server (Server Action) | — | Phase 28+ mutations must re-call `getUser()` before persisting |
| Zod schema validation (`weeks_data`, `CoachProfile`, `CoachClientLink`) | Shared package (`@ziko/coach-sdk`) | All 3 consumers | Bundler-agnostic; one source of truth across web (RSC) / backend (Hono) / mobile (RN) |
| Legacy account-delete (RGPD) | Frontend Server (Server Action) | — | Already on web pre-v1.5; service-role client allowlisted, NOT moved into coach-sdk |
| i18n locale routing | Frontend Server (Next.js middleware) | — | `next-intl` middleware runs after Supabase refresh, handles `/fr`, `/en` prefixes |
| ESLint architectural enforcement | Build-time (ESLint flat config) | CI (grep guard) | Two-layer defense: ESLint catches at dev time, CI grep catches at PR time |
| Bundle hygiene (no `react-native` in web bundle) | Build-time (`@next/bundle-analyzer`) | CI (regex grep on artifact) | Web bundle MUST stay RN-free; root `react-native-worklets` hoisting risk |
| Vercel function timeout (Pro tier proof) | API / Backend (Route Handler) | — | `maxDuration=60` is a Vercel platform-tier feature, asserted via 30s sleep probe |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | `^0.10.3` | Cookie-based Supabase auth for Next.js App Router | Official Supabase package for SSR/RSC auth as of 2026-05; replaces `@supabase/auth-helpers-nextjs` (deprecated) [VERIFIED: `npm view @supabase/ssr version` → 0.10.3, 2026-05-14] |
| `@supabase/supabase-js` | `^2.100.1` | Underlying JS client (peer of `@supabase/ssr`) | Already in `c:/ziko-web` package.json; will be installed transitively via `@supabase/ssr` peer. Banned in web Server Components by D-11 [VERIFIED: c:/ziko-web/package.json line 12] |
| `next-intl` | `^4.8.3` | FR/EN i18n routing | Already installed in `c:/ziko-web`; Phase 23 only adds composition with Supabase middleware [VERIFIED: c:/ziko-web/package.json line 17] |
| `next` | `15.5.14` | Next.js App Router (Turbopack default) | Already pinned in `c:/ziko-web`; survives the move [VERIFIED: c:/ziko-web/package.json line 16] |
| `react` / `react-dom` | `19.1.0` | React 19 | Already pinned [VERIFIED: c:/ziko-web/package.json lines 18-19] |
| `tsup` | `^8.5.1` | coach-sdk dual ESM/CJS/.d.ts bundler | Standard for workspace TypeScript packages emitting both module formats [VERIFIED: `npm view tsup version` → 8.5.1, 2026-05-14] |
| `zod` | `^4.3.6` (root) / peerDep `^4.0.0` (coach-sdk) | Runtime schema validation | Root already pins zod 4.x. Mobile and backend both consume same major [VERIFIED: package.json line 41 + `npm view zod version` → 4.4.3, 2026-05-14] |
| `vitest` | `^3.2.4` | coach-sdk unit tests, mirrors `backend/api` | Same major as backend [VERIFIED: backend/api/package.json line 31] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@next/bundle-analyzer` | `^16.2.6` | Bundle analysis for D-02 step 3 | Wrap `next.config.ts` with `withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })` to emit `.next/analyze/client.json` for grep verification [VERIFIED: `npm view @next/bundle-analyzer version` → 16.2.6, 2026-05-14] |
| `react-icons` | `^5.6.0` | Icon library on web (D-17) | Already present in `c:/ziko-web`. Survives the move; no Phase 23 change [VERIFIED: c:/ziko-web/package.json line 20] |
| `framer-motion` | `^12.38.0` | Animation library (Phase 24+ use) | Already installed in `c:/ziko-web` [VERIFIED: c:/ziko-web/package.json line 15] |
| `@upstash/ratelimit` + `@upstash/redis` | `^2.0.8` / `^1.37.0` | Rate limiting (Phase 25 reuse) | Already installed in `c:/ziko-web` [VERIFIED: c:/ziko-web/package.json lines 13-14] |
| `server-only` | `^0.0.1` | Server-component guard for admin client | Already in `c:/ziko-web/src/lib/supabase/admin.ts` [VERIFIED: c:/ziko-web/package.json line 21] |
| `tailwindcss` | `^4` | Styling | Tailwind v4 via `@tailwindcss/postcss`; matches mobile NativeWind v4 major [VERIFIED: c:/ziko-web/package.json line 32] |
| `tsconfig-paths` | — | Not needed | `moduleResolution: "bundler"` in tsconfig + monorepo workspace symlinks handle paths |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `git subtree add --prefix=apps/web` | `git filter-repo --to-subdirectory-filter apps/web` | filter-repo is best for rewriting authored history but requires a separate clone + force-push-equivalent merge. `git subtree` is simpler, in-place, and rollback-safe via `pre-web-onboarding` tag. **Locked recommendation: subtree.** [CITED: git-scm.com/docs/git-subtree (2026-05)] |
| `@next/bundle-analyzer` | `next-bundle-analyzer-turbo` (community) | `@next/bundle-analyzer@16.2.6` is the official package, works with Turbopack production builds via `ANALYZE=true`. Community alternatives lag behind. **Locked: official.** [VERIFIED: npm registry] |
| `tsup` | `tsc` + manual ESM/CJS dual emit | tsc cannot dual-emit ESM+CJS in a single config without two tsconfigs. `tsup` is the convention across the Next/React ecosystem for workspace packages [CITED: tsup.egoist.dev] |
| `git subtree --squash` | `git subtree add --prefix=apps/web <remote> main` (no squash) | `--squash` collapses ziko-web history into a single commit; loses blame. **Locked: no squash, preserve full history.** |
| Single `vercel.json` at root | Two `vercel.json` files (one per project root) | Vercel reads `vercel.json` from each Project's configured root. Two files is the standard pattern for monorepo projects [CITED: vercel.com/docs/projects/project-configuration/git-configuration] |
| Inline Supabase factories per-route | Centralized factories in `src/lib/supabase/{client,server,middleware,admin}.ts` | Centralized is the canonical Supabase SSR Next 15 pattern; D-07 locks this. [CITED: Context7 `/supabase/ssr` Next.js examples] |

**Installation (apps/web — incremental adds on top of migrated `c:/ziko-web/package.json`):**

```bash
# Inside apps/web/ after the subtree move
npm install --save @supabase/ssr@^0.10.3
npm install --save-dev @next/bundle-analyzer@^16.2.6
# coach-sdk linked via workspace
npm install --save @ziko/coach-sdk@*
```

**Installation (packages/coach-sdk — new workspace package):**

```bash
# devDependencies — coach-sdk itself
# (zod is a peerDependency, not a dep)
npm install --workspace=@ziko/coach-sdk --save-dev tsup@^8.5.1 vitest@^3.2.4 typescript@^5.7.0 zod@^4.3.6
```

**Version verification (executed 2026-05-14 — DO re-run during Wave 0):**

```bash
npm view @supabase/ssr version    # → 0.10.3
npm view next-intl version        # → 4.12.0  (c:/ziko-web pins 4.8.3 — safe; minor compat)
npm view tsup version             # → 8.5.1
npm view @next/bundle-analyzer version  # → 16.2.6
npm view zod version              # → 4.4.3
```

## Architecture Patterns

### System Architecture Diagram

```
                          ┌────────────────────────────────────────────┐
                          │  Browser request                            │
                          │  GET /fr/coach/_smoke  (with sb-auth cookie)│
                          └────────────────────┬───────────────────────┘
                                               ▼
                          ┌────────────────────────────────────────────┐
                          │  apps/web/middleware.ts                     │
                          │  ┌──────────────────────────────────────┐  │
                          │  │ Step 1: updateSession(req)           │  │
                          │  │   • createServerClient(cookies={...})│  │
                          │  │   • supabase.auth.getUser() ←refresh │  │
                          │  │   • forward Set-Cookie on response   │  │
                          │  └──────────────┬───────────────────────┘  │
                          │  ┌──────────────▼───────────────────────┐  │
                          │  │ Step 2: route check                  │  │
                          │  │   if /(fr|en)/coach/* → return supa  │  │
                          │  │   else → next-intl(req)              │  │
                          │  └──────────────┬───────────────────────┘  │
                          └─────────────────┼──────────────────────────┘
                                            ▼
                          ┌────────────────────────────────────────────┐
                          │  app/[locale]/(coach)/layout.tsx            │
                          │   • createServerClient(cookieStore)         │
                          │   • const { user } = getUser()              │
                          │   • if (!user) redirect('/fr/login')        │
                          └─────────────────┬──────────────────────────┘
                                            ▼
                          ┌────────────────────────────────────────────┐
                          │  app/[locale]/(coach)/_smoke/page.tsx       │
                          │   • dynamic = 'force-dynamic'               │
                          │   • renders "Signed in as ${user.id}"       │
                          │   • <SmokeButton/> (client component)       │
                          └──────────┬─────────────────────────────────┘
                                     │ click
                                     ▼
                          ┌────────────────────────────────────────────┐
                          │  app/[locale]/(coach)/_smoke/action.ts      │
                          │   'use server'                              │
                          │   • createServerClient(cookieStore)         │
                          │   • const { user } = getUser()  ←re-check  │
                          │   • return { ok, userId, ts }               │
                          └────────────────────────────────────────────┘

   Shared contracts:
   ┌─────────────────────────────────────────────────────────────────┐
   │  packages/coach-sdk  (zod-only, bundler-agnostic)               │
   │   • /schemas → ImportedProgramSchema, CoachClientLinkSchema,    │
   │     CoachProfileSchema                                          │
   │   • /types   → CoachProfile, CoachClientLink, ImportedProgram   │
   │   Consumed by: apps/web, backend/api, apps/mobile               │
   └─────────────────────────────────────────────────────────────────┘

   Build-time guards:
   ┌─────────────────────────────────────────────────────────────────┐
   │  ESLint flat config (apps/web/eslint.config.mjs)                │
   │   • no-restricted-imports → ban @supabase/supabase-js           │
   │     (allowlist: src/lib/supabase/admin.ts + tests)              │
   │   • no-restricted-imports → ban coach/*/db, coach/*/internal    │
   │     from outside their own service.ts (Phase 24 activation)    │
   │  @next/bundle-analyzer (CI artifact grep)                       │
   │   • zero matches for /react-native(?!-web)/ in .next/analyze    │
   │  CI grep                                                        │
   │   • grep -r 'SERVICE_ROLE' backend/api/src/coach/ → 0 matches   │
   └─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
ziko-platform/
├── apps/
│   ├── mobile/                          # untouched
│   └── web/                             # ★ NEW — moved from c:/ziko-web via git subtree
│       ├── src/
│       │   ├── app/
│       │   │   ├── [locale]/
│       │   │   │   ├── (coach)/         # ★ NEW route group
│       │   │   │   │   ├── layout.tsx   # Server Component getUser() guard
│       │   │   │   │   └── _smoke/      # ★ DELETABLE in Phase 24
│       │   │   │   │       ├── page.tsx
│       │   │   │   │       ├── action.ts
│       │   │   │   │       └── SmokeButton.tsx
│       │   │   │   ├── cgu/             # legacy, untouched
│       │   │   │   ├── mentions-legales/
│       │   │   │   ├── politique-de-confidentialite/
│       │   │   │   ├── supprimer-mon-compte/
│       │   │   │   └── (landing)/...
│       │   │   └── api/
│       │   │       └── _debug/
│       │   │           └── limits/
│       │   │               └── route.ts  # ★ DELETABLE in Phase 24
│       │   ├── lib/
│       │   │   └── supabase/             # ★ D-07 — factories ONLY live here
│       │   │       ├── client.ts         # createBrowserClient
│       │   │       ├── server.ts         # createServerClient (cookies)
│       │   │       ├── middleware.ts     # updateSession()
│       │   │       └── admin.ts          # legacy service-role (allowlisted)
│       │   ├── actions/
│       │   │   └── account.ts            # legacy GDPR delete (preserved)
│       │   └── i18n/
│       │       └── routing.ts            # preserved verbatim
│       ├── middleware.ts                 # composed Supabase + next-intl
│       ├── next.config.ts                # wrapped with bundle-analyzer
│       ├── eslint.config.mjs             # D-11 + D-12 rules layered on
│       ├── package.json                  # next 15.5.14, react 19, @supabase/ssr, etc.
│       ├── tsconfig.json                 # moduleResolution: bundler
│       └── vercel.json                   # D-14 ignoreBuildStep
├── backend/
│   └── api/
│       └── vercel.json                   # D-14 ignoreBuildStep added
├── packages/
│   ├── plugin-sdk/                       # unchanged
│   ├── ai-client/                        # unchanged
│   ├── ui/                               # unchanged
│   └── coach-sdk/                        # ★ NEW
│       ├── src/
│       │   ├── index.ts
│       │   ├── schemas/index.ts
│       │   └── types/index.ts
│       ├── test/
│       │   └── schemas.spec.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       └── vitest.config.ts
├── .github/
│   └── workflows/
│       ├── ci.yml                        # ★ NEW — type-check, lint, test, grep, bundle
│       └── publish-coach-sdk.yml         # ★ NEW (D-04 insurance)
└── (root unchanged: turbo.json, package.json, plugins/, supabase/, .planning/)
```

### Anti-Patterns to Avoid

- **Exporting Supabase factories from `coach-sdk`** — `@supabase/ssr` is web-only (Next.js cookies API). coach-sdk MUST stay bundler-agnostic per D-07.
- **`Set-Cookie` from Server Components** — Server Components can READ cookies but not WRITE. Cookie writes happen only in middleware, Server Actions, and Route Handlers. The Context7 canonical pattern OMITS `setAll` in Server Component clients.
- **`git subtree --squash`** — destroys ziko-web blame. D-03 mandates preserving history.
- **Adding `next-intl` Supabase composition inside the `next-intl` middleware** — D-10 requires Supabase FIRST so `getUser()` is fresh before any locale routing. Inverting the order causes stale-session bugs on locale redirects.
- **Mounting `(coach)` outside `[locale]`** — duplicates i18n setup and breaks FR/EN URL contract.
- **Using `Alert.alert` or NativeWind classes** — those are mobile-only. Web uses Tailwind v4 + standard React patterns.
- **Hand-rolling `updateSession`** — Use the verbatim Context7 pattern in §2; any local variation risks cookie-propagation bugs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-based Supabase session refresh | Custom `Set-Cookie` parsing + JWT validation | `@supabase/ssr` `createServerClient` + `updateSession` middleware | Token refresh, PKCE, SameSite/Secure semantics, and Set-Cookie forwarding are non-obvious. Supabase ships the canonical handler. |
| FR/EN locale routing | Custom URL parser | `next-intl` middleware (already installed) | next-intl handles `localePrefix: 'always'`, redirects, OG metadata locale negotiation |
| Dual ESM/CJS + `.d.ts` build for workspace package | Multiple `tsc` invocations | `tsup` | `tsup` handles entry-graph, externals, type-only emit in one config |
| Workspace dependency ordering (coach-sdk before web) | Manual scripts | `turbo` `dependsOn: ["^build"]` (already in turbo.json line 16) | Existing convention; `turbo run build --filter=web` builds coach-sdk first |
| Vercel monorepo build skip | Custom GHA matrix logic | `vercel.json` `"ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."` per project | Vercel official pattern; runs on Vercel's infra, no external CI needed for skip |
| Bundle-content audit | Custom webpack inspection | `@next/bundle-analyzer` + grep on `.next/analyze/client.json` | Officially supported emit format with module names; grep-able |
| CSV import for invitations | Anything | (out of phase — Phase 28 uses AI file imports) | Already deferred |

**Key insight:** Every line of plumbing in Phase 23 has a canonical library or pattern. The risk in this phase is **deviating** from the canonical pattern — not picking the wrong library. The 16/16 recommended-option ratification in CONTEXT.md operationalizes that risk: every deviation requires explicit justification.

## Runtime State Inventory

> Phase 23 involves moving `c:/ziko-web` source code into `apps/web/`. Runtime state inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — `c:/ziko-web` is read-only marketing + legacy account-delete. No database keys mention `ziko-web` literally. | None |
| **Live service config** | (a) Vercel Project `ziko-web` (if already provisioned) — Project's Git connection currently points at standalone repo `c:/ziko-web` upstream. After monorepo move, Project must be re-connected to the `ziko-platform` repo with Root Directory = `apps/web`. (b) Domain config (`ziko-app.com`) lives in Vercel dashboard, NOT in git. | (a) Reconfigure Vercel project Git source + Root Directory **at deploy time** (manual dashboard step). (b) Domain remains attached to the project — survives reconnect. |
| **OS-registered state** | None — no Windows Task Scheduler / launchd / systemd registrations reference `ziko-web` literal. | None — verified by inspecting `c:/ziko-web` directory contents (no Procfile, no `.service` files, no scheduled tasks). |
| **Secrets / env vars** | `c:/ziko-web/.env` (not in git, not on this filesystem in clear text) contains `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. After move, these env vars must exist in (a) Vercel Project `ziko-web` env settings (production + preview) and (b) `apps/web/.env.local` for local dev. | Manual Vercel env var setup (one-time, during cutover). `.env.local` template added to repo as `apps/web/.env.example`. |
| **Build artifacts / installed packages** | `c:/ziko-web/.next/` (dev cache — gitignored, irrelevant) · `c:/ziko-web/node_modules/` (rebuilt under workspaces post-move) · `c:/ziko-web/next-env.d.ts` (regenerated by `next` on first build) | `npm install` at root after move regenerates everything. |

**Nothing found in category:** Stored data (verified by checking that no Supabase migration or Upstash key contains `ziko-web` literal); OS-registered state (verified by `c:/ziko-web` directory listing).

**Canonical question — answered:** After every file is moved, the only runtime systems still referencing the old layout are (1) Vercel Project Git source — must be reconnected manually, (2) Vercel env vars — must be re-entered manually. These are documented as manual cutover steps in §1.

## Common Pitfalls

### Pitfall 1: Cookie set on `request` but not propagated to `response`
**What goes wrong:** The Supabase `setAll` callback writes to `response.cookies` only. Mid-middleware, some patterns mutate `request.cookies.set(...)` (so downstream `request.cookies.get(...)` reads see the new value). Forgetting either side causes "logged in then immediately logged out" bugs.
**Why it happens:** Two cookie stores (request, response) — refresh must update BOTH within the middleware.
**How to avoid:** Use the exact Context7 pattern in §2. `setAll` mirrors writes to `request.cookies.set(name, value)` AND `response.cookies.set(name, value, options)`.
**Warning signs:** Smoke test passes once (initial cookie), fails on the second navigation; "JWT expired" surfacing in `getUser()` after the refresh path was hit.

### Pitfall 2: `react-native-worklets` hoists into the web bundle
**What goes wrong:** Root `package.json` line 41 pins `react-native-worklets@^0.5.1` as a top-level dependency. npm workspaces hoist into root `node_modules`. Next.js bundler may resolve and bundle it if any indirect import path reaches it.
**Why it happens:** `react-native-worklets` is declared at root, so the resolver can find it from `apps/web/`. If anything transitively imports `react-native` or `react-native-reanimated`, the worklets dep gets pulled into the bundle.
**How to avoid:** Two-layer guard — (a) move `react-native-worklets` from root `dependencies` to `apps/mobile/package.json` directly (preferred); (b) if (a) blocks Phase 23 timeline, configure `apps/web/next.config.ts` with `transpilePackages: []` excluding RN packages AND assert with bundle analyzer regex. D-02 step 3 makes this a HARD gate.
**Warning signs:** Bundle analyzer output (`.next/analyze/client.json`) contains module path matching `/react-native(?!-web)/`.

### Pitfall 3: `next-intl` middleware runs before Supabase refresh
**What goes wrong:** If `next-intl` runs first and the locale path triggers a redirect, the Supabase refresh never executes. Stale JWT propagates to the redirected page; `getUser()` may return null even for a freshly-logged-in user.
**Why it happens:** Middleware order matters when one middleware terminates with a redirect.
**How to avoid:** Per D-10 — Supabase `updateSession()` FIRST, then conditional return of `supaResponse` for `(coach)` paths, then delegate to `intlMiddleware(req)` otherwise. The Context7 next-intl composition pattern (§3) is exactly this shape.
**Warning signs:** First `/fr/coach/_smoke` hit after login → redirect to login. Hard refresh fixes it.

### Pitfall 4: Vercel "ignored build step" runs on the wrong project root
**What goes wrong:** Both Vercel projects share the same git repo. Without `ignoreCommand`, every push to `main` triggers TWO builds (web + api), wasting build minutes and risking false-positive failures.
**Why it happens:** Default Vercel behavior is "build on every push touching any file in the connected repo."
**How to avoid:** `vercel.json` per project root with `"ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."` — Vercel runs this in the Project's Root Directory; exit 0 means "skip the build". Phrasing locked in §6.
**Warning signs:** Backend deploys triggered by a `apps/web/**` change, or vice versa.

### Pitfall 5: ESLint `no-restricted-imports` collides with the legacy `admin.ts`
**What goes wrong:** D-11 bans `@supabase/supabase-js` globally. The legacy GDPR `admin.ts` imports it. Without an allowlist override, lint fails.
**Why it happens:** Flat config rules apply broadly; needs a file-pattern override.
**How to avoid:** ESLint flat config `overrides`-style entry with `files: ['src/lib/supabase/admin.ts', '**/*.test.ts', '**/*.spec.ts']` re-declaring the rule as `'off'` or removing the restriction. Pattern locked in §7.
**Warning signs:** `turbo run lint` red on the very first run after migration.

### Pitfall 6: `coach-sdk` resolves a different `zod` than its consumers
**What goes wrong:** If `peerDependency: zod ^4.0.0` is unmet, npm installs an extra copy under `packages/coach-sdk/node_modules/zod`, causing `instanceof ZodError` checks to fail across module boundaries.
**Why it happens:** Without `peerDependency` declaration, npm hoists the consumer's zod, but coach-sdk may bundle its own (`external: ['zod']` in tsup config prevents this).
**How to avoid:** (a) `peerDependencies: { zod: "^4.0.0" }` in coach-sdk package.json (D-08). (b) `external: ['zod']` in tsup.config.ts. (c) Add a turbo post-install check: `node -e "require('zod')" && node -e "require('@ziko/coach-sdk/schemas')"` and verify the resolved zod path is unique. Pattern in §4.
**Warning signs:** Vitest spec `expect(err).toBeInstanceOf(z.ZodError)` returns false when run against the built dist.

### Pitfall 7: Server Action calls `getUser()` but middleware just refreshed — TOCTOU
**What goes wrong:** Between the middleware refresh and the Server Action execution, the cookie could (in theory) be stale. With cookie-bound auth, this is rare but possible across long-lived browser tabs.
**Why it happens:** Time-of-check vs time-of-use; middleware sets headers, Server Action reads cookies fresh from the browser submission.
**How to avoid:** The 3-layer pattern (middleware + layout + Server Action re-check) is itself the defense. The Server Action's `getUser()` call IS the re-check. D-13 mandates this.
**Warning signs:** None at Phase 23 scale; Phase 28+ may see this in long-running upload sessions.

## Code Examples

### 1. `updateSession()` middleware factory (canonical 2026-05 pattern)

**Location:** `apps/web/src/lib/supabase/middleware.ts`

```typescript
// Source: Context7 /supabase/ssr (2026-05) — Next.js Middleware example
// Cookie propagation: read from request, mirror writes to BOTH request and response.
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Mirror to BOTH stores so downstream reads see fresh tokens
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh — critical: do NOT branch logic before this call.
  await supabase.auth.getUser();

  return response;
}
```

### 2. Composed root middleware (Supabase → next-intl)

**Location:** `apps/web/middleware.ts`

```typescript
// Source: composed from Context7 /supabase/ssr + Context7 /amannn/next-intl
import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest } from 'next/server';
import { routing } from './src/i18n/routing';
import { updateSession } from './src/lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // Step 1: Supabase refresh — ALWAYS runs first
  const supaResponse = await updateSession(request);

  // Step 2: (coach) routes — auth response wins
  if (request.nextUrl.pathname.match(/^\/(fr|en)\/coach(\/|$)/)) {
    return supaResponse;
  }

  // Step 3: Delegate to next-intl for non-coach paths
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/',
    '/(fr|en)/:path*',
    '/((?!_next|_vercel|api|.*\\..*).*)',
  ],
};
```

### 3. Server Component supabase factory (read-only cookies)

**Location:** `apps/web/src/lib/supabase/server.ts`

```typescript
// Source: Context7 /supabase/ssr Server Component pattern
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies — middleware refreshes instead.
            // No-op intentional.
          }
        },
      },
    }
  );
}
```

### 4. Browser supabase factory (client components)

**Location:** `apps/web/src/lib/supabase/client.ts`

```typescript
// Source: Context7 /supabase/ssr Browser pattern
import { createBrowserClient } from '@supabase/ssr';

export function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 5. `_smoke` page (Server Component)

**Location:** `apps/web/src/app/[locale]/(coach)/_smoke/page.tsx`

```typescript
// Source: D-13 — exercises ARCH-05 layer 2 (layout guard already ran; this is the page itself)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createServerSupabase } from '@/lib/supabase/server';
import { SmokeButton } from './SmokeButton';

export default async function SmokePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  // Layout already redirected on !user; non-null here.
  return (
    <main style={{ padding: 24 }}>
      <h1>Phase 23 smoke route</h1>
      <p>Signed in as <code>{user!.id}</code></p>
      <SmokeButton />
    </main>
  );
}
```

### 6. `_smoke` Server Action (re-check layer)

**Location:** `apps/web/src/app/[locale]/(coach)/_smoke/action.ts`

```typescript
// Source: D-13 — exercises ARCH-05 layer 3 (Server Action re-check)
'use server';

import { createServerSupabase } from '@/lib/supabase/server';

export async function smokeReCheck() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false as const, error: error?.message ?? 'no user' };
  }
  return { ok: true as const, userId: user.id, ts: new Date().toISOString() };
}
```

### 7. `_debug/limits` route (Vercel Pro proof, D-15)

**Location:** `apps/web/src/app/api/_debug/limits/route.ts`

```typescript
// Source: D-15 — Pro tier evidence probe. Removed in Phase 24.
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024-08 (deprecation), GA throughout 2025 | New SSR package handles Next.js App Router cookies correctly; auth-helpers is unmaintained [VERIFIED: npm registry status] |
| `next-intl` v3 single-call middleware | v4 composable proxy middleware | 2024-12 | v4 supports composition with auth middleware (Context7 docs §3); v3 required hacky wrapping [VERIFIED: c:/ziko-web pins ^4.8.3] |
| `@next/bundle-analyzer` webpack-only | `@next/bundle-analyzer` v16 supports Turbopack production builds | 2025 (Next 15.x) | Required for Phase 23 since Next 15.5 defaults to Turbopack [VERIFIED: `npm view @next/bundle-analyzer version` → 16.2.6] |
| `tsc --build` for workspace package dual-emit | `tsup` (rollup-based, single config) | 2024+ | Industry standard; mirrors what `packages/plugin-sdk` and `packages/ai-client` will adopt for v1.5 [CITED: tsup.egoist.dev] |
| Vercel manual "ignored build step" in dashboard | `vercel.json` `ignoreCommand` field | 2024+ | In-repo configuration is auditable; D-14 locks this [CITED: vercel.com/docs/projects/project-configuration] |
| Zod v3 → v4 | zod v4 throughout monorepo | 2025-03 | Already adopted at root (`zod@^4.3.6`). coach-sdk peerDeps zod ^4.0.0 prevents drift [VERIFIED: root package.json line 41] |

**Deprecated / outdated:**
- `@supabase/auth-helpers-nextjs` — DO NOT install in `apps/web`. ESLint D-11 only bans `@supabase/supabase-js`; add `@supabase/auth-helpers-nextjs` to the `no-restricted-imports` list as belt-and-suspenders.
- `withRouter` / Pages Router — N/A; `c:/ziko-web` is already App Router.
- `next-intl@^3` middleware signature — N/A; `c:/ziko-web` already on ^4.8.3.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing Vercel Project `ziko-web` (if present) can be re-pointed to the new monorepo root via dashboard with no domain re-verification | §1, §6 | Domain cutover delay; mitigated by Vercel staging on `*.vercel.app` before DNS flip |
| A2 | Backend Vercel project `ziko-api-lilac` is already on Pro tier (CONTEXT.md says "Pro tier, existing" but no probe yet) | §6, §11 | If actually Hobby, Phase 28 cannot ship. D-15 probe in Phase 23 will surface this. |
| A3 | `c:/ziko-web/.env` env var keys exactly match what's needed by post-move `apps/web` runtime | Runtime State Inventory | Mismatch causes 500s on first deploy. Mitigation: cross-check during cutover, document in `apps/web/.env.example`. |
| A4 | `react-native-worklets` at root does not currently leak into a web bundle (no `c:/ziko-web` build artifact tested for this yet) | §11 spike, Pitfall 2 | D-02 step 3 is exactly the test that resolves this. If red, fall back to dual-repo per D-04. |
| A5 | `next-intl` v4 middleware is composable with custom logic via direct call (Context7 confirms but only with custom locale headers example, not auth) | §3 | The composition pattern is the same shape; risk is theoretical. If composition fails, fallback is to embed Supabase refresh inside the next-intl middleware's pre-step. |
| A6 | `@next/bundle-analyzer@16.2.6` produces `.next/analyze/client.json` with module names greppable for `react-native(?!-web)` | §8 | If output format changed in v16, use webpack-stats-plugin alternative or downgrade analyzer to last-known-working. Smoke-test in Wave 0. |
| A7 | The "Pro" tier check at D-15 distinguishes Hobby (10s timeout) from Pro (60s allowed). | §6, §11 | Vercel may change Hobby limits; if 10s is no longer the threshold, adjust sleep duration. Re-verify against Vercel docs at execution time. |
| A8 | `npm install` at root after the subtree move will correctly recognize `apps/web` as a workspace under the existing `apps/*` glob (line 6 of root package.json) | §1 | Should work — `apps/*` already includes `apps/mobile`. If not, add `apps/web` explicitly to `workspaces` array. |
| A9 | Phase 22's `weeks_data JSONB` shape is locked by Phase 22 D-11 to be Zod-validated only via coach-sdk; the Zod schema below mirrors a "weeks → sessions → exercises" tree consistent with Phase 27 PROG-02 requirements | §5 | If Phase 27 planner extends `weeks_data` semantics, the schema in §5 must round-trip; Phase 23 ships a minimal-viable shape covering PROG-02 requirements verbatim. Phase 27 plan-checker re-verifies. |

## Open Questions

1. **Is `ziko-web` Vercel Project already provisioned, or does Phase 23 provision it fresh?**
   - What we know: CONTEXT.md D-14 describes the project as if existing-or-new; D-15 implies Pro tier is what's being PROVEN, not assumed.
   - What's unclear: Provisioning steps (DNS, env vars, domain).
   - Recommendation: Planner adds a manual checklist task in PLAN.md Wave-final: "Connect/create Vercel Project `ziko-web` with Root Directory `apps/web`; copy env vars from `c:/ziko-web` Vercel project."

2. **Should `react-native-worklets` move out of root `dependencies` into `apps/mobile/dependencies` proactively?**
   - What we know: D-02 step 3 is a HARD gate. Moving the dep eliminates the hoisting risk entirely.
   - What's unclear: Whether `apps/mobile/package.json` already pins worklets; if so, root dep is redundant.
   - Recommendation: Planner verifies `apps/mobile/package.json` for `react-native-worklets`; if present, removes root dep (low-risk cleanup); if absent, adds to `apps/mobile` and removes from root. This is the cleanest fix per Pitfall 2.

3. **Does `apps/mobile/package.json` currently install anything that transitively pulls a `react-native` module into web's bundle?**
   - What we know: Workspaces hoist; resolver may find `react-native` from root.
   - What's unclear: Direct transitive graph.
   - Recommendation: D-02 step 3 (bundle analyzer) IS this check — output is the answer. No pre-investigation needed.

4. **Is the `c:/ziko-web` repo a true git repo with branching history, or a flat working copy?**
   - What we know: It has `c:/ziko-web/.git` (implied by being a checked-in project). Subtree merge requires a real git history to be worth preserving.
   - What's unclear: Remote URL.
   - Recommendation: Spike confirms via `cd c:/ziko-web && git log --oneline | head -20`. If empty history, drop the history-preservation goal (D-03 mandate softens — squashed merge is acceptable). Planner adds spike step.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | ✓ (assumed; root pins `>=18`) | 18.x+ | — |
| npm | Workspaces | ✓ | 10.9.0 (root packageManager) | — |
| `git` with `subtree` subcommand | D-03 | ✓ (Git for Windows includes git-subtree) | — | `git filter-repo` as fallback (requires `pip install git-filter-repo`) |
| `git filter-repo` | D-03 fallback | ✗ (not standard with Git for Windows) | — | Use `git subtree add` primary path; install filter-repo via `pip` only if subtree fails |
| Vercel CLI | Manual deploy validation | Likely ✓ (used by backend deploys) | — | Web dashboard "Redeploy" button |
| GitHub Packages auth (for D-04 fallback) | Only on dual-repo path | ✗ (workflow ships even on monorepo, but secrets unset) | — | `.npmrc` + `GITHUB_TOKEN` configured at first dual-repo activation; not needed Phase 23 |
| Supabase CLI | Not needed in Phase 23 | n/a | — | — |
| `curl` | CI smoke + dev smoke | ✓ (standard on Win/Mac/Linux runners) | — | — |

**Missing dependencies with no fallback:** None blocking Phase 23.

**Missing dependencies with fallback:** `git filter-repo` (subtree primary covers D-03); GitHub Packages auth (only needed on D-04 dual-repo activation, not on Phase 23 monorepo path).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 (existing in `backend/api`; new in `packages/coach-sdk`) |
| Config file | `packages/coach-sdk/vitest.config.ts` (mirrors `backend/api/vitest.config.ts`) — see §4 |
| Quick run command | `npm run test --workspace=@ziko/coach-sdk -- --run` |
| Full suite command | `turbo run test type-check lint` (parallel across all workspaces) |
| Web factory unit test | `apps/web/src/lib/supabase/__tests__/factories.spec.ts` (Vitest, mocked `next/headers`) |
| Smoke deploy probe | `curl` against preview deploy URL (manual, captured in 23-VERIFICATION.md) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-02 (ESLint) | `no-restricted-imports` blocks `coach/*/db/**` and `coach/*/internal/**` from outside service.ts | lint | `npm run lint --workspace=apps/web` | ❌ Wave 0 (rule lands Phase 23; activation Phase 24) |
| ARCH-02 (CI grep) | No `SERVICE_ROLE` references under `backend/api/src/coach/` | grep | `! grep -r 'SERVICE_ROLE' backend/api/src/coach/ 2>/dev/null` (must exit 0) | ❌ Wave 0 (`.github/workflows/ci.yml` new) |
| ARCH-04 (coach-sdk exists) | `import { ImportedProgramSchema } from '@ziko/coach-sdk/schemas'` resolves and runs | unit | `npm run test --workspace=@ziko/coach-sdk -- --run` | ❌ Wave 0 (`packages/coach-sdk/test/schemas.spec.ts` new) |
| ARCH-04 (round-trip) | All three Zod schemas accept golden inputs and reject malformed inputs | unit | same as above | ❌ Wave 0 |
| ARCH-04 (tree-shake) | `import` from `@ziko/coach-sdk/schemas` does not pull `@ziko/coach-sdk/types` | type-check | `tsc --noEmit` over imports in `apps/web` | ❌ Wave 0 (assertion in `factories.spec.ts`) |
| ARCH-05 (middleware refresh) | `updateSession()` returns a `NextResponse` with refreshed cookies | unit | `npm run test --workspace=apps/web -- factories.spec.ts` | ❌ Wave 0 |
| ARCH-05 (layout guard) | Coach layout's `getUser()` returns the test user under cookie injection | smoke | `curl -b sb-auth.cookie -s https://<preview>/fr/coach/_smoke` | ❌ Wave-final |
| ARCH-05 (Server Action re-check) | Smoke button POST returns `{ ok: true, userId, ts }` | smoke | manual via preview deploy | ❌ Wave-final |
| ARCH-05 (ESLint bans `@supabase/supabase-js`) | Lint fails when any file outside allowlist imports `@supabase/supabase-js` | lint | `npm run lint --workspace=apps/web` (with a temporary violation in a test fixture, then revert) | ❌ Wave 0 |
| ARCH-06 (force-dynamic) | All `(coach)` routes declare `dynamic = 'force-dynamic'`, `revalidate = 0` | grep | `grep -L "force-dynamic" apps/web/src/app/\[locale\]/\(coach\)/**/page.tsx` (must list zero files) | ❌ Wave-final |
| ARCH-06 (no-store) | All Supabase reads in `(coach)` use `cache: 'no-store'` (or are uncached server reads) | grep + manual | `grep -r "cache:" apps/web/src/app/\[locale\]/\(coach\)/` audit | ❌ Wave-final |
| ARCH-08 (Pro tier proof — web) | `GET /api/_debug/limits` with `DEBUG_LIMITS=on` returns 200 after 30s | smoke | `curl -s -m 65 'https://<preview>/api/_debug/limits' \| jq` | ❌ Wave-final |
| ARCH-08 (Pro tier proof — backend) | Same probe on `backend/api/src/routes/_debug.ts` | smoke | `curl -s -m 65 'https://ziko-api-lilac.vercel.app/_debug/limits'` | ❌ Wave-final |
| Bundle hygiene (D-02 step 3) | Zero matches for `/react-native(?!-web)/` in `.next/analyze/client.json` | CI grep | `ANALYZE=true turbo run build --filter=web && ! grep -E 'react-native(?!-web)' apps/web/.next/analyze/client.json` | ❌ Wave 0 (`.github/workflows/ci.yml`) |
| Triple-green (D-02) | Web build green + mobile prebuild green + bundle clean | composite | spike script in §11 | ❌ Spike day |

### Sampling Rate

- **Per task commit:** `npm run lint --workspace=apps/web && npm run test --workspace=@ziko/coach-sdk -- --run`
- **Per wave merge:** `turbo run type-check lint test`
- **Phase gate:** Full suite green + smoke deploy curl + bundle analyzer regex check, all green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/coach-sdk/test/schemas.spec.ts` — covers ARCH-04 (round-trip parse/safeParse for all 3 schemas)
- [ ] `packages/coach-sdk/vitest.config.ts` — config mirrors `backend/api/vitest.config.ts` shape
- [ ] `apps/web/src/lib/supabase/__tests__/factories.spec.ts` — covers ARCH-05 middleware unit
- [ ] `.github/workflows/ci.yml` — new workflow with type-check / lint / test / grep / bundle-analyzer steps
- [ ] Framework install: `npm install --workspace=@ziko/coach-sdk --save-dev vitest@^3.2.4 tsup@^8.5.1`
- [ ] `apps/web/.env.example` — template for required env vars

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `@supabase/ssr` cookie-based session; 3-layer (middleware + layout `getUser()` + Server Action re-check) per ARCH-05 |
| V3 Session Management | yes | `@supabase/ssr` `updateSession` refresh; HttpOnly + Secure + SameSite handled by Supabase library (defaults) |
| V4 Access Control | partial | `(coach)` layout `getUser()` redirect on null is the access boundary in Phase 23; Phase 22 RLS is the data boundary; cross-module ESLint (D-12) is the architectural boundary |
| V5 Input Validation | yes | Zod schemas in `@ziko/coach-sdk/schemas` validate every cross-boundary payload; coach-sdk is the single source of truth |
| V6 Cryptography | yes (passthrough) | All token signing/verification is delegated to Supabase (`@supabase/ssr` uses the publishable key; admin client uses service role under `admin.ts` allowlist only). NEVER hand-roll JWT validation. |
| V12 Files & Resources | n/a | No file upload in Phase 23 (Phase 28 territory) |
| V14 Configuration | yes | `vercel.json` `ignoreBuildStep` + `maxDuration` + `dynamic = 'force-dynamic'` are configuration controls |

### Known Threat Patterns for Next.js 15 + `@supabase/ssr`

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale-session bypass (middleware skipped) | Information Disclosure | Composed middleware (§3) runs `updateSession` BEFORE any locale redirect; matcher excludes `_next` only, not auth routes |
| Cookie injection via header | Tampering | `@supabase/ssr` uses HttpOnly + Secure; SameSite=Lax by default |
| Cross-coach data leak via cached RSC output | Information Disclosure | ARCH-06 `dynamic = 'force-dynamic'`, `revalidate = 0`, `cache: 'no-store'` — no shared cache between requests |
| Service-role key in client bundle | Elevation of Privilege | `admin.ts` declares `import 'server-only'` (existing in `c:/ziko-web`); ESLint allowlist scoped to that exact file; CI grep on `backend/api/src/coach/` enforces ARCH-03 |
| Forged `coach_id` on direct DB write | Tampering | Phase 22's RLS keystone + Phase 24's per-request user-JWT supabase client (ARCH-03) — not Phase 23 territory directly, but Phase 23 ESLint D-11/D-12 prevents bypass via `@supabase/supabase-js` (service role) |
| Open redirect via `redirect()` in layout | Tampering | Hard-code redirect target `/fr/login` in Phase 23 (no `searchParams.next` interpolation); Phase 24 introduces validated redirect target |
| react-native worklets leak into web bundle | (DoS via bundle bloat + potential native-API confusion) | D-02 step 3 bundle analyzer regex grep — HARD gate |
| Locale-prefix CSRF | Tampering | Standard same-origin + SameSite cookies; next-intl does not introduce new CSRF surface |

## Sources

### Primary (HIGH confidence)
- Context7 `/supabase/ssr` — Next.js Middleware + Server Component + Route Handler examples (fetched 2026-05-14); canonical `updateSession` + `createServerClient` pattern
- Context7 `/amannn/next-intl` — middleware composition with custom logic (fetched 2026-05-14); canonical proxy/wrap pattern
- `npm view @supabase/ssr version` → 0.10.3 (executed 2026-05-14)
- `npm view next-intl version` → 4.12.0 (executed 2026-05-14)
- `npm view tsup version` → 8.5.1 (executed 2026-05-14)
- `npm view @next/bundle-analyzer version` → 16.2.6 (executed 2026-05-14)
- `npm view zod version` → 4.4.3 (executed 2026-05-14)
- On-disk audit: `c:/ziko-web/middleware.ts`, `routing.ts`, `package.json`, `eslint.config.mjs`, `next.config.ts`, `tsconfig.json`, `src/lib/supabase/admin.ts`
- On-disk audit: `ziko-platform/packages/plugin-sdk/package.json`, `packages/ai-client/package.json`, `backend/api/vitest.config.ts`, `backend/api/vercel.json`, `backend/api/package.json`, `package.json`, `turbo.json`
- Supabase migrations 034, 035, 036 (verified to match Zod schemas in §5)
- Phase 22 VERIFICATION.md (PASS, 47/47 tests) — Zod schemas in §5 are post-keystone

### Secondary (MEDIUM confidence)
- tsup official docs (tsup.egoist.dev) — dual ESM/CJS pattern
- Vercel docs `vercel.json` `ignoreCommand` — pattern shape

### Tertiary (LOW confidence)
- None — Phase 23 is plumbing on canonical patterns. No LOW-confidence claims load-bearing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep version verified against npm registry on 2026-05-14
- Architecture: HIGH — `updateSession` + composed middleware patterns drawn verbatim from Context7 2026-05 docs
- Pitfalls: HIGH — each pitfall has a named code-or-config mitigation locked in §s 1–12

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (30 days — stable ecosystem; Next.js 15.x + Supabase SSR 0.x are mature)

---



## §1. Repository Onboarding Strategy (D-03)

### 1.1 Pre-flight checks (Wave 0 task)

```bash
# Verify destination is clean
cd C:/ziko-platform
git status --porcelain
git branch --show-current  # MUST be gsd/phase-23-web-turborepo-onboarding-auth-bootstrap

# Verify source has history worth preserving (resolves Open Question #4)
cd C:/ziko-web
git log --oneline | wc -l   # >1 means subtree --squash=false is worth it
git remote -v               # capture remote URL
```

### 1.2 Rollback safety net (FIRST task before any move)

```bash
cd C:/ziko-platform
git tag pre-web-onboarding -m "Phase 23 rollback point — before c:/ziko-web subtree merge"
git push origin pre-web-onboarding

# Archive c:/ziko-web on disk (manual checklist item — not automated):
# ROBOCOPY "C:\ziko-web" "C:\ziko-web.archived-2026-05-14" /MIR /XD node_modules .next
```

### 1.3 Subtree merge command (primary path, locked)

```bash
cd C:/ziko-platform

git remote add ziko-web-source "C:/ziko-web"
git fetch ziko-web-source

# --prefix=apps/web   → files land under apps/web/
# (no --squash flag)  → preserves every commit from ziko-web
git subtree add --prefix=apps/web ziko-web-source main

# Verify
ls apps/web/middleware.ts apps/web/next.config.ts apps/web/package.json apps/web/src/i18n/routing.ts
git log --follow apps/web/middleware.ts | head -10   # should show pre-move history
```

### 1.4 Fallback (filter-repo, if subtree merge commit is unwanted)

```bash
pip install git-filter-repo
git clone C:/ziko-web C:/ziko-web-clone
cd C:/ziko-web-clone
git filter-repo --to-subdirectory-filter apps/web
cd C:/ziko-platform
git remote add ziko-web-filtered C:/ziko-web-clone
git fetch ziko-web-filtered
git merge --allow-unrelated-histories ziko-web-filtered/main
```

### 1.5 Post-move adjustments (still Wave 1)

```bash
cd C:/ziko-platform
rm -f apps/web/package-lock.json apps/web/npm-shrinkwrap.json
npm install --workspace=apps/web --save @ziko/coach-sdk@*
npm install
npm ls --workspace=apps/web | head -5
```

### 1.6 History-preservation evidence test

```bash
git log --follow "apps/web/src/app/[locale]/mentions-legales/page.tsx" | grep -c '^commit '
# Expected: >5 (history preserved)
# If 1 — fallback (flat copy) was used; document as accepted deviation in PLAN.md
```

### 1.7 Rollback procedure (if D-02 triple-green fails)

```bash
cd C:/ziko-platform
git reset --hard pre-web-onboarding
git push --force-with-lease origin gsd/phase-23-web-turborepo-onboarding-auth-bootstrap
# c:/ziko-web.archived-2026-05-14 is the recovery source if c:/ziko-web is also dirty.
# Activate D-04 dual-repo path (see §12).
```

## §2. `@supabase/ssr` Middleware Reference Implementation (D-10)

**Authoritative source:** Context7 `/supabase/ssr` Next.js Middleware example fetched 2026-05-14. The pattern below is canonical — do not deviate.

**File:** `apps/web/src/lib/supabase/middleware.ts`

```typescript
// [VERIFIED: Context7 /supabase/ssr 2026-05]
// Cookie propagation requires writing to BOTH request and response stores.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Initial response carries the (possibly modified) request
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Step 1: mirror to request so downstream reads see fresh tokens
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Step 2: rebuild response carrying the mutated request
          response = NextResponse.next({ request });
          // Step 3: also write to response so the browser receives Set-Cookie
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // CRITICAL: getUser() triggers refresh if access token expired.
  // Do NOT wrap in try/catch. Do NOT branch logic before this call.
  await supabase.auth.getUser();

  return response;
}
```

**Anti-patterns (do NOT do):**
- `const response = NextResponse.next();` without `{ request }` propagation — downstream reads see stale cookies
- Setting cookies on response only (skipping `request.cookies.set`) — `getUser()` re-reads from request mid-flow
- Wrapping `await supabase.auth.getUser()` in try/catch — silently swallows auth state

## §3. Composed root `middleware.ts` (D-10)

**File:** `apps/web/middleware.ts`

```typescript
// [VERIFIED: Context7 /amannn/next-intl middleware composition + /supabase/ssr]
// D-10: Supabase refresh ALWAYS first. (coach) routes return supabase response.
// Non-coach paths delegate to next-intl for locale routing.
import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest } from 'next/server';
import { routing } from './src/i18n/routing';
import { updateSession } from './src/lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // Step 1: refresh Supabase cookies on every matched request.
  const supaResponse = await updateSession(request);

  // Step 2: (coach) routes — supabase response is authoritative.
  // Locale prefix already in URL; next-intl wouldn't redirect; skipping preserves fresh cookies.
  if (request.nextUrl.pathname.match(/^\/(fr|en)\/coach(\/|$)/)) {
    return supaResponse;
  }

  // Step 3: non-coach paths (landing, legal, /) → next-intl handles locale.
  return intlMiddleware(request);
}

export const config = {
  // Matcher per D-10
  matcher: [
    '/',
    '/(fr|en)/:path*',
    '/((?!_next|_vercel|api|.*\\..*).*)',
  ],
};
```

**Composition-order rationale:** If next-intl runs first and redirects (e.g., `/` → `/fr`), the redirect response carries no fresh `Set-Cookie`, and the user lands on `/fr` with a stale JWT. D-10 enforces Supabase-first.


## §4. `packages/coach-sdk` Package Shape (D-04/D-05/D-06/D-08)

### 4.1 `packages/coach-sdk/package.json`

```json
{
  "name": "@ziko/coach-sdk",
  "version": "0.1.0",
  "private": true,
  "description": "Shared Zod schemas and TypeScript types for the Ziko Coach Platform (consumed by apps/web, apps/mobile, backend/api).",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./schemas": {
      "import": "./dist/schemas/index.mjs",
      "require": "./dist/schemas/index.cjs",
      "types": "./dist/schemas/index.d.ts"
    },
    "./types": {
      "import": "./dist/types/index.mjs",
      "require": "./dist/types/index.cjs",
      "types": "./dist/types/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "clean": "rm -rf dist",
    "type-check": "tsc --noEmit",
    "lint": "echo 'lint: no eslint config, skipped'",
    "test": "vitest run --passWithNoTests"
  },
  "peerDependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "zod": "^4.3.6",
    "tsup": "^8.5.1",
    "typescript": "^5.7.0",
    "vitest": "^3.2.4"
  }
}
```

### 4.2 `packages/coach-sdk/tsup.config.ts`

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/schemas/index.ts',
    'src/types/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ['zod'],
  // outDir defaults to dist/
  // tsup emits .mjs for ESM + .cjs for CJS + .d.ts for types
  // Sub-path entries land at dist/schemas/index.{mjs,cjs,d.ts} matching the exports map.
});
```

### 4.3 `packages/coach-sdk/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "noEmit": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### 4.4 `packages/coach-sdk/src/index.ts`

```typescript
// Barrel re-export — consumers usually import from the sub-paths.
export * from './schemas/index.js';
export * from './types/index.js';
```

### 4.5 `packages/coach-sdk/src/schemas/index.ts`

See §5 for the three Zod schemas. The file re-exports each.

```typescript
export { ImportedProgramSchema } from './imported-program.js';
export { CoachClientLinkSchema } from './coach-client-link.js';
export { CoachProfileSchema } from './coach-profile.js';
```

### 4.6 `packages/coach-sdk/src/types/index.ts`

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

### 4.7 `packages/coach-sdk/vitest.config.ts`

```typescript
// Mirrors backend/api/vitest.config.ts shape (verified on disk).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{spec,test}.ts'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    reporters: 'default',
  },
});
```

### 4.8 `packages/coach-sdk/test/schemas.spec.ts`

```typescript
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ImportedProgramSchema,
  CoachClientLinkSchema,
  CoachProfileSchema,
} from '../src/schemas/index.js';

describe('ImportedProgramSchema', () => {
  it('parses a minimal valid program', () => {
    const r = ImportedProgramSchema.safeParse({
      name: 'Hyrox 8w',
      weeks: [
        {
          week_number: 1,
          sessions: [
            {
              name: 'Day 1',
              exercises: [{ name: 'Squat', sets: 5, reps: 5 }],
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejects negative reps', () => {
    const r = ImportedProgramSchema.safeParse({
      name: 'x',
      weeks: [{ week_number: 1, sessions: [{ name: 'd', exercises: [{ name: 'x', sets: 1, reps: -1 }] }] }],
    });
    expect(r.success).toBe(false);
    expect(r.error).toBeInstanceOf(z.ZodError);  // boundary instanceof check
  });
});

describe('CoachClientLinkSchema', () => {
  it('accepts active link', () => {
    const r = CoachClientLinkSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000001',
      coach_id: '00000000-0000-0000-0000-000000000002',
      client_id: '00000000-0000-0000-0000-000000000003',
      created_at: new Date().toISOString(),
      expires_at: null,
      revoked_at: null,
    });
    expect(r.success).toBe(true);
  });
});

describe('CoachProfileSchema', () => {
  it('accepts valid kyc_status', () => {
    const r = CoachProfileSchema.safeParse({
      user_id: '00000000-0000-0000-0000-000000000001',
      display_name: 'Anne',
      bio: null,
      specialties: ['hyrox', 'mobility'],
      website: null,
      photo_url: null,
      kyc_status: 'pending',
      kyc_docs: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(r.success).toBe(true);
  });
});
```

### 4.9 Turbo `build` ordering (no change needed)

`turbo.json` (verified on disk, line 14-18) already declares:

```json
"build": {
  "dependsOn": ["^build"],
  "outputs": ["dist/**", ".expo/**", "build/**"]
}
```

`turbo run build --filter=web` will cascade into `^build` of all `apps/web` deps — including `@ziko/coach-sdk` — building coach-sdk first automatically. No new turbo task needed.

### 4.10 Zod-version drift detection (post-install)

Add a one-line CI step (also locked in §9):

```bash
node -e "console.log('zod', require('zod/package.json').version)"
node -e "console.log('zod from coach-sdk', require.resolve('zod', { paths: ['packages/coach-sdk'] }))"
# Both lines MUST report the same zod version; if coach-sdk's resolve points to its own
# nested node_modules/zod, the peerDependency was misconfigured.
```


## §5. Zod Schemas — 3 Contracts (sourced from migrations 034/035/036 + Phase 22 D-11)

All three schemas mirror the database column sets verified on-disk. Phase 22 VERIFICATION.md confirms the columns are live. The Zod shapes below are the **single source of truth** per ARCH-04.

### 5.1 `ImportedProgramSchema` — `weeks_data` JSONB

**Mirrors:** Phase 22 D-11 — `weeks_data JSONB` has NO DB CHECK. Zod is the only guard. Shape covers PROG-02 requirements (multi-week, multi-session, exercises with sets/reps/RPE/RIR/rest).

**File:** `packages/coach-sdk/src/schemas/imported-program.ts`

```typescript
import { z } from 'zod';

// ─── ExerciseSchema ───────────────────────────────────────────
// PROG-02: each exercise has name, sets, reps, optional RPE/RIR/rest
const ExerciseSchema = z.object({
  // From existing exercise library OR free-text (PROG-03)
  exercise_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  sets: z.number().int().min(1).max(50),
  reps: z.number().int().min(1).max(1000),
  // Either RPE (1-10) or RIR (0-5) — at most one
  target_rpe: z.number().min(1).max(10).nullable().optional(),
  target_rir: z.number().int().min(0).max(5).nullable().optional(),
  rest_seconds: z.number().int().min(0).max(3600).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  // Confidence score per field (IMPORT-03 — set by AI parser, null when authored manually)
  confidence: z.number().min(0).max(1).nullable().optional(),
}).strict();

// ─── SessionSchema ────────────────────────────────────────────
const SessionSchema = z.object({
  name: z.string().min(1).max(200),
  day_of_week: z.number().int().min(1).max(7).nullable().optional(),
  exercises: z.array(ExerciseSchema).min(1).max(50),
  notes: z.string().max(2000).nullable().optional(),
}).strict();

// ─── WeekSchema ───────────────────────────────────────────────
const WeekSchema = z.object({
  week_number: z.number().int().min(1).max(52),
  sessions: z.array(SessionSchema).min(1).max(14),  // up to 2/day x 7 days
  notes: z.string().max(2000).nullable().optional(),
}).strict();

// ─── ImportedProgramSchema (THE TOP-LEVEL) ────────────────────
export const ImportedProgramSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  goal: z.enum([
    'strength', 'hypertrophy', 'endurance', 'weight_loss',
    'body_recomp', 'hyrox', 'powerlifting', 'general', 'other',
  ]).nullable().optional(),
  equipment: z.array(z.string().max(100)).max(50).nullable().optional(),
  weeks: z.array(WeekSchema).min(1).max(30),  // IMPORT-07: up to 30-page multi-week
  source: z.enum(['ai_import', 'manual', 'template_fork']).nullable().optional(),
  // Confidence aggregate (IMPORT-03)
  overall_confidence: z.number().min(0).max(1).nullable().optional(),
}).strict();
```

### 5.2 `CoachClientLinkSchema` — `coach_client_links` row

**Mirrors:** migration 035 lines 43-51 (verified on-disk).

**File:** `packages/coach-sdk/src/schemas/coach-client-link.ts`

```typescript
import { z } from 'zod';

export const CoachClientLinkSchema = z.object({
  id: z.string().uuid(),
  coach_id: z.string().uuid(),
  client_id: z.string().uuid(),
  expires_at: z.string().datetime({ offset: true }).nullable(),
  revoked_at: z.string().datetime({ offset: true }).nullable(),
  created_at: z.string().datetime({ offset: true }),
}).strict()
  .refine((d) => d.coach_id !== d.client_id, {
    message: 'coach_id and client_id must differ (matches DB CHECK)',
    path: ['client_id'],
  });

// Derived predicate (D-01: active = revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
export function isLinkActive(link: z.infer<typeof CoachClientLinkSchema>, now: Date = new Date()): boolean {
  if (link.revoked_at !== null) return false;
  if (link.expires_at === null) return true;
  return new Date(link.expires_at) > now;
}
```

### 5.3 `CoachProfileSchema` — `coach_profiles` row

**Mirrors:** migration 034 lines 29-41 (verified on-disk). Covers all 10 columns from Phase 22 D-05.

**File:** `packages/coach-sdk/src/schemas/coach-profile.ts`

```typescript
import { z } from 'zod';

export const CoachKycStatusSchema = z.enum([
  'pending',
  'submitted',
  'verified',
  'rejected',
]);

// kyc_docs JSONB — array of doc references (Phase 24 will refine)
export const CoachKycDocSchema = z.object({
  type: z.enum(['certification', 'id_document', 'other']),
  url: z.string().url(),
  uploaded_at: z.string().datetime({ offset: true }),
  filename: z.string().max(255).optional(),
}).strict();

export const CoachProfileSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().min(1).max(200),
  bio: z.string().max(5000).nullable(),
  specialties: z.array(z.string().min(1).max(100)).max(20),
  website: z.string().url().nullable(),
  photo_url: z.string().url().nullable(),
  kyc_status: CoachKycStatusSchema,
  kyc_docs: z.array(CoachKycDocSchema),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).strict();
```

### 5.4 Schema-to-migration traceability

| Migration | DB columns | Schema covers |
|-----------|-----------|---------------|
| `034_coach_role_profiles.sql` lines 29-41 | `coach_profiles` (10 cols) | `CoachProfileSchema` (10 fields, exact 1:1) |
| `035_coach_invitations_links_rls.sql` lines 43-51 | `coach_client_links` (6 cols) | `CoachClientLinkSchema` (6 fields, exact 1:1) |
| `036_workout_programs_ai_imports.sql` line 24 | `workout_programs.weeks_data JSONB` | `ImportedProgramSchema` (per Phase 22 D-11 — Zod is the only guard) |

## §6. Vercel Two-Project Config (D-14)

### 6.1 `apps/web/vercel.json` (new)

```json
{
  "framework": "nextjs",
  "buildCommand": "cd ../.. && turbo run build --filter=web",
  "installCommand": "cd ../.. && npm install",
  "outputDirectory": ".next",
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."
}
```

Notes:
- `framework: nextjs` — Vercel infers Next.js conventions (output dir, runtime).
- `buildCommand` reaches up to repo root and runs turbo with `--filter=web`. Turbo's `dependsOn: ["^build"]` (turbo.json line 16) cascades into `@ziko/coach-sdk` first.
- `installCommand` runs `npm install` at root so all workspaces share a single lockfile.
- `ignoreCommand` — Vercel runs this in the Project's Root Directory (`apps/web`). Exit 0 = skip build. `git diff --quiet HEAD^ HEAD -- .` means: skip if no files inside `apps/web/` changed between the previous commit and HEAD.
- IMPORTANT: Vercel Project must have **Root Directory = `apps/web`** set in Vercel dashboard. Without this, `ignoreCommand` runs against repo root and never skips.

### 6.2 `backend/api/vercel.json` (existing — add `ignoreCommand`)

Existing (verified on disk):

```json
{
  "buildCommand": "",
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/app" }
  ],
  "crons": [
    { "path": "/supplements/cron/scrape", "schedule": "0 3 * * 1" },
    { "path": "/storage/cron/cleanup", "schedule": "0 4 * * *" }
  ]
}
```

After Phase 23 — add one field:

```json
{
  "buildCommand": "",
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/app" }
  ],
  "crons": [
    { "path": "/supplements/cron/scrape", "schedule": "0 3 * * 1" },
    { "path": "/storage/cron/cleanup", "schedule": "0 4 * * *" }
  ],
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."
}
```

The `ignoreCommand` is **identical** for both projects; the difference is which Root Directory each Vercel Project points at. Project A roots at `apps/web`, Project B at `backend/api`. Each `git diff -- .` runs scoped to that root.

### 6.3 Vercel Dashboard Manual Cutover Steps (Phase 23 final task)

This is a manual checklist for PLAN.md final wave:

1. **Connect ziko-platform repo** to existing Vercel `ziko-web` project (or create new) → set **Root Directory** = `apps/web`.
2. **Copy env vars** from `c:/ziko-web` Vercel project to new `ziko-web` (production + preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Add `DEBUG_LIMITS=on` to **preview** scope only.
3. **Verify Root Directory** on `ziko-api-lilac` project — should already be `backend/api`. If not, set it now.
4. **Verify Pro tier** on both projects via dashboard → trigger preview deploy → curl `/api/_debug/limits` per §11.SC5.
5. **DNS** — `ziko-app.com` and `*.ziko-app.com` already pointed at Vercel. After connect + first successful prod deploy, no DNS change needed.

## §7. ESLint `no-restricted-imports` Configuration (D-11, D-12)

### 7.1 `apps/web/eslint.config.mjs`

Extends migrated base (`c:/ziko-web/eslint.config.mjs` already has `next/core-web-vitals` and `next/typescript`); layer D-11 + D-12 rules on top.

```javascript
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // Inherit existing Next.js rules from the migrated config
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // ─── D-11: Ban @supabase/supabase-js in Server Components / app code ────
  {
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@supabase/supabase-js',
            message: 'Use @supabase/ssr factories from src/lib/supabase/. See ARCH-05.',
          },
          {
            name: '@supabase/auth-helpers-nextjs',
            message: 'Deprecated. Use @supabase/ssr instead. See ARCH-05.',
          },
        ],
        // D-12: Cross-module imports — patterns activate when Phase 24 creates the folders.
        // ESLint ignores patterns that match no files; safe to ship now.
        patterns: [
          {
            group: ['**/coach/*/db/**'],
            message: 'Cross-module DB imports forbidden. Use the module\'s service.ts. See ARCH-02.',
          },
          {
            group: ['**/coach/*/internal/**'],
            message: 'Cross-module internal imports forbidden. Use the module\'s service.ts. See ARCH-02.',
          },
        ],
      }],
    },
  },

  // ─── D-11 Allowlist: Legacy admin client + tests ──────────────────────
  {
    files: [
      'src/lib/supabase/admin.ts',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
    ],
    rules: {
      // Disable the supabase-js ban in these files
      'no-restricted-imports': 'off',
    },
  },

  // ─── D-12 service.ts allowlist (Phase 24+ — pattern matches no files in Phase 23) ──
  {
    files: ['**/coach/*/service.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
```

### 7.2 Why two rule layers, not one

Flat config evaluates configs in order; the later config overrides the earlier when `files` patterns match. The allowlist entries each declare `'no-restricted-imports': 'off'` for matching files, which is the canonical flat-config allowlist pattern.

### 7.3 Smoke-test the lint rule (Wave 0, then revert)

```bash
# Temporary fixture to prove the rule fires:
echo "import { createClient } from '@supabase/supabase-js';" > apps/web/src/lib/_smoke_lint.ts
npm run lint --workspace=apps/web
# Expected: error citing @supabase/supabase-js
rm apps/web/src/lib/_smoke_lint.ts

# And prove the admin allowlist works:
# admin.ts already imports @supabase/supabase-js (verified on disk c:/ziko-web/src/lib/supabase/admin.ts line 2)
# After migration, run lint — admin.ts MUST NOT produce a no-restricted-imports error.
npm run lint --workspace=apps/web
# Expected: zero no-restricted-imports errors
```


## §8. Bundle Analyzer Pipeline (D-02 step 3)

### 8.1 Install

```bash
npm install --workspace=apps/web --save-dev @next/bundle-analyzer@^16.2.6
```

### 8.2 Wire into `apps/web/next.config.ts`

```typescript
import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  // Emit JSON artifacts for CI grep (in addition to HTML)
  openAnalyzer: false,
  analyzerMode: 'static',
  generateStatsFile: true,
  statsFilename: 'stats.json',
});

const nextConfig = {};

export default analyzer(withNextIntl(nextConfig));
```

### 8.3 Build with analysis

```bash
cd apps/web
ANALYZE=true npm run build
# Emits to apps/web/.next/analyze/{client,nodejs,edge}.html + stats.json
# The grep-able artifact is the stats.json (JSON-serialized webpack/Turbopack module graph)
```

### 8.4 CI grep verification (D-02 step 3 — locked)

```bash
# Run from repo root
cd C:/ziko-platform
ANALYZE=true turbo run build --filter=web

# HARD GATE: zero matches for /react-native(?!-web)/ in client bundle stats
if grep -E '"name":\s*"[^"]*react-native(?!-web)' apps/web/.next/analyze/stats.json; then
  echo "FAIL: react-native modules leaked into web client bundle"
  exit 1
fi
echo "PASS: bundle is RN-clean"
```

**Note on grep regex:** ripgrep / GNU grep `-E` supports negative lookahead on most modern installs. If lookahead is not supported on the CI runner, fall back to:

```bash
grep '"name":' apps/web/.next/analyze/stats.json | grep 'react-native' | grep -v 'react-native-web' && exit 1 || exit 0
```

### 8.5 Output artifact contract

The artifact CI greps:
- **Path:** `apps/web/.next/analyze/stats.json`
- **Format:** JSON object with a top-level `modules` array; each module has a `name` field that contains the resolved module path (e.g., `node_modules/react-native-reanimated/lib/...`).
- **Failure regex:** `"name":\s*"[^"]*react-native(?!-web)` — matches any module name containing `react-native` but NOT `react-native-web`.

## §9. CI Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # ─── Job 1: type-check + lint + unit tests ───────────────────────
  verify:
    name: type-check / lint / test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2   # for git diff on ignoreBuildStep equivalent
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install
        run: npm install
      - name: Type-check
        run: npx turbo run type-check
      - name: Lint
        run: npx turbo run lint
      - name: Test
        run: npx turbo run test

  # ─── Job 2: no SERVICE_ROLE under coach/ (ARCH-03, D-12 second layer) ─
  no-service-role-in-coach:
    name: Verify no SERVICE_ROLE under coach/
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Grep guard
        run: |
          # Phase 23 ships the rule; Phase 24 creates backend/api/src/coach/
          if [ -d backend/api/src/coach ]; then
            if grep -r 'SERVICE_ROLE' backend/api/src/coach/; then
              echo "FAIL: SERVICE_ROLE reference found under backend/api/src/coach/"
              exit 1
            fi
          fi
          echo "PASS: no SERVICE_ROLE under coach/ (or directory does not exist yet)"

  # ─── Job 3: bundle hygiene (D-02 step 3) ──────────────────────────
  bundle-hygiene:
    name: Verify no react-native in web bundle
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install
        run: npm install
      - name: Build with analyzer
        run: ANALYZE=true npx turbo run build --filter=web
      - name: Assert RN-clean bundle
        run: |
          if grep -E '"name":\s*"[^"]*react-native(?!-web)' apps/web/.next/analyze/stats.json; then
            echo "FAIL: react-native leaked into web bundle"
            exit 1
          fi
          echo "PASS: web bundle is RN-clean"

  # ─── Job 4: Zod version drift check (D-08 safety) ─────────────────
  zod-drift:
    name: coach-sdk zod resolves to root zod
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm install
      - name: Verify zod is hoisted, not duplicated
        run: |
          ROOT_ZOD=$(node -e "console.log(require.resolve('zod'))")
          SDK_ZOD=$(node -e "console.log(require.resolve('zod', { paths: ['packages/coach-sdk'] }))")
          if [ "$ROOT_ZOD" != "$SDK_ZOD" ]; then
            echo "FAIL: coach-sdk resolves a different zod than root"
            echo "  ROOT: $ROOT_ZOD"
            echo "  SDK:  $SDK_ZOD"
            exit 1
          fi
          echo "PASS: zod resolves to single instance ($ROOT_ZOD)"
```

**Job-name grep targets** (job names are stable strings — usable as CI status checks):
- `type-check / lint / test`
- `Verify no SERVICE_ROLE under coach/`
- `Verify no react-native in web bundle`
- `coach-sdk zod resolves to root zod`

## §10. Validation Architecture — Nyquist Dimension 8

See "## Validation Architecture" earlier in this document for the framework table and Wave 0 gaps.

This section provides the **success-criterion → test mapping** the planner turns into `[BLOCKING]` tasks.

### SC1: `apps/web/` lives in the Turborepo (or documented dual-repo fallback)

| Truth | Test | Command |
|-------|------|---------|
| `apps/web/package.json` exists | shell | `test -f apps/web/package.json && echo PASS` |
| `apps/web` resolves as a workspace | npm | `npm ls --workspace=apps/web --depth=0` exits 0 |
| Spike outcome documented in PLAN.md | manual | Reviewer confirms "Monorepo / Dual-Repo" written in 23-SUMMARY.md |
| If dual-repo: `@ziko/coach-sdk` published | shell | `npm view @ziko/coach-sdk version --registry=https://npm.pkg.github.com` |

### SC2: `@supabase/ssr` layered auth; `@supabase/supabase-js` banned in Server Components

| Truth | Test | Command |
|-------|------|---------|
| `@supabase/ssr` installed in apps/web | shell | `npm ls --workspace=apps/web @supabase/ssr` exits 0 |
| `updateSession` function exists with correct shape | unit | `npm run test --workspace=apps/web -- factories.spec.ts` (asserts `updateSession` returns `NextResponse`) |
| ESLint bans `@supabase/supabase-js` | lint | smoke-test in §7.3 |
| Allowlist permits `admin.ts` | lint | `npm run lint --workspace=apps/web` is green with admin.ts present |
| Coach layout calls `getUser()` | grep | `grep -q 'getUser' apps/web/src/app/\[locale\]/\(coach\)/layout.tsx` |
| Smoke route triggers Server Action re-check | smoke | preview deploy curl |

### SC3: `packages/coach-sdk` exists with 3 schemas

| Truth | Test | Command |
|-------|------|---------|
| Package builds | shell | `npm run build --workspace=@ziko/coach-sdk` |
| `dist/schemas/index.mjs` exists | shell | `test -f packages/coach-sdk/dist/schemas/index.mjs` |
| `dist/schemas/index.cjs` exists | shell | `test -f packages/coach-sdk/dist/schemas/index.cjs` |
| `dist/schemas/index.d.ts` exists | shell | `test -f packages/coach-sdk/dist/schemas/index.d.ts` |
| All 3 schemas round-trip | unit | `npm run test --workspace=@ziko/coach-sdk -- --run` |
| Consumed by web (import resolves) | type-check | `npx tsc --noEmit -p apps/web/tsconfig.json` |

### SC4: ESLint `no-restricted-imports` + CI grep guard

| Truth | Test | Command |
|-------|------|---------|
| ESLint rule layered correctly | shell | smoke-test in §7.3 |
| CI grep for `SERVICE_ROLE` under coach/ runs | CI | job `Verify no SERVICE_ROLE under coach/` in `.github/workflows/ci.yml` |
| CI passes on Phase 23 (coach/ doesn't exist yet) | CI | green status check |

### SC5: Vercel Pro confirmed; force-dynamic / no-store enforced

| Truth | Test | Command |
|-------|------|---------|
| `/api/_debug/limits` returns 200 after 30s on web project preview | smoke | `curl -s -m 65 'https://<web-preview>/api/_debug/limits'` returns `{ ok: true, tier: 'pro-confirmed' }` |
| `/_debug/limits` returns 200 after 30s on backend preview | smoke | `curl -s -m 65 'https://<api-preview>/_debug/limits'` same shape |
| All `(coach)` pages declare `force-dynamic` | grep | `grep -L 'force-dynamic' apps/web/src/app/\[locale\]/\(coach\)/**/page.tsx` lists nothing |
| All `(coach)` pages declare `revalidate = 0` | grep | `grep -L 'revalidate' apps/web/src/app/\[locale\]/\(coach\)/**/page.tsx` lists nothing |
| `maxDuration = 60` on `/api/_debug/limits` | grep | `grep -q 'maxDuration = 60' apps/web/src/app/api/_debug/limits/route.ts` |

## §11. Spike Execution Recipe (D-01, D-02)

This is the EXACT bash sequence the spike must run, with explicit pass/fail per step.

### 11.1 Pre-flight

```bash
cd C:/ziko-platform
git checkout gsd/phase-23-web-turborepo-onboarding-auth-bootstrap
git tag pre-web-onboarding -m "Phase 23 rollback point"
git push origin pre-web-onboarding
```

### 11.2 Subtree merge

```bash
cd C:/ziko-platform
git remote add ziko-web-source "C:/ziko-web" 2>/dev/null || true
git fetch ziko-web-source
git subtree add --prefix=apps/web ziko-web-source main
```

**PASS:** Exit code 0; `ls apps/web/middleware.ts` exists.
**FAIL:** Exit non-zero → activate D-04 dual-repo, jump to §12.

### 11.3 Workspace install + coach-sdk skeleton

```bash
# Remove ziko-web's standalone lockfile
rm -f apps/web/package-lock.json apps/web/npm-shrinkwrap.json

# Create coach-sdk package skeleton (use files from §4)
mkdir -p packages/coach-sdk/src/schemas packages/coach-sdk/src/types packages/coach-sdk/test
# [write the package.json / tsup.config.ts / tsconfig.json / src files per §4 + §5]

# Install
cd C:/ziko-platform
npm install

# Wire coach-sdk dependency into apps/web
npm install --workspace=apps/web --save '@ziko/coach-sdk@*'
```

**PASS:** `npm ls --workspace=apps/web @ziko/coach-sdk` exits 0.
**FAIL:** Inspect workspace symlinks; if root `package.json` `workspaces` array does not include `packages/*`, fix it (line 7 already does — verified on-disk).

### 11.4 Triple-green check (D-02)

**Step 1: web build**

```bash
cd C:/ziko-platform
turbo run build --filter=web
```

**PASS:** Exit 0; `apps/web/.next/` exists.
**FAIL:** Capture error; if RN-related → fall back to D-04. Other → fix and retry.

**Step 2: mobile prebuild**

```bash
cd C:/ziko-platform/apps/mobile
npx expo prebuild --clean
cd ../..
```

**PASS:** Exit 0; mobile native projects regenerate cleanly.
**FAIL:** Capture error. If error mentions web-only deps bleeding into mobile, document; if independent regression, fix before continuing.

**Step 3: bundle analyzer regex**

```bash
cd C:/ziko-platform
ANALYZE=true turbo run build --filter=web
grep -E '"name":\s*"[^"]*react-native(?!-web)' apps/web/.next/analyze/stats.json
```

**PASS:** Grep exits 1 (no matches).
**FAIL:** Grep exits 0 (matches found) → react-native leaked. Apply fix per Open Question #2 (move `react-native-worklets` from root deps to `apps/mobile`), retry. If still red after 2 hours of investigation → fall back to D-04 per D-02 rule.

### 11.5 Smoke route + smoke deploy (D-13, D-15)

After all three green:

```bash
# Write the smoke route files per Code Examples §s 1-7
# - apps/web/src/lib/supabase/{client,server,middleware,admin}.ts
# - apps/web/middleware.ts (composed)
# - apps/web/src/app/[locale]/(coach)/layout.tsx
# - apps/web/src/app/[locale]/(coach)/_smoke/{page,action,SmokeButton}.tsx
# - apps/web/src/app/api/_debug/limits/route.ts

# Commit and push
git add apps/web packages/coach-sdk .github/workflows/ci.yml
git commit -m "feat(23): apps/web onboarding + coach-sdk + composed middleware"
git push -u origin gsd/phase-23-web-turborepo-onboarding-auth-bootstrap

# Vercel auto-deploys preview. Capture URL.
VERCEL_URL="https://<preview-url>.vercel.app"

# Create a test user via Supabase admin
# (Manual one-liner against supabase admin API — captured in PLAN.md task)

# Inject cookie:
COOKIE="sb-<project-ref>-auth-token=<value-from-test-user>"

# SC1: unauth GET → 307 redirect
curl -I "$VERCEL_URL/fr/coach/_smoke" | head -1
# Expected: HTTP/2 307 or 302

# SC2: authed GET → 200, body contains user.id
curl -s -b "$COOKIE" "$VERCEL_URL/fr/coach/_smoke" | grep -o 'Signed in as <code>[^<]*</code>'

# SC3: Pro tier proof
curl -s -m 65 "$VERCEL_URL/api/_debug/limits" | jq
# Expected after ~30s: { "ok": true, "tier": "pro-confirmed", "durationSec": 30 }
# If timeout at 10s → Hobby tier → must upgrade before Phase 28
```

### 11.6 Spike outcome decision tree

```
                    All 3 D-02 checks GREEN?
                              │
              ┌───────────────┼────────────────┐
              │ YES                            │ NO
              ▼                                ▼
        Monorepo path                    Dual-repo path
        (continue Phase 23               (D-04 activation,
         in monorepo)                     §12)
              │                                │
              ▼                                ▼
        Write smoke +                  git reset --hard
        deploy, run §11.5              pre-web-onboarding,
        smoke curl checks              push --force-with-lease,
              │                        publish coach-sdk to GH Packages
              ▼                                │
        SC5 Pro tier proof                     ▼
        passes? YES → DONE             ziko-web stays separate,
                                       installs @ziko/coach-sdk via npm
```

## §12. GitHub Packages Fallback Recipe (D-04 — Insurance)

Even on the monorepo path, the release workflow ships so the SDK can be split out later without rebuilding the publish pipeline. **Publish step is conditional** — fires only when `vars.PUBLISH_COACH_SDK == 'true'` or when monorepo path fails.

### 12.1 `.npmrc` (only needed when consuming the published package)

**File (consumer side — e.g., `c:/ziko-web/.npmrc` if dual-repo):**

```
@ziko:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
always-auth=true
```

**CI side (GitHub Actions automatically provides `GITHUB_TOKEN`):**

```yaml
- name: Auth to GitHub Packages
  run: |
    echo "@ziko:registry=https://npm.pkg.github.com" >> ~/.npmrc
    echo "//npm.pkg.github.com/:_authToken=${{ secrets.GITHUB_TOKEN }}" >> ~/.npmrc
```

### 12.2 GitHub Actions release workflow (ships even on monorepo path)

**File:** `.github/workflows/publish-coach-sdk.yml`

```yaml
name: Publish @ziko/coach-sdk

on:
  push:
    branches: [main]
    paths:
      - 'packages/coach-sdk/**'
  workflow_dispatch:

jobs:
  publish:
    if: ${{ vars.PUBLISH_COACH_SDK == 'true' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@ziko'
      - name: Install
        run: npm install
      - name: Build coach-sdk
        run: npx turbo run build --filter=@ziko/coach-sdk
      - name: Type-check + test
        run: |
          npx turbo run type-check --filter=@ziko/coach-sdk
          npx turbo run test --filter=@ziko/coach-sdk
      - name: Publish
        working-directory: packages/coach-sdk
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Activation:**
- Monorepo path (Phase 23 default): leave `vars.PUBLISH_COACH_SDK` unset; the job is no-op.
- Dual-repo fallback: set `vars.PUBLISH_COACH_SDK=true` in repo settings, bump `packages/coach-sdk/package.json` version, push.

### 12.3 Dual-repo activation procedure (only if D-02 fails)

```bash
# 1. Reset ziko-platform to pre-onboarding
cd C:/ziko-platform
git reset --hard pre-web-onboarding
git push --force-with-lease origin gsd/phase-23-web-turborepo-onboarding-auth-bootstrap

# 2. Keep packages/coach-sdk (it lands in ziko-platform regardless of monorepo decision)
# Re-cherry-pick the coach-sdk commits, or re-author them on the post-reset branch.

# 3. Activate publish workflow
gh variable set PUBLISH_COACH_SDK --body 'true'

# 4. Bump version and tag
cd packages/coach-sdk
# edit package.json version → 0.1.0
git add package.json
git commit -m "release(coach-sdk): v0.1.0 initial GH Packages publish"
git push

# 5. Workflow auto-publishes on push to main (after PR merge).
#    Or trigger manually: gh workflow run publish-coach-sdk.yml

# 6. In c:/ziko-web/:
cd C:/ziko-web
echo '@ziko:registry=https://npm.pkg.github.com' > .npmrc
echo '//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}' >> .npmrc
npm install '@ziko/coach-sdk@^0.1.0'

# 7. Refactor c:/ziko-web imports if any from the spike attempt are present:
#    import { ... } from '@ziko/coach-sdk/schemas';  // unchanged — same import path
```

### 12.4 Why ship D-04 even when D-02 passes

Per CONTEXT.md "Specifics" line 250 — **deliberate over-investment in optionality**. If a future need arises to extract the SDK (e.g., open-source release, partner integration, separate billing-context split for v2), the publish pipeline is already in place. Cost today: ~30 lines of YAML + an `.npmrc` template. Cost later if not pre-built: ~half a day during a high-pressure incident.

---

## RESEARCH COMPLETE
