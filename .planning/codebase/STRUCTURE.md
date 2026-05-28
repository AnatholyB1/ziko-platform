<!-- refreshed: 2026-05-28 -->
# Codebase Structure

**Analysis Date:** 2026-05-28

## Directory Layout

```
ziko-platform/                        # Turborepo monorepo root
├── apps/
│   ├── mobile/                       # Expo SDK 54 mobile app (iOS + Android)
│   └── web/                          # Next.js 15 coach web portal
├── backend/
│   └── api/                          # Hono v4 REST + AI API (Vercel serverless)
├── packages/
│   ├── plugin-sdk/                   # Shared types, hooks, i18n, theme, alert
│   ├── ai-client/                    # AIBridge — SSE streaming AI client
│   ├── ui/                           # Shared React Native component library
│   ├── coach-sdk/                    # Coach-specific schemas, types, components
│   └── email/                        # React Email templates
├── plugins/                          # 19 plugin packages (one per feature)
│   ├── habits/
│   ├── nutrition/
│   ├── cardio/
│   ├── coach/
│   └── … (15 more)
├── supabase/
│   ├── migrations/                   # 69 SQL migration files (RLS, schema, triggers)
│   └── seed.sql                      # Exercises, plugin registry, food DB seed
├── .planning/                        # GSD planning docs (not shipped)
├── .claude/                          # Claude agent skills
├── package.json                      # Turborepo workspace root
├── turbo.json                        # Turborepo task pipeline
└── tsconfig.base.json                # Shared TypeScript base config
```

## Mobile App Structure (`apps/mobile/`)

```
apps/mobile/
├── app/                              # Expo Router file-based routes (root)
│   ├── _layout.tsx                   # Root layout: auth init, QueryClient, PluginLoader
│   ├── index.tsx                     # Redirect to /(app) or /(auth)
│   ├── (auth)/                       # Unauthenticated screens
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── welcome.tsx
│   │   ├── forgot.tsx
│   │   └── onboarding/               # step-1.tsx … step-7.tsx
│   └── (app)/                        # Authenticated screens (tab navigation)
│       ├── _layout.tsx               # Tab bar, notification listeners, auth guard
│       ├── index.tsx                 # Home dashboard
│       ├── workout/                  # Workout screens (index, session, history, [id])
│       ├── profile/                  # Profile screens
│       ├── ai/                       # AI chat screens (index, chat)
│       ├── store/                    # Plugin store / marketplace
│       ├── calendar.tsx
│       ├── notifications.tsx
│       ├── referral.tsx
│       └── (plugins)/                # Plugin route wrappers
│           ├── _layout.tsx           # Plugin layout (invisible, no headers)
│           ├── habits/               # dashboard.tsx, log.tsx
│           ├── nutrition/            # dashboard.tsx, log.tsx, tdee.tsx
│           ├── cardio/               # dashboard.tsx, tracker.tsx, [id].tsx
│           ├── coach/                # dashboard.tsx, forms/, …
│           └── … (16 more plugin dirs)
├── src/
│   ├── lib/
│   │   ├── PluginLoader.tsx          # Loads + registers manifests from user_plugins
│   │   ├── supabase.ts               # Supabase singleton client
│   │   ├── ai.ts                     # AIBridge singleton instance
│   │   ├── sentry.ts                 # Sentry init + user context helpers
│   │   ├── storage.ts                # MMKV wrappers
│   │   └── earnCredits.ts            # Credit earn API calls
│   ├── stores/
│   │   ├── authStore.ts              # Supabase session + profile + onAuthStateChange
│   │   ├── workoutStore.ts           # Active workout session state + MMKV persistence
│   │   ├── aiStore.ts                # AI chat messages, streaming state, conversations
│   │   ├── themeStore.ts             # Active theme + coach branding override
│   │   ├── notificationStore.ts      # Unread badge count + sync
│   │   ├── creditStore.ts            # Credit balance state
│   │   ├── userPrefsStore.ts         # Units, language, region prefs
│   │   └── clipboardStore.ts         # Clipboard utility store
│   ├── components/                   # Global shared UI components
│   ├── hooks/                        # Shared hooks (useNotificationSetup, …)
│   ├── tasks/                        # Background tasks (notificationTask.ts)
│   └── types/                        # App-level TypeScript types
├── assets/                           # Images, icons, fonts
├── android/                          # Native Android project (Gradle)
├── app.json                          # Expo app config
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
└── package.json
```

