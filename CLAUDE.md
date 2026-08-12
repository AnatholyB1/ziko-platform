# CLAUDE.md — Ziko Platform

Project context and conventions for AI assistants working in this codebase.

> **Deep reference:** `.planning/codebase/` holds the maintained long-form docs —
> `STACK.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `ARCHITECTURE.md`, `INTEGRATIONS.md`,
> `TESTING.md`, `CONCERNS.md`. This file is the summary; those are the source of truth
> when you need detail. Re-read them before large changes.

---

## Project Overview

**Ziko Platform** is a fitness product built as a Turborepo monorepo:

- **Mobile app** (Expo / React Native) — athlete side, extensible via a 19-plugin system, AI coach
- **Web app** (Next.js 15) — public marketing site (`ziko-app.com`) + authenticated **Coach Platform / CRM**
- **Backend API** (Hono on Vercel) — REST + AI orchestrator agent
- **Supabase** — PostgreSQL, Auth, Storage, RLS everywhere

Two audiences: **athletes** (mobile) and **coaches** (web CRM). They are linked through
invitation codes (`coach_invitations` / `coach_client_links`) and the mandatory `coach` mobile plugin.

---

## Monorepo Structure

```
apps/
  mobile/            → Expo SDK 54 + Expo Router v6 (iOS & Android)
  web/               → Next.js 15 (App Router, Turbopack) — marketing + coach CRM
backend/api/         → Hono v4 REST + AI API (Vercel serverless)
packages/
  plugin-sdk/        → Plugin contracts, TS types, hooks, i18n, theme, showAlert
  ai-client/         → AIBridge — SSE streaming AI agent client
  ui/                → Shared React Native component library
  coach-sdk/         → Zod schemas + types shared web/mobile/backend (published pkg)
  email/             → React Email templates (tsup build)
plugins/             → 19 plugin packages (see catalog below)
supabase/
  migrations/        → 73 SQL migrations (RLS, schema, triggers)
  seed.sql           → Exercises, plugin registry, food DB
