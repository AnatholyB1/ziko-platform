# Codebase Structure

**Analysis Date:** 2026-03-26

## Directory Layout

```
ziko-platform/
├── apps/
│   └── mobile/                      # Expo SDK 54 + React Native app
│       ├── app/                     # Expo Router v4 file-based routes
│       │   ├── _layout.tsx          # Root layout (auth init, QueryClient, PluginLoader)
│       │   ├── (auth)/              # Authentication routes group
│       │   │   ├── _layout.tsx      # Auth redirect logic
│       │   │   ├── login/
│       │   │   ├── register/
│       │   │   └── onboarding/      # 5-step onboarding screens
│       │   └── (app)/               # Main app routes (requires auth)
│       │       ├── _layout.tsx      # Tabs layout with dynamic plugin tabs
│       │       ├── (plugins)/       # Dynamic plugin screens
│       │       │   ├── habits/
│       │       │   ├── nutrition/
│       │       │   ├── cardio/
│       │       │   ├── timer/
│       │       │   ├── stats/
│       │       │   └── [12 more plugins]
│       │       ├── ai/              # AI chat screens
│       │       ├── profile/         # User profile edit
│       │       ├── store/           # Plugin store / shop
│       │       └── workout/         # Workout session tracking
│       ├── src/
│       │   ├── components/          # Shared UI components
│       │   ├── lib/
│       │   │   ├── supabase.ts      # Supabase client init
│       │   │   ├── ai.ts            # AIBridge instance
│       │   │   └── PluginLoader.tsx # Plugin registry + loading
│       │   └── stores/              # Zustand stores
│       │       ├── authStore.ts     # Auth state + session management
│       │       ├── aiStore.ts       # AI chat messages
│       │       ├── themeStore.ts    # Theme + banner
│       │       └── workoutStore.ts  # Active workout session
│       └── package.json
│
├── backend/
│   └── api/                         # Hono v4 REST API
│       ├── src/
│       │   ├── index.ts             # Server entry point (Node.js + Vercel)
│       │   ├── app.ts               # Hono app setup (routes, middleware, error handling)
│       │   ├── context/             # Three-layer context assembly
│       │   │   ├── user.ts          # fetchUserContext() — profile, habits, nutrition, workouts, plugins
│       │   │   └── conversation.ts  # getOrCreateConversation(), appendMessages()
│       │   ├── middleware/
│       │   │   └── auth.ts          # authMiddleware — validates JWT, sets userId
│       │   ├── routes/              # HTTP route handlers
│       │   │   ├── ai.ts            # POST /chat/stream, POST /chat, GET /tools, POST /tools/execute
│       │   │   ├── plugins.ts       # GET /plugins (registry)
│       │   │   ├── webhooks.ts      # POST /webhooks (Supabase triggers)
│       │   │   ├── bugs.ts          # POST /bugs (bug reports)
│       │   │   └── supplements.ts   # GET /supplements/*, POST /cron/scrape
│       │   ├── tools/               # AI tool implementations (one per plugin)
│       │   │   ├── registry.ts      # allToolSchemas, getToolExecutor()
│       │   │   ├── habits.ts        # habits_get_today, habits_log, habits_create, habits_get_streaks
│       │   │   ├── nutrition.ts     # nutrition_log_meal, nutrition_get_today, nutrition_get_tdee
│       │   │   ├── stretching.ts    # stretching_log_session, stretching_get_routines
│       │   │   ├── sleep.ts         # sleep_log, sleep_get_history, sleep_get_recovery_score
│       │   │   ├── measurements.ts  # measurements_log, measurements_get_history
│       │   │   ├── timer.ts         # timer_get_presets, timer_create_preset
│       │   │   ├── ai-programs.ts   # ai_programs_generate, ai_programs_list
│       │   │   ├── journal.ts       # journal_log_mood, journal_get_trends
│       │   │   ├── hydration.ts     # hydration_log, hydration_get_today
│       │   │   ├── cardio.ts        # cardio_log_session, cardio_get_history
│       │   │   ├── wearables.ts     # wearables_get_steps, wearables_sync_status
│       │   │   └── navigation.ts    # app_navigate (for agent to direct user to screens)
│       │   └── scrapers/            # Supplement price scraping (cron jobs)
│       │       ├── index.ts         # Main scraper coordinator
│       │       ├── brands/          # Per-brand scrapers (myprotein, optimum-nutrition, etc.)
│       │       └── utils/           # HTML parsers, category mappers
│       └── package.json
│
├── packages/
│   ├── plugin-sdk/                  # Shared plugin development kit
│   │   └── src/
│   │       ├── index.ts             # Public API exports
│   │       ├── types.ts             # PluginManifest, AITool, Permission, UserProfile
│   │       ├── hooks.ts             # usePluginRegistry, usePermission, useAlertStore
│   │       ├── theme.ts             # useThemeStore (7 themes + banners)
│   │       ├── i18n.ts              # useTranslation() hook
│   │       └── alert.ts             # useAlertStore, showAlert() custom alert system
│   │
│   ├── ai-client/                   # Client-side AI orchestration
│   │   └── src/
│   │       ├── index.ts             # Exports AIBridge
│   │       └── AIBridge.ts          # Plugin registration, skill management, system prompt assembly
│   │
│   └── ui/                          # Reusable React Native components
│       └── src/
│           └── components.tsx       # Button, Card, Input, etc.
│
├── plugins/                         # 17 fitness plugins (each is a package)
│   ├── habits/
│   │   └── src/
│   │       ├── manifest.ts          # Plugin metadata (must be default export)
│   │       ├── store.ts             # useHabitsStore (Zustand)
│   │       ├── index.tsx            # Main screen component
│   │       ├── screens/             # Feature screens (dashboard, create, etc.)
│   │       └── components/          # Plugin-specific UI components
│   │
│   ├── nutrition/                   # Similar structure
│   ├── cardio/
│   │   └── src/
│   │       ├── manifest.ts
│   │       ├── store.ts             # useCardioStore with GPS route data
│   │       ├── CardioTracker.tsx    # Live GPS tracking screen
│   │       ├── CardioDetail.tsx     # Post-session detail + RouteVisualizer
│   │       └── CardioDashboard.tsx  # Strava-like feed with weekly stats
│   │
│   ├── timer/
│   │   └── src/
│   │       ├── TimerDashboard.tsx   # Main timer UI
│   │       ├── TimerEditor.tsx      # Create/edit presets with exercise picker
│   │       └── types.ts             # TimerExercise, TimerPreset
│   │
│   ├── rpe/
│   │   └── src/
│   │       ├── manifest.ts
│   │       ├── index.ts             # formulas: rpeToPercent(), calc1RM(), rpeToRIR()
│   │       └── RPECalculatorScreen.tsx
│   │
│   ├── stretching/
│   ├── sleep/
│   ├── measurements/
│   ├── ai-programs/
│   ├── journal/
│   ├── hydration/
│   ├── wearables/
│   ├── supplements/
│   ├── stats/
│   ├── gamification/
│   ├── community/
│   └── persona/                     # AI coaching style / personality
│
├── supabase/
│   ├── migrations/                  # 21 PostgreSQL migrations
│   │   ├── 001_initial_schema.sql   # user_profiles, exercises, workout_*, habits, nutrition_logs, ai_*
│   │   ├── 002_habits_schema.sql
│   │   ├── 003_nutrition_schema.sql
│   │   ├── 007_gamification_schema.sql
│   │   ├── 009_community_schema.sql
│   │   ├── 012_new_plugins_schema.sql
│   │   ├── 014_wearables_schema.sql
│   │   ├── 018_supplements_schema.sql
│   │   ├── 020_timer_exercises_hyrox.sql
│   │   └── 021_cardio_gps.sql
│   └── seed.sql                     # Initial data: exercises, food database, plugins_registry
│
├── .planning/
│   └── codebase/                    # GSD mapping documents
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md           # (if quality focus)
│       ├── TESTING.md               # (if quality focus)
│       ├── CONCERNS.md              # (if concerns focus)
│       ├── STACK.md                 # (if tech focus)
│       └── INTEGRATIONS.md          # (if tech focus)
│
├── .env                             # (git-ignored, not committed)
├── package.json                     # Root Turborepo
├── tsconfig.json
├── turbo.json
└── CLAUDE.md                        # Project instructions
```

