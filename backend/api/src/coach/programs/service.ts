// Public entry point for coach/programs bounded module.
// CRITICAL: static paths (/exercises, /folders) are registered BEFORE /:id
// to prevent Hono matching them as :id param values (T-27-04-01).
//
// Routes (in registration order):
//   GET    /exercises          — search exercises (PROG-08)
//   POST   /exercises          — create user-defined exercise
//   GET    /folders            — list coach's folders
//   POST   /folders            — create a folder
//   GET    /                   — list templates (PROG-01)
//   POST   /                   — create template (PROG-01)
//   GET    /:id                — get single program
//   PUT    /:id                — update program (coach-owned only)
//   DELETE /:id                — delete template (?confirmed=true required, PROG-05)
//   POST   /:id/assign         — assign to clients (PROG-02, T-27-04-01)
//   POST   /:id/duplicate      — duplicate template (PROG-04)
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { ProgramWeekSchema } from '@ziko/coach-sdk';
import {
  listPrograms,
  createProgram,
  getProgram,
  updateProgram,
  deleteProgram,
  assignProgram,
  duplicateProgram,
  listFolders,
  createFolder,
  searchExercises,
  createExercise,
} from './db.js';
import type {
  CreateProgramBody,
  UpdateProgramBody,
  AssignProgramBody,
  CreateFolderBody,
  CreateExerciseBody,
} from './types.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const programsRouter = new Hono();
programsRouter.use('*', authMiddleware);

