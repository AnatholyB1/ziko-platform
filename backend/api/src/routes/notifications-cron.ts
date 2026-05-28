import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { notificationService } from '../services/notificationService.js';

// Admin client — bypasses RLS for cron-specific admin queries
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const notificationsCronRouter = new Hono();

// No authMiddleware — cron routes authenticate via CRON_SECRET Bearer header

/**
 * Verify that the request carries a valid CRON_SECRET.
 * Returns true when:
 *   - CRON_SECRET env var is not set (dev/local mode), OR
 *   - authHeader === `Bearer ${process.env.CRON_SECRET}`
 */
function verifyCronSecret(authHeader: string | undefined): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }
  return true;
}

// ── CRON-02: Receipt polling + dead-token cleanup ─────────────────────────────

/**
 * GET /notifications/cron/check-receipts
 * Triggered by Vercel Cron every 30 minutes.
 * 1. Queries notification_log for 'sent' rows within the last 24 h that have receipt_ids.
 * 2. Calls notificationService.processReceipts() to check delivery status with Expo.
 * 3. Deactivates notification_tokens for users whose tokens returned DeviceNotRegistered.
 */
notificationsCronRouter.get('/cron/check-receipts', async (c) => {
  if (!verifyCronSecret(c.req.header('authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Only consider receipts from the last 24 h — Expo receipts expire after 24 h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: logRows, error: logError } = await supabaseAdmin
      .from('notification_log')
      .select('receipt_ids')
      .eq('status', 'sent')
      .not('receipt_ids', 'is', null)
      .gte('sent_at', cutoff);

    if (logError) {
      console.error('[CRON-02] Failed to query notification_log:', logError);
      return c.json({ error: logError.message }, 500);
    }

    const allReceiptIds = (logRows ?? []).flatMap(
      (r: { receipt_ids: string[] | null }) => r.receipt_ids ?? [],
    );

    if (allReceiptIds.length === 0) {
      return c.json({ checked: 0, deactivated_users: 0 });
    }

    await notificationService.processReceipts(allReceiptIds);

    // After processReceipts updates error_code, deactivate tokens for DeviceNotRegistered
    const { data: failedRows, error: failedError } = await supabaseAdmin
      .from('notification_log')
      .select('user_id')
      .eq('error_code', 'DeviceNotRegistered')
      .eq('status', 'failed')
      .gte('sent_at', cutoff);

    if (failedError) {
      console.error('[CRON-02] Failed to query failed notification_log:', failedError);
      return c.json({ error: failedError.message }, 500);
    }

    const affectedUserIds = [
      ...new Set(
        (failedRows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean),
      ),
    ];

    for (const userId of affectedUserIds) {
      await supabaseAdmin
        .from('notification_tokens')
        .update({ is_active: false })
        .eq('user_id', userId);
    }

    return c.json({ checked: allReceiptIds.length, deactivated_users: affectedUserIds.length });
  } catch (err: any) {
    console.error('[CRON-02]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ── CRON-01: Streak-at-risk daily alert ──────────────────────────────────────

/**
 * GET /notifications/cron/streak-at-risk
 * Triggered by Vercel Cron daily at 18:00 UTC.
 * Finds users who logged habits yesterday but NOT today and have the habits plugin enabled.
 * Sends a push notification to each at-risk user (idempotent).
 */
notificationsCronRouter.get('/cron/streak-at-risk', async (c) => {
  if (!verifyCronSecret(c.req.header('authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterday = yesterdayDate.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // Step A: Users who logged a habit yesterday
    const { data: loggedYesterday, error: errA } = await supabaseAdmin
      .from('habit_logs')
      .select('user_id')
      .eq('date', yesterday);

    if (errA) {
      console.error('[CRON-01] errA:', errA);
      return c.json({ error: errA.message }, 500);
    }

    const usersYesterday = new Set(
      (loggedYesterday ?? []).map((r: { user_id: string }) => r.user_id),
    );

    if (usersYesterday.size === 0) {
      return c.json({ sent: 0, skipped: 0 });
    }

    // Step B: Users who already logged a habit today (exclude them)
    const { data: loggedToday, error: errB } = await supabaseAdmin
      .from('habit_logs')
      .select('user_id')
      .eq('date', today);

    if (errB) {
      console.error('[CRON-01] errB:', errB);
      return c.json({ error: errB.message }, 500);
    }

    const usersToday = new Set(
      (loggedToday ?? []).map((r: { user_id: string }) => r.user_id),
    );

    // Step C: Users with >= 3 distinct habit log dates in the last 7 days
    const { data: recentLogs, error: errC } = await supabaseAdmin
      .from('habit_logs')
      .select('user_id, date')
      .gte('date', sevenDaysAgo);

    if (errC) {
      console.error('[CRON-01] errC:', errC);
      return c.json({ error: errC.message }, 500);
    }

    // Count distinct dates per user
    const dateSets = new Map<string, Set<string>>();
    for (const row of recentLogs ?? []) {
      const r = row as { user_id: string; date: string };
      if (!dateSets.has(r.user_id)) dateSets.set(r.user_id, new Set());
      dateSets.get(r.user_id)!.add(r.date);
    }
    const usersWithStreak = new Set(
      [...dateSets.entries()]
        .filter(([, dates]) => dates.size >= 3)
        .map(([userId]) => userId),
    );

    // Step D: Users with habits plugin enabled
    const { data: enabledPlugins, error: errD } = await supabaseAdmin
      .from('user_plugins')
      .select('user_id')
      .eq('plugin_id', 'habits')
      .eq('is_enabled', true);

    if (errD) {
      console.error('[CRON-01] errD:', errD);
      return c.json({ error: errD.message }, 500);
    }

    const usersWithHabits = new Set(
      (enabledPlugins ?? []).map((r: { user_id: string }) => r.user_id),
    );

    // Step E: Intersection — logged yesterday, NOT today, streak >= 3, has habits plugin
    const atRiskUsers = [...usersYesterday].filter(
      (userId) =>
        !usersToday.has(userId) &&
        usersWithStreak.has(userId) &&
        usersWithHabits.has(userId),
    );

    let sentCount = 0;
    let skippedCount = 0;

    // Step F: Send one notification per at-risk user
    for (const userId of atRiskUsers) {
      const result = await notificationService.send({
        recipientUserId: userId,
        category: 'health',
        type: 'streak_at_risk',
        title: 'Ta série est en danger !',
        body: "Tu n'as pas encore validé tes habitudes aujourd'hui. Ne laisse pas tomber ta série !",
        data: { url: '/(plugins)/habits/dashboard' },
        idempotencyKey: `streak_at_risk_${userId}_${today}`,
      });

      if (result.sent) {
        sentCount++;
      } else {
        skippedCount++;
      }
    }

    return c.json({ sent: sentCount, skipped: skippedCount });
  } catch (err: any) {
    console.error('[CRON-01]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ── CRON-03: Weekly XP digest ─────────────────────────────────────────────────

/**
 * GET /notifications/cron/weekly-digest
 * Triggered by Vercel Cron every Sunday at 09:00 UTC.
 * Sends a weekly summary (sessions, XP, streak) to users who opted-in via type_prefs.
 */
notificationsCronRouter.get('/cron/weekly-digest', async (c) => {
  if (!verifyCronSecret(c.req.header('authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Find users who opted in to weekly digest AND have push enabled
    const { data: optedIn, error: prefError } = await supabaseAdmin
      .from('notification_preferences')
      .select('user_id')
      .eq('push_enabled', true)
      .filter('type_prefs->>weekly_xp_digest', 'eq', 'true');

    if (prefError) {
      console.error('[CRON-03] Failed to query notification_preferences:', prefError);
      return c.json({ error: prefError.message }, 500);
    }

    if (!optedIn || optedIn.length === 0) {
      return c.json({ sent: 0, skipped: 0 });
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const sundayDate = new Date().toISOString().split('T')[0];

    let sentCount = 0;
    let skippedCount = 0;

    for (const pref of optedIn as { user_id: string }[]) {
      const userId = pref.user_id;

      // Gather three data points in parallel
      const [sessionsResult, xpResult, streakResult] = await Promise.all([
        supabaseAdmin
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('ended_at', 'is', null)
          .gte('started_at', weekAgo),

        supabaseAdmin
          .from('xp_transactions')
          .select('amount')
          .eq('user_id', userId)
          .gte('created_at', weekAgo),

        supabaseAdmin
          .from('user_gamification')
          .select('current_streak')
          .eq('user_id', userId)
          .single(),
      ]);

      const sessions = sessionsResult.count ?? 0;
      const xp = (xpResult.data ?? []).reduce(
        (acc: number, r: { amount: number }) => acc + (r.amount ?? 0),
        0,
      );
      const streak = (streakResult.data as { current_streak: number } | null)?.current_streak ?? 0;

      const body = `${sessions} séance${sessions !== 1 ? 's' : ''} · +${xp} XP · Série de ${streak} jour${streak !== 1 ? 's' : ''}`;

      const result = await notificationService.send({
        recipientUserId: userId,
        category: 'health',
        type: 'weekly_digest',
        title: "Votre semaine en un coup d'oeil",
        body,
        data: { url: '/(app)/stats' },
        idempotencyKey: `weekly_digest_${userId}_${sundayDate}`,
      });

      if (result.sent) {
        sentCount++;
      } else {
        skippedCount++;
      }
    }

    return c.json({ sent: sentCount, skipped: skippedCount });
  } catch (err: any) {
    console.error('[CRON-03]', err);
    return c.json({ error: err.message }, 500);
  }
});

export { notificationsCronRouter };
