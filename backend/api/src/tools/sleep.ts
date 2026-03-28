import { clientForUser } from './db.js';

const today = () => new Date().toISOString().split('T')[0];

// ── Tool: sleep_log ──────────────────────────────────────────
export async function sleep_log(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const { date, bedtime, wake_time, quality, notes } = params as {
    date?: string;
    bedtime: string;
    wake_time: string;
    quality: number;
    notes?: string;
  };

  if (!bedtime) throw new Error('bedtime is required (HH:MM)');
  if (!wake_time) throw new Error('wake_time is required (HH:MM)');
  if (!quality) throw new Error('quality is required (1-5)');

  // Calculate duration in hours
  const [bH, bM] = bedtime.split(':').map(Number);
  const [wH, wM] = wake_time.split(':').map(Number);
  let durationMin = (wH * 60 + wM) - (bH * 60 + bM);
  if (durationMin < 0) durationMin += 24 * 60; // overnight
  const durationHours = parseFloat((durationMin / 60).toFixed(2));

  const db = clientForUser(userToken);
  const { data, error } = await db
    .from('sleep_logs')
    .upsert(
      {
        user_id: userId,
        date: date ?? today(),
        bedtime,
        wake_time,
        duration_hours: durationHours,
        quality,
        notes: notes ?? null,
      },
      { onConflict: 'user_id,date' },
    )
    .select('id, date, duration_hours, quality')
    .single();

  if (error) throw new Error(error.message);
  return { success: true, sleep: data };
}

// ── Tool: sleep_get_history ────────────────────────────────
export async function sleep_get_history(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const days = (params.days as number) ?? 7;
  const db = clientForUser(userToken);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await db
    .from('sleep_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);

  const logs = data ?? [];
  const avgDuration =
    logs.length > 0
      ? logs.reduce((sum: number, l: any) => sum + Number(l.duration_hours), 0) / logs.length
      : 0;
  const avgQuality =
    logs.length > 0
      ? logs.reduce((sum: number, l: any) => sum + l.quality, 0) / logs.length
      : 0;

  return {
    days,
    entries: logs.length,
    avg_duration_hours: parseFloat(avgDuration.toFixed(1)),
    avg_quality: parseFloat(avgQuality.toFixed(1)),
    logs,
  };
}

// ── Tool: sleep_get_recovery_score ─────────────────────────
export async function sleep_get_recovery_score(
  _params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken);

  // Get last 7 days of sleep
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [sleepRes, workoutRes] = await Promise.all([
    db
      .from('sleep_logs')
      .select('duration_hours, quality')
      .eq('user_id', userId)
      .gte('date', since.toISOString().split('T')[0])
      .order('date', { ascending: false }),
    db
      .from('workout_sessions')
      .select('total_volume_kg')
      .eq('user_id', userId)
      .gte('started_at', since.toISOString())
      .limit(7),
  ]);

  const sleepLogs = sleepRes.data ?? [];
  const workouts = workoutRes.data ?? [];

  const avgDuration =
    sleepLogs.length > 0
      ? sleepLogs.reduce((s: number, l: any) => s + Number(l.duration_hours), 0) / sleepLogs.length
      : 7;
  const avgQuality =
    sleepLogs.length > 0
      ? sleepLogs.reduce((s: number, l: any) => s + l.quality, 0) / sleepLogs.length
      : 3;

  // Score: 40% sleep duration (8h = 100%), 40% sleep quality, 20% workout balance
  const durationScore = Math.min(avgDuration / 8, 1) * 40;
  const qualityScore = (avgQuality / 5) * 40;
  const workoutCount = workouts.length;
  const workoutScore = workoutCount >= 3 && workoutCount <= 5 ? 20 : workoutCount > 5 ? 10 : workoutCount * 5;

  const recoveryScore = Math.round(durationScore + qualityScore + workoutScore);

  return {
    recovery_score: recoveryScore,
    avg_sleep_hours: parseFloat(avgDuration.toFixed(1)),
    avg_sleep_quality: parseFloat(avgQuality.toFixed(1)),
    workouts_this_week: workoutCount,
    recommendation:
      recoveryScore >= 80
        ? 'Great recovery — you can train hard today!'
        : recoveryScore >= 60
        ? 'Decent recovery — moderate intensity recommended.'
        : 'Low recovery — consider a rest day or light session.',
  };
}
