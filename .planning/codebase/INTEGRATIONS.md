# External Integrations

**Analysis Date:** 2026-05-28

## APIs & External Services

**AI / LLM:**
- **Anthropic Claude** — primary AI provider
  - SDK: `@ai-sdk/anthropic` ^3.0.58 (Vercel AI SDK adapter)
  - Models: `claude-sonnet-4-20250514` (orchestrator), `claude-haiku-4-5-20251001` (vision/food scan)
  - Config: `backend/api/src/config/models.ts`
  - Auth env var: `ANTHROPIC_API_KEY` (backend only)

- **OpenAI Whisper** — voice transcription
  - SDK: `openai` ^6.39.0
  - Model: `whisper-1`, language hardcoded to `fr`
  - Implementation: `backend/api/src/lib/whisper.ts`
  - Used by: `backend/api/src/coach/voice/service.ts` (POST `/coach/voice/transcribe`) and `backend/api/src/coach/videos/service.ts` (voice annotations)
  - Auth env var: `OPENAI_API_KEY` (backend + web)

**Email:**
- **Resend** — transactional email delivery
  - SDK: `resend` ^6.12.3
  - Templates: `@ziko/email` package using `@react-email/components`
  - Used by: `backend/api/src/coach/ai/service.ts` for weekly digest emails
  - Auth env var: not surfaced in explored files (set in Vercel environment)

**Error Monitoring:**
- **Sentry** — mobile crash and error tracking
  - SDK: `@sentry/react-native` ~7.2.0
  - Registered as Expo plugin in `apps/mobile/app.json`
  - Auth env var: configured via Sentry Expo plugin (DSN typically in `app.json` or env)

## Data Storage

