// POST /ai/session/generate — single-session generation for the mobile
// Coach IA wizard. Anthropic (via the AI SDK) is mocked; no network.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'test-key';
  return { generateText: vi.fn() };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn(), rpc: vi.fn(), auth: {} })),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: h.generateText };
});

vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!c.req.header('Authorization')?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing Authorization header' }, 401);
    }
    c.set('auth', { userId: 'athlete-1', email: 'a@example.com' });
    await next();
  },
}));

vi.mock('../../src/middleware/creditGate.js', () => ({
  creditCheck: () => async (_c: any, next: any) => next(),
  creditDeduct: () => async (_c: any, next: any) => next(),
}));

import { aiRouter } from '../../src/routes/ai.js';

function call(body: unknown, auth = true) {
  return aiRouter.request('/session/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer jwt' } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /ai/session/generate', () => {
  beforeEach(() => h.generateText.mockReset());

  it('requires auth', async () => {
    const res = await call({}, false);
    expect(res.status).toBe(401);
  });

  it('returns { result: { exercises, adaptation_note } } parsed from model JSON', async () => {
    h.generateText.mockResolvedValue({
      text:
        'Voici:\n{"adaptation_note":"Charge allégée","exercises":[{"name":"Squat","sets":"3 × 8","note":"dos droit"},{"name":"Fentes","sets":"3 × 10"},{"sets":"x"}]}',
    });
    const res = await call({ energy: 5, duration: 45, zone: 'bas', equipment: 'salle' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.adaptation_note).toBe('Charge allégée');
    expect(json.result.exercises).toEqual([
      { name: 'Squat', sets: '3 × 8', note: 'dos droit' },
      { name: 'Fentes', sets: '3 × 10' },
    ]);
    const prompt = h.generateText.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('5/10');
    expect(prompt).toContain('lower body');
  });

  it('tolerates a missing/invalid body (defaults applied)', async () => {
    h.generateText.mockResolvedValue({ text: '{"exercises":[{"name":"Pompes","sets":"3 × 12"}]}' });
    const res = await aiRouter.request('/session/generate', {
      method: 'POST',
      headers: { Authorization: 'Bearer jwt' },
    });
    expect(res.status).toBe(200);
    const prompt = h.generateText.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('45 minutes');
  });

  it('returns 500 when the model returns no JSON', async () => {
    h.generateText.mockResolvedValue({ text: 'désolé' });
    const res = await call({ energy: 7 });
    expect(res.status).toBe(500);
  });

  it('returns 500 when the model returns no exercises', async () => {
    h.generateText.mockResolvedValue({ text: '{"exercises":[]}' });
    const res = await call({ energy: 7 });
    expect(res.status).toBe(500);
  });

  it('returns 500 when the provider throws', async () => {
    // The failure is modelled on the resolved value (a throwing mock is reported as an unhandled error by vitest here).
    h.generateText.mockResolvedValue({
      get text(): string {
        throw new Error('upstream unavailable');
      },
    });
    const res = await call({ energy: 7 });
    expect(res.status).toBe(500);
  });
});
