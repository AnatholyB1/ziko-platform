# Architecture

**Analysis Date:** 2026-03-26

## Pattern Overview

**Overall:** Turborepo monorepo with plugin-based architecture, three-layer context system, and orchestrator AI agent

**Key Characteristics:**
- Mobile app (React Native/Expo) with dynamic plugin loading system
- Backend API (Hono v4) with three-tier context layers for AI agent
- Supabase PostgreSQL with Row Level Security for all data
- Vercel AI SDK v6 with Claude Sonnet as single orchestrator agent
- Plugins declare schemas, tools, skills; backends execute on behalf of agent
- Zustand global state (mobile + plugins) + TanStack Query for server state

## Layers

**Presentation Layer (Mobile):**
- Location: `apps/mobile/app/`
- Contains: Expo Router file-based routes, screen components, UI layouts
- Depends on: plugin-sdk (types, hooks, alert, i18n), ai-client (SSE streaming), Zustand stores
- Used by: User-facing fitness mobile app with 17 enabled plugins

**Plugin System (Dynamic Loading):**
- Location: `plugins/*/src/`
- Contains: Plugin manifest (static metadata), store (Zustand), screens (route components), tools/skills declarations
- Depends on: plugin-sdk, Supabase client, TanStack Query
- Used by: PluginLoader registers manifests at runtime; AI agent discovers tools + skills dynamically
- Pattern: Each plugin exports `manifest.ts` as default export; PluginLoader lazy-loads via static `PLUGIN_LOADERS` map

**API Layer (Backend):**
- Location: `backend/api/src/routes/`
- Contains: HTTP endpoints (Hono routers), auth middleware, request/response handling
- Depends on: Supabase admin client, AI SDK tools, context layers
- Used by: Mobile app via REST + SSE; Vercel webhook handlers
- Routes: `/ai` (chat/tools), `/plugins` (registry), `/webhooks`, `/bugs`, `/supplements`

**AI Agent Context Layer:**
- Location: `backend/api/src/context/`
- Contains: Three context providers that assemble dynamic AI state
- Depends on: Supabase database queries
- Used by: `buildSystemPrompt()` injects context at request time
- Pattern:
  1. **User Context** (`user.ts`): Fetches profile, habits summary, nutrition summary, recent workouts, installed plugins
  2. **Conversation Context** (`conversation.ts`): Loads/creates conversation, persists messages, auto-titles
  3. **Tool Context** (implicit in registry): Tool schemas + executors

**Tool Execution Layer:**
- Location: `backend/api/src/tools/`
- Contains: Per-plugin tool implementations (habits, nutrition, stretching, sleep, measurements, timer, ai-programs, journal, hydration, cardio, wearables, navigation)
- Depends on: Supabase client, domain logic
- Used by: AI agent via Vercel AI SDK `tool()` wrapper; direct `/ai/tools/execute` endpoint
- Pattern: Each tool module exports schema + async executor; registry maps names to executors

**Data Layer:**
- Location: `supabase/migrations/`
- Contains: 21 PostgreSQL migrations, RLS policies, initial seed data
- Depends on: Supabase instance
- Used by: All layers (mobile, API, plugins) via Supabase clients
- Pattern: Every table has RLS enabled; user isolation via `auth.uid()` matcher

**Shared Packages:**
- `packages/plugin-sdk/`: Types (PluginManifest, AITool, Permission), hooks (usePluginRegistry, useThemeStore), i18n, alert system, theme
- `packages/ai-client/`: AIBridge class for client-side plugin registration + skill management
- `packages/ui/`: Reusable React Native components

## Data Flow

**User Authentication & Onboarding:**

1. Root layout calls `authStore.initialize()`
2. `authStore` calls `supabase.auth.getSession()`
3. If session exists, `onAuthStateChange` listener updates store + calls `refreshProfile()`
4. Expo Router redirects: no session → `/(auth)/login` → onboarding → `/(auth)/onboarding/step-N` → `/(app)/`
5. Once authenticated, `PluginLoader` queries `user_plugins` table and lazy-loads enabled manifests

**AI Chat with Orchestrator Agent:**

1. Mobile sends `POST /ai/chat/stream` with `{ messages, conversation_id? }` + Supabase Bearer token
2. Auth middleware validates JWT, extracts `userId`
3. Backend fetches `userContext` (profile, habits, nutrition, recent workouts, installed plugins)
4. Backend fetches/creates conversation + loads message history
5. `buildSystemPrompt()` composes dynamic system message with user profile + today's snapshot
6. Vercel AI SDK `streamText()` orchestrates agent + tools:
   - Agent reads system prompt + tools + message history
   - Agent calls tools (via Vercel SDK `tool()` wrapper)
   - Tool executor called with `(params, userId)`
   - Tool reads/writes Supabase (RLS filters by `auth.uid()`)
   - Agent synthesizes response from tool results
   - Agent optionally calls `app_navigate` to direct user to relevant screen
7. Streaming SSE chunks sent to mobile (meta, chunk, done)
8. Backend persists all messages + auto-titles conversation from first user message
9. Mobile `AIBridge` streams chunks to UI, renders markdown

**Plugin Loading & Registration:**

1. After auth init, `PluginLoader` queries `user_plugins` where `is_enabled = true`
2. For each enabled plugin, static `PLUGIN_LOADERS[pluginId]()` async-imports manifest
3. For persona plugin, applies dynamic coaching style system prompt via `buildPersonaSystemPrompt()`
4. `registerPlugin(manifest)` adds to `usePluginRegistry()` Zustand store
5. `aiBridge.registerPlugin(manifest)` adds to `skillsByPlugin` map
6. Expo Router dynamically renders tab bar buttons for each plugin with `showInTabBar: true` routes
7. Plugin screens rendered as thin wrappers: `apps/mobile/app/(app)/(plugins)/{plugin}/{screen}.tsx`

