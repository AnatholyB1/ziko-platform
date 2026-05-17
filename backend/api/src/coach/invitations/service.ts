// Public entry point for coach/invitations bounded module (ARCH-01, ARCH-02)
// Only this file is imported by app.ts — db.ts and types.ts are module-internal
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { insertInvitation, listInvitations, revokeInvitation } from './db.js';
import type { GenerateCodePayload, ListStatusFilter } from './types.js';

const VALID_STATUS_FILTERS: ReadonlySet<ListStatusFilter> = new Set<ListStatusFilter>([
  'active',
  'used',
  'expired',
  'revoked',
  'all',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const invitationsRouter = new Hono();
invitationsRouter.use('*', authMiddleware);

// POST /coach/invitations — generate code (INVITE-01)
// Body: { expires_at: ISOString | null }
// Returns: 201 + CoachInvitationRow
invitationsRouter.post('/', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);

  let body: GenerateCodePayload;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Light validation: expires_at must be ISOString or null
  if (body.expires_at !== null && typeof body.expires_at !== 'string') {
    return c.json({ error: 'expires_at must be ISOString or null' }, 400);
  }
  if (body.expires_at !== null && Number.isNaN(Date.parse(body.expires_at))) {
    return c.json({ error: 'expires_at is not a valid date' }, 400);
  }

  try {
    const row = await insertInvitation(jwt, userId, body);
    return c.json(row, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /coach/invitations?status=active|used|expired|revoked|all (INVITE-02)
// Returns: 200 + Array<CoachInvitationRow & { status }>
invitationsRouter.get('/', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);

  const rawStatus = c.req.query('status') ?? 'active';
  if (!VALID_STATUS_FILTERS.has(rawStatus as ListStatusFilter)) {
    return c.json({ error: 'Invalid status filter' }, 400);
  }

  try {
    const rows = await listInvitations(jwt, userId, rawStatus as ListStatusFilter);
    return c.json(rows);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// DELETE /coach/invitations/:id — revoke (INVITE-02). Idempotent.
invitationsRouter.delete('/:id', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');

  if (!UUID_RE.test(id)) {
    return c.json({ error: 'Invalid id format' }, 400);
  }

  try {
    await revokeInvitation(jwt, userId, id);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
