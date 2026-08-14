# Phase 23: Web Turborepo Onboarding & Auth Bootstrap — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `23-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 23-web-turborepo-onboarding-auth-bootstrap
**Milestone:** v1.5 — Coach Platform & CRM
**Areas discussed:** Spike + integration approach, coach-sdk packaging + 3-bundler consumption, @supabase/ssr 3-layer + i18n + ESLint guardrails, Phase 23 thin slice + Vercel topology + test surface

---

## Area Selection

**Question:** Which gray areas do you want to discuss for Phase 23?
**Options presented:** (8 gray areas bundled into 4)
1. Spike + integration approach
2. coach-sdk packaging + 3-bundler consumption
3. @supabase/ssr 3-layer + i18n + ESLint guardrails
4. Phase 23 thin slice + Vercel topology + test surface

**User's choice:** All 4 selected.
**Notes:** Initial response came back empty; retry returned all 4.

---

## Area 1: Spike + Integration Approach

### Q1.1: Spike scope — what does the 1-day spike actually attempt?

| Option | Description | Selected |
|--------|-------------|----------|
| Full move + smoke | Real apps/web move (git mv / fresh init), wires next-intl + @supabase/ssr middleware, ships `/coach/_smoke` route + mobile build check. If green by EOD → monorepo. | ✓ |
| Representative slice | Throwaway `apps/web-spike/` with one Tailwind + @supabase/ssr page + nohoist test for `react-native-worklets`. Cheaper but defers real middleware composition risk. | |
| Compile-only audit | Pure inventory: dep check, version compat. No spike app. Fastest but blind to runtime bleed. | |

**User's choice:** Full move + smoke (recommended)
**Notes:** Honest signal; no hypothetical risk. Becomes D-01.

### Q1.2: Go/no-go criterion — what objectively decides monorepo vs dual-repo?

| Option | Description | Selected |
|--------|-------------|----------|
| Triple-green checklist | (a) `apps/web` build OK, (b) `apps/mobile` `expo prebuild` OK, (c) bundle analyzer shows zero `react-native*` in web bundle. Any red → dual-repo. | ✓ |
| Build-only | Just (a) + (b). Skip bundle analysis until perf regression appears. | |
| Time-only fallback | EOD-day cutoff; if still debugging → dual-repo. Subjective but realistic. | |

**User's choice:** Triple-green checklist (recommended)
**Notes:** Explicit + auditable. Becomes D-02. Bundle-analyzer command + threshold deferred to planner research.

### Q1.3: If monorepo wins — how do we move c:/ziko-web into apps/web?

| Option | Description | Selected |
|--------|-------------|----------|
| git mv preserving history | `git subtree add` or `git filter-repo`. Preserves v1.0–v1.4 landing-page blame in ziko-platform git log. | ✓ |
| Copy with fresh history | Copy files, NOTES.md pointer to archived ziko-web. Simpler but loses blame across the cut. | |
| Fresh next create + selective port | `npx create-next-app` then hand-port. Cleanest deps, most work, loses history. | |

**User's choice:** git mv preserving history (recommended)
**Notes:** Keeps history for audit + blame. Becomes D-03. Exact command shape (`git subtree add` vs `git filter-repo`) deferred to planner.

### Q1.4: If dual-repo wins — where is coach-sdk distributed?

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Packages (npm scoped) | Publish `@ziko/coach-sdk` to GitHub Packages registry, private. ziko-web installs with `.npmrc` + `GITHUB_TOKEN`. | ✓ |
| npm public (scoped, free) | Publish publicly on npmjs.com. Anyone can install; not secret but acceptable. | |
| Git URL / file: link | `npm install ziko-platform/coach-sdk#main`. Zero publish step but no lockable version + needs `npm link` for local dev. | |

**User's choice:** GitHub Packages (recommended)
**Notes:** Free, integrates with GitHub org. Becomes D-04. Release workflow shipped even on monorepo branch as insurance.

---

## Area 2: coach-sdk Packaging + 3-Bundler Consumption

### Q2.1: Build output — what does packages/coach-sdk actually emit?

| Option | Description | Selected |
|--------|-------------|----------|
| tsup → ESM + CJS + .d.ts | Dual format + types. Each consumer picks via exports map. Matches v1.4 ai-client pattern. | ✓ |
| tsc-only (no bundler) | Plain tsc emits .js + .d.ts. Simpler but Metro fights ESM-only and tree-shaking is bundler-dependent. | |
| Source-only + TS path aliases | No build, TS project refs. Fastest dev loop, ties consumers to TS-aware bundlers, more tsconfig complexity. | |

**User's choice:** tsup → ESM + CJS + .d.ts (recommended)
**Notes:** Zero metro/turbopack surprises. Becomes D-05.

### Q2.2: Exports surface — single entry or sub-paths?

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-path exports per domain | `/schemas`, `/types`, future `/auth`. Bundlers tree-shake by path. | ✓ |
| Single barrel re-export | Everything from `@ziko/coach-sdk` root. Mobile bundles all schemas. | |