// ── 1. GET /exercises?q= — search exercises ──────────────────────────────────
// CRITICAL: registered BEFORE /:id to avoid Hono matching 'exercises' as :id
programsRouter.get('/exercises', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const q = c.req.query('q') ?? '';
  if (!q.trim()) return c.json({ error: 'q query param is required' }, 400);
  try {
    const result = await searchExercises(jwt, coachId, q.trim());
    return c.json(result);
  } catch (err: any) {
    console.error('[coach/programs] GET /exercises error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 2. POST /exercises — create user-defined exercise ───────────────────────
programsRouter.post('/exercises', async (c) => {
  const { userId: _coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  let body: Partial<CreateExerciseBody>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body.name || typeof body.name !== 'string' || !body.name.trim())
    return c.json({ error: 'name is required' }, 400);
  try {
    const exercise = await createExercise(jwt, {
      name: body.name.trim(),
      category: typeof body.category === 'string' ? body.category : undefined,
    });
    return c.json({ exercise }, 201);
  } catch (err: any) {
    console.error('[coach/programs] POST /exercises error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 3. GET /folders — list coach's program folders ──────────────────────────
// CRITICAL: registered BEFORE /:id to prevent 'folders' matching as :id
programsRouter.get('/folders', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  try {
    const result = await listFolders(jwt, coachId);
    return c.json(result);
  } catch (err: any) {
    console.error('[coach/programs] GET /folders error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 4. POST /folders — create a folder ───────────────────────────────────────
programsRouter.post('/folders', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  let body: Partial<CreateFolderBody>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body.name || typeof body.name !== 'string' || !body.name.trim())
    return c.json({ error: 'name is required' }, 400);
  if (body.name.length > 100)
    return c.json({ error: 'name must be <= 100 characters' }, 400);
  try {
    const folder = await createFolder(jwt, coachId, { name: body.name.trim() });
    return c.json({ folder }, 201);
  } catch (err: any) {
    console.error('[coach/programs] POST /folders error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 5. GET / — list coach's templates + seed templates (PROG-01, PROG-08) ────
programsRouter.get('/', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  try {
    const result = await listPrograms(jwt, coachId);
    return c.json(result);
  } catch (err: any) {
    console.error('[coach/programs] GET / error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 6. POST / — create a new program template (PROG-01) ─────────────────────
// weeks_data validated with z.array(ProgramWeekSchema).safeParse() (T-27-04-02)
programsRouter.post('/', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  let body: Partial<CreateProgramBody>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body.name || typeof body.name !== 'string' || !body.name.trim())
    return c.json({ error: 'name is required' }, 400);
  if (typeof body.weeks_count !== 'number' || body.weeks_count < 1)
    return c.json({ error: 'weeks_count must be a positive integer' }, 400);

  // Validate weeks_data shape before DB write (T-27-04-02)
  if (body.weeks_data !== undefined) {
    const parsed = z.array(ProgramWeekSchema).safeParse(body.weeks_data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid weeks_data', details: parsed.error.flatten() }, 400);
    }
  }

  try {
    const program = await createProgram(jwt, coachId, {
      name: body.name.trim(),
      description: body.description,
      goal: body.goal,
      weeks_count: body.weeks_count,
      folder_id: body.folder_id,
      weeks_data: body.weeks_data,
    });
    return c.json({ program }, 201);
  } catch (err: any) {
    console.error('[coach/programs] POST / error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 7. GET /:id — single program (RLS handles visibility) ────────────────────
programsRouter.get('/:id', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.json({ error: 'Invalid program id' }, 400);
  try {
    const program = await getProgram(jwt, coachId, id);
    if (!program) return c.json({ error: 'Not found' }, 404);
    return c.json({ program });
  } catch (err: any) {
    console.error('[coach/programs] GET /:id error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 8. PUT /:id — update program (coach-owned only) ──────────────────────────
// weeks_data validated when present (T-27-04-03)
programsRouter.put('/:id', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.json({ error: 'Invalid program id' }, 400);
  let body: Partial<UpdateProgramBody>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  // Validate weeks_data shape if provided (T-27-04-03)
  if (body.weeks_data !== undefined) {
    const parsed = z.array(ProgramWeekSchema).safeParse(body.weeks_data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid weeks_data', details: parsed.error.flatten() }, 400);
    }
  }

  try {
    const program = await updateProgram(jwt, coachId, id, body);
    if (!program) return c.json({ error: 'Not found or not owned by coach' }, 404);
    return c.json({ program });
  } catch (err: any) {
    console.error('[coach/programs] PUT /:id error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 9. DELETE /:id — delete template (?confirmed=true required, T-27-04-05) ──
programsRouter.delete('/:id', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.json({ error: 'Invalid program id' }, 400);
  const confirmed = c.req.query('confirmed');
  if (confirmed !== 'true') {
    return c.json({ error: 'confirmed=true query param is required to delete a program' }, 400);
  }
  try {
    const result = await deleteProgram(jwt, coachId, id);
    if (!result.deleted) return c.json({ error: 'Not found or not owned by coach' }, 404);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error('[coach/programs] DELETE /:id error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 10. POST /:id/assign — fork template per client (PROG-02, T-27-04-01) ────
// RLS on INSERT enforces is_coach_of() for assigned_to_user_id.
// client_ids must be non-empty array.
programsRouter.post('/:id/assign', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.json({ error: 'Invalid program id' }, 400);
  let body: Partial<AssignProgramBody>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!Array.isArray(body.client_ids) || body.client_ids.length === 0)
    return c.json({ error: 'client_ids must be a non-empty array' }, 400);
  const invalidIds = body.client_ids.filter((cid: any) => !UUID_REGEX.test(cid));
  if (invalidIds.length > 0)
    return c.json({ error: 'All client_ids must be valid UUIDs' }, 400);
  try {
    const result = await assignProgram(jwt, coachId, id, body.client_ids);
    return c.json(result);
  } catch (err: any) {
    console.error('[coach/programs] POST /:id/assign error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 11. POST /:id/duplicate — copy template with ' (copie)' suffix (PROG-04) ─
programsRouter.post('/:id/duplicate', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.json({ error: 'Invalid program id' }, 400);
  try {
    const program = await duplicateProgram(jwt, coachId, id);
    return c.json({ program }, 201);
  } catch (err: any) {
    console.error('[coach/programs] POST /:id/duplicate error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});