**Tool Invocation via AI:**

1. Agent reads tool schema from registry (array of `AITool` with JSON Schema parameters)
2. Agent calls tool by name with typed inputs
3. Vercel SDK `tool()` wrapper executes async executor
4. Executor function runs plugin-specific logic:
   - Reads from Supabase (filtered by `user_id`)
   - May call other tools (e.g. nutrition logs to calculate daily totals)
   - Writes results if action requested (e.g. habits_log creates habit_log entry)
5. Result returned to agent as structured data
6. Agent may chain multiple tools in single turn (up to `stepCountIs(5)` limit)

## State Management

**Global (Mobile):**
- `useAuthStore` (Zustand): Session, user, profile, auth state
- `useThemeStore` (Zustand): Current theme, banner, theme list
- Plugin-specific stores (`useHabitsStore`, `useNutritionStore`, etc.): Local plugin state

**Server (Mobile):**
- TanStack Query v5: Caches API responses, handles refetching

**AI Context (Backend):**
- Dynamic per-request, built from Supabase queries
- No persistent server state for agent—stateless design

## Key Abstractions

**PluginManifest:**
- Purpose: Static contract declaring plugin capabilities (routes, permissions, AI tools, skills)
- Examples: `plugins/habits/src/manifest.ts`, `plugins/cardio/src/manifest.ts`
- Pattern: Default export; loaded at runtime via PluginLoader; defines schema for tools + skills

**AITool:**
- Purpose: Schema + executor for function-calling capability
- Examples: `habits_get_today`, `nutrition_log_meal`, `cardio_log_session`
- Pattern: JSON Schema on client/backend; executor on backend only; registered in tool registry

**AISkill:**
- Purpose: Contextual trigger keywords for AI to know when to suggest capability
- Examples: `habit_analysis` (triggered by "habit", "streak", "routine"), `cardio_analysis` (triggered by "running", "pace")
- Pattern: Optional context injection; agent checks incoming message for keywords; lazy-loads context only when needed

**UserContext:**
- Purpose: Assembled view of user state injected into every AI agent request
- Location: `backend/api/src/context/user.ts`
- Pattern: Parallel Supabase queries; memoized for duration of request; includes profile, today's nutrition, today's habits, recent workouts, installed plugins

**RoutePoint (CardioPlugin):**
- Purpose: GPS coordinate with timestamp for live tracking
- Structure: `{ lat, lng, timestamp, altitude?, accuracy? }`
- Usage: Cardio sessions store array of RoutePoints; RouteVisualizer renders polyline visualization

**TimerExercise:**
- Purpose: Exercise definition for timed workouts (tabata, HIIT, EMOM, Hyrox)
- Structure: `{ id, name, sets, reps?, duration_seconds?, rest_seconds?, notes? }`
- Pattern: Stored in `timer_presets.exercises JSONB`; TimerEditor picker selects; TimerDashboard displays during session

## Entry Points

**Mobile App:**
- Location: `apps/mobile/app/_layout.tsx`
- Triggers: App launch
- Responsibilities: Initialize auth store, prevent splash screen hide until auth ready, wrap tree with QueryClient + PluginLoader + CustomAlert

**API Server:**
- Location: `backend/api/src/index.ts`
- Triggers: Node.js process start or Vercel serverless invocation
- Responsibilities: Serve Hono app on port 3000 (dev) or Vercel handler (prod)

**Auth Flow Entry:**
- Location: `apps/mobile/app/(auth)/_layout.tsx`
- Triggers: No session detected by Router
- Responsibilities: Redirect authenticated users to `/(app)`; show login/register/onboarding screens

**App Tab Bar Entry:**
- Location: `apps/mobile/app/(app)/_layout.tsx`
- Triggers: Session exists + profile onboarding complete
- Responsibilities: Render Tabs layout with dynamically-generated plugin tabs; show FAB buttons (bug report, chat)

**AI Chat Entry:**
- Location: `backend/api/src/routes/ai.ts` POST `/chat/stream`
- Triggers: Mobile POST to `/ai/chat/stream` with messages
- Responsibilities: Orchestrate agent with context injection, run tool loop, stream SSE chunks, persist conversation

## Error Handling

**Strategy:** Try-catch at route level; log to console; return JSON error response

**Patterns:**
- Auth errors: Middleware returns 401 if JWT invalid
- Tool errors: Executor catch block logs + returns error string to agent (agent can retry or apologize)
- Supabase errors: Usually data-access issues; propagate as JSON error with message

## Cross-Cutting Concerns

**Logging:** Console.log at route/tool level; no centralized logging service (Vercel logs capture stdout)

**Validation:**
- Types via TypeScript
- Supabase RLS policies enforce data isolation
- Tool parameters validated by Vercel AI SDK against JSON Schema

**Authentication:**
- Supabase Auth handles JWT issuance
- Bearer token passed from mobile in Authorization header
- Auth middleware (`backend/api/src/middleware/auth.ts`) validates via `adminClient.auth.getUser(token)`
- User ID extracted and set in context for all subsequent operations

**Internationalization:**
- `useTranslation()` hook from plugin-sdk
- Translation files managed per-plugin
- Falls back to English if key not found

---

*Architecture analysis: 2026-03-26*
