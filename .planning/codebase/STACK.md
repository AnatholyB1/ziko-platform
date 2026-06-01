# Technology Stack

**Analysis Date:** 2026-05-28

## Languages

**Primary:**
- TypeScript 5.7 — all apps, packages, plugins, and backend
- SQL — Supabase migrations in `supabase/migrations/`

**Secondary:**
- Kotlin — Android native module (`apps/mobile/android/app/src/main/java/`)
- CSS/Tailwind — web app styling

## Runtime

**Environment:**
- Node.js >=18.0.0 (enforced in root `package.json` engines field)
- CI uses Node 20 (`.github/workflows/ci.yml`)
- TypeScript target: ES2022 (`tsconfig.base.json`)

**Package Manager:**
- npm 10.9.0 (declared as `packageManager` in root `package.json`)
- Lockfile: `package-lock.json` present at root
- Workspaces: `apps/*`, `packages/*`, `plugins/*`, `backend/*`

## Frameworks

**Mobile (`apps/mobile`):**
- Expo SDK ~54.0.0 — React Native app shell
- React Native ^0.81.5 — core mobile framework
- Expo Router ~6.0.23 — file-based routing (Expo Router v4)
- React 19.1.0 — UI rendering
- NativeWind ^4.1.0 — Tailwind-syntax styling for React Native
- Tailwind CSS ^3.4.0 — used with NativeWind

**Web (`apps/web`):**
- Next.js 15.5.14 with Turbopack (both `dev` and `build` use `--turbopack`)
- React 19.2.6 + react-dom 19.2.6
- Tailwind CSS ^4 (PostCSS variant `@tailwindcss/postcss`)
- next-intl ^4.8.3 — i18n routing and translations

**Backend (`backend/api`):**
- Hono ^4.7.0 — HTTP framework (deployed on Vercel serverless)
- `@hono/node-server` ^1.19.11 — local dev server
- `@hono/zod-validator` ^0.7.6 — request body validation
- tsx ^4.19.0 — TypeScript execution for development watch mode (`tsx watch --env-file=.env.local`)

**AI:**
- Vercel AI SDK (`ai`) ^6.0.116 — orchestrator agent loop (`streamText`, `generateText`, `stepCountIs`)
- `@ai-sdk/anthropic` ^3.0.58 — Anthropic provider adapter
- Claude Sonnet `claude-sonnet-4-20250514` — orchestrator model (`backend/api/src/config/models.ts`)
- Claude Haiku `claude-haiku-4-5-20251001` — vision / food-scan model
- OpenAI (`openai` ^6.39.0) — Whisper-1 audio transcription (`backend/api/src/lib/whisper.ts`)

**Testing:**
- Vitest ^3.2.4 — backend API and web unit tests
- `@vitest/coverage-v8` ^3.2.4 — coverage reporting for backend
- `@testing-library/react` ^16.0.0 — web component tests
- happy-dom ^15.0.0 — web test DOM environment

**Build/Dev:**
- Turborepo ^2.3.3 — monorepo task orchestration (`turbo.json`)
- tsup ^8.5.1 — library builds for `@ziko/coach-sdk` and `@ziko/email`
- Babel + `babel-plugin-module-resolver` ^5.0.0 — mobile bundling
- Metro bundler (via Expo) — React Native bundling
- `patch-package` ^8.0.0 — applied via `postinstall` hook

## Key Dependencies

**State Management:**
- Zustand ^5.0.0 — global state (mobile + plugin stores in `apps/mobile/src/stores/` and `plugins/*/src/store.ts`)
- TanStack Query v5 (`@tanstack/react-query` ^5.62.0) — server state (mobile + web)
- react-native-mmkv ^3.0.0 — fast MMKV local storage (mobile)

**Data Validation:**
- Zod ^4.3.6 — schema validation across root, backend, and `@ziko/coach-sdk`

**UI / Animation (mobile):**
- moti ^0.29.0 — React Native animations
- motion ^12.38.0 — animation library
- react-native-reanimated ~4.1.1 — gesture + animation runtime
- react-native-gesture-handler ~2.28.0
- react-native-svg ^15.12.1 — SVG rendering (charts)
- react-native-chart-kit ^6.12.0 — chart components
- `@expo/vector-icons` ^15.1.1 — Ionicons icon set (used throughout plugins)

**UI (web):**
- framer-motion ^12.38.0 — page / component animations
- gsap ^3.15.0 — advanced timeline animation
- lucide-react ^1.16.0 — icon set
- recharts ^3.8.1 — data charts
- react-grid-layout ^2.2.1 — draggable dashboard grids
- `@vidstack/react` ^1.15.1 — video player
- `@tanstack/react-table` ^8.21.3 — headless table

**Document Generation (web):**
- jspdf ^4.2.1 — PDF export
- html2canvas ^1.4.1 — DOM-to-canvas for PDF

**Email:**
- `@react-email/components` ^1.0.12 — React Email template components
- `resend` ^6.12.3 — transactional email delivery (used in `backend/api/src/coach/ai/service.ts`)

**Error Monitoring:**
- `@sentry/react-native` ~7.2.0 — mobile crash / error tracking (registered as Expo plugin in `app.json`)

## Internal Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@ziko/plugin-sdk` | `packages/plugin-sdk/` | Plugin contracts, hooks, i18n, theme, custom alert, Zustand stores |
| `@ziko/ai-client` | `packages/ai-client/` | AIBridge — SSE streaming AI agent client for mobile |
| `@ziko/ui` | `packages/ui/` | Shared React Native component library |
| `@ziko/coach-sdk` | `packages/coach-sdk/` | Shared Zod schemas + TS types (web + mobile + backend) |
| `@ziko/email` | `packages/email/` | React Email templates (`WeeklyDigest`) built with tsup |

## Configuration

**TypeScript:**
- Base config: `tsconfig.base.json` — `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, strict mode, composite true
- Root `tsconfig.json` references the base
- Each app/package has its own `tsconfig.json` extending the base

**Build:**
- `turbo.json` — defines `build`, `dev`, `lint`, `type-check`, `test`, `clean` tasks with dependency order
- `backend/api/vercel.json` — rewrite rules + 7 Vercel cron schedules
- `eas.json` — EAS build profiles: `development` (internal), `preview` (AAB internal), `production` (AAB + autoIncrement)

**Environment Variables (per app):**
- Mobile (`apps/mobile/.env`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`, `EXPO_PUBLIC_API_URL`
- Web (`apps/web/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `OPENAI_API_KEY`
- Backend (`backend/api/.env.local`): loaded via `tsx --env-file=.env.local`; key vars in Turborepo `globalEnv` in `turbo.json`

## Platform Requirements

**Development:**
- Node.js >=18 (Node 20 recommended, matches CI)
- npm >=9.0.0
- Android SDK (minSdkVersion 26 / Android 8.0+)
- iOS: requires macOS + Xcode for native builds
- Expo CLI / EAS CLI (>=18.4.0) for mobile builds and OTA updates

**Production:**
- Mobile: iOS App Store + Google Play via EAS cloud builds (EAS project ID: `9b672c1a-10c4-4d66-882c-b9a08294650f`, owner: `anatholyb`)
- Backend API: Vercel serverless (Node.js runtime), production URL `https://ziko-api-lilac.vercel.app`
- Web: Vercel (Next.js), production URL `https://ziko-app.com`
- Database: Supabase managed PostgreSQL
- Android minSdkVersion: 26 (Android 8.0)
- iOS bundle ID: `com.ziko.mobile` | Android package: `com.ziko.mobile`

---

*Stack analysis: 2026-05-28*
