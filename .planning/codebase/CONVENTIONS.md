# Coding Conventions

**Analysis Date:** 2026-05-28

## TypeScript Usage

**Strict Mode:** Enabled across all packages via `tsconfig.base.json` (`"strict": true`). All apps inherit via `extends "../../tsconfig.base.json"`.

**Targets:**
- `apps/mobile/tsconfig.json`: `ESNext`, bundler module resolution, `react-native` JSX, `nativewind/types`
- `apps/web/tsconfig.json`: `ES2017`, `jsx: "preserve"` for Next.js App Router
- `tsconfig.base.json`: `ES2022`, module `ESNext`

**Path Aliases:**
- Mobile: `@/*` → `./src/*`, `@app/*` → `./app/*`, `@ziko/sounds` → `./src/lib/sounds`
- Web: `@/*` → `./src/*`
- Backend: no path aliases — uses relative imports with explicit `.js` extensions (ESM Node.js)

**Import Extension Rule (backend only):** All imports in `backend/api/src/` append `.js` even for `.ts` source files:
```ts
import { updateRole } from './db.js';
import { authMiddleware } from '../../middleware/auth.js';
```

**Type Patterns:**
- `interface` for object shapes, `type` for unions/literals/aliases
- Prop types local to a file: `type ClientRow = { id: string; ... }`
- Exported types: `export interface` or `export type`
- `Omit<T, keyof>` for data subsets: `Omit<Habit, 'id' | 'user_id'>[]`
- `as const` for readonly arrays and lookup maps
- `Record<K, V>` for maps: `Record<string, PluginManifest>`, `Record<QuestionType, ...>`
- Caught errors typed as `any`: `catch (err: any) { err.message }`

**Zod Validation (backend):** Schemas in `packages/coach-sdk/src/schemas/`. Use `z.safeParse()` for runtime validation; surface `ZodError` as HTTP 400.

## Naming Patterns

**Files:**
- React components: `PascalCase.tsx` — `PendingFormsOverlay.tsx`, `CoachSidebar.tsx`
- Hooks: `camelCase.ts` with `use` prefix — `useHomeData.ts`, `useCoachClients.ts`
- Stores: `camelCase.ts` with `Store` suffix — `authStore.ts`, `workoutStore.ts`
- Backend modules: `service.ts` (routes), `db.ts` (queries), `types.ts` (schema types)
- Test files: `*.spec.ts` for integration, `*.test.ts` for unit tests in web

**Functions:**
- Components: `PascalCase` named exports (not default)
- Hooks: `camelCase` with `use` prefix
- Utilities/helpers: `camelCase`
- Zustand actions: verb-first camelCase — `setHabits`, `updateLog`, `getStreak`

**Variables:**
- `camelCase` throughout
- Booleans: `is*` / `has*` prefix — `isLoading`, `isActive`, `hasDestructive`
- Supabase results: always `{ data, error }` destructuring

**Types/Interfaces:**
- `PascalCase`
- State slices suffixed with `State`: `HabitsState`, `AuthState`
- Props interfaces match component: `CoachSidebarProps`, `FormQuestionProps`
- Backend payload types: `ProfileUpsertPayload`, `AuthContext`

## Component Patterns

### React Native (Mobile + Plugins)

**File structure:**
```tsx
// 1. React import
import React, { useState, useMemo } from 'react';
// 2. React Native primitives
import { View, Text, TouchableOpacity, Modal } from 'react-native';
// 3. Third-party (expo, tanstack, moti, expo-router)
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
// 4. Internal packages
import { SubTabs, ErrorScreen } from '@ziko/ui';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
// 5. Local (stores, lib, types) — separated by ASCII-box section comments

// ─── Types ────────────────────────────────────────────────────────────────────
interface Habit { ... }

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD_STYLE = { ... };

// ─── Helper functions ─────────────────────────────────────────────────────────
const habitColor = (color: string): string => ...

// ─── Component ────────────────────────────────────────────────────────────────
export function MyScreen() { ... }
```

**Key rules:**
- Named exports only (no default) for components
- Never use `Alert.alert` from `react-native` — always `showAlert()` from `@ziko/plugin-sdk`
- Icons: Ionicons string names only (e.g., `'checkmark-circle-outline'`), never emoji
- Screen roots: `paddingBottom: 100` for tab bar clearance

### Next.js (Web Coach App)

