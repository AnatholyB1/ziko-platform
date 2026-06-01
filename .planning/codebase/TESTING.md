# Testing Patterns

**Analysis Date:** 2026-05-28

## Test Framework

**Runner:** Vitest — used in `backend/api`, `apps/web`, `packages/coach-sdk`, `packages/email`.

**Mobile (`apps/mobile`):** No test framework configured. No test files exist. `package.json` has `"lint": "echo 'lint: no eslint config, skipped'"`.

**Assertion Library:** Vitest built-in (`expect`, `vi`). No separate assertion library.

**Config files:**
- `backend/api/vitest.config.ts`
- `apps/web/vitest.config.ts`
- `packages/coach-sdk/vitest.config.ts`

**Run Commands:**
```bash
# Backend API
cd backend/api
npm test                     # vitest run --passWithNoTests
npm run test:watch           # vitest watch
npm run test:rls             # vitest run test/rls --passWithNoTests

# Web
cd apps/web
npm test                     # vitest run --passWithNoTests

# Coach SDK
cd packages/coach-sdk
# runs via vitest (check package.json scripts)

# All packages (Turborepo)
npm run build                # includes type-check; no root test task
```

## Test File Organization

**Backend API (`backend/api/test/`):**
```
backend/api/
├── test/
│   ├── setup.ts             # Global setup: loads .env.test, validates required env vars
│   ├── rls/
│   │   ├── fixtures.ts      # Shared: createTestUser, getAdminClient, cleanupTestUsers
│   │   ├── fixtures.test.ts
│   │   ├── role.spec.ts
│   │   ├── coach-profiles.spec.ts
│   │   ├── coach-rls.spec.ts
│   │   ├── redeem-rpc.spec.ts
│   │   ├── ai-imports.spec.ts
│   │   └── workout-programs.spec.ts
│   └── coach/
│       ├── rls/fixtures      # → imports from ../rls/fixtures (same fixture file)
│       ├── identity.spec.ts
│       ├── invitations.spec.ts
│       ├── imports.spec.ts
│       ├── programs.spec.ts
│       ├── clients-roster.spec.ts
│       ├── clients-*.spec.ts  (13+ files)
│       ├── timing.spec.ts
│       ├── ratelimit.spec.ts
│       ├── ai/
│       │   ├── service.spec.ts
│       │   ├── tools.spec.ts
│       │   ├── db.spec.ts
│       │   ├── alerts.spec.ts
│       │   ├── audit.spec.ts
│       │   └── cron.spec.ts
│       └── parse/
│           ├── claude.spec.ts
│           ├── excel.spec.ts
│           └── pdf.spec.ts
```

**Web (`apps/web/`):**
```
apps/web/
├── test/
│   └── safe-next.spec.ts     # safeNext redirect allowlist
└── src/
    ├── lib/
    │   ├── supabase/__tests__/
    │   │   └── factories.spec.ts   # Supabase client factory (mocked)
    │   └── dashboard/
    │       └── powerlifting.test.ts # Pure function unit tests
    └── components/coach/vocal/
        ├── useVocalTimer.test.ts    # RED stub (target doesn't exist yet)
        ├── useVocalRecorder.test.ts
        ├── VocalReview.test.tsx
        └── vocalReducer.test.ts
```

**Coach SDK (`packages/coach-sdk/test/`):**
```
packages/coach-sdk/
└── test/
    └── schemas.spec.ts       # Zod schema parse/reject tests
```

**Email (`packages/email/src/templates/`):**
```
packages/email/src/templates/
└── WeeklyDigest.spec.tsx     # it.todo stub only
```

**Naming conventions:**
- `*.spec.ts` — integration tests hitting real Supabase / Hono app
- `*.test.ts` / `*.test.tsx` — unit tests with mocks
- `__tests__/` subdirectory for library-internal tests

## Vitest Configuration Details

