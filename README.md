# Ziko Platform

**A fully extensible fitness platform built with Expo (React Native), featuring a plugin system, AI coaching integration, and a Supabase backend.**

---

## Architecture

```
ziko-platform/
├── apps/
│   └── mobile/          # Expo SDK 52 + Expo Router v4 (iOS & Android)
├── packages/
│   ├── plugin-sdk/      # Plugin contracts, TypeScript types, shared hooks
│   ├── ai-client/       # AIBridge — SSE streaming AI agent client
│   └── ui/              # Shared React Native component library
├── plugins/
│   ├── nutrition/       # Nutrition Tracker plugin
│   └── persona/         # AI Persona & Habits plugin
├── backend/
│   └── api/             # Hono REST API (AI proxy + plugin management)
└── supabase/
    ├── migrations/      # SQL schema (16 tables, RLS, triggers)
    └── seed.sql         # Default exercises, plugins registry, food database
```

### Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo SDK 52, React Native 0.76, Expo Router v4 |
| Styling | NativeWind v4 (Tailwind syntax) |
| State | Zustand v5 (global) + TanStack Query v5 (server) |
| Storage | MMKV (react-native-mmkv v3) |
| Backend | Hono v4 (TypeScript, Node) |
| Database | Supabase (PostgreSQL + RLS + Auth) |
| AI | Custom AIBridge — SSE streaming, plugin skill injection |
| Monorepo | Turborepo v2 + npm workspaces |

---

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- Expo CLI (`npm i -g expo-cli`)
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

```bash
cp .env.example .env
# Edit .env with your Supabase + AI agent credentials
```

Copy mobile variables to `apps/mobile/.env`:

```bash
cp .env.example apps/mobile/.env
# Keep only EXPO_PUBLIC_* variables
```

### 3. Set up Supabase

1. Create a new Supabase project
2. Run migrations:
   ```bash
   # Using Supabase CLI
   supabase db push
   # or copy-paste supabase/migrations/001_initial_schema.sql in the SQL editor
   ```
3. Seed the database:
   ```bash
   psql $DATABASE_URL < supabase/seed.sql
   # or run supabase/seed.sql in the SQL editor
   ```
4. Enable Google OAuth in Authentication → Providers (optional)

### 4. Start development

```bash
# Start everything
npm run dev

# Or individually:
npm run dev --workspace=apps/mobile    # Expo dev server
npm run dev --workspace=backend/api    # Hono API server
```

---

## Plugin System

Plugins are self-contained packages in `plugins/`. Each plugin exports:

- **`manifest.ts`** — `PluginManifest` (id, name, permissions, aiSkills, routes, aiSystemPromptAddition)
- **`store.ts`** — Zustand state isolated per plugin
- **`screens/`** — React Native screen components
- **`index.ts`** — Public exports

### Creating a plugin

1. Create `plugins/my-plugin/` with the structure above
2. Register it in `apps/mobile/src/lib/PluginLoader.tsx` PLUGIN_LOADERS map
3. Add route files in `apps/mobile/app/(app)/(plugins)/my-plugin/`
4. Insert a row in `supabase/seed.sql` → `plugins_registry` table

---

## AI Integration

The `AIBridge` (in `packages/ai-client/`) assembles a composite system prompt from:

1. Core fitness assistant instructions
2. Each active plugin's `aiSystemPromptAddition`
3. The user's profile (goals, stats)

It communicates with your AI agent via SSE streaming (`POST /chat/stream`) or REST (`POST /chat`).

---

## Key Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start all apps in development |
| `npm run build` | Build all packages |
| `npm run type-check` | TypeScript check across all workspaces |
| `npm run lint` | ESLint across all workspaces |

---

## Environment Variables

See [.env.example](.env.example) for all required variables.

---

## Database Schema

16 tables with full Row Level Security:

- `user_profiles` — extended user data
- `exercises` — global + custom exercise library
- `workout_programs`, `program_workouts`, `program_exercises` — program structure
- `workout_sessions`, `session_sets` — session logging
- `ai_conversations`, `ai_messages` — chat history
- `plugins_registry`, `user_plugins` — plugin marketplace
- `nutrition_logs`, `food_database` — nutrition tracking
- `persona_settings` — AI coach persona

---

## License

MIT
