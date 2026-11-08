// Phase 45 audit fix - POST /ai/tools/execute must refuse internal-only
// executors (create_reward, assess_profile) that are registered in
// tools/registry.ts but deliberately absent from allToolSchemas.
//
// Pure unit spec: supabase-js, auth and the two internal executors are mocked;
// the real registry (and its INTERNAL_ONLY_TOOLS deny-list) is used.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'test-key';
  return { createReward: vi.fn(), assessProfile: vi.fn() };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn(), rpc: vi.fn(), auth: {} })),
}));

vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!c.req.header('Authorization')?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing Authorization header' }, 401);
    }
    c.set('auth', { userId: 'athlete-1', email: 'a@example.com' });
    await next();
  },
}));

vi.mock('../../src/coaching-engine/tools.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/coaching-engine/tools.js')>();
  return { ...actual, create_reward: h.createReward };
});

vi.mock('../../src/tools/onboarding.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/tools/onboarding.js')>();
  return { ...actual, assess_profile: h.assessProfile };
});

import { aiRouter } from '../../src/routes/ai.js';
import { INTERNAL_ONLY_TOOLS, allToolSchemas, getToolExecutor } from '../../src/tools/registry.js';

function exec(tool_name: string, parameters: Record<string, unknown> = {}) {
  return aiRouter.request('/tools/execute', {
    method: 'POST',
    headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool_name, parameters }),
  });
}

describe('POST /ai/tools/execute internal-only deny-list', () => {
  beforeEach(() => {
    h.createReward.mockReset();
    h.assessProfile.mockReset();
  });

  it.each(['create_reward', 'assess_profile'])('refuses %s with 404 and never runs it', async (name) => {
    const res = await exec(name, { tier: 2, week_of: '2026-11-02' });
    expect(res.status).toBe(404);
    expect(h.createReward).not.toHaveBeenCalled();
    expect(h.assessProfile).not.toHaveBeenCalled();
  });

  it('deny-list covers every executor that is registered but not in allToolSchemas', () => {
    expect([...INTERNAL_ONLY_TOOLS].sort()).toEqual(['assess_profile', 'create_reward']);
    for (const name of INTERNAL_ONLY_TOOLS) {
      expect(allToolSchemas.some((t) => t.name === name)).toBe(false);
      // still registered for internal callers (apply.ts / onboarding)
      expect(getToolExecutor(name)).toBeTypeOf('function');
    }
  });

  it('unknown tools stay 404 and public tools keep an executor', async () => {
    const res = await exec('definitely_not_a_tool');
    expect(res.status).toBe(404);
    const names = allToolSchemas.map((t) => t.name);
    expect(names.length).toBeGreaterThan(0);
    expect(getToolExecutor(names[0])).toBeTypeOf('function');
  });
});