## Directory Purposes

**apps/mobile:**
- Purpose: Expo-based React Native fitness app
- Contains: Route files, Zustand stores, Supabase + AI client initialization, PluginLoader
- Key files: `_layout.tsx` (root), `(app)/_layout.tsx` (tabs), `(auth)/_layout.tsx` (auth flow)

**apps/mobile/app/(auth):**
- Purpose: Authentication and onboarding flows
- Contains: Login, register, 5-step onboarding screens
- Redirect logic: Authenticated users with `onboarding_done: true` redirect to `/(app)`

**apps/mobile/app/(app):**
- Purpose: Main authenticated app UI
- Contains: Tab bar with dynamic plugin tabs, AI chat, profile, store, workout screens
- Tab sources: `usePluginRegistry.enabledPlugins` drives Tabs.Screen generation

**apps/mobile/app/(app)/(plugins):**
- Purpose: Dynamic plugin screen registration
- Pattern: Thin wrapper files `[plugin]/[screen].tsx` import plugin component + pass Supabase client
- Example: `apps/mobile/app/(app)/(plugins)/habits/index.tsx` → imports `@ziko/plugin-habits` screen

**apps/mobile/src/stores:**
- Purpose: Zustand global state
- Pattern: Each store exports a `useXStore` hook; auth + theme required; plugins add own stores
- Key store: `authStore` must store `_authSubscription` to prevent memory leaks