**Databases:**
- **Supabase PostgreSQL** — primary database
  - Client: `@supabase/supabase-js` (^2.47.0 mobile, ^2.50.0 backend, ^2.100.1 web)
  - Web SSR client: `@supabase/ssr` ^0.10.3
  - 21 SQL migrations in `supabase/migrations/`
  - RLS enabled on every table
  - Mobile env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`
  - Web env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL` (server), `SUPABASE_SERVICE_ROLE_KEY` (admin — `apps/web/src/lib/supabase/admin.ts` only)
  - Backend env vars: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_KEY` (for admin client bypassing RLS)

**Caching / Rate Limiting:**
- **Upstash Redis** — serverless Redis for rate limiting and caching
  - SDKs: `@upstash/redis` ^1.37.0, `@upstash/ratelimit` ^2.0.8
  - Implementation: `backend/api/src/lib/redis.ts` (single `redis` export)
  - Used in: web (`apps/web`) and backend API
  - Env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**File Storage:**
- **Supabase Storage** — media/file uploads (exercise media, avatars, coach branding assets)
  - Route: `backend/api/src/routes/storage.ts` (upload + cron cleanup)
  - Cron: `POST /storage/cron/cleanup` — daily at 04:00 UTC (`backend/api/vercel.json`)

**Local Storage (mobile):**
- **MMKV** (`react-native-mmkv` ^3.0.0) — fast key-value store
- **Expo SecureStore** (~15.0.8) — secure credential storage
- **AsyncStorage** (`@react-native-async-storage/async-storage` ^2.2.0) — fallback persistent storage

## Authentication & Identity

**Auth Provider:**
- **Supabase Auth** — JWT-based authentication
  - Mobile: session managed by `authStore.ts` (`apps/mobile/src/stores/authStore.ts`) via `onAuthStateChange`
  - Web: SSR cookies via `@supabase/ssr` middleware
  - Backend: Supabase Bearer token validated in `backend/api/src/middleware/auth.ts` via `adminClient.auth.getUser(token)`
  - All API routes require `Authorization: Bearer <supabase-jwt>` header

**Auth Flow:**
- Unauthenticated → `/(auth)/login` (mobile) or locale login page (web)
- Authenticated → `/(app)/` (mobile) or `/(coach)/` (web)
- Onboarding: `/(auth)/onboarding/step-1` through `step-5` (mobile)

## Push Notifications

**Expo Push Notifications:**
- SDK: `expo-notifications` ~0.32.16 + `expo-server-sdk` ^6.1.0 (backend)
- Registration: `POST /notifications/token` — registers `ExponentPushToken[...]` per device (`backend/api/src/routes/notifications.ts`)
- Token table: `notification_tokens` in Supabase
- Service: `backend/api/src/services/notificationService.ts` — quiet hours logic, batch dispatch
- Auth env var (optional): `EXPO_ACCESS_TOKEN`
- Background notifications enabled: `UIBackgroundModes: ["remote-notification", "fetch"]` in `app.json`
- Android: `POST_NOTIFICATIONS` permission declared

**Notification Crons (`backend/api/vercel.json`):**
- `POST /notifications/cron/streak-at-risk` — daily at 21:00 UTC
- `POST /notifications/cron/check-receipts` — every 15 minutes
- `POST /notifications/cron/weekly-digest` — Sundays at 09:00 UTC

## Wearables & Health

**Apple Health (iOS):**
- SDK: `react-native-health` ^1.19.0
- Entitlements: `com.apple.developer.healthkit`, `com.apple.developer.healthkit.background-delivery`
- Permissions declared in `apps/mobile/app.json` (read/write steps, heart rate, sleep, workouts, weight, body fat)

**Android Health Connect:**
- SDK: `react-native-health-connect` ^3.5.0
- Registered as Expo plugin in `apps/mobile/app.json` with explicit read/write permission list
- Android permissions: `android.permission.health.*` (steps, heart rate, sleep, calories, exercise, weight, body fat)

## GPS / Location

**Expo Location:**
- SDK: `expo-location` ~19.0.8
- Used by cardio plugin (`plugins/cardio/`) for live GPS session tracking
- Permissions in `app.json`: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription` (iOS); `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (Android)
- Background task: `expo-task-manager` ~14.0.9

## Deployment & CI/CD

**Hosting:**
- **Vercel** — backend API (`ziko-api-lilac.vercel.app`) and web app (`ziko-app.com`)
  - Backend: serverless handlers exported from `backend/api/src/app.ts` (`GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`)
  - 7 Vercel cron jobs configured in `backend/api/vercel.json`
  - SDK: `@vercel/functions` ^3.6.0

- **EAS (Expo Application Services)** — mobile builds and OTA updates
  - CLI version: >=18.4.0
  - Project ID: `9b672c1a-10c4-4d66-882c-b9a08294650f`
  - OTA updates: `expo-updates` ~29.0.17

**CI Pipeline:**
- GitHub Actions (`.github/workflows/`)
  - `ci.yml` — on push/PR to `main`: type-check + lint + Vitest tests + Supabase migration push + security guards
  - `publish-coach-sdk.yml` — publishes `@ziko/coach-sdk` to npm
  - `release.yml` — release automation
  - `test-rls.yml` — RLS-specific test suite
- Node 20 in CI (`actions/setup-node@v4`)
- Supabase migrations applied via `supabase db push` on push to `main`

**Security Guards in CI:**
- No `SERVICE_ROLE` references under `backend/api/src/coach/` (ARCH-02)
- No `react-native` leaking into web bundle (D-02, bundle analyzer)
- Zod single-instance check — `@ziko/coach-sdk` must resolve same zod as root (D-08)

## Supplements Scraper

**Vercel Cron:**
- `POST /supplements/cron/scrape` — Mondays at 03:00 UTC (`backend/api/vercel.json`)
- Implementation: `backend/api/src/routes/supplements.ts` + `backend/api/src/scrapers/`
- Scrapes supplement prices across brands/sources into Supabase tables (`supplement_prices`)

## Coach AI Monitoring

**Vercel Cron:**
- `POST /coach/ai/monitor-cron` — daily at 07:00 UTC
- Implementation: `backend/api/src/coach/ai/service.ts`
- Sends weekly digest emails via Resend using `@ziko/email/templates/WeeklyDigest`

## Forms Cron

**Vercel Cron:**
- `POST /forms/cron/trigger-fixed-date` — daily at 06:00 UTC
- Implementation: `backend/api/src/routes/forms.ts`

## Environment Variable Requirements

### Mobile (`apps/mobile/.env`)
| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_KEY` | Supabase publishable key (NOT anon key) |
| `EXPO_PUBLIC_API_URL` | Hono API base URL |

### Web (`apps/web/.env.local`)
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key (client-side) |
| `SUPABASE_URL` | Supabase URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin only — `src/lib/supabase/admin.ts`) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (https://ziko-app.com) |
| `OPENAI_API_KEY` | OpenAI API key |

### Backend API (`backend/api/.env.local`)
| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_KEY` | Supabase service key (admin client — bypasses RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Used in tests only |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENAI_API_KEY` | OpenAI Whisper API key |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `EXPO_ACCESS_TOKEN` | Expo push notification access token (optional) |
| `PORT` | Local dev server port (default 3000; dev uses 8080) |
| `APP_ORIGIN` | Allowed CORS origin override |

---

*Integration audit: 2026-05-28*
