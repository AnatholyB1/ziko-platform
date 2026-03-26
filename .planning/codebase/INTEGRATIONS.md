# External Integrations

**Analysis Date:** 2026-03-26

## APIs & External Services

**Anthropic Claude AI:**
- Service: claude-sonnet-4-20250514 (Claude Sonnet 4 via Vercel AI SDK v6)
- What it's used for: Orchestrator agent for fitness coaching, tool calling, workout/nutrition/habit analysis
- SDK/Client: @ai-sdk/anthropic ^3.0.58
- Auth: `ANTHROPIC_API_KEY` (backend/.env)
- API: Vercel AI SDK v6 streaming with structured tool execution
- Model features: Vision-capable, streaming support, structured outputs, tool use

**Custom Backend API:**
- Service: Ziko Platform Hono API
- What it's used for: REST endpoints for AI chat, tool execution, plugin registry, webhooks
- Client: AIBridge (packages/ai-client/AIBridge.ts) - SSE streaming wrapper
- Auth: Supabase Bearer JWT token (Authorization header)
- Endpoints (backend/api/src/routes/):
  - `POST /ai/chat/stream` - Streaming AI chat with orchestrator agent
  - `POST /ai/chat` - Non-streaming variant
  - `GET /ai/tools` - List available tool schemas
  - `POST /ai/tools/execute` - Direct tool execution
  - `GET /health` - Health check
  - `GET /plugins` - Plugin registry
  - `POST /webhooks` - Supabase event handlers
  - `POST /bugs` - Bug report submission
  - `POST /supplements/cron/scrape` - Weekly supplement price scraper (Vercel cron)

## Data Storage

**Database:**
- Provider: Supabase (PostgreSQL 15+)
- Connection: `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`
- Client: @supabase/supabase-js ^2.47+ (supports auto-refresh on mobile, stateless on backend)
- Authentication: Supabase JWT (issued via Supabase auth.users table)

**Key Tables (21 migrations total):**
- `auth.users` - Supabase built-in auth users
- `user_profiles` - Extended user data (age, weight, height, goal, units)
- `exercises` - Exercise library (name, category, muscle_groups[], instructions)
- `workout_programs`, `workout_sessions`, `session_sets` - Workout tracking
- `ai_conversations`, `ai_messages` - Chat history persistence
- `plugins_registry` - Plugin manifests & bundle URLs
- `user_plugins` - User's installed/enabled plugins
- `habits`, `habit_logs` - Daily habit tracking (002_habits_schema.sql)
- `nutrition_logs` - Meal entries with macros (003_nutrition_schema.sql)
- `stretching_logs`, `stretching_routines` - Mobility sessions (012, 013)
- `sleep_logs` - Sleep quality tracking (012)
- `body_measurements` - Weight, body fat, limb measurements (012)
- `timer_presets` - User custom HIIT/Tabata timers with exercises (012, 020)
- `ai_generated_programs` - AI-created workout plans (012)
- `journal_entries` - Mood/energy/stress journaling (012)
- `hydration_logs` - Daily water intake (012)
- `cardio_sessions` - Running/cycling with GPS route data (012, 021)
- `wearable_daily_summary`, `health_sync_log` - Apple Health/Health Connect sync (014)
- `bug_reports` - In-app bug report database (015)
- `supplement_brands`, `supplement_categories`, `supplements`, `supplement_prices` - Supplement catalog (018)

**Local Storage:**
- Mobile: MMKV (react-native-mmkv v3) - Fast key-value storage via Zustand stores
- Auth session: AsyncStorage @react-native-async-storage/async-storage ^2.2.0
- Secure tokens: expo-secure-store ^15.0.8

**Caching:**
- Server state: TanStack React Query v5.62.0 (query caching)
- Global state: Zustand v5.0.0 (in-memory stores)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in PostgreSQL auth extension)
- JWT token-based (Bearer token in Authorization header)
- Email/password signup & login (auth.users table)
- Auto-token refresh on mobile (`autoRefreshToken: true`)

**Session Management:**
- Mobile: Supabase client auto-refresh via AsyncStorage persistence
- Backend: Stateless JWT validation (no session storage)
- Token validation: `adminClient.auth.getUser(token)` in auth middleware (`backend/api/src/middleware/auth.ts`)

**Permission Model:**
- Row Level Security (RLS) policies on all user tables
- Policies enforce: `auth.uid() = user_id` for all CRUD operations
- Mobile app receives user ID from Supabase auth context
- Backend extracts user ID from JWT token

## Health & Wearable Data

**Apple Health (iOS):**
- SDK: react-native-health ^1.19.0
- Data types read: steps, heart rate, sleep, distance, total/active calories, exercise sessions, weight, body fat
- Data types write: exercise sessions, steps
- Permissions: Declared in app.json iOS infoPlist
  - `NSHealthShareUsageDescription` - Read permission
  - `NSHealthUpdateUsageDescription` - Write permission
  - `com.apple.developer.healthkit` + background-delivery entitlements