## Web App Structure (`apps/web/`)

```
apps/web/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root HTML layout
│   │   ├── api/                      # Next.js API routes
│   │   │   ├── coach/[...path]/      # Proxy to Hono /coach/* (route.ts)
│   │   │   ├── credits/balance/
│   │   │   ├── photo/
│   │   │   └── storage/upload-url/
│   │   └── [locale]/                 # Locale-prefixed routes
│   │       ├── (coach)/              # Coach-authenticated group
│   │       │   └── coach/
│   │       │       ├── dashboard/
│   │       │       ├── clients/      # List + [id]/ (dashboard, programs, habits, …)
│   │       │       ├── programs/     # List + new/ + [id]/
│   │       │       ├── forms/        # List + new/ + [id]/
│   │       │       ├── invitations/
│   │       │       ├── exercises/
│   │       │       ├── imports/
│   │       │       ├── branding/
│   │       │       ├── settings/
│   │       │       ├── ai/
│   │       │       └── dashboards/
│   │       ├── (marketing)/          # Public marketing pages (cgu, coachs, …)
│   │       ├── coach/onboarding/     # Coach onboarding flow
│   │       ├── login/
│   │       ├── redeem/               # Credit redemption
│   │       └── r/[code]/             # Referral code redirect
│   ├── components/
│   │   ├── coach/                    # Coach-specific components
│   │   ├── account/                  # Account management
│   │   ├── layout/                   # Layout wrappers, sidebars
│   │   ├── marketing/                # Landing page components
│   │   └── seo/                      # SEO helpers
│   ├── lib/
│   │   ├── supabase/                 # Supabase client helpers (server + client)
│   │   ├── coach/                    # Coach business logic helpers
│   │   ├── dashboard/                # Dashboard data helpers
│   │   └── redeem/                   # Redemption helpers
│   ├── hooks/                        # React hooks (useCoachClients, useDashboardConfig, …)
│   ├── actions/                      # Next.js server actions
│   ├── i18n/                         # next-intl translations
│   └── types/                        # TypeScript types for web
├── middleware.ts                      # Next.js middleware (locale + auth routing)
├── next.config.ts
├── tailwind.config.js
└── package.json
```

## Backend API Structure (`backend/api/`)

