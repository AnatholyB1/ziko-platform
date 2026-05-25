# Phase 23: Web Turborepo Onboarding & Auth Bootstrap — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning
**Milestone:** v1.5 — Coach Platform & CRM
**Depends on:** Phase 22 (VERIFIED 2026-05-14)

<domain>
## Phase Boundary

Phase 23 lands the **web foundation** for v1.5 — five interlocking deliverables, all of which must be reachable end-to-end at the close of the phase:

1. **`apps/web/`** exists inside the Turborepo (after a 1-day spike decides monorepo vs dual-repo), running Next 15.5 + React 19 + Tailwind v4 + `next-intl` (carried over from `c:/ziko-web`).
2. **`@supabase/ssr`** powers layered cookie-based auth: middleware refresh + `(coach)` layout `getUser()` + Server Action re-check. **`@supabase/supabase-js`** is ESLint-banned in Server Components.
3. **`packages/coach-sdk`** exists as a workspace package exporting `ImportedProgramSchema`, `CoachClientLinkSchema`, `CoachProfileSchema` (Zod) consumed by web + backend + mobile.
4. **ESLint `no-restricted-imports`** blocks cross-module imports outside `coach/<m>/service`; a **CI grep** verifies no `SERVICE_ROLE` references appear under `backend/api/src/coach/`.
5. **Vercel Pro tier** is confirmed enabled (evidence-based, via `/api/_debug/limits` probe) for both `apps/web/` and `backend/api`; all `(coach)` routes declare `dynamic = 'force-dynamic'`, `revalidate = 0`, `cache: 'no-store'`.

**The user-visible surface of Phase 23 is one route**: `/fr/coach/_smoke` — a Server Component that renders `Signed in as {user.id}` plus a Server Action button that re-checks `getUser()`. No login UI ships in Phase 23 (defers to Phase 24). Manual auth uses cookie paste from a Supabase admin-created test user.

**Out of phase (explicitly deferred):**
- Login / signup UI → Phase 24 (Coach Identity & Onboarding)
- Coach profile form, KYC upload → Phase 24
- Mobile "Mon coach" code redemption → Phase 25
- TanStack Table client list, signal filters → Phase 26
- Program template authoring, weeks_data editor → Phase 27
- AI import upload flow → Phase 28

</domain>

<decisions>
## Implementation Decisions

### Spike & Integration Approach (Open Decision #1, gates the phase)

- **D-01 — Spike scope: Full move + smoke.** The spike attempts the real `apps/web` move (git mv from `c:/ziko-web` with subtree history preservation), wires `next-intl` + `@supabase/ssr` middleware composition, ships `/fr/coach/_smoke` route calling `supabase.auth.getUser()`, and runs `apps/mobile` build to detect RN/web cross-contamination. The spike must produce **either** a green PR (monorepo path) **or** a documented failure with rollback decision (dual-repo path) by EOD spike day.

