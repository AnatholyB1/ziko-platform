# Testing Patterns

**Analysis Date:** 2026-03-26

## Test Framework

**Status:** No test files or test framework found

**Investigation:**
- No `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` files in the codebase
- No `jest.config.js`, `vitest.config.ts`, `jest.setup.js`, or test runner configuration
- No test dependencies in `package.json` (Jest, Vitest, Playwright, Testing Library not present)
- ESLint and Prettier installed but no test linting rules

**Implication:** Testing is not currently implemented in this codebase. All code paths lack automated test coverage.

## Recommended Testing Strategy (For Future Implementation)

Given the monorepo structure, a phased testing approach is recommended:

### Phase 1: Test Infrastructure Setup

**Recommended framework:** Vitest (fast, modern, ESM-native)

```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8
npm install -D @testing-library/react-native @testing-library/jest-native
npm install -D ts-node tsx
```

**Configuration structure:**
- Root: `vitest.config.ts` (shared config)
- Mobile: `apps/mobile/vitest.config.ts` (extends root)
- Backend: `backend/api/vitest.config.ts` (Node runner)

### Phase 2: Test File Organization

**Location pattern:** Co-locate tests with source files

```
apps/mobile/
  src/
    stores/
      __tests__/
        authStore.test.ts
        aiStore.test.ts
      authStore.ts
      aiStore.ts
    lib/
      __tests__/
        supabase.test.ts
      supabase.ts
    components/
      __tests__/
        CustomAlert.test.tsx
      CustomAlert.tsx

plugins/habits/src/
  __tests__/
    store.test.ts
  store.ts
  manifest.ts

backend/api/src/
  routes/
    __tests__/
      ai.test.ts
    ai.ts
  middleware/
    __tests__/
      auth.test.ts
    auth.ts
```

**Naming:** `{filename}.test.ts` or `{filename}.spec.ts` (preferred: `.test.ts`)

### Phase 3: Test Suite Structure

**Pattern observed in codebase:** None, but recommended structure based on architecture:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react-native';
import { useAuthStore } from '../authStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({ session: null, user: null, profile: null });
  });

  describe('initialize()', () => {
    it('should fetch session and initialize auth state', async () => {
      // Arrange
      const mockSession = { user: { id: 'test-id' } };
      vi.mock('../lib/supabase', () => ({
        supabase: {
          auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: mockSession } }),
          },
        },
      }));

      // Act
      const { result } = renderHook(() => useAuthStore());
      await act(async () => {
        await result.current.initialize();
      });

      // Assert
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isInitialized).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      // Arrange
      const mockError = new Error('Network error');
      vi.mock('../lib/supabase', () => ({
        supabase: {
          auth: {
            getSession: vi.fn().mockRejectedValue(mockError),
          },
        },
      }));

      // Act & Assert
      const { result } = renderHook(() => useAuthStore());
      await act(async () => {
        await expect(result.current.initialize()).rejects.toThrow('Network error');
      });
    });
  });

  describe('setSession()', () => {
    it('should update session and extract user', () => {
      const { result } = renderHook(() => useAuthStore());
      const mockSession = { user: { id: 'user-1', email: 'test@example.com' } };

      act(() => {
        result.current.setSession(mockSession as any);
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user?.id).toBe('user-1');
    });

    it('should clear user when session is null', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setSession(null);
      });

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
    });
  });
});
```

## Mocking

**Framework:** Vitest's `vi.mock()` and `vi.fn()`

**Patterns for codebase:**

### Mocking Supabase
```typescript
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}));
```

### Mocking async database queries
```typescript
import { supabase } from '../lib/supabase';
import { vi } from 'vitest';

const mockSupabase = supabase as any;

mockSupabase.from.mockReturnValue({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: { id: '123', name: 'Test User' },
    error: null,
  }),
});
```

### Mocking Zustand store selectors
```typescript
import { useAuthStore } from '../stores/authStore';
import { vi } from 'vitest';

beforeEach(() => {
  // Reset store state
  useAuthStore.setState({
    session: null,
    user: null,
    profile: null,
    isLoading: false,
    isInitialized: false,
  });
});
```

### Mocking Hono context
```typescript
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

it('should extract userId from auth header', async () => {
  const mockContext = {
    req: {
      header: vi.fn().mockReturnValue('Bearer valid-token'),
    },
    set: vi.fn(),
    json: vi.fn(),
    get: vi.fn(),
  };

  const mockNext = vi.fn();

  await authMiddleware(mockContext as any, mockNext);

  expect(mockContext.set).toHaveBeenCalledWith('auth', expect.objectContaining({
    userId: expect.any(String),
  }));
  expect(mockNext).toHaveBeenCalled();
});
```

## What to Mock

**Always mock:**
- Supabase client: database queries, auth state changes
- Environment variables: API keys, URLs
- Router/navigation: `router.push()`, route params
- Timers: `setTimeout`, `setInterval` (use `vi.useFakeTimers()`)
- Network requests: fetch, axios, Hono API calls
- Third-party SDKs: @anthropic-sdk, @ai-sdk packages

**What NOT to mock:**
- Pure utility functions: date formatting, calculations, string manipulation
- Zustand store logic itself (test selectors, not mocks)
- React hooks like `useState`, `useCallback`, `useEffect`
- Type/interface definitions
- Constants and enums

## Fixtures and Factories

**Test data pattern (recommended):**

```typescript
// fixtures/user.fixtures.ts
export function createMockUserProfile(overrides = {}) {
  return {
    id: 'test-user-id',
    name: 'Test User',
    age: 25,
    weight_kg: 75,
    height_cm: 180,
    goal: 'muscle_gain',
    units: 'metric',
    ...overrides,
  };
}

