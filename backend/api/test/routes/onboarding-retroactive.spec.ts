// v1.21 SEV4 : POST /ai/onboarding/retroactive ne doit jamais repondre 500 quand le modele ne renvoie pas
// d'objet structure (AI_NoObjectGeneratedError). Spec unitaire : aucun appel reseau.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCompute = vi.fn();

vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    if (!c.req.header('Authorization')?.startsWith('Bearer ')) return c.json({ error: 'Missing Authorization header' }, 401);
    c.set('auth', { userId: 'athlete-1', email: 'athlete@example.com' });
    await next();
  }),
}));
vi.mock('../../src/context/conversation.js', () => ({ getOrCreateConversation: vi.fn(), appendMessages: vi.fn() }));
vi.mock('../../src/tools/onboarding-retroactive.js', () => ({
  computeRetroactiveProfile: (...a: unknown[]) => mockCompute(...a),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: vi.fn() })) }));

import { onboardingRouter } from '../../src/routes/onboarding.js';

const call = () =>
  onboardingRouter.request('/onboarding/retroactive', {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: '{}',
  });

describe('POST /ai/onboarding/retroactive', () => {
  beforeEach(() => {
    mockCompute.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('succes : renvoie le resultat tel quel (200)', async () => {
    mockCompute.mockResolvedValue({ success: true, decision_id: 'd1' });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, decision_id: 'd1' });
  });

  it('skip existant : inchange (200)', async () => {
    mockCompute.mockResolvedValue({ success: false, skipped: 'state_exists' });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: false, skipped: 'state_exists' });
  });

  it('modele sans objet structure (AI_NoObjectGeneratedError) : 200 skipped model_no_object, pas de 500', async () => {
    const err = new Error('No object generated: could not parse the response.');
    err.name = 'AI_NoObjectGeneratedError';
    mockCompute.mockRejectedValue(err);
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: false, skipped: 'model_no_object' });
  });

  it('autre erreur : toujours 500', async () => {
    mockCompute.mockRejectedValue(new Error('db down'));
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'db down' });
  });

  it('sans jeton : 401', async () => {
    const res = await onboardingRouter.request('/onboarding/retroactive', { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
  });
});