- `'use client';` as first line for interactive components
- Server components have no directive (default in App Router)
- Icons: `react-icons/io5` — `IoGridOutline`, `IoPeopleOutline`, etc.
- Styling: Tailwind CSS v4 utility classes exclusively

## State Management

### Zustand Store Pattern

```ts
// 1. Export data interfaces
export interface Habit { id: string; name: string; ... }

// 2. Private state interface
interface HabitsState {
  habits: Habit[];
  isLoading: boolean;
  // Actions
  setHabits: (habits: Habit[]) => void;
  // Computed selectors as inline functions
  getStreak: (habitId: string) => number;
}

// 3. Export store with `use` prefix + empty () for TypeScript inference
export const useHabitsStore = create<HabitsState>()((set, get) => ({
  habits: [],
  isLoading: false,
  setHabits: (habits) => set({ habits }),
  getStreak: (habitId) => { /* use get() for reads */ },
}));
```

**Locations:**
- App-level: `apps/mobile/src/stores/*.ts` — `authStore.ts`, `workoutStore.ts`, `aiStore.ts`
- Plugin-level: `plugins/<name>/src/store.ts`

**Persistence:** Use `zustand/middleware` `persist` + `createJSONStorage(MMKV)` when store must survive app restarts.

**Auth subscription:** `onAuthStateChange` returns a subscription that must be stored on the store object (as `(get() as any)._authSubscription`) for cleanup. See `apps/mobile/src/stores/authStore.ts`.

### TanStack Query (v5)

```ts
// Query — always scope queryKey with user ID
useQuery({
  queryKey: ['resource-name', userId],
  queryFn: async () => {
    const { data, error } = await supabase.from('table').select('*').eq('id', userId!).single();
    if (error) throw error;
    return data;
  },
  enabled: !!userId,
  staleTime: 1000 * 60 * 10,  // 10 min for profile/static data
});

// staleTime conventions:
// 60_000   = 1 min — list data (clients, programs)
// 10 * 60 * 1000 = 10 min — profile / slow-changing data
// 0 = always fresh (pending forms, alerts)
```

**Query keys:** `[resourceName, scopeId]` — `['profile', userId]`, `['streak', userId]`, `['pending-forms', userId]`.

**Data fetching source:**
- Mobile: queries hit Supabase directly via `supabase` client
- Web hooks: fetch Hono API with `Authorization: Bearer <token>` header

## Error Handling

**Backend (Hono) pattern:**
```ts
// JSON parse guard
let body: SomeType;
try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }

// DB operation guard
try {
  const result = await someDbOperation();
  return c.json(result);
} catch (err: any) {
  return c.json({ error: err.message }, 500);
}
```

**Supabase pattern:**
```ts
const { data, error } = await supabase.from('table').select('*').eq('id', id).single();
if (error) throw error;
return data;
// OR
if (!error && data) { set({ profile: data }); }
```

**Mobile:** TanStack Query propagates thrown errors. Components show `ErrorScreen` from `@ziko/ui` for fatal errors.

## i18n / Translation Conventions

**Hook:** `useTranslation()` from `@ziko/plugin-sdk` — returns `{ t }` function.

**Key format:** dot-separated namespaces — `'general.save'`, `'auth.login'`, `'habits.addHabit'`.

**Files:** All translation dictionaries in `packages/plugin-sdk/src/i18n.ts`. Two locales: `'fr'` (primary, ~500+ keys) and `'en'`.

**Web (Next.js):** Uses `next-intl` package with `[locale]` URL prefix. Locale files in `apps/web/src/i18n/`.

**Hardcoded French strings:** Plugin screens commonly hardcode French strings directly in JSX (`"Aujourd'hui"`, `"Il y a ${days} jours"`). This is accepted — only shared/cross-cutting strings use `t()`.

## Styling Conventions

### Mobile (React Native)

**No `StyleSheet.create()`** — use inline style objects only. Design tokens via `useThemeStore`:
```tsx
const theme = useThemeStore((s) => s.theme);
<View style={{ backgroundColor: theme.surface, borderRadius: 16 }} />
```

**Design token reference** (from `packages/plugin-sdk/src/theme.ts`):
- `theme.background` = `#F7F6F3`
- `theme.surface` = `#FFFFFF`
- `theme.border` = `#E2E0DA`
- `theme.primary` = `#FF5C1A`
- `theme.text` = `#1C1A17`
- `theme.muted` = `#6B6963`

**Standard card shadow:**
```ts
const CARD_STYLE = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E2E0DA',
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};
```

