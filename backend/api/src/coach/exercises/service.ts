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
