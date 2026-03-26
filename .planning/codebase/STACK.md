# Technology Stack

**Analysis Date:** 2026-03-26

## Languages

**Primary:**
- TypeScript ^5.7.0 - All app code, backend API, plugins
- SQL - Database schema (PostgreSQL via Supabase)

**Runtime:**
- React Native 0.81.5 - Mobile app via Expo
- Node.js >=18.0.0 - Backend API runtime
- Expo SDK 54 - Mobile framework with built-in dev server

## Runtime & Package Management

**Environment:**
- Node.js: >=18.0.0
- npm: >=9.0.0 (package manager: npm@10.9.0)

**Package Manager:**
- npm@10.9.0 - Monorepo workspace management
- Lockfile: npm-shrinkwrap.json (npm v10 compatible)

## Frameworks & Core Libraries

**Mobile Frontend:**
- Expo ~54.0.0 - iOS/Android framework
- Expo Router ~6.0.23 - File-based routing (Expo v4 API)
- React ^19.1.0 - Core UI library
- React Native ^0.81.5 - Native framework
- Nativewind ^4.1.0 - Tailwind CSS for React Native (light sport theme)

**Backend API:**
- Hono ^4.7.0 - Lightweight REST API framework (TypeScript-first)
- @hono/node-server ^1.19.11 - Node.js server adapter
- Vercel deployment with serverless function exports

**AI/LLM Integration:**
- ai (Vercel AI SDK) ^6.0.116 - Streaming & tool-calling framework
- @ai-sdk/anthropic ^3.0.58 - Claude integration
- Model: claude-sonnet-4-20250514 - Orchestrator agent

**State Management:**
- Zustand ^5.0.0 - Global store (mobile + plugins)
- TanStack Query (React Query) ^5.62.0 - Server state caching

**Storage & Database:**
- @supabase/supabase-js ^2.47+ - PostgreSQL ORM & auth client
- MMKV (react-native-mmkv v3) - Fast local key-value storage on mobile
- AsyncStorage @react-native-async-storage/async-storage ^2.2.0 - Session persistence

**UI Component Library:**
- @gluestack-ui/themed ^1.1.73 - Accessible component primitives
- @gluestack-style/react ^1.0.57 - Style composition engine
- @expo/vector-icons ^15.1.1 - Ionicons icon library
- react-native-chart-kit ^6.12.0 - Charts & graphs
- react-native-svg ^15.12.1 - SVG rendering

**Navigation & Motion:**
- Expo Router ~6.0.23 - File-based routing
- react-native-gesture-handler ~2.28.0 - Touch gesture support
- react-native-reanimated ~4.1.1 - Smooth animations
- moti ^0.29.0 - Animation library
- motion ^12.38.0 - Advanced motion primitives
- react-native-safe-area-context ~5.6.0 - Safe area handling
- react-native-screens ~4.16.0 - Native screen navigation

**Health & Wearable Integration:**
- react-native-health ^1.19.0 - Apple HealthKit (iOS)
- react-native-health-connect ^3.5.0 - Health Connect API (Android)
- expo-location ~19.0.8 - GPS tracking for cardio sessions

**Utilities:**
- date-fns ^4.1.0 - Date manipulation (lightweight alternative to moment)
- zod ^4.3.6 - Runtime type validation (root workspace)
- base64-arraybuffer ^1.0.2 - Binary encoding

**Dev Tools & Build:**
- Turbo ^2.3.3 - Monorepo task orchestration
- tsx ^4.19.0 - TypeScript executor for Node.js
- Tailwind CSS ^3.4.0 - Styling toolkit (generates NativeWind classes)
- ESLint ^9.0.0 - Code linting
- Prettier ^3.4.0 - Code formatting
- Babel ^7.25.0 - JavaScript transpiler with module-resolver

## Build & Deployment

**Mobile Build:**
- EAS (Expo Application Services) - Managed cloud builds
  - Android: `eas build --platform android --profile production`
  - iOS: `eas build --platform ios --profile production`
- EAS ProjectId: `9b672c1a-10c4-4d66-882c-b9a08294650f`
- Deployment target: Expo Go app distribution
- Bundle identifiers:
  - iOS: `com.ziko.mobile`
  - Android: `com.ziko.mobile`

**Backend Build:**
- TypeScript compilation: `tsc`
- Vercel Serverless Functions
  - Entry: `/api/app` (rewrites all routes)
  - Cron job: `POST /supplements/cron/scrape` (Mondays 3am UTC)

**Development:**
- Turbo dev server: `turbo run dev` (parallel all workspaces)
- Mobile: `expo start` (metro bundler)
- Backend: `tsx watch --env-file=.env src/index.ts` (auto-reload)

## Configuration Files

**Root:**
- `tsconfig.json` - Extends `expo/tsconfig.base`
- `package.json` - Workspace root with Turbo scripts
- Workspace structure: apps/*, packages/*, plugins/*, backend/*

**Mobile (apps/mobile/):**
- `app.json` - Expo config with:
  - Health/wearable permissions (Apple HealthKit, Health Connect, Location)
  - Splash screen, icon, adaptive icon
  - iOS entitlements for HealthKit background delivery
  - Android Health Connect permissions (v12+)
  - Expo plugins: router, font, splash-screen, secure-store, health-connect
- `eas.json` - EAS build profiles (referenced in package.json scripts)

**Backend (backend/api/):**
- `vercel.json` - Deployment config:
  - Rewrites all routes to `/api/app`
  - Cron job: `/supplements/cron/scrape` Monday 3am UTC
- `tsconfig.json` - Standard TypeScript config

**Shared Packages:**
- `packages/plugin-sdk/` - Plugin contract types, hooks, i18n, theming
- `packages/ui/` - React Native component library
- `packages/ai-client/` - AIBridge SSE streaming client

## Environment Variables

**Mobile (apps/mobile/.env):**
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_KEY` - Supabase publishable key (for RLS policies)
- `EXPO_PUBLIC_API_URL` - Backend API base URL (e.g., https://ziko-api-lilac.vercel.app)
- `EXPO_PUBLIC_AI_AGENT_API_KEY` - Optional API key (currently unused, auth via Supabase JWT)

**Backend (backend/api/.env):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` - Supabase publishable key for RLS
- `ANTHROPIC_API_KEY` - Claude API key for AI agent
- `PORT` - Server port (defaults to 3000 locally, Vercel sets dynamically)

## Platform Requirements

**Development:**
- Node.js >=18, npm >=9
- Xcode (for iOS builds) or Android Studio/NDK (for Android)
- Expo CLI (installed via npm)
- EAS CLI for cloud builds

**Production - Mobile:**
- iOS 13+ (HealthKit entitlements required)
- Android 10+ (Health Connect API available on Android 12+)
- Internet connection for Supabase auth & API calls
- Location permissions enabled for GPS cardio tracking

**Production - Backend:**
- Vercel serverless functions (deployed automatically via git push)
- Node.js v18+ runtime
- Environment variables provisioned in Vercel dashboard

## Database

**Engine:** PostgreSQL 15+ (via Supabase)

**Key Features:**
- Row Level Security (RLS) enabled on all user tables
- Triggers for updated_at timestamps
- pgvector extension (for future AI embeddings)
- PostGIS extension available (not currently used)

**Connection:**
- Client: Supabase JS SDK v2.47+
- Auth: Supabase JWT via `EXPOSE_PUBLIC_SUPABASE_KEY`
- Auto-refresh enabled on mobile, disabled on backend (stateless)

---

*Stack analysis: 2026-03-26*