**Backend API (`backend/api/vitest.config.ts`):**
```ts
{
  environment: 'node',
  include: ['test/**/*.{spec,test}.ts', 'src/**/*.test.ts'],
  setupFiles: ['./test/setup.ts'],
  testTimeout: 30_000,
  hookTimeout: 30_000,
  fileParallelism: false,    // RLS tests mutate shared DB state — must serialize
  sequence: { concurrent: false },
}
```

**Web (`apps/web/vitest.config.ts`):**
```ts
{
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  environment: 'node',
  globals: true,
  include: ['{src,test}/**/*.{spec,test}.{ts,tsx}'],
  environmentMatchGlobs: [['**/*.test.tsx', 'happy-dom']],  // TSX tests use happy-dom
  passWithNoTests: true,
}
```

**Coach SDK (`packages/coach-sdk/vitest.config.ts`):**
```ts
{
  environment: 'node',
  include: ['test/**/*.{spec,test}.ts'],
  testTimeout: 10_000,
  hookTimeout: 10_000,
}
```

## Test Structure

**Standard integration test (backend):**
```ts
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient } from '../rls/fixtures';
import app from '../../src/app';   // Hono app instance

const admin = getAdminClient();
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});

async function getJwt(user: Awaited<ReturnType<typeof createTestUser>>): Promise<string> {
  const { data } = await user.client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No access token for test user');
  return token;
}

describe('coach identity — COACH-01: role promotion', () => {
  it('PATCH /coach/identity/role sets role to both for a new user', async () => {
    const user = await createTestUser('role-new');
    createdIds.push(user.id);
    const jwt = await getJwt(user);

    const res = await app.request('/coach/identity/role', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('both');

    // Verify in DB via admin
    const { data } = await admin.from('user_profiles').select('role').eq('id', user.id).single();
    expect(data?.role).toBe('both');
  });
});
```

**Standard unit test (pure function):**
```ts
import { describe, it, expect } from 'vitest';
import { estimate1RM } from '@/lib/dashboard/powerlifting';

function makeRow(overrides: { weight_kg: number; reps: number; ... }) { ... }

describe('estimate1RM', () => {
  it('returns weight unchanged when reps === 1', () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });
  it('applies Epley formula for reps > 1', () => {
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1);
  });
});
```

**Reducer/state machine test:**
```ts
import { describe, it, expect } from 'vitest';
import { vocalReducer } from './vocalReducer';

describe('vocalReducer state transitions', () => {
  it('idle → recording on START_RECORDING', () => {
    const next = vocalReducer({ status: 'idle' }, { type: 'START_RECORDING' });
    expect(next.status).toBe('recording');
  });
});
```

## Mocking

**Framework:** `vi` from Vitest.

**Module mocking:**
```ts
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
  })),
  createBrowserClient: vi.fn(() => ({ ... })),
}));
```

**Timer mocking:**
```ts
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
vi.advanceTimersByTime(300_000);
```

**Spy pattern:**
```ts
const onAutoStop = vi.fn();
expect(onAutoStop).toHaveBeenCalledOnce();
```

**What to mock:**
- External SDK clients (`@supabase/ssr`) in web unit tests
- Timers for hook tests with timeouts
- Environment variables: set `process.env.VAR = 'value'` in `beforeEach`

**What NOT to mock (backend integration tests):**
- Supabase — tests hit the real Supabase instance (requires `.env.test` with `SUPABASE_SERVICE_ROLE_KEY`)
- The Hono app — `app.request()` used directly on the real app instance

## Fixtures and Factories

**Shared fixture factory (`backend/api/test/rls/fixtures.ts`):**
```ts
export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

// Creates a real Supabase auth user with email_confirm: true
export async function createTestUser(prefix: string): Promise<TestUser>

// Returns admin client with service role key (TESTS ONLY)
export function getAdminClient(): SupabaseClient

// Returns anonymous client
export function getAnonClient(): SupabaseClient

// Deletes test users and cascades all FK-related rows
export async function cleanupTestUsers(userIds: string[]): Promise<void>
```

