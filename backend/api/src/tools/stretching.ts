import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

function admin() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Tool: stretching_get_routines ──────────────────────────
export async function stretching_get_routines(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const db = admin();
  const { type, muscle_group } = params as { type?: string; muscle_group?: string };

  // Return recent stretching logs as "routines" — the app stores completed routines
  let query = db
    .from('stretching_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(20);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let routines = data ?? [];

  // Filter by type or muscle group if provided (stored in exercises JSONB)
  if (type) {
    routines = routines.filter((r: any) =>
      r.routine_name?.toLowerCase().includes(type.replace('_', ' ')),
    );
  }
  if (muscle_group) {
    routines = routines.filter(
      (r: any) =>
        r.routine_name?.toLowerCase().includes(muscle_group.toLowerCase()) ||
        JSON.stringify(r.exercises).toLowerCase().includes(muscle_group.toLowerCase()),
    );
  }

  return { routines };
}

// ── Tool: stretching_log_session ───────────────────────────
export async function stretching_log_session(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const { routine_id, duration_seconds } = params as {
    routine_id?: string;
    duration_seconds: number;
  };
  if (!duration_seconds) throw new Error('duration_seconds is required');

  const db = admin();
  const { data, error } = await db
    .from('stretching_logs')
    .insert({
      user_id: userId,
      routine_name: routine_id ?? 'Custom Session',
      duration_sec: duration_seconds,
      exercises: [],
    })
    .select('id, routine_name, duration_sec, date')
    .single();

  if (error) throw new Error(error.message);
  return { success: true, session: data };
}

// ── Tool: stretching_get_history ───────────────────────────
export async function stretching_get_history(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const days = (params.days as number) ?? 7;
  const db = admin();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await db
    .from('stretching_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);

  const logs = data ?? [];
  const totalMinutes = logs.reduce((sum: number, l: any) => sum + (l.duration_sec ?? 0), 0) / 60;

  return {
    days,
    session_count: logs.length,
    total_minutes: Math.round(totalMinutes),
    sessions: logs,
  };
}
