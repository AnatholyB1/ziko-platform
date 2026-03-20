# CLAUDE.md — Ziko Platform

Project context and conventions for AI assistants working in this codebase.

---

## Project Overview

**Ziko Platform** is a fully extensible fitness mobile app built as a Turborepo monorepo. It features a plugin system, AI coaching integration (Claude Sonnet orchestrator agent), and a Supabase backend.

---

## Monorepo Structure

```
apps/mobile/          → Expo SDK 54 + Expo Router v4 (iOS & Android)
packages/
  plugin-sdk/         → Plugin contracts, TS types, shared hooks
  ai-client/          → AIBridge — SSE streaming AI agent client
  ui/                 → Shared React Native component library
plugins/
  habits/             → Daily Habits & Goals plugin
  nutrition/          → Nutrition Tracker plugin
  persona/            → AI Persona plugin
backend/api/          → Hono v4 REST API (AI orchestrator + plugin management)
  src/
    routes/ai.ts      → AI chat endpoints (stream + sync)
    tools/            → AI tool implementations (habits, nutrition, registry)
    context/          → Context layers (user.ts, conversation.ts)
    middleware/auth.ts → Supabase JWT auth middleware
supabase/
  migrations/         → SQL schema (RLS, triggers, extensions)
  seed.sql            → Default exercises, plugins registry, food database
```

---

## Tech Stack

| Layer     | Technology                                        |
|-----------|---------------------------------------------------|
| Mobile    | Expo SDK 54, React Native 0.81, Expo Router v4    |
| Styling   | NativeWind v4 (Tailwind syntax, light sport theme) |
| State     | Zustand v5 (global) + TanStack Query v5 (server)  |
| Storage   | MMKV (react-native-mmkv v3)                       |
| Backend   | Hono v4 (TypeScript, Node.js)                     |
| Database  | Supabase (PostgreSQL + RLS + Auth)                |
| AI        | Vercel AI SDK v6 + Claude Sonnet (orchestrator agent) |
| Monorepo  | Turborepo v2 + npm workspaces                     |

---

## Dev Commands

```bash
npm run dev              # Start everything (Turborepo)
npm run mobile           # Expo dev server only
npm run backend          # Hono API only (port 3000)
npm run build            # Build all packages
npm run type-check       # TypeScript check all
```

From `apps/mobile/`:
```bash
npx expo start           # Start Expo dev server
```

From `backend/api/`:
```bash
npm run dev              # Start API with tsx watch (auto-loads .env)
```

---

## Environment Variables

### `apps/mobile/.env` (prefix: `EXPO_PUBLIC_`)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=       ← NOT EXPO_PUBLIC_SUPABASE_KEY
EXPO_PUBLIC_API_URL=                 ← Hono API base URL
```

### `backend/api/.env`
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=                ← NOT SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY=
```

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

- **Light sport theme** — no dark mode
- **No StyleSheet** — use inline style objects or NativeWind classes
- Icons: **Ionicons** names (from `@expo/vector-icons`)

---

## AI Architecture

### Single Orchestrator Agent
- **Model**: `claude-sonnet-4-20250514` via `@ai-sdk/anthropic`
- **SDK**: Vercel AI SDK v6 (`ai` package v6.0.116+)
- Agent handles both conversation AND tool execution in a single loop
- `stopWhen: stepCountIs(5)` — max 5 tool-call steps per turn

### Three-Layer Context System
1. **User Context** (`backend/api/src/context/user.ts`)
   - `fetchUserContext(userId)` → profile, installed plugins, recent workouts, today's nutrition & habits summaries
   - Injected into the system prompt dynamically on every request
2. **Conversation Context** (`backend/api/src/context/conversation.ts`)
   - `getOrCreateConversation(userId, conversationId?)` → loads/creates conversation + message history
   - `appendMessages(conversationId, messages)` → persists user + assistant messages
   - `updateConversationTitle(conversationId, title)` → auto-titles from first user message
3. **Tool Context** — 8 tools (4 habits + 4 nutrition) registered in `backend/api/src/tools/registry.ts`

### AI SDK v6 Key Differences (from v3)
- `inputSchema` (not `parameters`)
- `stopWhen: stepCountIs(n)` (not `maxSteps`)
- `input` (not `args`) / `output` (not `result`) in tool callbacks

### API Routes (`/ai/*`)
| Route                  | Description                                |
|------------------------|--------------------------------------------|
| `GET /ai/tools`        | List all available tool schemas             |
| `POST /ai/tools/execute` | Execute a single tool directly           |
| `POST /ai/chat/stream` | Streaming chat with context + persistence  |
| `POST /ai/chat`        | Non-streaming chat with context + persistence |