**Health Connect (Android):**
- SDK: react-native-health-connect ^3.5.0 (v3.5.0 compatible with migration 020)
- Data types: Steps, HeartRate, SleepSession, Distance, TotalCaloriesBurned, ActiveCaloriesBurned, ExerciseSession, Weight, BodyFat
- Read/write permissions configured in app.json Expo plugin config
- Supabase tables: `wearable_daily_summary`, `health_sync_log` (migration 014) - synced daily summaries only

**GPS Tracking (Cardio):**
- SDK: expo-location ~19.0.8
- Permission: `NSLocationWhenInUseUsageDescription` (iOS foreground), `NSLocationAlwaysAndWhenInUseUsageDescription` (iOS background)
- Android: `android.permission.ACCESS_FINE_LOCATION`, `android.permission.ACCESS_COARSE_LOCATION`, foreground service permissions
- Implementation: `CardioTracker.tsx` captures live latitude/longitude with accuracy filter (noise <5m discarded)
- Storage: `cardio_sessions.route_data` JSONB array (RoutePoint[]) with lat/lng/timestamp/altitude/accuracy

## Monitoring & Observability

**Error Tracking:**
- Not detected in primary integrations
- Backend error handler in `backend/api/src/app.ts`: logs to console + returns 500 response

**Logs:**
- Mobile: console.log via Expo dev tools or device logs
- Backend: Hono logger middleware (`app.use('*', logger())`) outputs to stdout
- Supabase: Query logs available in dashboard (not directly queried)

**Debugging:**
- React Native: Expo SDK provides debugger + Fast Refresh
- TypeScript: Full type checking via `npm run type-check`

## CI/CD & Deployment

**Hosting:**
- Frontend: Expo cloud (EAS Build)
  - iOS distribution via App Store Connect (TestFlight/production)
  - Android distribution via Google Play (TestFlight/production)
  - Development: Local Expo dev server + USB/LAN preview
- Backend: Vercel serverless functions
  - Deployment trigger: git push to main
  - Auto-builds & deploys via Vercel GitHub integration
  - Production URL: https://ziko-api-lilac.vercel.app

**CI Pipeline:**
- Not detected (no GitHub Actions, CircleCI, or similar)
- TypeScript type checking: `npm run type-check` (manual)
- Linting: `npm run lint` (ESLint ^9.0.0, manual)

**Build Commands:**
- Mobile: `npx eas build --platform [android|ios] --profile production`
- Backend: `npm run build` (tsc) + automatic Vercel deployment
- Monorepo: `npm run build` (Turbo orchestrates all workspaces)

**Environment Configuration:**
- Mobile: `.env` file (not committed, .gitignore pattern: `.env*`)
- Backend: `.env` file loaded via tsx `--env-file=.env` (not committed)
- Secrets: Vercel dashboard (backend) + Expo secrets (mobile builds)

## Cron Jobs & Scheduled Tasks

**Supplements Price Scraper:**
- Route: `POST /supplements/cron/scrape`
- Schedule: Mondays 3:00 AM UTC (vercel.json: `"schedule": "0 3 * * 1"`)
- Purpose: Weekly scraping of supplement prices from external sources (backend/api/src/scrapers/)
- Implementation: Vercel Cron via serverless function

## Webhooks & Callbacks

**Incoming:**
- Supabase webhooks: `backend/api/src/routes/webhooks.ts`
  - Listens for database events (INSERT/UPDATE/DELETE)
  - Triggered by: Supabase Real-Time subscriptions

**Outgoing:**
- None detected at time of analysis (app uses request-response only)

## Environment Configuration

**Required env vars (Mobile - apps/mobile/.env):**
- `EXPO_PUBLIC_SUPABASE_URL` - Project URL from Supabase dashboard
- `EXPO_PUBLIC_SUPABASE_KEY` - Publishable API key (NOT anon/service key)
- `EXPO_PUBLIC_API_URL` - Backend API base (e.g., https://ziko-api-lilac.vercel.app)

**Required env vars (Backend - backend/api/.env):**
- `SUPABASE_URL` - Project URL
- `SUPABASE_PUBLISHABLE_KEY` - Publishable API key
- `ANTHROPIC_API_KEY` - Claude API key from Anthropic dashboard

**Secrets location:**
- Mobile: Local `.env` file (auto-loaded by Expo)
- Backend: Vercel dashboard Environment Variables (production) + local `.env` (development)
- Backup: .env.example files (if available, not committed)

## Third-Party Dependencies at Scale

**Data Parsing & Validation:**
- zod ^4.3.6 - Runtime schema validation (root workspace)
- base64-arraybuffer ^1.0.2 - Binary encoding for health data

**HTTP & Networking:**
- Vercel AI SDK handles HTTP to Anthropic via @ai-sdk/anthropic
- Supabase SDK handles PostgreSQL connection pooling
- Hono built-in fetch API for CORS handling

**No Detected Integrations:**
- Payment processing (Stripe, PayPal) - not implemented
- Analytics (Sentry, Datadog, Segment) - not integrated
- Social login (Google, Apple, Facebook) - using Supabase auth only
- Third-party APIs (Strava, MyFitnessPal, USDA nutrition DB) - locally implemented equivalents
- SMS/Email delivery (Twilio, SendGrid) - not integrated

---

*Integration audit: 2026-03-26*
