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
  plugin-sdk/         → Plugin contracts, TS types, shared hooks, i18n, theme, alert
  ai-client/          → AIBridge — SSE streaming AI agent client
  ui/                 → Shared React Native component library
plugins/              → 17 plugins total
  habits/             → Daily Habits & Goals plugin
  nutrition/          → Nutrition Tracker + TDEE Calculator
  persona/            → AI Persona & coaching style
  stats/              → Analytics & charts
  gamification/       → XP, levels, coins, shop
  community/          → Friends, challenges, chat, leaderboards
  stretching/         → Stretching & mobility routines
  sleep/              → Sleep tracking & recovery score
  measurements/       → Body measurements & progression
  timer/              → Tabata, HIIT, EMOM, Hyrox timers + exercises
  ai-programs/        → AI-generated workout programs
  journal/            → Mood, energy, stress journal
  hydration/          → Daily water intake tracking
  cardio/             → Running, cycling, Hyrox — GPS live tracking (Strava-like)
  supplements/        → Supplement catalog + price comparator
  wearables/          → Apple Health / Health Connect integration
  rpe/                → RPE Calculator & 1RM estimator
backend/api/          → Hono v4 REST API (deployed on Vercel)
  src/
    routes/ai.ts      → AI chat endpoints (stream + sync)
    tools/            → AI tool implementations (habits, nutrition, registry)
    context/          → Context layers (user.ts, conversation.ts)
    middleware/auth.ts → Supabase JWT auth middleware
supabase/
  migrations/         → 21 SQL migrations (RLS, triggers, extensions)
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
eas build --platform android --profile production  # EAS cloud build (Android)
eas build --platform ios --profile production       # EAS cloud build (iOS)
```

From `backend/api/`:
```bash
npm run dev              # Start API with tsx watch (auto-loads .env)
vercel --prod --yes      # Deploy to Vercel production
```

---

## Environment Variables

### `apps/mobile/.env` (prefix: `EXPO_PUBLIC_`)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_KEY=            ← publishable key (NOT ANON_KEY)
EXPO_PUBLIC_API_URL=                 ← Hono API base URL (https://ziko-api-lilac.vercel.app)
```

### `backend/api/.env`
```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=           ← publishable key (NOT SERVICE_KEY)
ANTHROPIC_API_KEY=
```

### `.gitignore` pattern
```
.env
.env.*
!.env.example
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
3. **Tool Context** — tools registered in `backend/api/src/tools/registry.ts` (habits + nutrition + plugin AI tools)

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

### `PluginLoader` (`apps/mobile/src/lib/PluginLoader.tsx`)
- Reads `mod.default` — the manifest **must** be a default export
- Static `PLUGIN_LOADERS` map with `() => import('@ziko/plugin-{id}/manifest') as any`
- Currently registers 17 plugins: nutrition, persona, habits, stats, gamification, community, stretching, sleep, measurements, timer, ai-programs, journal, hydration, cardio, wearables, supplements, rpe
- Plugin screens are registered as Expo Router file-based routes under `app/(app)/(plugins)/`

### Route Files
- Each plugin screen has a thin wrapper in `apps/mobile/app/(app)/(plugins)/<plugin>/<screen>.tsx`
- Pattern: imports screen component + supabase, renders `<ScreenComponent supabase={supabase} />`

### AI Skills & Tools
- Each plugin can declare `aiSkills` with `triggerKeywords` for automatic context injection
- Each plugin can declare `aiTools` with JSON Schema parameters for function calling
- `aiSystemPromptAddition` — injected into global system prompt when plugin is active

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

### Extended Tables (`004`–`011`)
- `004` — exercises extended fields
- `005` — program_exercises extended
- `006` — session analytics
- `007` — gamification schema (user_xp, shop_items, user_inventory)
- `008` — plugin reviews
- `009` — community schema (friendships, challenges, chat)
- `010` — banners & themes
- `011` — name_fr column

### New Plugin Tables (`012_new_plugins_schema.sql`)
- `stretching_logs` — routine name, duration, exercises (JSONB)
- `sleep_logs` — bedtime, wake_time, duration_hours, quality 1-5 (unique per user+date)
- `body_measurements` — weight_kg, body_fat_pct, waist/chest/arm/thigh/hip_cm, photo_url
- `timer_presets` — user custom timer presets (type, work_sec, rest_sec, rounds)
- `ai_generated_programs` — AI-created workout programs (goal, split, program_data JSONB)
- `journal_entries` — mood/energy/stress 1-5, context (pre/post workout, morning, evening), notes
- `hydration_logs` — amount_ml per entry, date
- `cardio_sessions` — activity_type, duration_min, distance_km, calories, pace, heart_rate

### Additional Tables (`013`–`021`)
- `013` — `stretching_routines` — custom user routines (name, type, muscle_groups[], exercises JSONB)
- `014` — `health_sync_log`, `wearable_daily_summary` — wearable sync tracking + cached daily health data
- `015` — `bug_reports` — in-app bug reports (title, description, severity, category, device_info JSONB, status)
- `016` — program cycles schema
- `017` — avatars storage
- `018` — `supplement_brands`, `supplement_categories`, `supplements`, `supplement_prices` — full catalog + price comparator
- `019` — remove dead supplement brands
- `020` — `timer_presets.exercises JSONB` column + hyrox/functional types for timer & cardio
- `021` — `cardio_sessions.title`, `route_data JSONB`, `elevation_gain_m`, `max_speed_kmh` — GPS route storage

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

Local: `http://localhost:3000` · Production: `https://ziko-api-lilac.vercel.app`

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