**User's choice:** Sub-path exports per domain (recommended)
**Notes:** Future-proofs as SDK grows. Becomes D-06.

### Q2.3: Where do Supabase client factories live?

| Option | Description | Selected |
|--------|-------------|----------|
| apps/web only — NOT in coach-sdk | @supabase/ssr is web-specific; factories live in apps/web/src/lib/supabase/. coach-sdk stays pure (Zod + types). | ✓ |
| coach-sdk/auth with conditional exports | `exports` conditions: `react-native` → mobile flavor, `node`/`browser` → ssr. DRY but Metro support is patchy. | |
| Both: schemas in sdk, factories duplicated | Each app has thin supabase wrapper. Some duplication but isolation clean. | |

**User's choice:** apps/web only (recommended)
**Notes:** Keeps SDK pure; no web-only deps leak to mobile. Becomes D-07. Mobile keeps existing `apps/mobile/src/lib/supabase.ts`.

### Q2.4: Zod version pinning across web + backend + mobile?

| Option | Description | Selected |
|--------|-------------|----------|
| Pin in coach-sdk peerDependency | `peerDependencies: { zod: '^4.0.0' }`. Each consumer installs zod. npm de-dupes. | ✓ |
| Direct dependency in coach-sdk | Risk: each consumer pulls different zod, `instanceof ZodError` checks fail. | |
| Bundle zod into coach-sdk dist | Smaller dep tree but doubles zod in node_modules per consumer. | |

**User's choice:** peerDependency (recommended)
**Notes:** Prevents instanceof drift. Becomes D-08.

---

## Area 3: @supabase/ssr 3-Layer + i18n Nesting + ESLint Guardrails

### Q3.1: (coach) route position relative to existing [locale] (fr/en)?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside [locale] — /fr/coach, /en/coach | (coach) lives at app/[locale]/(coach)/. Zero refactor; coach gets free i18n. | ✓ |
| Outside [locale] — /coach (no locale prefix) | (coach) at app/(coach)/. next-intl matcher excludes /coach. Cleaner URLs, locked to one language. | |

**User's choice:** Inside [locale] (recommended)
**Notes:** Zero refactor to landing. Becomes D-09.

### Q3.2: middleware.ts composition — next-intl + Supabase cookie refresh how?

| Option | Description | Selected |
|--------|-------------|----------|
| Chained: Supabase first, then next-intl | Single middleware.ts: supabase.auth.getUser() refresh → if /coach return Supabase resp → else delegate to intlMw. Official @supabase/ssr pattern. | ✓ |
| Split: separate matchers | Two files? Next only allows ONE middleware.ts; would need a manual dispatcher. Complex, fragile. | |
| Skip middleware refresh — layout only | Violates ARCH-05; breaks long-lived sessions (refresh token rotation needs middleware). | |

**User's choice:** Chained: Supabase first, then next-intl (recommended)
**Notes:** Becomes D-10. Exact `updateSession()` implementation deferred to planner Context7 query.

### Q3.3: @supabase/supabase-js ESLint ban — how strict and where?

