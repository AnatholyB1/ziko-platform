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
  listCoachClients,
  listClientTags,
  createClientTag,
  deleteClientTag,
  getClientNote,
  upsertClientNote,
  revokeClientLinkByCoach,
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

// ── Coach-facing roster routes (Phase 26, CLIENT-01..08) ──────────────────────

// GET / — list all linked clients with signal flags (CLIENT-01, CLIENT-02)
clientsRouter.get('/', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  try {
    const rows = await listCoachClients(jwt, userId);
    return c.json({ clients: rows });
  } catch (err: any) {
    console.error('[coach/clients] GET / error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/tags — list coach's tags for this client (CLIENT-05)
clientsRouter.get('/:id/tags', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const tags = await listClientTags(jwt, userId, clientId);
    return c.json({ tags });
  } catch (err: any) {
    console.error('[coach/clients] GET /:id/tags error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// POST /:id/tags — create a tag (CLIENT-05)
clientsRouter.post('/:id/tags', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  let body: { tag?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const tag = typeof body.tag === 'string' ? body.tag.trim() : '';
  if (!tag || tag.length > 50) return c.json({ error: 'tag must be 1-50 chars' }, 400);
  try {
    const created = await createClientTag(jwt, userId, clientId, tag);
    return c.json({ tag: created }, 201);
  } catch (err: any) {
    console.error('[coach/clients] POST /:id/tags error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// DELETE /:id/tags/:tagId — delete a tag (CLIENT-05)
clientsRouter.delete('/:id/tags/:tagId', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  const tagId = c.req.param('tagId');
  if (!UUID_REGEX.test(clientId) || !UUID_REGEX.test(tagId))
    return c.json({ error: 'Invalid id format' }, 400);
  try {
    await deleteClientTag(jwt, userId, tagId);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error('[coach/clients] DELETE /:id/tags/:tagId error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/notes — get coach's note for this client (CLIENT-06)
clientsRouter.get('/:id/notes', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const note = await getClientNote(jwt, userId, clientId);
    return c.json({ note });
  } catch (err: any) {
    console.error('[coach/clients] GET /:id/notes error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// PUT /:id/notes — upsert coach's note for this client (CLIENT-06)
clientsRouter.put('/:id/notes', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  let body: { content?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const content = typeof body.content === 'string' ? body.content : '';
  try {
    const note = await upsertClientNote(jwt, userId, clientId, content);
    return c.json({ note });
  } catch (err: any) {
    console.error('[coach/clients] PUT /:id/notes error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// DELETE /links/:clientId — COACH-side revoke (CLIENT-08, D-20)
// NOTE: registered BEFORE DELETE /links/:id (athlete-side) — Hono matches in registration order.
// coach handler checks coach_id = userId; athlete handler checks client_id = userId.
// Both are safe independently due to their WHERE clause authorization.
clientsRouter.delete('/links/:clientId', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('clientId');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const result = await revokeClientLinkByCoach(jwt, userId, clientId);
    return c.json({ ok: true, revoked_at: result.revoked_at });
  } catch (err: any) {
    console.error('[coach/clients] DELETE /links/:clientId error:', err.message);
    return c.json({ error: err.message }, 500);
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
