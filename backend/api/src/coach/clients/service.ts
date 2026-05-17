// Public entry point for coach/clients bounded module (ARCH-01, ARCH-02).
// Routes:
//   GET    /links/me         — current active link + coach preview (always 200)
//   POST   /links/preview    — peek a code; constant-time envelope; rate-limited
//   POST   /links/redeem     — redeem a code; constant-time envelope; rate-limited
//   DELETE /links/:id        — athlete revokes own link (INVITE-06)
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { redemptionRateLimit } from './ratelimit.js';
import {
  getActiveLink,
  peekInvitation,
  redeemInvitation,
  revokeLink,
} from './db.js';

const CODE_REGEX = /^[A-Z2-9]{6}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Constant-time envelopes for catch-all error paths in /preview + /redeem
// (do NOT leak internal error messages to wire).
const PREVIEW_ERROR = {
  ok: false as const,
  error_code: 'INVALID_OR_EXPIRED' as const,
  preview: null,
};
const REDEEM_ERROR = {
  ok: false as const,
  error_code: 'INVALID_OR_EXPIRED' as const,
  link: null,
  preview: null,
};

export const clientsRouter = new Hono();
clientsRouter.use('*', authMiddleware);

// GET /coach/clients/links/me — always 200; returns { link: null } when unlinked
clientsRouter.get('/links/me', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  try {
    const result = await getActiveLink(jwt, userId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /coach/clients/links/preview — constant-time + rate-limited (INVITE-05, INVITE-07)
clientsRouter.post('/links/preview', redemptionRateLimit, async (c) => {
  const { userId: _userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);

  let body: { code?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json(PREVIEW_ERROR, 200);
  }

  const code = typeof body.code === 'string' ? body.code : '';
  if (!CODE_REGEX.test(code)) {
    // Malformed code is just another flavor of INVALID — collapse to wire envelope
    return c.json(PREVIEW_ERROR, 200);
  }

  try {
    const result = await peekInvitation(jwt, { code });
    return c.json(result);
  } catch (err: any) {
    console.warn('[coach/clients] /links/preview unexpected error:', err.message);
    return c.json(PREVIEW_ERROR, 200);
  }
});

// POST /coach/clients/links/redeem — constant-time + rate-limited (INVITE-03, INVITE-04, INVITE-07)
clientsRouter.post('/links/redeem', redemptionRateLimit, async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);

  let body: { code?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json(REDEEM_ERROR, 200);
  }

  const code = typeof body.code === 'string' ? body.code : '';
  if (!CODE_REGEX.test(code)) {
    return c.json(REDEEM_ERROR, 200);
  }

  try {
    const result = await redeemInvitation(jwt, { code }, userId);
    return c.json(result);
  } catch (err: any) {
    console.warn('[coach/clients] /links/redeem unexpected error:', err.message);
    return c.json(REDEEM_ERROR, 200);
  }
});

// DELETE /coach/clients/links/:id — athlete revoke (INVITE-06)
clientsRouter.delete('/links/:id', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.json({ error: 'Invalid id format' }, 400);
  try {
    await revokeLink(jwt, userId, id);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
