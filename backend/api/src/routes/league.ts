// v1.20 Phase 26 (LEAG-03/05) - routes de la Ligue.
//  - POST /league/refresh    : cloture des semaines + porte IA de la transition Habitudes -> Performance (cout absorbe,
//                              plafonne 1/jour, pas de creditCheck). Sans raison d'appeler le modele : 0 appel IA.
//  - POST /league/collective : un COACH cree un defi collectif (RPC en base avec le JWT du coach : c'est la base qui
//                              verifie le role, les liens actifs, le plafond de 3 defis actifs et les bornes).
// L'identite vient toujours du jeton (jamais du corps).
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { createUserClient } from '../coach/clients/db.js';
import { refreshLeague } from '../league/service.js';

export const leagueRouter = new Hono();
leagueRouter.use('*', authMiddleware);

leagueRouter.post('/refresh', async (c) => {
  const { userId } = c.get('auth');
  const out = await refreshLeague(userId);
  if (out.status === 'error') return c.json(out, 502);
  return c.json(out);
});

const CollectiveBody = z.object({
  title: z.string().min(3).max(80),
  metric: z.enum(['workout_sessions', 'habit_logs', 'hydration_ml']),
  target_total: z.number().positive().max(1_000_000),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const COLLECTIVE_ERRORS: Record<string, { status: 400 | 403 | 409; error: string }> = {
  not_a_coach: { status: 403, error: 'not_a_coach' },
  no_clients: { status: 409, error: 'no_clients' },
  too_many_active_challenges: { status: 409, error: 'too_many_active_challenges' },
  invalid_arguments: { status: 400, error: 'invalid_arguments' },
};

leagueRouter.post('/collective', async (c) => {
  const parsed = CollectiveBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_arguments' }, 400);
  const jwt = (c.req.header('Authorization') ?? '').slice(7);
  const db = createUserClient(jwt);
  const b = parsed.data;
  const { data, error } = await db.rpc('ziko_create_collective_challenge', {
    p_title: b.title,
    p_metric: b.metric,
    p_target: b.target_total,
    p_start: b.start_date,
    p_end: b.end_date,
  });
  if (error) {
    const key = Object.keys(COLLECTIVE_ERRORS).find((k) => error.message.includes(k));
    if (key) return c.json({ error: COLLECTIVE_ERRORS[key].error }, COLLECTIVE_ERRORS[key].status);
    console.error('[League] collective create failed:', error.message);
    return c.json({ error: 'create_failed' }, 502);
  }
  return c.json({ status: 'created', ...(data as Record<string, unknown>) }, 201);
});