```
backend/api/
├── src/
│   ├── app.ts                        # Hono app factory — all routes mounted here
│   ├── index.ts                      # Vercel serverless entry (exports app)
│   ├── config/
│   │   └── models.ts                 # AGENT_MODEL, VISION_MODEL constants
│   ├── middleware/
│   │   ├── auth.ts                   # Supabase JWT validation → sets c.var.auth
│   │   ├── creditGate.ts             # Credit check + deduct before AI calls
│   │   └── rateLimiter.ts            # Per-user rate limiting
│   ├── context/
│   │   ├── user.ts                   # fetchUserContext() — 6 parallel Supabase queries
│   │   └── conversation.ts           # getOrCreateConversation(), appendMessages()
│   ├── routes/                       # Mobile-facing API routes
│   │   ├── ai.ts                     # /ai/chat/stream, /ai/chat, /ai/tools
│   │   ├── forms.ts                  # /forms — coach forms delivery to athletes
│   │   ├── notifications.ts          # /notifications — push token, send
│   │   ├── notifications-cron.ts     # /notifications/cron — scheduled sends
│   │   ├── credits.ts                # /credits — balance, earn, deduct
│   │   ├── plugins.ts                # /plugins — registry endpoint
│   │   ├── supplements.ts            # /supplements — catalog
│   │   ├── storage.ts                # /storage — presigned URLs
│   │   ├── referral.ts               # /referral, /promo
│   │   ├── bugs.ts                   # /bugs — in-app bug reports
│   │   ├── webhooks.ts               # /webhooks — Supabase webhook handlers
│   │   ├── push-events.ts            # /push-events
│   │   └── pantry-recipes.ts         # /pantry — recipe data
│   ├── coach/                        # Coach-facing modules (each has db.ts + service.ts + types.ts)
│   │   ├── identity/                 # /coach/identity — coach profile
│   │   ├── invitations/              # /coach/invitations — invite clients
│   │   ├── clients/                  # /coach/clients — client management + link status
│   │   ├── programs/                 # /coach/programs — workout program builder
│   │   ├── exercises/                # /coach/exercises — custom exercise library
│   │   ├── branding/                 # /coach/branding — custom colors, logo
│   │   ├── dashboards/               # /coach/dashboards — client widget config
│   │   ├── forms/                    # (via routes/forms.ts)
│   │   ├── imports/                  # /coach/imports — bulk client import
│   │   ├── ai/                       # /coach/ai — coach AI assistant
│   │   ├── voice/                    # /coach/voice — voice message
│   │   └── videos/                   # /coach/videos — video library
│   ├── tools/                        # AI tool implementations
│   │   ├── registry.ts               # Central tool registry — allToolSchemas + getToolExecutor
│   │   ├── habits.ts                 # habits_list, habits_log, habits_create, habits_today
│   │   ├── nutrition.ts              # nutrition_log_meal, nutrition_today, nutrition_history
│   │   ├── sleep.ts                  # sleep_log, sleep_get_history, sleep_get_recovery_score
│   │   ├── hydration.ts              # hydration_log, hydration_get_today, hydration_set_goal
│   │   ├── cardio.ts                 # cardio_log_session, cardio_get_history, cardio_get_stats
│   │   ├── journal.ts                # journal_log_mood, journal_get_history, journal_get_trends
│   │   ├── measurements.ts           # measurements_log, measurements_get_history
│   │   ├── stretching.ts             # stretching_get_routines, stretching_log_session
│   │   ├── timer.ts                  # timer_get_presets, timer_create_preset
│   │   ├── ai-programs.ts            # ai_programs_generate, ai_programs_list, ai_programs_adjust
│   │   ├── wearables.ts              # wearables_get_steps, wearables_get_heart_rate, …
│   │   ├── navigation.ts             # app_navigate tool
│   │   ├── pantry.ts                 # pantry search/recommend tools
│   │   ├── coach.ts                  # coach-related tools
│   │   └── db.ts                     # clientForUser() — Supabase client factory
│   ├── services/
│   │   ├── creditService.ts          # Credit balance business logic
│   │   └── notificationService.ts    # Push notification delivery
│   ├── scrapers/                     # Supplement price scraper
│   └── lib/                          # Backend utility helpers
├── api/                              # Vercel API directory (serverless functions entry)
├── vercel.json                       # Vercel deployment config
└── package.json
```

## Plugin Package Structure (`plugins/<name>/`)

```
plugins/habits/                       # Example: habits plugin
├── src/
│   ├── manifest.ts                   # Plugin manifest — MUST use `export default`
│   ├── store.ts                      # Zustand store for plugin state
│   ├── index.ts                      # Plugin entry (exports store, types, helpers)
│   ├── notifications.ts              # Optional: plugin-specific notification logic
│   └── screens/
│       ├── HabitsPlugin.tsx          # Main dashboard screen component
│       └── HabitLogScreen.tsx        # Additional screen components
└── package.json                      # name: "@ziko/plugin-habits"
```

**Expo Router wrapper pattern** (thin file in mobile app):
```
apps/mobile/app/(app)/(plugins)/habits/
├── dashboard.tsx    → imports HabitsPlugin from @ziko/plugin-habits/screens/HabitsPlugin
└── log.tsx          → imports HabitLogScreen from @ziko/plugin-habits/screens/HabitLogScreen
```

Each wrapper is ~7 lines: imports the screen component and the `supabase` singleton, renders `<ScreenComponent supabase={supabase} />`.

## Shared Packages Structure

```
packages/
├── plugin-sdk/src/
│   ├── types.ts          # PluginManifest, UserProfile, Exercise, WorkoutSession, AITool, …
│   ├── hooks.ts          # usePluginRegistry(), useTranslation(), useThemeStore()
│   ├── theme.ts          # Theme tokens, 7 themes, coachStorage
│   ├── i18n.ts           # ~500 keys per locale (fr, en)
│   ├── alert.ts          # showAlert() — Custom Alert API (replaces Alert.alert)
│   └── index.ts          # Re-exports all public API
├── ai-client/src/
│   ├── AIBridge.ts       # SSE streaming client, plugin skill/tool registry
│   └── index.ts
├── ui/src/
│   ├── components/       # Shared RN components (BugFab, BugSheet, …)
│   ├── components.tsx    # Component exports
│   └── design-system.ts  # Design tokens
├── coach-sdk/src/
│   ├── schemas/          # Zod schemas for coach domain
│   ├── types/            # TypeScript types
│   └── index.ts
└── email/src/
    └── templates/        # React Email templates
```

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `HabitsPlugin.tsx`, `BrandingPreviewCard.tsx`)
- Non-component TypeScript: `camelCase.ts` (e.g., `authStore.ts`, `creditGate.ts`)
- Route files: kebab-case or Expo Router special syntax (e.g., `[id].tsx`, `_layout.tsx`)
- Backend modules: `camelCase.ts` (e.g., `registry.ts`, `notificationService.ts`)