export function createMockSession(overrides = {}) {
  return {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      user_metadata: {},
      ...overrides,
    },
    expires_at: Date.now() + 3600000,
  };
}

export function createMockConversation(overrides = {}) {
  return {
    id: 'conv-123',
    user_id: 'test-user-id',
    title: 'Test Conversation',
    plugin_context: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
```

**Location:** `tests/fixtures/` or `__fixtures__/` adjacent to test files

**Usage:**
```typescript
import { createMockUserProfile } from '../fixtures/user.fixtures';

describe('useAuthStore', () => {
  it('should set profile', () => {
    const mockProfile = createMockUserProfile({ name: 'Alice' });
    // ... test code
  });
});
```

## Coverage

**Target:** No coverage tool currently configured

**Recommended setup:**
```bash
npm install -D @vitest/coverage-v8
```

**Configuration in `vitest.config.ts`:**
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/fixtures/**',
      ],
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
  },
});
```

**Run coverage:**
```bash
npm run test -- --coverage
```

**View coverage report:**
```bash
open coverage/index.html
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, store selectors, hooks
- Approach: Test pure logic, mock all external dependencies (Supabase, Router, etc.)
- Example: `useAuthStore.setSession()`, `fetchUserContext()`, `getStreak()`
- Assertion pattern: Direct state/return value checks

**Integration Tests:**
- Scope: Store interactions, multi-step flows (auth → profile load → navigation)
- Approach: Use real store, mock only network I/O
- Example: "Initialize auth store and verify profile is loaded", "Send AI message and verify conversation is persisted"
- Assertion pattern: Final state verification after async operations

**API Integration Tests (Backend):**
- Scope: Hono routes with mocked Supabase
- Approach: Test route handlers, middleware, error responses
- Example: `POST /ai/chat` with mocked context, `GET /plugins` with auth
- Assertion pattern: HTTP status codes, response body shape

**E2E Tests (Currently not applicable):**
- Would use Playwright or Cypress for full app flow
- Not recommended until testing infrastructure established

## Common Test Patterns

### Testing async Zustand stores
```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { useAIStore } from '../stores/aiStore';
import { vi } from 'vitest';

it('should load conversations on command', async () => {
  // Mock Supabase response
  vi.mock('../lib/supabase', () => ({
    supabase: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'conv-1', title: 'First' }],
        }),
      }),
    },
  }));

  const { result } = renderHook(() => useAIStore());

  act(() => {
    result.current.loadConversations();
  });

  await waitFor(() => {
    expect(result.current.conversations).toHaveLength(1);
  });
});
```

### Testing error scenarios
```typescript
it('should throw error when not authenticated', async () => {
  const { result } = renderHook(() => useAIStore());

  // Simulate no user
  useAuthStore.setState({ user: null });

  await act(async () => {
    expect(() => result.current.createConversation()).rejects.toThrow('Not authenticated');
  });
});
```

### Testing Hono route handlers
```typescript
import { Hono } from 'hono';
import { describe, it, expect, vi } from 'vitest';
import { pluginsRouter } from '../routes/plugins';

describe('POST /plugins/:id/install', () => {
  it('should install plugin and return success', async () => {
    // Mock adminClient
    vi.mock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'habits', name: 'Habits' },
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }));

    const app = new Hono().route('/plugins', pluginsRouter);
    const req = new Request('http://localhost/plugins/habits/install', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });

    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
```

### Testing plugin manifest validation
```typescript
import { describe, it, expect } from 'vitest';
import habitsManifest from '@ziko/plugin-habits/manifest';

describe('plugin-habits manifest', () => {
  it('should have valid structure', () => {
    expect(habitsManifest).toHaveProperty('id', 'habits');
    expect(habitsManifest).toHaveProperty('icon');
    expect(habitsManifest.icon).not.toMatch(/emoji/);
    expect(habitsManifest.routes).toBeInstanceOf(Array);
    expect(habitsManifest.routes.every(r => r.path.startsWith('/(plugins)/'))).toBe(true);
  });

  it('should export as default', () => {
    // Verify manifest is the default export
    expect(habitsManifest).toBeDefined();
  });

  it('should have required aiTools defined', () => {
    const toolNames = habitsManifest.aiTools?.map(t => t.name) ?? [];
    expect(toolNames).toContain('habits_get_today');
    expect(toolNames).toContain('habits_log');
  });
});
```

## Run Commands

**Recommended `package.json` scripts:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**Filter tests by package:**
```bash
npm run test -- --include="apps/mobile/**"
npm run test -- --include="backend/api/**"
npm run test -- --include="plugins/habits/**"
```

**Watch specific file:**
```bash
npm run test:watch -- apps/mobile/src/stores/authStore.test.ts
```

---

*Testing analysis: 2026-03-26*

**Note:** This codebase currently lacks automated tests. The patterns and recommendations above align with the existing code structure and should guide implementation when testing is prioritized.