## Theme System

- 7 themes available (stored in `useThemeStore` from `@ziko/plugin-sdk`)
- 8 profile banners
- Light sport theme — no dark mode
- Plugins access theme via `useThemeStore((s) => s.theme)`

---

## Internationalization (i18n)

- Uses `useTranslation()` hook from `@ziko/plugin-sdk`
- ~500+ keys per locale
- Translation files in plugin-sdk
- All user-facing strings should use `t('key')` pattern

---

## Plugin Catalog (17 plugins)

| Plugin | ID | AI Skills | AI Tools | Category |
|--------|----|-----------|----------|----------|
| Daily Habits & Goals | `habits` | habit_analysis, habit_coaching | 4 tools | coaching |
| Nutrition Tracker | `nutrition` | meal_planning, calorie_feedback, nutrition_coaching | 4 tools | nutrition |
| AI Persona | `persona` | — | — | persona |
| Analytics | `stats` | full_analytics | — | analytics |
| Récompenses | `gamification` | gamification_info | — | coaching |
| Communauté | `community` | community_info | — | social |
| Stretching & Mobilité | `stretching` | stretching_recommendation, stretching_coaching | stretching_get_routines, stretching_log_session, stretching_get_history | training |
| Sommeil & Récupération | `sleep` | sleep_analysis, recovery_coaching | sleep_log, sleep_get_history, sleep_get_recovery_score | health |
| Mesures & Progression | `measurements` | body_progress | measurements_log, measurements_get_history, measurements_get_progress | health |
| Timer & Chrono | `timer` | timer_recommendation | timer_get_presets, timer_create_preset | training |
| Programmes IA | `ai-programs` | program_generation, program_adaptation | ai_programs_generate, ai_programs_list, ai_programs_adjust | training |
| Journal & Mindset | `journal` | mood_analysis, mindset_coaching | journal_log_mood, journal_get_history, journal_get_trends | coaching |
| Hydratation | `hydration` | hydration_tracking | hydration_log, hydration_get_today, hydration_set_goal | health |
| Cardio & Running | `cardio` | cardio_analysis, running_coaching | cardio_log_session, cardio_get_history, cardio_get_stats | training |
| Compléments Alimentaires | `supplements` | supplement_recommendation, supplement_comparison | supplements_search, supplements_compare_prices, supplements_recommend | nutrition |
| Wearables & Santé | `wearables` | health_sync, activity_summary | wearables_get_steps, wearables_get_heart_rate, wearables_get_summary, wearables_sync_status | health |
| Calculateur RPE | `rpe` | rpe_coaching | — | training |

---

## Custom Alert System

- **Do not use** `Alert` from `react-native` in plugins — use `showAlert` from `@ziko/plugin-sdk`
- Drop-in replacement: `showAlert(title, message, buttons?)` — same API as `Alert.alert`
- Renders via `CustomAlert` component mounted in the root layout
- Required in all plugin screens for consistent UX

---

## Cardio Plugin — GPS Tracking

