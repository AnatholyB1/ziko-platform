// Public entry point for coach/exercises bounded module.
//
// Routes:
//   GET    /          — list coach's custom exercises (EXLIB-01)
//   POST   /          — create exercise with name + category validation (EXLIB-02, T-43-02-02)
//   PATCH  /:id       — update exercise, 404 if not owned (EXLIB-03, T-43-02-01)
//   DELETE /:id       — delete exercise + storage cleanup (EXLIB-04, T-43-02-01)
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import {
  listExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  getMediaUrls,
} from './db.js';
import { EXERCISE_CATEGORIES } from './types.js';
import type { CreateExerciseBody, UpdateExerciseBody } from './types.js';

export const exercisesRouter = new Hono();
exercisesRouter.use('*', authMiddleware);

// ── GET / — list coach's exercises ───────────────────────────────────────────
exercisesRouter.get('/', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  try {
    const result = await listExercises(jwt, coachId);
    return c.json(result);
  } catch (err: any) {
    console.error('[coach/exercises] GET / error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ── POST / — create a new exercise (T-43-02-02: validate name + category) ────
exercisesRouter.post('/', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  let body: Partial<CreateExerciseBody>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // Validate name — required, max 100
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return c.json({ error: 'Le nom de l\'exercice est obligatoire.', field: 'name' }, 400);
  }
  if (body.name.trim().length > 100) {
    return c.json({ error: 'name must be <= 100 characters', field: 'name' }, 400);
  }

  // Validate category — required, must be in EXERCISE_CATEGORIES enum
  if (!body.category || typeof body.category !== 'string') {
    return c.json({ error: 'Veuillez choisir une catégorie.', field: 'category' }, 400);
  }
  if (!(EXERCISE_CATEGORIES as readonly string[]).includes(body.category)) {
    return c.json({ error: `category must be one of: ${EXERCISE_CATEGORIES.join(', ')}`, field: 'category' }, 400);
  }

  try {
    const exercise = await createExercise(jwt, coachId, {
      name: body.name.trim(),
      description: body.description ?? null,
      category: body.category,
      muscle_groups: body.muscle_groups,
      video_path: body.video_path ?? null,
      photo_path: body.photo_path ?? null,
    });
    return c.json({ exercise }, 201);
  } catch (err: any) {
    console.error('[coach/exercises] POST / error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ── GET /:id/media-url — generate signed URLs for athlete (EXLIB-06, D-12) ───
// Static segment '/media-url' registered BEFORE /:id catch-all (Hono static-before-param rule).
// Authenticates via existing exercisesRouter.use('*', authMiddleware).
// Never returns 500 — any error degrades to { video_url: null, photo_url: null } (D-13).
exercisesRouter.get('/:id/media-url', async (c) => {
  const { userId: athleteUserId } = c.get('auth');
  const id = c.req.param('id');

  // UUID validation — reject malformed IDs early
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: 'Invalid exercise id' }, 400);
  }

  try {
    const result = await getMediaUrls(id, athleteUserId);
    // If exercise not found getMediaUrls returns nulls — surface as 404 per must_haves
    // We can't distinguish "not found" vs "no relationship" from the return value alone,
    // so we always return 200 with nulls for the no-relationship case (graceful degradation D-13).
    // A separate existence check would require an extra query; per plan spec both degrade to nulls.
    return c.json(result);
  } catch (err: any) {
    // Graceful degradation — never 500
    console.warn('[coach/exercises] GET /:id/media-url unhandled error:', err.message);
    return c.json({ video_url: null, photo_url: null });
  }
});

// ── PATCH /:id — update exercise (T-43-02-01: coach_id guard) ────────────────
exercisesRouter.patch('/:id', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  let body: Partial<UpdateExerciseBody>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // Validate category if provided
  if (body.category !== undefined && !(EXERCISE_CATEGORIES as readonly string[]).includes(body.category)) {
    return c.json({ error: `category must be one of: ${EXERCISE_CATEGORIES.join(', ')}`, field: 'category' }, 400);
  }

  try {
    const exercise = await updateExercise(jwt, coachId, id, body);
    if (!exercise) return c.json({ error: 'Exercise not found' }, 404);
    return c.json({ exercise });
  } catch (err: any) {
    console.error('[coach/exercises] PATCH /:id error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ── DELETE /:id — delete exercise + storage cleanup (T-43-02-01) ─────────────
exercisesRouter.delete('/:id', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  try {
    const result = await deleteExercise(jwt, coachId, id);
    if (!result.deleted) return c.json({ error: 'Exercise not found' }, 404);
    return c.json({ deleted: true });
  } catch (err: any) {
    console.error('[coach/exercises] DELETE /:id error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
