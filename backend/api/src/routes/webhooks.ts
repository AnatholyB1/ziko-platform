import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const adminClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const router = new Hono();

/**
 * POST /webhooks/supabase
 * Supabase DB webhook receiver (e.g. new user → send welcome push).
 * Secured by WEBHOOK_SECRET header.
 */
router.post('/supabase', async (c) => {
  const secret = c.req.header('X-Webhook-Secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await c.req.json<{ type: string; table: string; record: Record<string, unknown> }>();
  const { type, table, record } = payload;

  // Example: handle new user profile creation
  if (table === 'user_profiles' && type === 'INSERT') {
    console.log(`New user registered: ${record.id}`);
    // TODO: send welcome notification via FCM/APNs
  }

  return c.json({ received: true });
});

export { router as webhooksRouter };
