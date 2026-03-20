import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

function admin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const today = () => new Date().toISOString().split('T')[0];

// ── Tool: habits_get_today ─────────────────────────────────
export async function habits_get_today(
  _params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const db = admin();
  const date = today();

  const [habitsRes, logsRes] = await Promise.all([
    db.from('habits').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order'),
    db.from('habit_logs').select('*').eq('user_id', userId).eq('date', date),
  ]);

  if (habitsRes.error) throw new Error(habitsRes.error.message);
  if (logsRes.error) throw new Error(logsRes.error.message);

  const logMap = Object.fromEntries((logsRes.data ?? []).map((l: any) => [l.habit_id, l.value]));

  return {
    date,
    habits: (habitsRes.data ?? []).map((h: any) => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      type: h.type,
      target: h.target,
      unit: h.unit,
      value_today: logMap[h.id] ?? 0,
      completed: (logMap[h.id] ?? 0) >= h.target,
    })),
  };
}

// ── Tool: habits_log ───────────────────────────────────────
export async function habits_log(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const { habit_id, value } = params as { habit_id: string; value: number };
  if (!habit_id) throw new Error('habit_id is required');

  const db = admin();

  // Verify habit belongs to user
  const { data: habit, error: habitErr } = await db
    .from('habits')
    .select('id, name, target')
    .eq('id', habit_id)
    .eq('user_id', userId)
    .single();

  if (habitErr || !habit) throw new Error('Habit not found');

  const { error } = await db.from('habit_logs').upsert(
    { habit_id, user_id: userId, date: today(), value: value ?? 1 },
    { onConflict: 'habit_id,date' },
  );

  if (error) throw new Error(error.message);
  return { success: true, habit_name: (habit as any).name, value: value ?? 1, date: today() };
}

// ── Tool: habits_get_streaks ───────────────────────────────
export async function habits_get_streaks(
  _params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const db = admin();

  const [habitsRes, logsRes] = await Promise.all([
    db.from('habits').select('id, name, emoji').eq('user_id', userId).eq('is_active', true),
    db.from('habit_logs')
      .select('habit_id, date, value')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(300),
  ]);

  if (habitsRes.error) throw new Error(habitsRes.error.message);
  if (logsRes.error) throw new Error(logsRes.error.message);

  const logs = logsRes.data ?? [];
  const habits = habitsRes.data ?? [];

  return habits.map((h: any) => {
    const habitLogs = logs
      .filter((l: any) => l.habit_id === h.id && l.value >= 1)
      .map((l: any) => l.date)
      .sort()
      .reverse();

    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (const dateStr of habitLogs) {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((cursor.getTime() - d.getTime()) / 86400000);
      if (diff <= 1) {
        streak++;
        cursor = d;
      } else {
        break;
      }
    }

    return { id: h.id, name: h.name, emoji: h.emoji, streak };
  });
}

// ── Tool: habits_create ────────────────────────────────────
export async function habits_create(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const { name, emoji = '✅', type = 'boolean', target = 1, unit } = params as any;
  if (!name) throw new Error('name is required');

  const db = admin();
  const { data, error } = await db
    .from('habits')
    .insert({ user_id: userId, name, emoji, type, target, unit: unit ?? null, source: 'manual' })
    .select('id, name')
    .single();

  if (error) throw new Error(error.message);
  return { success: true, habit: data };
}
