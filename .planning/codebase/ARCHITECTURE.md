<!-- refreshed: 2026-05-28 -->
# Architecture

**Analysis Date:** 2026-05-28

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
├──────────────────────────┬───────────────────────────────────────────┤
│   Mobile App             │   Web Coach Portal                        │
│   `apps/mobile/`         │   `apps/web/`                             │
│   Expo SDK 54 / RN 0.81  │   Next.js 15 / App Router                 │
│   Expo Router v4         │   `[locale]/(coach)/...`                  │
└─────────────┬────────────┴────────────────────┬──────────────────────┘
              │  Bearer token (Supabase JWT)     │  Bearer token / SSR
              ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     HONO API  (backend/api/)                         │
│   Deployed on Vercel as serverless functions                         │
│   Routes: /ai/* · /coach/* · /forms · /notifications · /credits …   │
│   Middleware: authMiddleware (JWT validation via Supabase Admin)     │
│   `backend/api/src/app.ts`                                           │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐    ┌────────────────────┐
│  Supabase     │    │  Anthropic Claude  │
│  PostgreSQL   │    │  Sonnet (AI agent) │
│  + Auth + RLS │    │  via Vercel AI SDK │
│  + Realtime   │    │  v6                │
└───────────────┘    └────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Path |
|-----------|----------------|------|
| Mobile App | Athlete-facing UI, workout tracking, plugin host | `apps/mobile/` |
| Web Portal | Coach dashboard, client management, program builder | `apps/web/` |
| Hono API | REST + AI orchestration, auth, business logic | `backend/api/src/` |
| Supabase | Auth, database (PostgreSQL + RLS), realtime channels | `supabase/` |
| plugin-sdk | Shared types, hooks, i18n, theme, alert system | `packages/plugin-sdk/src/` |
| ai-client | AIBridge — SSE streaming client for mobile | `packages/ai-client/src/AIBridge.ts` |
| ui | Shared React Native component library | `packages/ui/` |
| coach-sdk | Coach-specific schemas, types, components | `packages/coach-sdk/src/` |
| email | React Email templates | `packages/email/src/` |
| Plugins (19) | Feature modules — each has manifest, store, screens | `plugins/<name>/src/` |

## Pattern Overview

**Overall:** Monorepo (Turborepo) with a plugin-based mobile app, a coach web portal, and a shared Hono backend.

**Key Characteristics:**
- Plugin manifests declare routes, AI skills, AI tools, and permissions; core app knows nothing about plugin internals
- All auth is Supabase JWT — mobile sends `Bearer` token to Hono, which validates via `adminClient.auth.getUser(token)`
- AI agent is a single orchestrator on the backend; mobile communicates via SSE stream
- Plugin screens are thin Expo Router file wrappers that import screen components from plugin packages
- RLS enforces data isolation on every Supabase table; no service-key queries from the client

## Layers

**Shared Packages:**
- Purpose: Types, hooks, design tokens, i18n, components shared across apps and plugins
- Location: `packages/`
- Contains: TypeScript types (`plugin-sdk/src/types.ts`), i18n keys (`plugin-sdk/src/i18n.ts`), theme tokens (`plugin-sdk/src/theme.ts`), AIBridge client (`ai-client/src/AIBridge.ts`), RN component library (`ui/`)
- Depends on: Nothing internal
- Used by: `apps/mobile/`, all plugins, `apps/web/` (coach-sdk)

**Mobile App Core:**
- Purpose: Root layout, auth store, plugin loader, workout store, global state
- Location: `apps/mobile/app/`, `apps/mobile/src/`
- Contains: Expo Router layouts, Zustand stores, PluginLoader, shared hooks/components
- Depends on: `packages/plugin-sdk`, `packages/ai-client`, all installed plugins
- Used by: End users (athletes)

**Plugins:**
- Purpose: Self-contained feature modules (habits, nutrition, cardio, etc.)
- Location: `plugins/<name>/src/` — each exports `manifest.ts`, `store.ts`, `screens/`
- Contains: Plugin manifest (routes, aiSkills, aiTools), Zustand store, screen components
- Depends on: `packages/plugin-sdk` only (no cross-plugin imports)
- Used by: `PluginLoader` in mobile app to register into plugin registry and AIBridge

**Hono Backend:**
- Purpose: REST API, AI agent orchestration, coach routes, cron jobs
- Location: `backend/api/src/`
- Contains: Routes (`routes/`, `coach/`), AI tools (`tools/`), context layers (`context/`), middleware, services
- Depends on: Supabase, Anthropic API, Vercel AI SDK v6
- Used by: Both mobile app and web portal

**Web Coach Portal:**
- Purpose: Coach-facing dashboard (clients, programs, forms, branding, invitations)
- Location: `apps/web/src/`
- Contains: Next.js App Router pages, server actions, coach API proxy, components
- Depends on: `packages/coach-sdk`, `packages/ui`, Supabase direct + Hono API
- Used by: Coaches

## Data Flow

### Primary Mobile Request Path

1. User action triggers Supabase query or Hono API call in plugin screen or core screen
2. Mobile reads Supabase JWT from `authStore` (`apps/mobile/src/stores/authStore.ts`)
3. HTTP request sent with `Authorization: Bearer <token>` to `EXPO_PUBLIC_API_URL`
4. `authMiddleware` in Hono validates token via `adminClient.auth.getUser(token)` (`backend/api/src/middleware/auth.ts`)
5. Route handler executes business logic with `c.get('auth').userId`
6. Supabase RLS enforces row-level isolation for all DB reads/writes

### AI Chat Flow (Mobile → Backend → Claude)

1. User types in `apps/mobile/app/(app)/ai/chat.tsx`
2. `useAIStore.sendMessage()` calls `aiBridge.streamChat()` (`packages/ai-client/src/AIBridge.ts`)
3. `POST /ai/chat/stream` received by `backend/api/src/routes/ai.ts`
4. `fetchUserContext(userId)` parallelises 6 Supabase queries: profile, plugins, workouts, nutrition, habits, persona (`backend/api/src/context/user.ts`)
5. `getOrCreateConversation()` loads/creates conversation + message history (`backend/api/src/context/conversation.ts`)
6. `streamText()` (Vercel AI SDK v6) calls Claude Sonnet with dynamic system prompt, tool registry, `stopWhen: stepCountIs(5)`
7. Tool calls resolved by `getToolExecutor(name)` from `backend/api/src/tools/registry.ts`
8. SSE stream emitted: `{"type":"meta","conversation_id":"..."}` → `{"type":"chunk","content":"..."}` → `[DONE]`
9. `appendMessages()` persists user + assistant messages after stream completes
10. Mobile `aiStore` accumulates stream chunks, renders incrementally

### Plugin Load Flow

1. `PluginLoader` mounts at root in `apps/mobile/app/_layout.tsx`
2. Mandatory plugins loaded first (bypass DB), then `user_plugins` queried from Supabase
3. Each plugin's `manifest.default` registered into `pluginRegistry` (plugin-sdk) and `aiBridge`
4. Persona plugin gets dynamic system prompt injected from `persona_settings` Supabase table
5. Plugin routes become accessible via Expo Router file-based wrappers under `app/(app)/(plugins)/`

### Coach Web Flow

1. Next.js SSR pages in `apps/web/src/app/[locale]/(coach)/coach/`
2. Coach API calls proxied through `apps/web/src/app/api/coach/[...path]/route.ts` → Hono `/coach/*`
3. Hono `coach/` modules (`identity`, `clients`, `programs`, `branding`, etc.) each contain `service.ts` + `db.ts` + `types.ts`

**State Management:**
- Zustand stores hold global client state (auth, workout, AI chat, notifications, credits, theme, user prefs)
- TanStack Query (v5) manages server-fetched data with 5-minute default staleTime and 2 retries
- MMKV used for persistent local storage (coach branding cache, workout session recovery)
- Supabase Realtime channels used for live notification updates in the mobile app layout

## Key Abstractions

**PluginManifest:**
- Purpose: Contract between plugins and the host app — declares routes, AI capabilities, permissions
- Examples: `plugins/habits/src/manifest.ts`, `plugins/nutrition/src/manifest.ts`
- Pattern: `export default manifest` (not named export); fields: `id`, `requiredPermissions`, `routes`, `aiSkills`, `aiTools`, `mandatory?`

**AIBridge:**
- Purpose: Client-side orchestration of SSE streaming, plugin skill/tool registration
- Examples: `packages/ai-client/src/AIBridge.ts` — singleton instantiated in `apps/mobile/src/lib/ai.ts`
- Pattern: `aiBridge.registerPlugin(manifest)` called by `PluginLoader`; `aiBridge.streamChat(messages, onChunk)` called by `aiStore`

**Tool Registry:**
- Purpose: Central map of AI tool names → executor functions on the backend
- Examples: `backend/api/src/tools/registry.ts` — 16 tool files, 23+ tools registered
- Pattern: `getToolExecutor(name)` returns an async function; `allToolSchemas` returns JSON Schema array for LLM

**Context Layers (User + Conversation):**
- Purpose: Dynamic per-request context injected into AI system prompt
- Examples: `backend/api/src/context/user.ts`, `backend/api/src/context/conversation.ts`
- Pattern: `fetchUserContext(userId)` parallelises 6 DB queries; `getOrCreateConversation()` loads/creates thread

## Entry Points

**Mobile Root:**
- Location: `apps/mobile/app/_layout.tsx`
- Triggers: App launch — Expo Router root
- Responsibilities: Auth init, font loading, QueryClient, PluginLoader, global overlays (CustomAlert, BugFab, CreditEarnToast)

**Mobile App Layout:**
- Location: `apps/mobile/app/(app)/_layout.tsx`
- Triggers: Authenticated navigation
- Responsibilities: Tab bar setup, branding bootstrap, notification listeners, Supabase Realtime subscription, auth + onboarding redirects, PendingFormsOverlay

**Hono Entry:**
- Location: `backend/api/src/app.ts` + `backend/api/src/index.ts`
- Triggers: HTTP requests to `https://ziko-api-lilac.vercel.app`
- Responsibilities: Middleware registration (CORS, logger), route mounting, 404/error handlers, Vercel serverless exports (`GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`)

**Web Root:**
- Location: `apps/web/src/app/layout.tsx` → `apps/web/src/app/[locale]/(coach)/coach/`
- Triggers: Next.js page render
- Responsibilities: Locale routing, global CSS, font loading, coach auth guard

## Architectural Constraints

- **Metro bundler static imports:** `PluginLoader.tsx` uses a static `PLUGIN_LOADERS` map — Metro cannot handle dynamic `import(variable)`. Adding a new plugin requires editing this map at `apps/mobile/src/lib/PluginLoader.tsx`.
- **AI SDK v6 API:** Use `inputSchema:` (not `parameters:`), `stopWhen: stepCountIs(5)` (not `maxSteps:`), `input`/`output` (not `args`/`result`) in tool callbacks. Do not revert to v3 patterns.
- **Supabase RLS:** All tables use `auth.uid() = user_id` policy. Server-side code using the user's own JWT inherits RLS. Service key bypasses RLS — only used in `creditGate.ts` and `ai_cost_log` inserts.
- **Plugin isolation:** Plugins must only import from `@ziko/plugin-sdk`. Cross-plugin imports are forbidden.
- **Expo Router file-based routing:** Plugin screens require a thin wrapper file in `app/(app)/(plugins)/<plugin>/` that imports from the plugin package and passes `supabase` as a prop.
- **No dark mode:** Light sport theme only (#FF5C1A primary). Do not introduce dark mode styles.
- **Global singletons:** `queryClient` in `app/_layout.tsx`, `aiBridge` in `apps/mobile/src/lib/ai.ts`, `supabase` in `apps/mobile/src/lib/supabase.ts`.

## Anti-Patterns

### Using `Alert` from react-native in plugins

**What happens:** `import { Alert } from 'react-native'` used directly in plugin screens.
**Why it's wrong:** Bypasses the custom alert system; causes inconsistent UX and cannot be intercepted.
**Do this instead:** `import { showAlert } from '@ziko/plugin-sdk'` — same `Alert.alert` API, rendered via `CustomAlert` at root.

### Named export for plugin manifest

**What happens:** `export const manifest: PluginManifest = { ... }` instead of default export.
**Why it's wrong:** `PluginLoader.tsx` reads `mod.default` — named exports will fail silently (plugin never loads).
**Do this instead:** Always `export default manifest` in every `plugins/<name>/src/manifest.ts`.

### Using AI SDK v3 patterns

**What happens:** `parameters:` field on tools, `maxSteps:` option, `args`/`result` in tool callbacks.
**Why it's wrong:** Project uses Vercel AI SDK v6 — v3 fields are silently ignored or throw runtime errors.
**Do this instead:** Use `inputSchema:`, `stopWhen: stepCountIs(5)`, `input`/`output` in tool callbacks (see `backend/api/src/routes/ai.ts`).

### `findLast` on arrays

**What happens:** `array.findLast(fn)` called in mobile/plugin TypeScript files.
**Why it's wrong:** TypeScript `target: ES2016` does not include `findLast` — causes runtime crashes on Android.
**Do this instead:** `array.filter(fn).pop()` or `[...array].reverse().find(fn)`.

## Error Handling

**Strategy:** Try/catch at route handler level; errors logged with `console.error('[API Error]', err)` in Hono's `onError` handler; Sentry captures unhandled exceptions in mobile.

**Patterns:**
- Hono routes return `c.json({ error: 'message' }, statusCode)` on failure
- Plugin loaders catch per-plugin load errors with `console.warn` — a failing plugin does not crash the app
- Auth failures return 401 from `authMiddleware` before reaching route handlers
- `ErrorBoundary` wraps the entire React tree in `apps/mobile/app/_layout.tsx`
- Sentry initialized before any renders via `initSentry()` + `Sentry.wrap(RootLayout)` in `apps/mobile/app/_layout.tsx`

## Cross-Cutting Concerns

**Logging:** `console.error`/`console.warn` in backend; Sentry `captureException` for mobile crashes via `apps/mobile/src/lib/sentry.ts`
**Validation:** Zod in coach-sdk and web; backend routes do manual type checks; no shared validation layer
**Authentication:** Supabase JWT everywhere — `authMiddleware` on all Hono routes, `useAuthStore` on mobile, `middleware.ts` on web Next.js routes
**Internationalisation:** `useTranslation()` from `@ziko/plugin-sdk`; ~500+ keys per locale in `packages/plugin-sdk/src/i18n.ts`; locale prefix in web app router; language stored in `user_profiles.language`
**Credits system:** `creditGate.ts` middleware checks and deducts credits before AI calls; `creditStore.ts` tracks balance on mobile; `POST /credits` endpoints manage balance
**Notifications:** Push via Expo Notifications + server-side cron (`/notifications` routes); Supabase Realtime channel in `(app)/_layout.tsx` syncs unread count live; `notificationStore.ts` holds badge count

---

*Architecture analysis: 2026-05-28*
