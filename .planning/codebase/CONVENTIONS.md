# Coding Conventions

**Analysis Date:** 2026-03-26

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `CustomAlert.tsx`, `CardioDashboard.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useAuthStore.ts`, `useAIStore.ts`)
- Utility/library files: camelCase (e.g., `supabase.ts`, `storage.ts`)
- Plugin manifests: `manifest.ts` (always)
- Plugin stores: `store.ts`
- Routes: kebab-case in file system (e.g., `cardio/dashboard.tsx`)

**Functions:**
- Camel case: `loadConversations()`, `fetchUserContext()`, `addSet()`
- Async operations: prefix with `load`, `fetch`, `send`, or verb form (e.g., `loadMessages`, `fetchUserContext`, `sendMessage`)
- Boolean getters: prefix with `is` or `get` (e.g., `isCompletedToday()`, `getTodayValue()`)
- Private/internal functions: no prefix but placed after exports in files

**Variables:**
- Camel case: `userId`, `currentSession`, `isLoading`, `activeSets`
- Constants: UPPER_SNAKE_CASE (e.g., `AGENT_MODEL`, `DEFAULT_HABITS`, `BASE_SYSTEM`)
- State slices in stores: camelCase, descriptive (e.g., `activePluginContext`, `streamingContent`, `pendingActions`)

**Types and Interfaces:**
- PascalCase: `AuthState`, `UserContext`, `PluginManifest`, `CardioSession`
- Type imports: `import type { ... }` always used
- Omit/Partial utilities for related types (e.g., `Omit<Habit, 'id' | 'user_id'>`)

## Code Style

**Formatting:**
- Prettier v3.4.0 (configured but no explicit `.prettierrc` found — uses defaults)
- Line length: no strict limit observed, but files stay readable
- Indentation: 2 spaces (JavaScript/TypeScript standard)
- Semicolons: required at end of statements

**Linting:**
- ESLint v9.0.0 installed (no `.eslintrc` config file found — using defaults)
- Strict TypeScript mode enabled (`strict: true` in all `tsconfig.json` files)
- Type safety enforced across monorepo

**Comments:**
- JSDoc/TSDoc style for exported functions and interfaces:
  ```typescript
  /** Get or create a conversation and return its ID + existing messages */
  export async function getOrCreateConversation(
    userId: string,
    conversationId?: string,
  ): Promise<{ conversationId: string; history: StoredMessage[] }>
  ```
- Single-line comments for inline logic (e.g., `// Store unsubscribe so callers can clean up if needed`)
- Section markers for major code blocks: `// ─── Section Name ────────────────────────────────────────`
- No commented-out code; prefer TODOs for future work

**TODO/FIXME:**
- Marked with `// TODO: description` (e.g., `// TODO: send welcome notification via FCM/APNs`)
- Not enforced via linting; use for unfinished features

## Import Organization

**Order:**
1. React and React Native core imports
2. React Native UI components (`View`, `Text`, `ScrollView`, etc.)
3. Icon library (`@expo/vector-icons`)
4. Router and navigation
5. External libraries (Zustand, Supabase, AI SDK, etc.)
6. Type-only imports: `import type { ... }`
7. Internal @ziko modules (`@ziko/plugin-sdk`, `@ziko/plugin-*`)
8. Local relative imports (utils, stores, lib)

**Example from `CardioTracker.tsx`:**
```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useCardioStore, ACTIVITY_LABELS, formatPace } from '../store';
import type { CardioSession } from '../store';
```

**Path Aliases:**
- Mobile app (`apps/mobile/tsconfig.json`):
  - `@/*` → `./src/*`
  - `@app/*` → `./app/*`
  - `@ziko/sounds` → `./src/lib/sounds`
- Backend API: no aliases (ES2022 modules with explicit relative paths)
- Plugins: no aliases (direct relative imports or `@ziko/plugin-*` workspace refs)

**Workspace imports:**
- Format: `@ziko/plugin-{id}/manifest` or `@ziko/plugin-{id}/screens/ScreenName`
- Example: `import manifest from '@ziko/plugin-cardio/manifest'`
- Static plugin loaders in `PluginLoader.tsx` use `() => import('@ziko/plugin-*/manifest') as any` pattern (required for Metro bundler static analysis)

## Error Handling

**Patterns:**
- Try/catch blocks capture errors from Supabase, API calls, and async operations
- Errors thrown explicitly: `throw new Error('Not authenticated')` or `throw error` (from Supabase)
- No custom error classes observed; all errors are generic `Error`

**Database errors:**
- Supabase returns `{ data, error }` — check `error` before using `data`
- Pattern: `if (error || !data) throw new Error('message')`
- Null fallback: `data ?? []` or `data ?? null`

**API response errors:**
- Hono routes return JSON errors: `c.json({ error: 'message' }, statusCode)`
- Standard codes: `401` (auth), `404` (not found), `500` (server error)

**Console logging:**
- Warnings: `console.warn('[PluginLoader] message:', data)` (scoped with bracket prefix)
- Errors: `console.error('[API Error]', err)` in global error handler
- Verbose logging: `console.log()` in dev (e.g., API startup message)
- No logging in production-optimized paths; errors propagated instead