Chat endpoints accept `{ messages, conversation_id? }`. Both inject user context into the system prompt, load/persist conversation history, and return `conversation_id`.

### SSE Stream Format
```
data: {"type":"meta","conversation_id":"uuid"}\n\n
data: {"type":"chunk","content":"text"}\n\n
data: [DONE]\n\n
```

---

## Plugin System Conventions

Plugins live in `plugins/<name>/src/`. Each plugin must export:

### `manifest.ts`
```ts
// MUST use `export default` (not a named export)
const manifest: PluginManifest = { ... };
export default manifest;
```

### Key `PluginManifest` fields
- `requiredPermissions` — use this field name (NOT `permissions`)
- `routes[].showInTabBar` — boolean (NOT `inTabBar`)
- `routes[].icon` — Ionicons string name (NOT `tabIcon`)
- `routes[].path` — Expo Router path, e.g. `"/(plugins)/habits/dashboard"`
- `aiTools` — optional array of `AITool` schemas for function calling

### `PluginLoader`
- Reads `mod.default` — the manifest **must** be a default export
- Plugin screens are registered as Expo Router file-based routes under `app/(app)/(plugins)/`

### AI Skills & Tools
- Each plugin can declare `aiSkills` with `triggerKeywords` for automatic context injection
- Each plugin can declare `aiTools` with JSON Schema parameters for function calling

---

## Database (Supabase)

### Key Tables (`001_initial_schema.sql`)
- `user_profiles` — extends `auth.users` (name, age, weight_kg, height_cm, goal, units)
- `exercises` — exercise library (name, category, muscle_groups[], instructions)
- `workout_programs`, `workout_sessions`, `session_sets`
- `ai_conversations` — chat conversation metadata (user_id, title, plugin_context JSONB)
- `ai_messages` — chat messages (conversation_id, role [user|assistant|system], content)
- `plugins_registry` — plugin manifests + bundle URLs
- `user_plugins` — installed plugins per user (is_enabled, settings JSONB)

### Habits Plugin Tables (`002_habits_schema.sql`)
- `habits` — user habit definitions (boolean or count type, target, emoji, color)
- `habit_logs` — daily completion records (unique per habit+date)

### Nutrition Plugin Tables (`003_nutrition_schema.sql`)
- `nutrition_logs` — meal entries (date, meal_type, food_name, calories, protein_g, carbs_g, fat_g, serving_g)

### RLS Policy Pattern
Every table uses Row Level Security:
```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<table>_own" ON public.<table>
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## State Management

- **Zustand** stores live in `apps/mobile/src/stores/`
  - `authStore.ts` — Supabase session + `onAuthStateChange` subscription (must store the subscription reference)
  - `workoutStore.ts` — active workout session state
  - `aiStore.ts` — AI chat messages
- Plugins have their own Zustand stores in `plugins/<name>/src/store.ts`

---

## Auth Flow

1. `authStore` initializes Supabase session on app load
2. `onAuthStateChange` subscription kept as a reference (unsubscribe on cleanup)
3. Expo Router redirects: `/(auth)/login` → unauthenticated, `/(app)/` → authenticated
4. Onboarding: `/(auth)/onboarding/step-1` through `step-5`

---

## Backend API (Hono)

Base URL: `http://localhost:3000`

| Route              | Description                               |
|--------------------|-------------------------------------------|
| `GET /health`      | Health check                              |
| `GET /ai/tools`    | List AI tool schemas                      |
| `POST /ai/chat/stream` | Streaming AI chat (orchestrator agent) |
| `POST /ai/chat`    | Non-streaming AI chat                     |
| `POST /ai/tools/execute` | Direct tool execution              |
| `GET /plugins`     | Plugin registry                           |
| `POST /webhooks`   | Supabase webhook handlers                 |

Auth middleware (`src/middleware/auth.ts`) validates Supabase Bearer token via `adminClient.auth.getUser(token)`, sets `c.set('auth', { userId, email })`.

---

## Known Bugs Fixed

- `EXPO_PUBLIC_SUPABASE_KEY` → renamed to `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `plugins/persona/src/manifest.ts` — fixed to `export default` with correct field names
- `authStore.ts` — `onAuthStateChange` subscription now properly stored and cleaned up
- Design system migrated from dark Indigo+Emerald to light sport orange (#FF5C1A) palette
- AI SDK v6 API differences from v3 (inputSchema, stepCountIs, input/output)
- `findLast` not available in ES2016 target — use `filter` + last element instead
