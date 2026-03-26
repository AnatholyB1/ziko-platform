# Ziko Platform

**A fully extensible fitness platform built with Expo (React Native), featuring a plugin system, AI coaching integration (Claude Sonnet), and a Supabase backend.**

> Backend: [https://ziko-api-lilac.vercel.app](https://ziko-api-lilac.vercel.app)

---

## Architecture

```
ziko-platform/
├── apps/
│   └── mobile/          # Expo SDK 54 + Expo Router v4 (iOS & Android)
├── packages/
│   ├── plugin-sdk/      # Plugin contracts, TypeScript types, shared hooks, i18n, theme, alert
│   ├── ai-client/       # AIBridge — SSE streaming AI agent client
│   └── ui/              # Shared React Native component library
├── plugins/             # 17 plugins
│   ├── habits/          # Daily Habits & Goals
│   ├── nutrition/       # Nutrition Tracker + TDEE Calculator
│   ├── persona/         # AI Persona & coaching style
│   ├── stats/           # Analytics & charts
│   ├── gamification/    # XP, levels, coins, shop
│   ├── community/       # Friends, challenges, chat, leaderboards
│   ├── stretching/      # Stretching & mobility routines
│   ├── sleep/           # Sleep tracking & recovery score
│   ├── measurements/    # Body measurements & progression
│   ├── timer/           # Tabata, HIIT, EMOM, Hyrox timers + exercises
│   ├── ai-programs/     # AI-generated workout programs
│   ├── journal/         # Mood, energy, stress journal
│   ├── hydration/       # Daily water intake tracking
│   ├── cardio/          # Running, cycling, Hyrox — GPS live tracking (Strava-like)
│   ├── supplements/     # Supplement catalog + price comparator
│   ├── wearables/       # Apple Health / Health Connect integration
│   └── rpe/             # RPE Calculator & 1RM estimator
├── backend/
│   └── api/             # Hono v4 REST API — deployed on Vercel
└── supabase/
    ├── migrations/      # 21 SQL migrations (RLS, triggers, extensions)
    └── seed.sql         # Default exercises, plugins registry, food database
```

### Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo SDK 54, React Native 0.81, Expo Router v4 |
| Styling | NativeWind v4 (Tailwind syntax, light sport theme) |
| State | Zustand v5 (global) + TanStack Query v5 (server) |
| Storage | MMKV (react-native-mmkv v3) |
| Backend | Hono v4 (TypeScript, Node.js) |
| Database | Supabase (PostgreSQL + RLS + Auth) |
| AI | Vercel AI SDK v6 + Claude Sonnet (orchestrator agent) |
| Monorepo | Turborepo v2 + npm workspaces |

---

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- EAS CLI (`npm i -g eas-cli`) — for mobile builds
- Vercel CLI (`npm i -g vercel`) — for backend deploys
- A [Supabase](https://supabase.com) project

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/your-org/ziko-platform.git
cd ziko-platform
npm install
```

### 2. Configure environment variables

**`apps/mobile/.env`**
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_KEY=your_publishable_key
EXPO_PUBLIC_API_URL=https://ziko-api-lilac.vercel.app
```

**`backend/api/.env`**
```
SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 3. Set up Supabase

1. Create a new Supabase project
2. Run all 21 migrations in order via the SQL editor or Supabase CLI:
   ```bash
   supabase db push
   ```
3. Seed the database:
   ```bash
   # Run supabase/seed.sql in the SQL editor
   ```

### 4. Start development

```bash
npm run dev          # Start everything (Turborepo)
npm run mobile       # Expo dev server only
npm run backend      # Hono API only (port 3000)
```

---

## Plugin System

Plugins are self-contained packages in `plugins/`. Each plugin exports:

- **`manifest.ts`** — `PluginManifest` (id, name, requiredPermissions, aiSkills, aiTools, routes) — **must use `export default`**
- **`store.ts`** — Zustand state isolated per plugin
- **`screens/`** — React Native screen components
- **`index.ts`** — Public exports

### Manifest conventions
- `icon` — **Ionicons name** (e.g. `'calculator-outline'`), never an emoji
- `requiredPermissions` — not `permissions`
- `routes[].showInTabBar` — not `inTabBar`

### Creating a plugin

1. Create `plugins/my-plugin/` with the structure above
2. Register it in `apps/mobile/src/lib/PluginLoader.tsx` → `PLUGIN_LOADERS` map
3. Add route files in `apps/mobile/app/(app)/(plugins)/my-plugin/`
4. Add `Stack.Screen` entries in `apps/mobile/app/(app)/(plugins)/_layout.tsx`
5. Insert a row in `supabase/seed.sql` → `plugins_registry` table

### Alert system

Use `showAlert` from `@ziko/plugin-sdk` instead of `Alert` from `react-native` in all plugin screens:

```ts
import { showAlert } from '@ziko/plugin-sdk';
showAlert('Title', 'Message', [{ text: 'OK' }]);
```

---

## AI Integration

### Orchestrator Agent
- **Model**: `claude-sonnet-4-20250514` via Vercel AI SDK v6
- Single agent loop handles conversation + tool execution
- Max 5 tool-call steps per turn (`stopWhen: stepCountIs(5)`)

### Three-Layer Context
1. **User context** — profile, installed plugins, recent activity (injected every request)
2. **Conversation context** — persistent message history per `conversation_id`
3. **Tool context** — 34 registered AI tools across all plugins

### API Endpoints

| Route | Description |
|---|---|
| `POST /ai/chat/stream` | Streaming SSE chat |
| `POST /ai/chat` | Non-streaming chat |
| `GET /ai/tools` | List all tool schemas |
| `POST /ai/tools/execute` | Direct tool execution |
| `GET /plugins` | Plugin registry |

---

## Key Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start all apps in development |
| `npm run build` | Build all packages |
| `npm run type-check` | TypeScript check across all workspaces |

### Mobile builds (from `apps/mobile/`)

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

### Backend deploy (from `backend/api/`)

```bash
vercel --prod --yes
```

---

## Database Schema

21 migrations, all tables with Row Level Security:

| Migration | Tables |
|---|---|
| 001 | `user_profiles`, `exercises`, `workout_programs`, `workout_sessions`, `session_sets`, `ai_conversations`, `ai_messages`, `plugins_registry`, `user_plugins` |
| 002 | `habits`, `habit_logs` |
| 003 | `nutrition_logs` |
| 007 | `user_xp`, `shop_items`, `user_inventory` |
| 009 | `friendships`, `community_challenges`, `chat_messages` |
| 012 | `stretching_logs`, `sleep_logs`, `body_measurements`, `timer_presets`, `ai_generated_programs`, `journal_entries`, `hydration_logs`, `cardio_sessions` |
| 013 | `stretching_routines` |
| 014 | `health_sync_log`, `wearable_daily_summary` |
| 015 | `bug_reports` |
| 018 | `supplement_brands`, `supplement_categories`, `supplements`, `supplement_prices` |
| 020 | `timer_presets.exercises` column + hyrox/functional activity types |
| 021 | `cardio_sessions.title`, `route_data`, `elevation_gain_m`, `max_speed_kmh` |

---

## License

MIT