.planning/           → GSD planning docs (committed, not shipped)
.agents/skills/      → Repo-local agent skills
```

Workspaces: `apps/*`, `packages/*`, `plugins/*`, `backend/*`.

---

## Tech Stack

| Layer      | Technology                                                        |
|------------|-------------------------------------------------------------------|
| Mobile     | Expo SDK 54, React Native 0.81, Expo Router v6, React 19.1         |
| Web        | Next.js 15.5 (Turbopack), React 19.2, Tailwind CSS v4, next-intl   |
| Mobile CSS | NativeWind v4 installed, but **plugin screens use inline styles**  |
| State      | Zustand v5 (global) + TanStack Query v5 (server)                   |
| Storage    | MMKV (react-native-mmkv v3)                                        |
| Backend    | Hono v4 (TypeScript, ESM, Node 20)                                 |
| Database   | Supabase (PostgreSQL + RLS + Auth + Storage)                       |
| AI         | Vercel AI SDK v6 + Claude Sonnet orchestrator; Whisper for audio   |
| Validation | Zod v4 (schemas in `@ziko/coach-sdk`)                              |
| Tests      | Vitest v3 (backend + web), Testing Library + happy-dom (web)       |
| Monorepo   | Turborepo v2 + npm workspaces (npm 10.9, Node >=18 / CI Node 20)   |
| Monitoring | Sentry (`@sentry/react-native`)                                    |

---

## Dev Commands

```bash
npm run dev              # Start everything (Turborepo)
npm run mobile           # Expo dev server only
npm run backend          # Hono API only — PORT 8080, loads .env.local
npm run build            # Build all packages
npm run type-check       # TypeScript check all
npm run lint             # Lint all
npx turbo run test       # Run all test suites
```

From `apps/mobile/`:
```bash
npx expo start
eas build --platform android --profile production
eas build --platform ios --profile production
```

From `apps/web/`:
```bash
npm run dev              # next dev --turbopack
npm run test             # vitest run
```

From `backend/api/`:
```bash
npm run dev              # tsx watch --env-file=.env.local (port 8080)
npm run test             # vitest run
npm run test:rls         # RLS policy integration tests
vercel --prod --yes      # Deploy to Vercel production
```

**CI** (`.github/workflows/ci.yml`): `type-check` → `lint` → `test` via turbo on Node 20.
On push to `main`, Supabase migrations are applied automatically when
`supabase/migrations/` changed. Vercel deploys API + web via GitHub integration.
Other workflows: `test-rls.yml`, `release.yml`, `publish-coach-sdk.yml`.

---

## Environment Variables

### `apps/mobile/.env` (prefix `EXPO_PUBLIC_`)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_KEY=            ← publishable key (NOT ANON_KEY)
EXPO_PUBLIC_API_URL=                 ← https://ziko-api-lilac.vercel.app
```

### `apps/web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=           ← server-only, never expose to client
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
OPENAI_API_KEY=
```

### `backend/api/.env.local`
```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=                      ← Whisper transcription
RESEND_API_KEY=                      ← transactional email
```

`.gitignore` pattern: `.env`, `.env.*`, `!.env.example`.

---

## Design System

| Token      | Value       |
|------------|-------------|
| Background | `#F7F6F3`   |
| Surface    | `#FFFFFF`   |
| Border     | `#E2E0DA`   |
| Primary    | `#FF5C1A`   |
| Text       | `#1C1A17`   |
| Muted text | `#6B6963`   |

- **Light sport theme — no dark mode.** 7 themes + coach branding override via `useThemeStore`.
- **Mobile:** no `StyleSheet.create()` — inline style objects, tokens from `useThemeStore((s) => s.theme)`.
  Icons = **Ionicons** names from `@expo/vector-icons`. Screen roots use `paddingBottom: 100`.
- **Web:** Tailwind v4 tokens in `apps/web/src/app/globals.css` under `@theme { }`; semantic
  classes `text-primary`, `bg-background`, `border-border`, `text-muted`. Icons = `react-icons/io5`
  (and `lucide-react` in newer surfaces).
- Standard mobile card: radius 16, 1px `#E2E0DA` border, shadow `#1C1A17` @ 0.08 / radius 12 / elevation 3.

---

## AI Architecture

### Single Orchestrator Agent
- Models centralized in `backend/api/src/config/models.ts` — **change model IDs there only**:
  - `AGENT_MODEL` = `claude-sonnet-4-20250514` — all chat routes
  - `VISION_MODEL` = `claude-haiku-4-5-20251001` — food scan
- SDK: Vercel AI SDK v6 (`ai` ^6.0.116) + `@ai-sdk/anthropic`
- One agent handles conversation **and** tool execution; `stopWhen: stepCountIs(5)`

### Three-Layer Context System
1. **User context** — `backend/api/src/context/user.ts`, `fetchUserContext(userId)` runs 6 parallel
   Supabase queries (profile, installed plugins, recent workouts, today's nutrition/habits), injected
   into the system prompt on every request
2. **Conversation context** — `backend/api/src/context/conversation.ts`:
   `getOrCreateConversation()`, `appendMessages()`, `updateConversationTitle()`
3. **Tool context** — `backend/api/src/tools/registry.ts` exports `allToolSchemas` + `getToolExecutor`

### AI SDK v6 vs v3
`inputSchema` (not `parameters`) · `stopWhen: stepCountIs(n)` (not `maxSteps`) ·
`input`/`output` (not `args`/`result`) in tool callbacks.

### AI routes (`/ai/*`)
| Route | Credit gate | Description |
|-------|-------------|-------------|
| `GET /ai/tools` | — | List tool schemas |
| `POST /ai/tools/execute` | — | Execute a single tool |
| `POST /ai/chat/stream` | `chat` | Streaming chat + context + persistence |
| `POST /ai/chat` | `chat` | Non-streaming chat |
| `POST /ai/vision/nutrition` | `scan` | Food photo → macros |
| `POST /ai/programs/generate` | `program` | AI workout program generation |

Every paid AI route is wrapped in `creditCheck(kind)` + `creditDeduct(kind)`
(`backend/api/src/middleware/creditGate.ts`). Usage is logged to `ai_cost_log`.

### SSE stream format
```
data: {"type":"meta","conversation_id":"uuid"}\n\n
data: {"type":"chunk","content":"text"}\n\n
data: [DONE]\n\n
```

---

## Backend API (Hono)

Local `http://localhost:8080` · Production `https://ziko-api-lilac.vercel.app`

App factory + route mounting: `backend/api/src/app.ts`. Vercel entry: `backend/api/src/index.ts`.

**Mobile-facing:** `/health`, `/ai`, `/plugins`, `/webhooks`, `/push-events`, `/bugs`,
`/supplements`, `/pantry`, `/credits`, `/referral`, `/promo`, `/notifications`, `/storage`, `/forms`

**Coach-facing:** `/coach/identity`, `/coach/invitations`, `/coach/clients`, `/coach/programs`,
`/coach/imports`, `/coach/ai`, `/coach/voice`, `/coach/branding`, `/coach/exercises`,
`/coach/dashboards`, `/coach/videos`

Each `backend/api/src/coach/<module>/` folder follows `service.ts` (routes) + `db.ts` (queries) + `types.ts`.

**Middleware:** `auth.ts` validates the Supabase Bearer token and sets
`c.set('auth', { userId, email })` · `creditGate.ts` · `rateLimiter.ts` (Upstash Redis).

**ESM import rule (backend only):** every relative import ends in `.js`, even for `.ts` sources —
`import { updateRole } from './db.js';`

**Vercel crons** (`backend/api/vercel.json`, 7 jobs): supplements scrape (Mon 3am),
storage cleanup (daily 4am), coach AI monitor (daily 7am), forms fixed-date trigger (daily 6am),
streak-at-risk (daily 21h), push receipt check (every 15 min), weekly digest (Sun 9am).

---

## Plugin System Conventions

Plugins live in `plugins/<name>/src/`, package name `@ziko/plugin-<id>`.

### `manifest.ts`
```ts
const manifest: PluginManifest = { ... };
export default manifest;   // MUST be `export default` — PluginLoader reads mod.default
```

### Key `PluginManifest` fields
- `requiredPermissions` — this field name, **not** `permissions`
- `routes[].showInTabBar` — boolean, **not** `inTabBar`
- `routes[].icon` and `icon` — Ionicons string name, **never an emoji** (passed straight to `<Ionicons name={...} />`)
- `routes[].path` — Expo Router path, e.g. `"/(plugins)/habits/dashboard"`
- `mandatory?: boolean` — pre-loaded unconditionally by `PluginLoader`, trash button disabled in the store
- `aiTools` / `aiSkills` (`triggerKeywords`) / `aiSystemPromptAddition` — optional AI wiring

### Adding a plugin
1. `plugins/<id>/src/` with `manifest.ts`, `store.ts`, `index.ts`, `screens/`
2. `package.json` named `@ziko/plugin-<id>`
3. Register in the static `PLUGIN_LOADERS` map — `apps/mobile/src/lib/PluginLoader.tsx`
4. Thin route wrappers in `apps/mobile/app/(app)/(plugins)/<id>/` (~7 lines: import screen + `supabase`,
   render `<ScreenComponent supabase={supabase} />`)
5. Backend tools in `backend/api/src/tools/<id>.ts`, registered in `tools/registry.ts`

`PluginLoader` currently registers **19** plugins.

---

## Plugin Catalog (19)

| Plugin | ID | Category | Notes |
|--------|----|----------|-------|
| Daily Habits & Goals | `habits` | coaching | 4 AI tools |
| Nutrition Tracker | `nutrition` | nutrition | 4 AI tools + TDEE |
| Smart Pantry | `pantry` | nutrition | Inventory, barcode, AI recipes, shopping list |
| Mon Coach | `coach` | coaching | **mandatory** — 3-state invitation UX (code / preview / linked) |
| AI Persona | `persona` | persona | Injects a dynamic system prompt at load |
| Analytics | `stats` | analytics | |
| Récompenses | `gamification` | coaching | XP, levels, coins, shop |
| Communauté | `community` | social | Friends, challenges, chat, leaderboards |
| Stretching & Mobilité | `stretching` | training | |
| Sommeil & Récupération | `sleep` | health | Recovery score |
| Mesures & Progression | `measurements` | health | |
| Timer & Chrono | `timer` | training | Tabata, HIIT, EMOM, rest, custom, hyrox, functional |
| Programmes IA | `ai-programs` | training | |
| Journal & Mindset | `journal` | coaching | Mood / energy / stress |
| Hydratation | `hydration` | health | |
| Cardio & Running | `cardio` | training | GPS live tracking (Strava-like) |
| Compléments Alimentaires | `supplements` | nutrition | Catalog + price comparator |
| Wearables & Santé | `wearables` | health | Apple Health / Health Connect |
| Calculateur RPE | `rpe` | training | 1RM estimator, no AI tools |

---

## Database (Supabase)

73 migrations in `supabase/migrations/`. **Never edit an existing migration — always add a new one.**
Numbering is mixed: `NNN_description.sql` for the historical series and `YYYYMMDD_description.sql`
for the newer ones.

### Core tables
`user_profiles` · `exercises` · `workout_programs` · `workout_sessions` · `session_sets` ·
`ai_conversations` · `ai_messages` · `plugins_registry` · `user_plugins`

### Per-domain (selected)
- Plugins: `habits`/`habit_logs`, `nutrition_logs`, `sleep_logs`, `body_measurements`,
  `timer_presets`, `ai_generated_programs`, `journal_entries`, `hydration_logs`,
  `cardio_sessions`, `stretching_logs`/`stretching_routines`, `supplement_*`, pantry tables
- Gamification / social: `user_xp`, `shop_items`, `user_inventory`, friendships, challenges, chat
- Health sync: `health_sync_log`, `wearable_daily_summary`
- Credits & monetization: credit balance/ledger tables, `ai_cost_log`, referral & promo tables
- Coach platform: `coach_invitations`, `coach_client_links`, coach programs/exercises/branding/videos,
  `dashboard_widgets`, `coach_metric_thresholds`, forms schema + trigger engine, `coach_vocal_feedbacks`
- Notifications: notification schema, `workout_reminder_prefs`
- Ops: `bug_reports`

### RLS pattern
Every table enables RLS:
```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<table>_own" ON public.<table>
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```
Coach access uses dedicated policies scoped through `coach_client_links`.
RLS is covered by integration tests — `npm run test:rls` in `backend/api/`.

---

## State Management

**Mobile Zustand stores** (`apps/mobile/src/stores/`): `authStore`, `workoutStore`, `aiStore`,
`themeStore`, `notificationStore`, `creditStore`, `userPrefsStore`, `clipboardStore`.
Plugins keep their own store in `plugins/<name>/src/store.ts`.

Pattern: `create<State>()((set, get) => ({ ... }))`, actions verb-first (`setHabits`, `getStreak`).
Persistence via `zustand/middleware` `persist` + `createJSONStorage(MMKV)`.

**TanStack Query:** query keys are `[resourceName, scopeId]` — always scope by user ID.
`staleTime`: `60_000` for lists, `10 * 60 * 1000` for profile/slow data, `0` for pending forms/alerts.
Mobile queries hit Supabase directly; web hooks call the Hono API with `Authorization: Bearer <token>`.

---

## Auth Flow

1. `authStore` initializes the Supabase session on app load
2. `onAuthStateChange` returns a subscription that **must be stored** for cleanup —
   kept as `(get() as any)._authSubscription`
3. Expo Router redirects: `/(auth)/login` unauthenticated, `/(app)/` authenticated
4. Onboarding: `/(auth)/onboarding/step-1` … `step-7`
5. Web: Next.js `middleware.ts` handles locale + auth routing; coach pages under `[locale]/(coach)/`

---

## i18n

- **Mobile:** `useTranslation()` from `@ziko/plugin-sdk`, dictionaries in `packages/plugin-sdk/src/i18n.ts`.
  Locales `fr` (primary, ~500+ keys) and `en`. Keys are dot-separated: `'general.save'`, `'habits.addHabit'`.
- **Web:** `next-intl` with `[locale]` URL prefix, files in `apps/web/src/i18n/`.
- Plugin screens commonly hardcode French strings in JSX — accepted; only shared/cross-cutting
  strings go through `t()`.

---

## Custom Alert System

**Do not use** `Alert` from `react-native` in plugins — use `showAlert` from `@ziko/plugin-sdk`.
Drop-in replacement with the same API as `Alert.alert`; renders via `CustomAlert` mounted in the root layout.

---

## GSD Planning Workflow

This repo is driven by **GSD** (Get Shit Done) — spec-driven planning with state on disk in `.planning/`.

```
.planning/
├── PROJECT.md              # Product definition + shipped-milestone log
├── ROADMAP.md              # Milestones → phases
├── MILESTONES.md           # Milestone index
├── STATE.md                # Root state (deprecated — workstreams own their STATE.md)
├── HANDOFF.json            # Session resume point (phase / plan / task / blockers)
├── config.json             # GSD config: mode, granularity, workflow gates
├── active-workstream       # Name of the workstream currently in focus
├── codebase/               # ARCHITECTURE / STACK / STRUCTURE / CONVENTIONS / …
├── workstreams/<name>/     # ROADMAP.md, STATE.md, phases/, milestones/
├── phases/<NN>-<slug>/     # Legacy root-level phases (pre-workstream migration)
├── seeds/ research/ reports/ mockups/ milestones/ debug/
```

**Phase file nomenclature** inside `phases/<NN>-<slug>/`:
`<NN>-CONTEXT.md` · `<NN>-RESEARCH.md` · `<NN>-DISCUSSION-LOG.md` · `<NN>-UI-SPEC.md` ·
`<NN>-<MM>-PLAN.md` / `-SUMMARY.md` · `<NN>-REVIEW.md` / `-REVIEW-FIX.md` ·
`<NN>-VALIDATION.md` · `<NN>-VERIFICATION.md`

**Config in force** (`.planning/config.json`): `mode: yolo`, `granularity: standard`,
research + plan-check + verifier + nyquist validation + UI phase + UI safety gate enabled,
`auto_advance: false`, node repair budget 2, `commit_docs: true`.
Phase branches follow `gsd/phase-{phase}-{slug}`.

**Rules when working here:**
- Planning docs are committed — update `STATE.md` / `HANDOFF.json` as work progresses
- Design-first: a `<NN>-UI-SPEC.md` is expected before implementing UI phases
- Check `.planning/active-workstream` and that workstream's `STATE.md` before starting

**Install GSD** (slash commands `/gsd-new-project`, `/gsd-onboard`, `/gsd-execute-phase`, …):
```bash
npx @opengsd/gsd-core@latest --claude --global
```
Note `.claude/` is gitignored, so the install is per-machine and must be re-run on new environments.
Upstream: https://github.com/open-gsd/gsd-core

---

## Repo-Local Agent Skills

`.agents/skills/` (tracked by `skills-lock.json`):
- `ziko-routes-and-tools` — route + AI tool reference for the app (**note: its plugin table is stale, says 14**)
- `supabase-postgres-best-practices` — vendored from `supabase/agent-skills`

---

## Gotchas & Fixed Bugs

- Backend dev server runs on **port 8080** and loads **`.env.local`** (not `.env`, not 3000)
- Supabase keys: `EXPO_PUBLIC_SUPABASE_KEY` (publishable) on mobile, `SUPABASE_PUBLISHABLE_KEY`
  on the backend. `SUPABASE_SERVICE_ROLE_KEY` is web-server/tests only and **must not** be imported
  from `backend/api/src/**`
- Backend relative imports require a `.js` extension even for `.ts` files
- `manifest.icon` must be an Ionicons name — an emoji renders as a broken glyph
- Manifests must use `export default`; `PluginLoader` reads `mod.default`
- `Alert.alert` → always `showAlert` from `@ziko/plugin-sdk` in plugins
- `findLast` is unavailable at the mobile TS target — use `filter` + last element
- Files with emoji/accented characters (e.g. `CardioDashboard.tsx`): edit with file tools, never
  shell `echo`/heredoc — it corrupts the encoding
- All mobile screen roots need `paddingBottom: 100` for tab bar clearance
- No dark mode anywhere — light sport theme only
