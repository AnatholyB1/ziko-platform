import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const adminClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
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
  } else if (table === 'workout_sessions' && type === 'INSERT') {
    try {
      const athleteId = record.user_id as string | null
      const programId = record.program_id as string | null

      if (!athleteId) {
        console.warn('[webhooks] workout_sessions INSERT: missing user_id')
        return c.json({ received: true })
      }

      // Find the athlete's active coach
      const { data: linkRow, error: linkErr } = await adminClient
        .from('coach_client_links')
        .select('coach_id')
        .eq('client_id', athleteId)
        .is('revoked_at', null)
        .maybeSingle()

      if (linkErr || !linkRow) {
        // No active coach link — nothing to trigger
        return c.json({ received: true })
      }

      // Count total sessions for this athlete in the same program
      let sessionQuery = adminClient
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', athleteId)
      if (programId) {
        sessionQuery = sessionQuery.eq('program_id', programId)
      }
      const { count, error: countErr } = await sessionQuery
      if (countErr) {
        console.warn('[webhooks] workout_sessions count error:', countErr.message)
        return c.json({ received: true })
      }
      const sessionCount = count ?? 1

      // Fire after_n_sessions trigger
      const { data, error: rpcErr } = await adminClient.rpc(
        'create_form_instances_for_trigger',
        {
          p_trigger_type: 'after_n_sessions',
          p_athlete_id: athleteId,
          p_coach_id: linkRow.coach_id,
          p_n_sessions: sessionCount,
        }
      )
      if (rpcErr) {
        console.warn('[forms/after_n_sessions trigger]', rpcErr.message)
      } else {
        console.log(
          '[forms/after_n_sessions trigger] athlete=%s sessions=%d created=%d',
          athleteId,
          sessionCount,
          data ?? 0
        )
      }
    } catch (err) {
      console.error('[webhooks] workout_sessions branch error:', err)
    }
  }

  return c.json({ received: true });
});

export { router as webhooksRouter };
