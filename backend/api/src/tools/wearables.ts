import { clientForUser } from './db.js';

const today = () => new Date().toISOString().split('T')[0];

// ── Tool: wearables_get_steps ──────────────────────────────
export async function wearables_get_steps(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const startDate = (params.start_date as string) ?? today();
  const endDate = (params.end_date as string) ?? today();

  const db = clientForUser(userToken);
  const { data, error } = await db
    .from('wearable_daily_summary')
    .select('date, steps')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);

  const totalSteps = (data ?? []).reduce((s: number, d: any) => s + (d.steps ?? 0), 0);
  const avgSteps = data?.length ? Math.round(totalSteps / data.length) : 0;

  return {
    start_date: startDate,
    end_date: endDate,
    days: data ?? [],
    total_steps: totalSteps,
    average_steps: avgSteps,
  };
}

// ── Tool: wearables_get_heart_rate ─────────────────────────
export async function wearables_get_heart_rate(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const startDate = (params.start_date as string) ?? today();
  const endDate = (params.end_date as string) ?? today();

  const db = clientForUser(userToken);
  const { data, error } = await db
    .from('wearable_daily_summary')
    .select('date, heart_rate_avg, heart_rate_resting, heart_rate_min, heart_rate_max')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .not('heart_rate_avg', 'is', null)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);

  return {
    start_date: startDate,
    end_date: endDate,
    days: data ?? [],
  };
}

// ── Tool: wearables_get_summary ────────────────────────────
export async function wearables_get_summary(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const date = (params.date as string) ?? today();

  const db = clientForUser(userToken);
  const { data, error } = await db
    .from('wearable_daily_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);

  if (!data) {
    return {
      date,
      message: 'No wearable data synced for this date. Ask the user to sync their wearable device.',
      steps: 0,
      calories_active: 0,
      calories_total: 0,
      heart_rate_avg: null,
      heart_rate_resting: null,
      sleep_hours: null,
      exercises: [],
    };
  }

  return {
    date: data.date,
    steps: data.steps,
    calories_active: data.calories_active,
    calories_total: data.calories_total,
    heart_rate_avg: data.heart_rate_avg,
    heart_rate_resting: data.heart_rate_resting,
    heart_rate_min: data.heart_rate_min,
    heart_rate_max: data.heart_rate_max,
    sleep_hours: data.sleep_hours,
    sleep_bedtime: data.sleep_bedtime,
    sleep_wake_time: data.sleep_wake_time,
    exercises: data.exercises ?? [],
    platform: data.platform,
    synced_at: data.synced_at,
  };
}

// ── Tool: wearables_sync_status ────────────────────────────
export async function wearables_sync_status(
  _params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken);

  // Get latest sync per data type
  const { data, error } = await db
    .from('health_sync_log')
    .select('data_type, synced_at, platform, record_count')
    .eq('user_id', userId)
    .order('synced_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  // Group by data_type, keep only most recent
  const latestByType: Record<string, any> = {};
  for (const row of data ?? []) {
    if (!latestByType[row.data_type]) {
      latestByType[row.data_type] = row;
    }
  }

  // Get the most recent daily summary
  const { data: latestSummary } = await db
    .from('wearable_daily_summary')
    .select('date, synced_at, platform')
    .eq('user_id', userId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  return {
    has_synced: Object.keys(latestByType).length > 0,
    latest_sync: latestSummary?.synced_at ?? null,
    platform: latestSummary?.platform ?? 'unknown',
    data_types: latestByType,
  };
}