| Option | Description | Selected |
|--------|-------------|----------|
| Banned everywhere under apps/web/src/ except allowlist | no-restricted-imports errors everywhere. Allowlist: lib/supabase/admin.ts + test files. | ✓ |
| Banned only in app/(coach)/** | Smaller blast radius but lets shared lib/ accidentally import wrong client. | |
| Warn-only | Lower friction but devs ignore warnings; defeats ARCH-02. | |

**User's choice:** Strict ban + narrow allowlist (recommended)
**Notes:** Becomes D-11.

### Q3.4: ARCH-02 cross-module import rule — enforcement shape?

| Option | Description | Selected |
|--------|-------------|----------|
| ESLint no-restricted-imports + CI grep | Dev-time (ESLint pattern on coach/<m>/db, internal) + CI-time (grep SERVICE_ROLE under backend coach/). | ✓ |
| ESLint only | CI grep added in Phase 24 when modules exist. ARCH-02 unenforced at PR-time until then. | |
| CI grep only | Postpone ESLint to Phase 24. Devs may write wrong patterns before lint catches them. | |

**User's choice:** ESLint + CI grep dual-layer (recommended)
**Notes:** Becomes D-12. ESLint patterns ship in Phase 23 with TODO comments; activate as modules land in Phase 24.

---

## Area 4: Phase 23 Thin Slice + Vercel Topology + Test Surface

### Q4.1: Phase 23 thin slice — what's the minimum (coach) surface that closes the phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Server Action protected route | /fr/coach/_smoke page (Server Component, getUser()) + action.ts (`'use server'`, re-checks getUser()) + SmokeButton.tsx (client invokes action). Exercises all 3 ARCH-05 layers. No login UI. | ✓ |
| Layout-only protected route | /fr/coach/ renders user.id from layout guard. No Server Action. Third auth layer unproven. | |
| Full login + protected route | Adds /fr/login form, sign-up, error states. Bigger scope; risks Phase 24 drag. | |

**User's choice:** Server Action protected route (recommended)
**Notes:** Closes ARCH-05 fully; defers login UX to Phase 24. Becomes D-13.

### Q4.2: Vercel project topology — one project or two?

| Option | Description | Selected |
|--------|-------------|----------|
| Two projects, one repo (monorepo) | Vercel A=ziko-web (apps/web), Vercel B=ziko-api-lilac (backend/api). Both Pro. Independent deploys. | ✓ |
| One project, monorepo dual build | Cheaper config but web change rebuilds backend; cross-contamination on failure. | |
| Three projects (if dual-repo) | Only if dual-repo branch wins: ziko-platform + ziko-web. Adds complexity. | |

**User's choice:** Two projects, one repo (recommended)
**Notes:** Becomes D-14. Each project ignores changes outside its root via `vercel.json` ignoreBuildStep or dashboard.

### Q4.3: Vercel Pro confirmation — how is it proven for ARCH-08?

| Option | Description | Selected |
|--------|-------------|----------|
| Automated probe — /api/_debug/limits route | maxDuration=60 route, DEBUG_LIMITS=on gated, sleeps 30s, CI hits on preview. Evidence in VERIFICATION.md. | ✓ |
| Manual: `vercel inspect` + screenshot | Human runs CLI, pastes "Plan: Pro" output in VERIFICATION.md. Lowest cost, unverifiable in CI. | |
| Billing dashboard screenshot | Trivial, no automation. | |

**User's choice:** Automated probe (recommended)
**Notes:** Evidence-based, auditable. Becomes D-15. Routes deleted in Phase 24.

### Q4.4: Test surface for Phase 23 — what proves "done"?

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest unit + type-check + ESLint + smoke deploy | coach-sdk schema tests + supabase factory tests; turbo type-check + lint; CI grep SERVICE_ROLE; manual curl on preview. No Playwright. | ✓ |
| Add Playwright E2E now | Stand up Playwright in monorepo, sign-in E2E. Higher coverage but adds infra not used elsewhere. | |
| Type-check + ESLint only | Skip Vitest entirely. Lightest touch but no behavioral guard on coach-sdk schemas. | |

**User's choice:** Vitest + type-check + ESLint + smoke (recommended)
**Notes:** Fast feedback, no new infra. Becomes D-16. Playwright deferred to Phase 24.

---

## Auto-Resolved by Audit (no question asked)

### Icon library (Open Decision #6 from roadmap)

**Audit finding:** `c:/ziko-web/package.json` already has `react-icons@^5.6.0` installed.
**Rule applied:** Roadmap rollback for Decision #6 says "Audit existing v1.0 landing; reuse whichever is already present."
**Resolution:** Locked to `react-icons`. No migration in Phase 23. Becomes D-17.

---

## Claude's Discretion

Areas where the user accepted Claude (planner) decides:

1. Exact `git subtree` / `git filter-repo` command shape for D-03 (history-preserving move).
2. Exact `@supabase/ssr` `updateSession()` implementation per Next 15 official guide (Context7 query).
3. Bundle-analyzer choice for D-02 step 3 (`@next/bundle-analyzer` vs Turbopack alternative).
4. `vercel.json` ignored-build-step script shape per project.
5. `.npmrc` shape for GitHub Packages (only used on dual-repo branch).
6. Whether new `apps/web/eslint.config.mjs` extends the migrated base config or starts fresh.
7. Vitest config location for `packages/coach-sdk` (match `backend/api` pattern for consistency).

---

## Deferred Ideas

Items mentioned but explicitly belong to later phases:

- GitHub Packages `.npmrc` + GHA token setup (only on dual-repo branch).
- Login / signup UI → Phase 24.
- Coach profile form (name, bio, specialties, photo, KYC docs) → Phase 24.
- TanStack Table client list + signal filters → Phase 26.
- `weeks_data JSONB` editor UI → Phase 27.
- Lucide-react / @heroicons migration → not before a Phase 24+ design contract requires it.
- Playwright E2E → Phase 24.
- `_smoke` route + `/api/_debug/limits` route deletion → Phase 24 first task.
- SEO / robots / sitemap on `(coach)` routes → Phase 31 (Marketing).
- Bundle size budgets / Lighthouse thresholds → post-v1.5.
- Strava OAuth callback URL on `apps/web/` → Phase 30.
- Multi-tenant / team coaches → v1.6+.

---

## Pattern Observation

The user picked the recommended option on **all 16 questions across all 4 areas** (same pattern as Phase 22, where 16/16 recommendations were also accepted). This consistent alignment ratifies the conservative codebase-pattern-matching defaults — planner should treat any deviation from "match what exists" as requiring explicit justification.
