import { clientForUser } from './db.js';
import { earnCredits } from '../services/creditService.js';

const today = () => new Date().toISOString().split('T')[0];

// ── Tool: cardio_log_session ───────────────────────────────────────
export async function cardio_log_session(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const {
    activity_type,
    duration_min,
    distance_km,
    calories_burned,
    avg_heart_rate,
    notes,
  } = params as {
    activity_type: string;
    duration_min: number;
    distance_km?: number;
    calories_burned?: number;
    avg_heart_rate?: number;
    notes?: string;
  };

  if (!activity_type) throw new Error('activity_type is required');
  if (!duration_min) throw new Error('duration_min is required');

  // Calculate pace if distance available
  let avgPaceSecPerKm: number | null = null;
  if (distance_km && distance_km > 0) {
    avgPaceSecPerKm = Math.round((duration_min * 60) / distance_km);
  }

  const db = clientForUser(userToken);
  const { data, error } = await db
    .from('cardio_sessions')
    .insert({
      user_id: userId,
      activity_type,
      duration_min,
      distance_km: distance_km ?? null,
      calories_burned: calories_burned ?? null,
      avg_heart_rate: avg_heart_rate ?? null,
      avg_pace_sec_per_km: avgPaceSecPerKm,
      notes: notes ?? null,
      date: today(),
    })
    .select('id, activity_type, duration_min, distance_km, date')
    .single();

  if (error) throw new Error(error.message);

  // Fire-and-forget earn (D-03): session.id is the idempotency key
  earnCredits(userId, 'cardio', (data as any).id).catch(() => {});

  return { success: true, session: data };
}

// ── Tool: cardio_get_history ───────────────────────────────
export async function cardio_get_history(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const days = (params.days as number) ?? 30;
  const activityType = params.activity_type as string | undefined;
  const db = clientForUser(userToken);
  const since = new Date();
  since.setDate(since.getDate() - days);

  let query = db
    .from('cardio_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (activityType) {
    query = query.eq('activity_type', activityType);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return { days, sessions: data ?? [] };
}

// ── Tool: cardio_get_stats ─────────────────────────────────
export async function cardio_get_stats(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const days = (params.days as number) ?? 30;
  const db = clientForUser(userToken);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await db
    .from('cardio_sessions')
    .select('activity_type, duration_min, distance_km, calories_burned, avg_pace_sec_per_km')
    .eq('user_id', userId)
    .gte('date', since.toISOString().split('T')[0]);

  if (error) throw new Error(error.message);

  const sessions = data ?? [];
  const totalMinutes = sessions.reduce((s: number, r: any) => s + Number(r.duration_min), 0);
  const totalDistance = sessions.reduce((s: number, r: any) => s + (Number(r.distance_km) || 0), 0);
  const totalCalories = sessions.reduce((s: number, r: any) => s + (r.calories_burned ?? 0), 0);

  const paces = sessions
    .filter((s: any) => s.avg_pace_sec_per_km)
    .map((s: any) => s.avg_pace_sec_per_km);
  const avgPace = paces.length > 0 ? Math.round(paces.reduce((a: number, b: number) => a + b, 0) / paces.length) : null;

  // Group by activity type
  const byType: Record<string, number> = {};
  for (const s of sessions) {
    byType[s.activity_type] = (byType[s.activity_type] ?? 0) + 1;
  }

  return {
    days,
    total_sessions: sessions.length,
    total_minutes: Math.round(totalMinutes),
    total_distance_km: parseFloat(totalDistance.toFixed(1)),
    total_calories: totalCalories,
    avg_pace_sec_per_km: avgPace,
    avg_pace_formatted: avgPace
      ? `${Math.floor(avgPace / 60)}:${String(avgPace % 60).padStart(2, '0')}/km`
      : null,
    sessions_by_type: byType,
  };
}