**backend/api/src/tools:**
- Purpose: AI tool implementations (function calling)
- Pattern: Each tool module exports schema + async executor; registry maps names to executors
- Executor pattern: `async (params: Record<string, unknown>, userId: string) => Promise<unknown>`
- Responsibility: Read/write Supabase filtered by RLS; return structured result to agent

**backend/api/src/routes:**
- Purpose: HTTP endpoint handlers
- Main route: `/ai/chat/stream` orchestrates agent with context + streaming
- Pattern: Fetch context, build system prompt, run agent loop, stream SSE, persist conversation

**backend/api/src/context:**
- Purpose: Dynamic context assembly for AI agent requests
- User context: Profile, today's habits/nutrition, recent workouts, installed plugins
- Conversation context: Load history, persist messages, auto-title
- Pattern: Parallel queries; passed to `buildSystemPrompt()` for dynamic injection

**supabase/migrations:**
- Purpose: Database schema version control
- Pattern: Numbered files (001, 002, etc.) applied in order
- Each migration: CREATE TABLE, ALTER, CREATE POLICY (RLS), INSERT seed data
- RLS pattern: Every table has policy `WHERE auth.uid() = user_id` or `USING (auth.uid() = user_id)`

**plugins/[name]/src:**
- Purpose: Single plugin package
- Must export: `manifest.ts` as default export
- May export: Store (Zustand), screen components, helper utilities
- Convention: Plugin route paths use pattern `/(plugins)/[plugin]/[screen]`

## Key File Locations

**Entry Points:**
- `apps/mobile/app/_layout.tsx`: Mobile root layout (auth init, PluginLoader wrapper)
- `backend/api/src/index.ts`: API server entry (Node.js) or Vercel export
- `backend/api/src/app.ts`: Hono app definition (routes, middleware, error handling)

**Configuration:**
- `apps/mobile/.env`: Environment for mobile (EXPO_PUBLIC_* prefix required)
- `backend/api/.env`: Environment for backend (Supabase + Anthropic keys)
- `package.json` (root): Turborepo workspace configuration

**Core Logic:**
- `backend/api/src/routes/ai.ts`: Orchestrator agent + streaming implementation
- `backend/api/src/context/user.ts`: User context assembly (profile, habits, nutrition, workouts)
- `backend/api/src/tools/registry.ts`: Tool schema + executor registry
- `apps/mobile/src/lib/PluginLoader.tsx`: Dynamic plugin loading + registration
- `apps/mobile/src/stores/authStore.ts`: Session management + profile fetching

**Testing:**
- Not currently detected in repo (no Jest/Vitest config found)

## Naming Conventions

**Files:**
- Route files: `index.tsx`, `[dynamic].tsx`, `_layout.tsx` (Expo Router standard)
- Component files: PascalCase (e.g., `CardioTracker.tsx`, `BugReportModal.tsx`)
- Store files: `store.ts` in each plugin root; `authStore.ts`, `themeStore.ts` in mobile/stores
- Tool files: `[plugin-name].ts` in backend/api/src/tools (e.g., `habits.ts`, `nutrition.ts`)
- Migration files: `NNN_snake_case_description.sql` (e.g., `021_cardio_gps.sql`)

