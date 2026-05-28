import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { upsertBranding } from './db.js';

const ALLOWED_TONES = ['Motivant', 'Analytique', 'Bienveillant', 'Exigeant'] as const;
const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const brandingRouter = new Hono();
brandingRouter.use('*', authMiddleware);

// PATCH /coach/branding — upsert coach branding config
brandingRouter.patch('/', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);

  // Parse body — return 400 on malformed JSON
  let body: { primary_color?: unknown; logo_url?: unknown; tone?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // Validate primary_color: required, must match #RRGGBB (T-03-02)
  const { primary_color, logo_url, tone } = body;
  if (typeof primary_color !== 'string' || !COLOR_REGEX.test(primary_color)) {
    return c.json({ error: 'primary_color must be a valid hex color (#RRGGBB)' }, 400);
  }

  // Validate logo_url: optional — must be string or null if present (T-03-02)
  if (logo_url !== undefined && logo_url !== null && typeof logo_url !== 'string') {
    return c.json({ error: 'logo_url must be a string or null' }, 400);
  }

  // Validate tone: must be one of the allowed values or null (T-03-03)
  if (tone !== null && tone !== undefined && !ALLOWED_TONES.includes(tone as any)) {
    return c.json(
      { error: `tone must be null or one of: ${ALLOWED_TONES.join(', ')}` },
      400,
    );
  }

  try {
    // T-03-04: coachId comes from auth middleware (JWT), not from the request body
    const row = await upsertBranding(jwt, userId, {
      primary_color: primary_color as string,
      logo_url: (logo_url as string | null | undefined) ?? null,
      tone: (tone as string | null | undefined) ?? null,
    });
    return c.json({ branding: row });
  } catch (err: any) {
    console.error('[coach/branding]', err);
    return c.json({ error: err.message }, 500);
  }
});