**NativeWind:** Installed but not used in plugin screens. Tailwind classes appear only in `apps/mobile/app/` base wrappers.

### Web (Next.js)

**Tailwind v4** — custom tokens in `apps/web/src/app/globals.css` under `@theme { }`:
```css
--color-primary: #FF5C1A;
--color-background: #F7F6F3;
--color-border: #E2E0DA;
--color-muted: #6B6963;
```

Use semantic utility classes: `text-primary`, `bg-background`, `border-border`, `text-muted`, `text-danger`, `text-success`.

## Plugin Development Conventions

### Manifest (`plugins/<name>/src/manifest.ts`)

```ts
import type { PluginManifest } from '@ziko/plugin-sdk';

const manifest: PluginManifest = {
  id: 'plugin-id',                  // kebab-case
  name: 'Human Readable Name',
  version: '1.0.0',
  icon: 'calculator-outline',        // MUST be Ionicons string, never emoji
  category: 'training',
  price: 'free',
  requiredPermissions: ['read_profile'],  // use requiredPermissions NOT permissions
  routes: [{
    path: '/(plugins)/plugin-id/dashboard',
    title: 'Tab Label',
    icon: 'calculator-outline',
    showInTabBar: true,              // use showInTabBar NOT inTabBar
  }],
  aiTools: [{
    name: 'tool_name',
    description: 'What the tool does.',
    parameters: { type: 'object', properties: { arg: { type: 'string' } }, required: ['arg'] },
  }],
  aiSkills: [{
    name: 'skill_name',
    description: 'Skill description.',
    triggerKeywords: ['keyword1', 'keyword2'],
    contextProvider: () => ({ skill: 'skill_name' }),
  }],
  aiSystemPromptAddition: `## Plugin Context\n...`,
};

export default manifest;  // MUST be default export
```

### Plugin Store (`plugins/<name>/src/store.ts`)

```ts
export interface DataType { ... }

interface PluginState {
  data: DataType[];
  isLoading: boolean;
  setData: (data: DataType[]) => void;
}

export const usePluginStore = create<PluginState>()((set, get) => ({ ... }));
```

### Route Wrapper (`apps/mobile/app/(app)/(plugins)/<name>/<screen>.tsx`)

Each plugin screen has a thin wrapper that passes `supabase`:
```tsx
import { supabase } from '@/lib/supabase';
import { PluginScreen } from '@ziko/plugin-<name>';

export default function Screen() {
  return <PluginScreen supabase={supabase} />;
}
```

### AI Tools (server-side)

Backend implementations in `backend/api/src/tools/`. Registered in `backend/api/src/tools/registry.ts`. Use `inputSchema` (not `parameters`) in Vercel AI SDK v6 tool definitions.

## Import Organization (Canonical Order)

**Mobile/Plugin files:**
1. `react` — core React
2. React Native primitives and safe-area
3. Third-party (expo, tanstack, moti, expo-router)
4. Internal packages (`@ziko/ui`, `@ziko/plugin-sdk`)
5. Local files (stores, lib, types)

**Section comments in large files:**
```ts
// ─── Types ────────────────────────────────────────────────────────────────────
// ─── Constants ────────────────────────────────────────────────────────────────
// ─── Helper functions ─────────────────────────────────────────────────────────
// ─── Component ────────────────────────────────────────────────────────────────
```

**Barrel exports:** `packages/plugin-sdk/src/index.ts` uses explicit named re-exports. Consumers: `import { useThemeStore, showAlert } from '@ziko/plugin-sdk'`.

## Comments

**Architectural constraints:**
```ts
// SERVICE-ROLE ONLY IN TESTS — this file MUST NOT be imported from backend/api/src/**
```

**Phase/task references:**
```ts
// Phase 28 plan 02
// COACH-01, COACH-04
// D-08 NOTE: creditCheck cannot be added here because...
```

**Non-obvious workarounds:**
```ts
// findLast not available in ES2016 target — use filter + last element instead
// Store unsubscribe so callers can clean up if needed
(get() as any)._authSubscription = subscription;
```

**JSDoc:** Used for key exported interfaces and fields in `packages/plugin-sdk/src/types.ts`. Not required for component props.

## Logging

No logging framework. `console.log` / `console.error` used ad-hoc. Hono's `logger()` middleware handles HTTP request logging in `backend/api/src/app.ts`.

---

*Convention analysis: 2026-05-28*