**Alert handling:**
- Use `showAlert(title, message, buttons?)` from `@ziko/plugin-sdk` (not `Alert.alert()` from React Native)
- `showAlert` is drop-in replacement with same API as native `Alert.alert`
- Button object: `{ text: string, onPress?: () => void, style?: 'cancel' | 'destructive' }`

## Logging

**Framework:** No dedicated logging library; uses `console.*` and native error propagation

**Patterns:**
- Error context prefix in brackets: `[PluginLoader]`, `[API Error]`, `[Router]`
- Async errors logged at catch point; not re-logged higher up
- User-facing errors go through Supabase RLS or API validation layer

## Component & Hook Design

**React Components:**
- Functional components only (no class components)
- Props interface/type always explicitly declared: `{ supabase: any }` (plugin screens), destructured in parameter
- Default exports for screen/route components: `export default function ScreenName() { }`
- Named exports for sub-components used internally

**Hooks (Zustand stores):**
- Pattern: `export const useStore = create<StoreInterface>()((set, get) => ({ ... }))`
- State initialization inline in creation function
- Selectors: `useAuthStore((s) => s.profile)` or `useAuthStore.getState().user` for imperative access
- Subscribe/unsubscribe pattern preserved: `const { data: { subscription } } = supabase.auth.onAuthStateChange(...)`

**Plugin Screen Props:**
- All screens receive `supabase` client: `function ScreenName({ supabase }: { supabase: any })`
- Used to query `user_plugins`, `ai_conversations`, plugin data tables
- No auth checks needed (middleware-protected API, plugin-loaded only if installed)

**Effects and Subscriptions:**
- `useCallback` for memoized functions passed to hooks
- `useEffect` with dependency arrays (not commented)
- Subscription cleanup functions stored and called on unmount
- Pattern in `authStore.ts`: `(get() as any)._authSubscription = subscription` for reference storage

**State Management Layer:**
- Zustand stores (`src/stores/*`) for global state (auth, AI, workout, theme, etc.)
- Store state accessed via hooks: `useAuthStore()` or `useAuthStore.getState()` for imperative
- Store updates via action methods: `set()` for batch updates, immutable patterns
- Plugin-scoped state: each plugin has own `store.ts` (e.g., `plugins/habits/src/store.ts`)

## Function Design

**Size:** No explicit line limits; average function 20–50 lines

**Parameters:**
- Destructured props preferred: `({ userId, conversationId }: Props)`
- Union types for flexibility: `conversationId?: string` (optional)
- Explicit typing over `any` where possible; `any` used for plugin props until better typing

**Return Values:**
- Async functions return `Promise<Type>`
- Success patterns: return data directly or `{ success: true, data }`
- Error patterns: throw error (not return `{ error: ... }`)
- Void operations: confirm success via side effects or mutation

**Null handling:**
- Null coalescing: `value ?? default`
- Optional chaining: `obj?.property?.nested`
- Falsy checks for conditionals: `if (!data)`, `if (error)`

## Module Design

**Exports:**
- Mix of default + named exports per file
- Default exports: route components, main plugin manifests
- Named exports: utility functions, store hooks, types, components
- `export { router as pluginsRouter }` pattern for route modules

**Barrel files:**
- `@ziko/plugin-sdk/src/index.ts` re-exports all public APIs
- Plugins no barrel files; direct imports from `@ziko/plugin-{id}/manifest` or `screens/ScreenName`

**Folder structure for stores:**
- Zustand stores centralized: `apps/mobile/src/stores/` (5 files)
- Plugin stores co-located: `plugins/{id}/src/store.ts`
- Context helpers: `backend/api/src/context/` (user.ts, conversation.ts)

## TypeScript Specifics

**Target and lib:**
- Mobile: `ESNext` + `DOM` (for web APIs like `Promise`, `JSON`)
- Backend: `ES2022` (Node.js runtime, no DOM)
- Strict mode: enabled everywhere

**Modules:**
- Mobile: `ESNext` (Expo bundler supports all modern syntax)
- Backend: `NodeNext` (Node.js with ES modules)

**jsconfig/tsconfig patterns:**
- Base config: `tsconfig.base.json` (shared compiler options)
- Workspace configs: extend base, add path aliases
- `noEmit: true` in mobile (bundler handles emit)
- `outDir: dist` in backend (tsc outputs transpiled code)

## Cross-Plugin Patterns

**Plugin manifest structure:**
```typescript
const manifest: PluginManifest = {
  id: 'string',
  name: 'string',
  icon: 'ionicons-name', // NOT emoji
  requiredPermissions: ['read_profile', ...],
  aiSkills: [{ name, description, triggerKeywords, contextProvider }],
  aiTools: [{ name, description, parameters }],
  routes: [{ path: '/(plugins)/...' , icon, showInTabBar }],
};
export default manifest; // NOT named export
```

**Plugin-to-plugin integration:**
```typescript
// Cardio plugin trying to access measurements
let useMeasurementsStore: any = null;
try { useMeasurementsStore = require('@ziko/plugin-measurements').useMeasurementsStore; } catch {}
// Graceful fallback if measurements plugin not installed
```

**Theme colors:**
- Access via: `const theme = useThemeStore((s) => s.theme)`
- Properties: `theme.primary`, `theme.surface`, `theme.background`, `theme.text`, `theme.muted`, `theme.border`
- Dynamic color mixing: `theme.primary + '15'` (appends alpha channel hex)

---

*Convention analysis: 2026-03-26*