**Directories:**
- Mobile route groups: Expo Router convention — `(app)/`, `(auth)/`, `(plugins)/`
- Web route groups: `(coach)/`, `(marketing)/`
- Plugin packages: kebab-case IDs matching `PluginManifest.id` (e.g., `ai-programs`, `habits`)
- Package names: `@ziko/<name>` (e.g., `@ziko/plugin-sdk`, `@ziko/plugin-habits`)

**Stores:**
- Named `use<Name>Store` (e.g., `useAuthStore`, `useWorkoutStore`, `useAIStore`)
- File: `<name>Store.ts` in `apps/mobile/src/stores/` or `plugins/<name>/src/store.ts`

## Package Boundaries and Ownership

| Package | Owned by | Can import from |
|---------|----------|-----------------|
| `apps/mobile` | Mobile team | `packages/*`, `plugins/*` |
| `apps/web` | Web team | `packages/coach-sdk`, `packages/ui` |
| `backend/api` | Backend team | External packages only (no internal packages) |
| `plugins/<name>` | Plugin owner | `packages/plugin-sdk` only |
| `packages/plugin-sdk` | Core team | External packages only |
| `packages/ai-client` | Core team | `packages/plugin-sdk` |
| `packages/ui` | Core team | External packages only |
| `packages/coach-sdk` | Web team | External packages only |

## Where to Add New Code

**New plugin:**
1. Create `plugins/<plugin-id>/src/` with `manifest.ts` (default export), `store.ts`, `index.ts`, `screens/`
2. Add `package.json` with `name: "@ziko/plugin-<plugin-id>"`
3. Add to static `PLUGIN_LOADERS` map in `apps/mobile/src/lib/PluginLoader.tsx`
4. Create route wrapper files in `apps/mobile/app/(app)/(plugins)/<plugin-id>/`
5. Add AI tool implementations to `backend/api/src/tools/<plugin-id>.ts` and register in `backend/api/src/tools/registry.ts`

**New backend route (mobile-facing):**
- Add `backend/api/src/routes/<name>.ts`, mount in `backend/api/src/app.ts`

**New backend coach module:**
- Create `backend/api/src/coach/<module>/` with `service.ts`, `db.ts`, `types.ts`
- Mount in `backend/api/src/app.ts` as `app.route('/coach/<module>', <module>Router)`

**New mobile screen (core, not plugin):**
- Add file to `apps/mobile/app/(app)/` (tab-accessible) or a subdirectory
- Add `<Tabs.Screen name="..." options={{ href: null }} />` in `apps/mobile/app/(app)/_layout.tsx` if not in tab bar

**New web coach page:**
- Add directory under `apps/web/src/app/[locale]/(coach)/coach/<section>/`
- Page file: `page.tsx`; client component: `<Section>Client.tsx` co-located

**New Zustand store (mobile):**
- Add `apps/mobile/src/stores/<name>Store.ts`
- Follow pattern: `create<State>()((set, get) => ({ ... }))`

**New Supabase table:**
- Create `supabase/migrations/<NNN>_<description>.sql` with table definition + RLS policy
- Use `auth.uid() = user_id` policy pattern

## Special Directories

**`.planning/`:**
- Purpose: GSD planning documents, workstream tracking, phase plans
- Generated: No (human-authored + AI-assisted)
- Committed: Yes

**`supabase/migrations/`:**
- Purpose: Sequential SQL migrations (69 files as of 2026-05-28)
- Generated: No
- Committed: Yes — never edit existing migration files; always add a new one

**`apps/mobile/android/`:**
- Purpose: Native Android project (Gradle, Kotlin)
- Generated: Partially (Expo prebuild)
- Committed: Yes — native modifications tracked

**`.expo/`:**
- Purpose: Expo tooling cache
- Generated: Yes
- Committed: No

**`patches/`:**
- Purpose: `patch-package` patches for dependency overrides
- Generated: Semi (via `npx patch-package <package>`)
- Committed: Yes

---

*Structure analysis: 2026-05-28*
