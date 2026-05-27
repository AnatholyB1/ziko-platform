import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import { notificationService } from '../services/notificationService.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const router = new Hono();

/**
 * POST /push-events/supabase
 * Supabase DB webhook receiver for action-triggered push notifications.
 * Handles:
 *   - PUSH-03: workout_sessions UPDATE (ended_at NULL→timestamp) → 2-min delayed post-session summary
 *   - PUSH-04: user_xp UPDATE (level increase) → immediate level-up push
 * Secured by WEBHOOK_SECRET header.
 */
router.post('/supabase', async (c) => {
  // Auth guard
  const secret = c.req.header('X-Webhook-Secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await c.req.json<{
    type: string;
    table: string;
    record: Record<string, unknown>;
    old_record?: Record<string, unknown>;
  }>();

  const { type, table, record, old_record } = payload;

  // ── PUSH-03: workout_sessions UPDATE (ended_at NULL → timestamp) ──────────
  if (table === 'workout_sessions' && type === 'UPDATE') {
    const endedAtOld = old_record?.ended_at;
    const endedAtNew = record.ended_at;

    // Only trigger when ended_at transitions from null to a non-null value
    if (endedAtOld === null && typeof endedAtNew === 'string' && endedAtNew !== null) {
      const athleteId = record.user_id as string;
      const sessionId = record.id as string;

      waitUntil(
        (async () => {
          // D-04: 2-minute delay before sending
          await new Promise<void>((resolve) => setTimeout(resolve, 120_000));

          // D-05: Active session guard — suppress if athlete started a new session
          const { data: activeSession } = await supabaseAdmin
            .from('workout_sessions')
            .select('id')
            .eq('user_id', athleteId)
            .is('ended_at', null)
            .limit(1)
            .maybeSingle();

          if (activeSession) {
            console.log('[push-events] PUSH-03 suppressed — active session found for user:', athleteId);
            return;
          }

          await notificationService.send({
            recipientUserId: athleteId,
            category: 'workout',
            type: 'post_session_summary',
            title: 'Séance terminée 🔥',
            body: 'Belle performance ! Regarde ton résumé.',
            data: { url: '/(app)/workout-history' },
            idempotencyKey: `session_summary_${athleteId}_${sessionId}`,
          });
        })(),
      );
    }

    return c.json({ received: true });
  }

  // ── PUSH-04: user_xp UPDATE (level increase) ─────────────────────────────
  if (table === 'user_xp' && type === 'UPDATE') {
    const oldLevel = Number(old_record?.level ?? 0);
    const newLevel = Number(record.level);

    // Only trigger when level actually increases
    if (newLevel <= oldLevel) {
      return c.json({ received: true });
    }

    const userId = record.user_id as string;

    waitUntil(
      notificationService.send({
        recipientUserId: userId,
        category: 'gamification',
        type: 'level_up',
        title: 'Niveau supérieur ! 🏆',
        body: `Tu viens de passer au niveau ${newLevel}. Continue comme ça !`,
        data: { url: '/(app)/(plugins)/gamification/dashboard' },
        idempotencyKey: `levelup_${userId}_${newLevel}`,
      }),
    );

    return c.json({ received: true });
  }

  // Default: unhandled table/type combination
  console.log('[push-events] Unhandled event:', { type, table });
  return c.json({ received: true });
});

export { router as pushEventsRouter };