**Directories:**
- Packages: kebab-case (e.g., `plugin-sdk`, `ai-client`)
- Plugins: kebab-case short names (e.g., `ai-programs`, `nutrition`, `cardio`)
- Routes: kebab-case in paths, but can use parentheses groups for layout organization (e.g., `(app)`, `(auth)`, `(plugins)`)
- Feature subdirs: lowercase descriptive names (e.g., `screens/`, `components/`, `utils/`)

**TypeScript/Variables:**
- Interfaces: PascalCase, prefix with `I` if convention used (not consistent in codebase; examples: `PluginManifest`, `UserProfile`, `AITool`)
- Functions: camelCase (e.g., `fetchUserContext()`, `buildSystemPrompt()`, `registerPlugin()`)
- Constants: UPPER_SNAKE_CASE (e.g., `PLUGIN_LOADERS`, `BASE_SYSTEM`, `AGENT_MODEL`)
- Hooks: camelCase with `use` prefix (e.g., `useAuthStore`, `usePluginRegistry`, `useTranslation()`)

## Where to Add New Code

**New Plugin:**
1. Create directory: `plugins/[plugin-id]/src/`
2. Create manifest: `plugins/[plugin-id]/src/manifest.ts` — must export default
3. Create screen components in `plugins/[plugin-id]/src/screens/` or directly in index.tsx
4. Create store if needed: `plugins/[plugin-id]/src/store.ts` (Zustand)
5. Register in PluginLoader: Add static import to `PLUGIN_LOADERS` map in `apps/mobile/src/lib/PluginLoader.tsx`
6. Add route wrapper: Create thin wrapper at `apps/mobile/app/(app)/(plugins)/[plugin]/index.tsx`
7. Add tool implementations if needed: `backend/api/src/tools/[plugin].ts`
8. Register tools: Export from tool module, add to `registry.ts` `allToolSchemas` array

**New Feature Screen (in existing plugin):**
1. Create component: `plugins/[plugin]/src/screens/[ScreenName].tsx`
2. Add route: `plugins/[plugin]/src/manifest.ts` → add entry to `routes` array with path, icon, showInTabBar
3. Export from plugin index
4. No API changes needed if using existing tools

**New API Endpoint:**
1. Create handler: `backend/api/src/routes/[feature].ts` (or add to existing file)
2. Register in `backend/api/src/app.ts`: `app.route('[path]', featureRouter)`
3. If auth required: Wrap route handlers with `router.use('*', authMiddleware)`
4. If new tool: Also create in `backend/api/src/tools/` and register in registry

**New AI Tool:**
1. Add schema: `backend/api/src/tools/registry.ts` → add to relevant plugin's `ToolSchema[]` array
2. Add executor: `backend/api/src/tools/[plugin].ts` → export schema + async executor function
3. Register in registry: Add to `allToolSchemas`, map in tool executor function
4. Optional: Add to plugin manifest: `plugins/[plugin]/src/manifest.ts` → add to `aiTools` array (for documentation)

**Utility Functions:**
- Shared helpers: `packages/ui/src/` or create new package
- Plugin-specific helpers: `plugins/[plugin]/src/utils/` or `lib/`
- Backend helpers: Create in `backend/api/src/utils/` or task-specific file

**Database Changes:**
1. Create migration: `supabase/migrations/NNN_description.sql`
2. Create TABLE / ALTER TABLE with CREATE POLICY (RLS required)
3. If initial data: Add INSERT statements to seed.sql
4. Apply to local Supabase: `supabase db push` (requires local setup)

## Special Directories

**apps/mobile/.expo:**
- Purpose: Expo metadata and web cache
- Generated: Yes
- Committed: No (git-ignored)

**backend/api/dist:**
- Purpose: TypeScript compiled output
- Generated: Yes
- Committed: No (git-ignored)

**node_modules (all workspaces):**
- Purpose: Installed dependencies
- Generated: Yes (by npm install)
- Committed: No (git-ignored)

**.planning/codebase:**
- Purpose: GSD analysis documents
- Generated: Yes (by `/gsd:map-codebase` command)
- Committed: Yes (reference for future phases)

**supabase/migrations:**
- Purpose: Database schema version control
- Generated: No (manually created)
- Committed: Yes (required for Supabase sync)

**plugins/*/src:**
- Purpose: Plugin source code
- Generated: No (manually created)
- Committed: Yes (plugins are checked in, not dynamically fetched from registry)

---

*Structure analysis: 2026-03-26*