- **D-02 — Go/no-go criterion: Triple-green checklist.** Monorepo wins **iff ALL three** are green:
  1. `turbo run build --filter=web` succeeds in `apps/web`
  2. `cd apps/mobile && npx expo prebuild --clean` still succeeds
  3. Bundle analysis (`ANALYZE=true next build` via `@next/bundle-analyzer` or Turbopack's `--profile`) shows **zero** `react-native*` modules in the web client bundle.

  Any red → fall back to dual-repo per D-04. Planner: lock the bundle-analyzer command + threshold (regex `react-native(?!-web)` matches in `.next/analyze/*.json` must be 0).

- **D-03 — Migration strategy (monorepo path): `git mv` preserving history.** Use `git subtree add --prefix=apps/web c:/ziko-web main --squash=false` (or `git filter-repo --to-subdirectory-filter apps/web` on a clone of ziko-web, then merge into ziko-platform). Preserves all v1.0–v1.4 landing-page blame and commit history in `ziko-platform`'s git log. Planner: research the exact subtree command shape; document the rollback (a tag `pre-web-onboarding` on `main` of `ziko-platform` before the merge, archive `c:/ziko-web` as `c:/ziko-web.archived-2026-05-XX/`).

- **D-04 — Dual-repo fallback (if D-02 fails): `coach-sdk` to GitHub Packages.** Publish `@ziko/coach-sdk` to GitHub Packages registry (private, scoped, uses existing GitHub org auth). `c:/ziko-web` installs via `npm install @ziko/coach-sdk` with `.npmrc` declaring `@ziko:registry=https://npm.pkg.github.com` and `GITHUB_TOKEN` for CI. Version-tagged on each merge to `ziko-platform` `main`. Planner: ship the GitHub Actions release workflow even on the monorepo path (so SDK can later be split to dual-repo without rebuilding the publish pipeline) — flagged as optional, low-cost insurance.

### coach-sdk Packaging (3-bundler consumption)

- **D-05 — Build output: `tsup` → dual ESM + CJS + `.d.ts`.** `tsup.config.ts`: `{ entry: ['src/index.ts', 'src/schemas/index.ts', 'src/types/index.ts'], format: ['esm', 'cjs'], dts: true, clean: true, external: ['zod'] }`. Each consumer's bundler picks the right output via `exports` map. Pattern matches existing `packages/ai-client` / `packages/plugin-sdk` v1.4 build pattern (planner: verify by reading those packages).

- **D-06 — Exports surface: Sub-path exports per domain.**
  ```json
  // packages/coach-sdk/package.json
  "exports": {
    ".":          { "import": "./dist/index.mjs",   "require": "./dist/index.cjs",   "types": "./dist/index.d.ts" },
    "./schemas":  { "import": "./dist/schemas/index.mjs", "require": "./dist/schemas/index.cjs", "types": "./dist/schemas/index.d.ts" },
    "./types":    { "import": "./dist/types/index.mjs",   "require": "./dist/types/index.cjs",   "types": "./dist/types/index.d.ts" }
  }
  ```
  Imports look like `import { ImportedProgramSchema } from '@ziko/coach-sdk/schemas'` and `import type { CoachProfile } from '@ziko/coach-sdk/types'`. Tree-shakes per-path on mobile.

- **D-07 — Supabase client factories live in `apps/web/src/lib/supabase/` only.** `coach-sdk` does **NOT** export `createBrowserClient` / `createServerClient` — those are `@supabase/ssr`-specific and would leak web-only deps into mobile. Mobile keeps its existing `apps/mobile/src/lib/supabase.ts` unchanged. Backend keeps its existing `backend/api/src/middleware/auth.ts` validation. `coach-sdk` stays bundler-agnostic: **only** Zod schemas + pure TypeScript types.

- **D-08 — Zod version: peerDependency `^4.0.0`.** `coach-sdk/package.json` declares `peerDependencies: { zod: "^4.0.0" }` + matching `devDependencies`. Each consumer installs zod (root already has `zod@^4.3.6`); npm de-dupes if compatible, warns otherwise. Prevents `instanceof ZodError` drift across package boundaries. Planner: verify all three consumers (web, backend, mobile) end up resolving the same zod version after install; add a `turbo run` post-install check if needed.

### Auth + i18n Nesting + ESLint Guardrails

- **D-09 — `(coach)` route position: Inside `[locale]` (`/fr/coach`, `/en/coach`).** Routes live at `app/[locale]/(coach)/...`. Reuses existing `next-intl` infrastructure with zero refactor to landing pages. Coach UI inherits i18n for free (FR-FR default per PROJECT.md French jurisdiction, EN-US optional). All `(coach)` pages declare `export const dynamic = 'force-dynamic'; export const revalidate = 0;` and all Supabase reads use `cache: 'no-store'` (ARCH-06 enforcement).

- **D-10 — `middleware.ts` composition: Supabase-first, then `next-intl` delegated.** Single `middleware.ts` chains:
  ```typescript
  // 1. Refresh Supabase session cookies (per @supabase/ssr Next 15 official guide)
  const supaResponse = await updateSession(req);
  // 2. If path is /<locale>/coach/*, return Supabase response (auth-only)
  if (req.nextUrl.pathname.match(/^\/(fr|en)\/coach(\/|$)/)) return supaResponse;
  // 3. Otherwise delegate to next-intl middleware for locale routing
  return intlMiddleware(req);
  ```
  Matcher: `['/', '/(fr|en)/:path*', '/((?!_next|_vercel|api|.*\\..*).*)']`. Planner: verify the exact `updateSession()` shape from `@supabase/ssr` Next 15 docs (Context7 query); confirm header propagation (cookies must be forwarded to the next handler, not consumed).

- **D-11 — ESLint ban on `@supabase/supabase-js`: strict, with narrow allowlist.** `apps/web/eslint.config.mjs` adds `no-restricted-imports` rule:
  ```javascript
  { name: '@supabase/supabase-js', message: 'Use @supabase/ssr factories from src/lib/supabase/. See ARCH-05.' }
  ```
  Allowlist (via `overrides`): `src/lib/supabase/admin.ts` (legacy account-delete via service-role, pre-dates v1.5), `**/*.test.ts`, `**/*.spec.ts`. Errors (not warnings). Forces all new web code through `@supabase/ssr`.

- **D-12 — ARCH-02 enforcement: ESLint + CI grep dual-layer.**
  - **ESLint rule** (effective once Phase 24 introduces `coach/<module>/` folders): `no-restricted-imports` blocks `**/coach/*/db/**` and `**/coach/*/internal/**` from outside their own `service.ts`. Phase 23 ships the rule with a TODO note that the patterns activate as soon as first module lands.
  - **CI grep** (Phase 23 ships immediately): GitHub Actions step runs `grep -r 'SERVICE_ROLE' backend/api/src/coach/ && exit 1 || exit 0`. Step name "Verify no SERVICE_ROLE under coach/". Matches Phase 23 success criterion 4 verbatim.

### Thin Slice + Vercel Topology + Test Surface

- **D-13 — Phase 23 thin slice: Server Action protected route.** Ships `/fr/coach/_smoke/`:
  - `page.tsx` — Server Component, calls `getUser()`, renders `Signed in as {user.id}` (or redirects to `/fr/login` placeholder if unauth).
  - `action.ts` — `'use server'`, re-checks `getUser()`, returns `{ ok: true, userId, ts }` JSON.
  - `SmokeButton.tsx` — client component, invokes the action and renders the response.

  Layout (`app/[locale]/(coach)/layout.tsx`) guards with `getUser()` → `redirect()` on null. This exercises **all three** ARCH-05 layers (middleware refresh + layout guard + Server Action re-check). No login UI. Manual test = inject a valid sb-auth cookie from a `supabase.auth.admin.createUser()` admin call. The `_smoke` directory is **deleted** as the first task of Phase 24.

- **D-14 — Vercel topology: Two projects in one monorepo.**
  - **Project A**: `ziko-web` (Pro tier). Root: `apps/web`. Framework: Next.js. Build: `turbo run build --filter=web`. Domain: `ziko-app.com` (production), `*.vercel.app` (previews).
  - **Project B**: `ziko-api-lilac` (Pro tier, existing). Root: `backend/api`. Framework: Hono via `@hono/vercel`. Build: `turbo run build --filter=api`. Already configured pre-v1.5.
  
  Each Vercel project ignores changes outside its root via `vercel.json` `ignoreBuildStep` or Vercel dashboard "ignored build step" with `git diff --quiet HEAD^ HEAD -- $VERCEL_ROOT`. Independent deploy cadence; one app's failure does not block the other.

- **D-15 — Vercel Pro proof: Automated `/api/_debug/limits` probe.**
  - Ships at `apps/web/src/app/api/_debug/limits/route.ts` (and `backend/api/src/routes/_debug.ts` equivalent), `export const maxDuration = 60`, `dynamic = 'force-dynamic'`.
  - Route is gated: returns 404 unless `process.env.DEBUG_LIMITS === 'on'`. Set the env on **preview** deploys only; not production.
  - Handler sleeps 30 seconds then returns `{ ok: true, tier: 'pro-confirmed' }`. If Vercel returned 504 at 10s the project is on Hobby; 200 after 30s proves Pro.
  - CI step on the verification preview deploy hits the URL with `DEBUG_LIMITS=on` set; records evidence in `23-VERIFICATION.md`.
  - **Removed in Phase 24** (debug routes have no production purpose; ARCH-08 evidence is captured by then).

- **D-16 — Test surface for Phase 23: Vitest unit + type-check + ESLint + smoke deploy.**
  - **Vitest unit**: `packages/coach-sdk/test/schemas.spec.ts` — golden parse/safeParse cases for all three Zod schemas (`ImportedProgramSchema`, `CoachClientLinkSchema`, `CoachProfileSchema`); `apps/web/src/lib/supabase/__tests__/factories.spec.ts` — factory return-type assertions (mocked cookies).
  - **Type-check**: `turbo run type-check` green across all workspaces (`apps/mobile`, `apps/web`, `backend/api`, `packages/coach-sdk`, `packages/plugin-sdk`, etc.).
  - **Lint**: `turbo run lint` green including the new `no-restricted-imports` rule.
  - **CI grep**: `grep -r 'SERVICE_ROLE' backend/api/src/coach/` returns empty (matches Phase 23 success criterion 4 verbatim).
  - **Smoke**: Preview deploy hit via curl. Unauth GET on `/fr/coach/_smoke` → 307 redirect. Authed GET (cookie injected) → 200 + `user.id` in HTML body.
  - **No Playwright** in Phase 23 — defer E2E to Phase 24 when a real login flow exists worth testing.

### Icon Library (Open Decision #6, auto-resolved by audit)

- **D-17 — Icon library locked to `react-icons@^5.6.0`.** Audit of `c:/ziko-web/package.json` shows `react-icons` already installed. Per the roadmap rollback rule "Audit existing v1.0 landing; reuse whichever is already present" — the audit answers the decision. No migration to lucide/heroicons in Phase 23; revisit only if Phase 24+ design contract requires a specific icon set unavailable in `react-icons`.

### Claude's Discretion

The planner has flexibility on (and is expected to research before locking):
- The **exact** `git subtree`/`git filter-repo` command shape for D-03 (history-preserving merge of `c:/ziko-web` into `apps/web`). Both work; pick whichever is best-documented in 2026 and rollback-safest.
- The **exact** `@supabase/ssr` `updateSession()` implementation per its Next 15 official guide (Context7 query for `supabase/ssr` docs). Cookie handling subtleties around `request.cookies.set()` vs `response.cookies.set()` are non-obvious.
- Bundle-analyzer choice for D-02 step 3: `@next/bundle-analyzer` is the canonical option but Turbopack may need a different tool by 2026-05; pick whichever produces a machine-readable artifact CI can grep.
- Vercel `vercel.json` shape per project — Project A's `vercel.json` lives at `apps/web/vercel.json` after the move; planner picks the exact ignored-build-step script.
- The `.npmrc` shape for GitHub Packages (D-04) — needed only on the dual-repo branch.
- Whether `apps/web/eslint.config.mjs` extends the existing `c:/ziko-web/eslint.config.mjs` or starts fresh — minor decision, depends on what survives the migration.
- The Vitest config location for `packages/coach-sdk` — match `backend/api`'s pattern (root `vitest.config.ts` + `tsconfig.test.json`) for consistency.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — vision, key decisions log, v1.5 milestone framing
- `.planning/REQUIREMENTS.md` — §ARCH-02 (cross-module imports), §ARCH-04 (coach-sdk package), §ARCH-05 (Next.js web + `@supabase/ssr` layered auth), §ARCH-06 (`force-dynamic` + `no-store`), §ARCH-08 (Vercel Pro + `maxDuration = 60`)
- `.planning/STATE.md` — v1.5 blockers list (Open Decisions #1, #2, #6 all flagged as Phase 23 blockers); Phase 22 verification status
- `.planning/ROADMAP.md` — §Phase 23 success criteria (5 items); §Open Architectural Decisions #1, #2, #6 (rollback paths)
- `.planning/ROADMAP.md` — §Phase 24, §Phase 25 (downstream consumers of `coach-sdk` Zod schemas; planner must NOT break their assumptions)

### Phase 22 (delivered foundation)
- `.planning/phases/22-schema-foundation-rls-keystone/22-CONTEXT.md` — especially **D-11** (`weeks_data` Zod validation lives in `coach-sdk` — single source of truth for the JSONB shape, no DB CHECK) and **D-09** (full `ai_imports` column set Phase 23 schemas must mirror)
- `.planning/phases/22-schema-foundation-rls-keystone/22-VERIFICATION.md` — proof RLS + RPCs are green; coach-sdk's runtime context
- `supabase/migrations/034_coach_role_profiles.sql`, `035_coach_invitations_links_rls.sql`, `036_workout_programs_ai_imports.sql` — the DB shapes `coach-sdk` Zod schemas must match

### Existing patterns to reuse (in ziko-platform)
- `packages/plugin-sdk/package.json`, `packages/ai-client/package.json` — existing workspace package conventions (build script, types entry, peerDependencies). Planner: read these to ensure `coach-sdk` follows the same shape.
- `backend/api/vitest.config.ts`, `backend/api/test/rls/coach-rls.spec.ts` — Vitest config pattern + supabase-admin test fixture pattern reused for `coach-sdk` schema tests
- `backend/api/src/middleware/auth.ts` — Supabase JWT validation pattern (compare to `@supabase/ssr` cookie pattern in `apps/web/`)
- `backend/api/vercel.json` (if exists) — existing Vercel project config that the new `apps/web/vercel.json` should mirror in shape

### Existing patterns to reuse (in `c:/ziko-web/` — the source repo to onboard)
- `c:/ziko-web/middleware.ts` — current `next-intl` middleware that must be **composed**, not replaced (D-10)
- `c:/ziko-web/src/i18n/routing.ts` — existing `routing` export consumed by `next-intl` middleware
- `c:/ziko-web/eslint.config.mjs`, `c:/ziko-web/next.config.ts`, `c:/ziko-web/tsconfig.json` — base configs that survive the move
- `c:/ziko-web/src/lib/supabase/admin.ts` — **must be preserved** in the move (legacy GDPR delete-account flow); goes onto the ESLint allowlist (D-11)
- `c:/ziko-web/src/app/[locale]/` — existing landing routes (legal pages, landing) — must keep working after `(coach)` is added inside

### Codebase intel
- `.planning/codebase/STACK.md` — current technology baseline (npm@10.9.0 workspaces, turbo@^2.3.3, TypeScript ^5.7.0)
- `.planning/codebase/STRUCTURE.md` — monorepo directory layout (where `apps/`, `packages/`, `backend/`, `plugins/` live)
- `.planning/codebase/CONVENTIONS.md` — workspace conventions
- `.planning/codebase/CONCERNS.md` — known risks
- `.planning/codebase/INTEGRATIONS.md` — external service integration patterns

### External docs (Context7 queries planner should run)
- `@supabase/ssr` — Next 15 App Router cookie-based auth official guide (`createBrowserClient`, `createServerClient`, `updateSession`); the **exact `updateSession()` middleware implementation**
- `next-intl` v4 — middleware composition pattern (chained middleware example)
- `tsup` — dual ESM/CJS + `.d.ts` + external + subpath entry config for v8+
- `turbo` v2 — workspace `filter` + `dependsOn` patterns for `packages/coach-sdk` → `apps/web` build ordering
- `vercel` — `ignoreBuildStep` config + monorepo project root configuration
- `@next/bundle-analyzer` — Turbopack-compatible bundle analysis (or alternative if `@next/bundle-analyzer` is webpack-only)

### Future phases that depend on Phase 23 deliverables (do NOT modify without coordination)
- Phase 24 — extends `coach-sdk/schemas` with `CoachProfileFormSchema`; deletes `/fr/coach/_smoke/` and `/api/_debug/limits/` as first tasks
- Phase 25 — `redeem_invitation_code` RPC consumed from mobile via `coach-sdk/types`
- Phase 26 — TanStack Table on `/fr/coach/clients` — relies on `(coach)` layout + 3-layer auth
- Phase 27 — `weeks_data JSONB` editor — must round-trip through `ImportedProgramSchema` from `coach-sdk/schemas`
- Phase 28 — `/coach/imports/:id/parse` — relies on Vercel Pro `maxDuration = 60` confirmed by D-15

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

#### From `c:/ziko-web/` (the repo being onboarded)
- **`middleware.ts`** — Current `next-intl` `createMiddleware` config. Survives the move; D-10 wraps it.
- **`src/i18n/routing.ts`** — Existing `routing` export. Used by both the surviving `next-intl` middleware and any `[locale]` layouts.
- **`src/lib/supabase/admin.ts`** — Legacy service-role client for account-delete (GDPR). Survives the move as-is. ESLint-allowlisted (D-11). Phase 24+ must NOT extend this pattern.
- **`src/actions/account.ts`** — Existing Server Action calling the admin client. Survives. Demonstrates that Server Actions are already in use; the Phase 23 `/coach/_smoke` action follows the same shape.
- **`eslint.config.mjs`** — Existing ESLint v9 flat config with `eslint-config-next`. Base for the new file with D-11 + D-12 rules layered in.
- **`tailwind.config` (PostCSS-driven, v4)** — Tailwind v4 + `@tailwindcss/postcss`. Matches mobile NativeWind v4 major version. Should compose cleanly under monorepo.
- **`next.config.ts`** — Next 15.5 + Turbopack config. Survives.
- **`framer-motion@^12.38`** — Animation library already present. Available for Phase 24+ UI.
- **`@upstash/ratelimit` + `@upstash/redis`** — Already installed in `c:/ziko-web`. Phase 25 invitation rate limiting reuses these (no add).

#### From `ziko-platform` (the destination)
- **`packages/plugin-sdk`, `packages/ai-client`** — Existing workspace packages. `coach-sdk` mirrors their `package.json` shape (D-05 build, exports).
- **`backend/api/vitest.config.ts`, `backend/api/test/rls/`** — Vitest 3 config + admin-client fixture pattern. `coach-sdk` reuses this pattern for D-16 unit tests.
- **`backend/api/src/middleware/auth.ts`** — Reference for how the backend validates JWTs; web mirrors this through cookie-based session instead.
- **Existing Vercel project `ziko-api-lilac`** — Already on whatever tier it's on (must be confirmed Pro per D-15). New `ziko-web` project is created in Phase 23.

### Established Patterns

- **Workspace package shape**: every `packages/*` has `package.json` with `"main"`, `"types"`, sometimes `"exports"`; builds emit to `dist/`; built via `turbo run build`. `coach-sdk` follows this.
- **Vitest 3 in monorepo**: Each package has its own `vitest.config.ts` extending a shared base if one exists. `--passWithNoTests` is set in scripts (per Phase 22-01 lesson, otherwise Vitest 3 exits 1 on empty suites).
- **Supabase MCP `apply_migration` for DDL** — Phase 23 ships **NO** new migrations. All schema changes were delivered by Phase 22 migrations 034/035/036.
- **No StyleSheet in mobile** (existing convention) — Tailwind v4 (web) and NativeWind v4 (mobile) coexist via PostCSS plugin separation.
- **Branch naming**: `gsd/phase-23-web-turborepo-onboarding-auth-bootstrap` (matches `git.phase_branch_template` from `.planning/config.json`).

### Integration Points

- **`apps/web/src/lib/supabase/{client,server,middleware,admin}.ts`** — D-07 supabase factories. Four files: `client.ts` (`createBrowserClient` for client components), `server.ts` (`createServerClient` for Server Components/Actions/Route Handlers, with cookies), `middleware.ts` (`updateSession` for D-10 cookie refresh), `admin.ts` (the legacy SERVICE_ROLE client, allowlisted).
- **`apps/web/src/app/[locale]/(coach)/layout.tsx`** — D-13 layout guard. Calls `createServerClient().auth.getUser()`, redirects to `/fr/login` (placeholder route — Phase 24 ships real UI) on null user.
- **`apps/web/src/app/[locale]/(coach)/_smoke/{page.tsx, action.ts, SmokeButton.tsx}`** — D-13 thin slice. Three files, all delete-able by Phase 24's first task.
- **`apps/web/src/app/api/_debug/limits/route.ts`** + **`backend/api/src/routes/_debug.ts`** — D-15 Pro-tier probes. Both deletable by Phase 24.
- **`apps/web/eslint.config.mjs`** — D-11 + D-12 ESLint rules. Layered on the migrated base config.
- **`packages/coach-sdk/{package.json, tsup.config.ts, src/{index.ts, schemas/, types/}}`** — D-05 to D-08 package shape.
- **`.github/workflows/ci.yml`** — Add CI grep step (D-12 second layer) and `turbo run type-check && turbo run lint && turbo run test` step.
- **`vercel.json` files** — `apps/web/vercel.json` (new), `backend/api/vercel.json` (audit existing, likely unchanged).

### Constraints from the existing architecture

- **`react-native-worklets` at root** — Currently lives in root `package.json`. Will hoist into root `node_modules` and risk web bundle bleed (D-02 step 3 checks this). Planner: consider moving to `apps/mobile/package.json` directly to prevent hoisting; or use `npm` workspaces `--workspace=` install flags.
- **No dark mode anywhere** — `apps/web/` continues the light sport theme (`#FF5C1A` primary). Match the existing landing palette.
- **French jurisdiction (RGPD)** — Legal pages already in `c:/ziko-web/src/app/[locale]/{cgu, mentions-legales, politique-de-confidentialite, supprimer-mon-compte}/`. Survive the move; planner must NOT touch them.
- **Turbopack is default in Next 15.5 dev + build** — All build commands assume Turbopack. Some webpack-era ecosystem tools (`@next/bundle-analyzer` historically) may need a Turbopack-compatible alternative — flagged in Claude's Discretion.

</code_context>

<specifics>
## Specific Ideas

- **The user picked the recommended option on all 16 questions across all 4 areas.** This is the same pattern as Phase 22 (16/16 recommended). Treat that as ratification of the conservative codebase-pattern-matching defaults — not coincidence. Planner: any deviation from "match what exists" needs explicit justification.
- The user explicitly framed Phase 23 as **plumbing-only** — no user-visible UI ships beyond `/fr/coach/_smoke` which is itself a developer-only probe. Login flow, profile form, dashboard — ALL Phase 24+. Planner: PLAN.md must call out the `_smoke` route and `/api/_debug/limits` route as **explicitly deletable** in Phase 24.
- The user accepted **shipping the GitHub Actions release workflow even on the monorepo branch** (D-04 final note) — low-cost insurance against future split. This is a deliberate over-investment in optionality.
- The user accepted **3-layer auth proof in a single test route** (`_smoke` page + Server Action + client button). Planner: do NOT split this into three separate routes. One route exercises all three layers, with clear comments naming which layer each piece tests.
- The user accepted **react-icons retention by audit** rather than picking a v1.5 standard. Phase 24 design contract (`/gsd-ui-phase`) may revisit; Phase 23 does NOT.

</specifics>

<deferred>
## Deferred Ideas

(Items mentioned or considered during discussion but explicitly belong to later phases.)

- **GitHub Packages `.npmrc` + GHA token setup** — Only needed if D-02 fails and dual-repo wins. Even on the monorepo path, the release workflow is shipped (D-04) but the publish step is conditional. Detailed `.npmrc` shape deferred to actual dual-repo execution.
- **Login / signup UI** — Phase 24. The placeholder redirect target `/fr/login` is a 404 stub in Phase 23.
- **Coach profile form (name, bio, specialties, website, photo, KYC docs)** — Phase 24, against `coach_profiles` table from migration 034.
- **TanStack Table for client list + signal filters** — Phase 26.
- **`weeks_data JSONB` Zod schema** — `coach-sdk/schemas` ships the `ImportedProgramSchema` shape in Phase 23 (it's the only DB-side guard per Phase 22 D-11), but the **editor UI** for `weeks_data` is Phase 27.
- **Lucide-react or @heroicons migration** — D-17 auto-resolved to `react-icons` by audit. Re-evaluate only if Phase 24+ UI design contract requires it.
- **Playwright E2E in monorepo** — Phase 24 first introduces login flow worth E2E testing. Phase 23 explicitly defers per D-16.
- **`apps/web/_debug/limits` route deletion** — Phase 24 first-task housekeeping, NOT Phase 23.
- **Search / SEO on `(coach)` routes** — Phase 23 declares `force-dynamic` + `no-store`. Robots/sitemap for coach routes is Phase 31 (Marketing).
- **Bundle size budgets / Lighthouse thresholds for `apps/web`** — Performance tuning is post-v1.5. Phase 23 only validates "no RN bleed" via bundle analyzer.
- **Strava OAuth callback URL on `apps/web/`** — Phase 30. The redirect host (`ziko-app.com/api/strava/callback`) ships in Phase 30; Phase 23 ensures the project on Vercel can host it later.
- **Multi-tenant / team coaches** — explicitly Phase v1.6+.

</deferred>

---

*Phase: 23-web-turborepo-onboarding-auth-bootstrap*
*Context gathered: 2026-05-14*