- **`expo-location`** installed + permissions in `app.json`
- `CardioTracker.tsx` — live GPS session: Haversine distance, noise filter (< 5m accuracy discarded), rolling 60s pace
- `CardioDetail.tsx` — post-session detail with `RouteVisualizer` (custom polyline via angled Views, no map lib), splits, PRs, notes edit, delete
- `CardioDashboard.tsx` — Strava-like feed: `WeeklyChart`, `PersonalRecords`, `SessionCard`, date-grouped session list
- `CardioSession` interface in `store.ts` includes: `title`, `route_data: RoutePoint[]`, `elevation_gain_m`, `max_speed_kmh`
- `RoutePoint`: `{ lat, lng, timestamp, altitude?, accuracy? }`

---

## Timer Plugin — Hyrox & Exercises

- Timer types: `tabata`, `hiit`, `emom`, `rest`, `custom`, `hyrox`, `functional`
- `timer_presets` table has `exercises JSONB` column (migration 020)
- `TimerExercise` interface: `{ id, name, sets, reps?, duration_seconds?, rest_seconds?, notes? }`
- `TimerEditor` has exercise picker; `TimerDashboard` shows current exercise card during session
- Session can be saved as a workout session ("Sauvegarder comme séance")
- Cardio activity types also include `hyrox`, `functional` (migration 020)

---

## RPE Calculator Plugin

- **Plugin ID**: `rpe` | **Category**: training | **Icon**: `calculator-outline`
- `plugins/rpe/src/index.ts` — core formulas:
  - `RPE10_PCT`: base % of 1RM per reps at RPE 10 (Tuchscherer/RTS table)
  - `rpeToPercent(reps, rpe)` → % of 1RM
  - `calc1RM(weight, reps, rpe)` → estimated 1RM
  - `rpeToRIR(rpe)` → reps in reserve
  - `TRAINING_ZONES`: 50%→100% intensity zones
- `RPECalculatorScreen.tsx` — weight input ±1/2.5/5, reps 1–12 chips, RPE 5–10 (0.5 increments) color-coded, 1RM result, zones table
- Shortcut in `workout/index.tsx` + inline RPE modal in `workout/session.tsx` (rest phase)

---

## Supplements Plugin

- **Plugin ID**: `supplements` | **Category**: nutrition
- DB tables (migration 018): `supplement_brands`, `supplement_categories`, `supplements`, `supplement_prices`
- Price comparator across brands/sources
- Weekly scraper cron: `POST /supplements/cron/scrape` (Vercel cron, Monday 3am)
- Migration 019 removes dead/obsolete brands

---

## Wearables Plugin

- **Plugin ID**: `wearables` | **Category**: health
- DB tables (migration 014): `health_sync_log`, `wearable_daily_summary`
- Platforms: `apple_health`, `health_connect` (Android)
- Data types: `steps`, `heart_rate`, `sleep`, `calories`, `exercises`, `weight`

---

## Known Bugs Fixed

- `EXPO_PUBLIC_SUPABASE_ANON_KEY` → renamed to `EXPO_PUBLIC_SUPABASE_KEY` (publishable key)
- `SUPABASE_SERVICE_KEY` → removed from backend, replaced with `SUPABASE_PUBLISHABLE_KEY`
- `plugins/persona/src/manifest.ts` — fixed to `export default` with correct field names
- `authStore.ts` — `onAuthStateChange` subscription now properly stored and cleaned up
- Design system migrated from dark Indigo+Emerald to light sport orange (#FF5C1A) palette
- AI SDK v6 API differences from v3 (inputSchema, stepCountIs, input/output)
- `findLast` not available in ES2016 target — use `filter` + last element instead
- `.env.production` removed from git tracking (security fix)
- Removed `name_fr` from Supabase queries
- All screens use `paddingBottom: 100` for tab bar clearance
- Plugin manifest `icon` field must use Ionicons name (e.g. `'calculator-outline'`), never emoji — `manifest.icon` is passed directly to `<Ionicons name={...} />`
- `Alert.alert` replaced by `showAlert` from `@ziko/plugin-sdk` everywhere in plugins — drops in as exact same API
- CardioDashboard emoji/accented char encoding corruption — edit file via tools, not shell echo
- Cardio GPS `expo-location` permissions declared in `app.json` (iOS `NSLocationWhenInUseUsageDescription` + Android `ACCESS_FINE_LOCATION`)
