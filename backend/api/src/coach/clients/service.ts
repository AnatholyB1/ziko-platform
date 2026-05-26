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
  getClientSummary,
  getClientSessions,
  getClientMeasurements,
  getClientHabits,
  getClientNutrition,
  getClientSleep,
  getClientCardio,
  getClientJournal,
  listCompareData,
  getProgramsForClient,
  upsertSharedNote,
} from './db.js';
import { getWidgetData } from '../dashboards/db.js';

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

// GET /compare — multi-client comparison data (CLIENT-07, D-17)
// CRITICAL: Registered BEFORE /:id/* to avoid Hono matching "compare" as an :id (T-26-03-03)
clientsRouter.get('/compare', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const idsParam = c.req.query('ids') ?? '';
  const metric = (c.req.query('metric') ?? 'weight') as 'weight' | 'sessions' | 'sleep' | 'mood';
  const daysParam = parseInt(c.req.query('days') ?? '30', 10);
  const days = ([30, 90, 365].includes(daysParam) ? daysParam : 30) as 30 | 90 | 365;

  const clientIds = idsParam.split(',').filter(id => UUID_REGEX.test(id));
  if (!clientIds.length) return c.json({ error: 'ids query param required (UUID list)' }, 400);
  if (clientIds.length > 5) return c.json({ error: 'Maximum 5 clients per comparison' }, 400);
  if (!['weight', 'sessions', 'sleep', 'mood'].includes(metric))
    return c.json({ error: 'Invalid metric' }, 400);

  try {
    const data = await listCompareData(jwt, userId, clientIds, metric, days);
    return c.json({ data });
  } catch (err: any) {
    console.error('[coach/clients] GET /compare error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/summary — executive summary aggregates (CLIENT-04)
clientsRouter.get('/:id/summary', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const summary = await getClientSummary(jwt, userId, clientId);
    return c.json({ summary });
  } catch (err: any) {
    console.error('[coach/clients] GET /:id/summary error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/sessions — sessions tab (CLIENT-03)
clientsRouter.get('/:id/sessions', async (c) => {
  const { userId: _userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const sessions = await getClientSessions(jwt, clientId);
    return c.json({ sessions });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/measurements — measurements tab (CLIENT-03)
clientsRouter.get('/:id/measurements', async (c) => {
  const { userId: _userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const measurements = await getClientMeasurements(jwt, clientId);
    return c.json({ measurements });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/habits — habits tab (CLIENT-03)
clientsRouter.get('/:id/habits', async (c) => {
  const { userId: _userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const result = await getClientHabits(jwt, clientId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/nutrition — nutrition tab (CLIENT-03)
clientsRouter.get('/:id/nutrition', async (c) => {
  const { userId: _userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const nutrition = await getClientNutrition(jwt, clientId);
    return c.json({ nutrition });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/sleep — sleep tab (CLIENT-03)
clientsRouter.get('/:id/sleep', async (c) => {
  const { userId: _userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const sleep = await getClientSleep(jwt, clientId);
    return c.json({ sleep });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/cardio — cardio tab (CLIENT-03)
clientsRouter.get('/:id/cardio', async (c) => {
  const { userId: _userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const cardio = await getClientCardio(jwt, clientId);
    return c.json({ cardio });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/journal — journal tab (CLIENT-03)
clientsRouter.get('/:id/journal', async (c) => {
  const { userId: _userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const journal = await getClientJournal(jwt, clientId);
    return c.json({ journal });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /:id/programs — programs assigned to this client by the requesting coach (PROG-06)
clientsRouter.get('/:id/programs', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const result = await getProgramsForClient(jwt, coachId, clientId);
    return c.json(result);
  } catch (err: any) {
    console.error('[coach/clients] GET /:id/programs error:', err.message);
    return c.json({ error: 'Not found' }, 404);
  }
});

// PUT /:clientId/shared-note — update shared_note on the coach↔client link (PROG-07, PROG-09)
clientsRouter.put('/:clientId/shared-note', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('clientId');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  let body: { note?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (typeof body.note !== 'string') return c.json({ error: 'note must be a string' }, 400);
  if (body.note.length > 500) return c.json({ error: 'note exceeds 500 character limit' }, 400);
  try {
    const result = await upsertSharedNote(jwt, coachId, clientId, body.note);
    return c.json(result);
  } catch (err: any) {
    console.error('[coach/clients] PUT /:clientId/shared-note error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// GET /:clientId/widget-data — returns shaped data for a single widget type (01-04)
clientsRouter.get('/:clientId/widget-data', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('clientId');
  const type = c.req.query('type');
  const period = c.req.query('period') ?? '30d';

  if (!type) return c.json({ error: 'type query param required' }, 400);

  const params: Record<string, string> = {};
  for (const key of ['dataKey', 'threshold', 'unit', 'message', 'severity', 'filter']) {
    const v = c.req.query(key);
    if (v !== undefined) params[key] = v;
  }

  try {
    const data = await getWidgetData(jwt, userId, clientId, type, period, params);
    return c.json(data);
  } catch (err: any) {
    const msg: string = err?.message ?? 'Unknown error';
    if (msg.startsWith('Unknown widget type') || msg === 'Invalid period') {
      return c.json({ error: msg }, 400);
    }
    console.error('[widget-data]', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
