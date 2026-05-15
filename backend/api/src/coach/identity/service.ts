// Public entry point for coach/identity bounded module (ARCH-01, ARCH-02)
// Only this file is imported by app.ts — db.ts and types.ts are module-internal
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { updateRole, upsertProfile, getProfile } from './db.js';
import type { ProfileUpsertPayload } from './types.js';

export const identityRouter = new Hono();
identityRouter.use('*', authMiddleware);
// D-08 NOTE: creditCheck cannot be added here — creditCheck(action) requires a CreditAction
// ('chat' | 'scan' | 'program'). Identity routes are non-AI operations with no credit cost.
// authMiddleware above already provides the auth-gate that D-08 intends.
// If a zero-cost creditCheck mode is added in a future phase, add:
//   import { creditCheck } from '../../middleware/creditGate.js';
//   identityRouter.use('*', creditCheck('identity')); // requires new CreditAction 'identity'

// PATCH /coach/identity/role — promote user to coach or both (COACH-01, COACH-04)
identityRouter.patch('/role', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  try {
    const result = await updateRole(jwt, userId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /coach/identity/profile — create/upsert coach profile (COACH-02)
identityRouter.post('/profile', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  let body: ProfileUpsertPayload;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  try {
    const profile = await upsertProfile(jwt, userId, body);
    return c.json(profile, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// PATCH /coach/identity/profile — update coach profile (COACH-05)
identityRouter.patch('/profile', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  let body: ProfileUpsertPayload;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  try {
    const profile = await upsertProfile(jwt, userId, body);
    return c.json(profile);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /coach/identity/profile — read own profile (COACH-02, COACH-05)
identityRouter.get('/profile', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  try {
    const profile = await getProfile(jwt, userId);
    if (!profile) return c.json({ error: 'Profile not found' }, 404);
    return c.json(profile);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