**Pattern:** Each test file tracks created IDs and cleans up in `afterAll`:
```ts
const createdIds: string[] = [];
afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});
```

**User email pattern:** `${prefix}-${randomUUID().slice(0, 8)}@ziko.test`

**Web factory helper (`apps/web/src/lib/supabase/__tests__/`):** Tests the Supabase client factory functions directly using `vi.mock('@supabase/ssr')`.

## Environment Setup

**Backend tests require `.env.test`** (gitignored) at `backend/api/.env.test`:
```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # Required for admin operations
```

Setup validated in `backend/api/test/setup.ts` — throws if any required var is missing.

**Web tests:** Set `process.env.NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` inside `beforeEach`.

## Coverage

**Requirements:** No coverage thresholds enforced. `@vitest/coverage-v8` installed in `backend/api/` devDependencies.

**Run coverage:**
```bash
cd backend/api
npx vitest run --coverage
```

## Test Types

**Integration tests (backend `*.spec.ts`):**
- Hit real Supabase instance
- Test full HTTP request-response cycle via `app.request()`
- Verify DB state via admin client after mutations
- Test RLS policies directly via scoped clients

**Unit tests (web `*.test.ts` / `*.test.tsx`):**
- Pure function tests (data transformers, formulas)
- State machine / reducer tests
- Hook tests with fake timers
- Module factory tests with mocked SDK

**Schema tests (`packages/coach-sdk/test/schemas.spec.ts`):**
- Zod schema `safeParse()` / `safeParse().error` boundary checks

**Stub tests (`it.todo`):**
- Several spec files contain only `it.todo(...)` stubs (planning skeletons)
- `backend/api/test/coach/programs.spec.ts` — all todo
- `backend/api/test/coach/ai/service.spec.ts` — 1 todo
- `packages/email/src/templates/WeeklyDigest.spec.tsx` — all todo

**E2E tests:** None present in the codebase.

## CI Testing Configuration

No CI configuration found in the codebase (no `.github/workflows/`, no `Makefile` with test targets). Tests are run manually via `npm test` in each workspace.

**Serialization constraint (backend):** `fileParallelism: false` and `sequence: { concurrent: false }` are set because RLS test suite creates and deletes real Supabase auth users — running concurrently would cause email collisions and `cleanupTestUsers` races.

## Current Testing Gaps

**No mobile tests (`apps/mobile/`):**
- Zero test files exist for the Expo/React Native app
- No test framework configured
- Covers plugin screens, Zustand stores, TanStack Query hooks — all untested
- Risk: plugin regressions, auth flow bugs, and store mutations are invisible

**No plugin tests (`plugins/*/`):**
- 17 plugins have no test files
- Covers habit logic, nutrition calculations, GPS tracking, timer presets — all untested

**Stub-only test files:**
- `backend/api/test/coach/programs.spec.ts` — all 3 tests are `it.todo`
- `backend/api/test/coach/ai/service.spec.ts` — 1 todo
- `packages/email/src/templates/WeeklyDigest.spec.tsx` — all todos
- `apps/web/src/components/coach/vocal/useVocalTimer.test.ts` — RED stub (module doesn't exist)

**No web component tests:**
- `apps/web/src/components/coach/` has 50+ components — none tested
- `apps/web/src/app/` route handlers — not integration tested

**No contract tests between mobile and backend:**
- API response shapes from Hono are not type-checked against mobile consumers

**Areas with no test coverage:**
- `packages/plugin-sdk/src/` — theme store, i18n, alert system, hooks
- `packages/ai-client/` — SSE streaming client
- `packages/ui/` — shared React Native component library
- `apps/mobile/src/lib/` — Supabase client, PluginLoader
- `apps/mobile/src/hooks/` — `useHomeData`, `useStreak`, `useAIDailyTip`
- Supplement price scraper (`backend/api/src/scrapers/`)
- Push notification delivery pipeline

---

*Testing analysis: 2026-05-28*
