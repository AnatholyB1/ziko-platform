// Defensive shaping of rows coming back from `ziko_habits` / `ziko_habit_logs`.
// The screen must render with whatever the DB (or a stale React Query cache entry) hands
// it: a non-array payload, null columns or malformed rows must not take the module down.

export interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  type: 'boolean' | 'count';
  target: number;
  emoji: string;
  color: string;
  created_at?: string;
  reminder_time: string | null;
  is_active: boolean;
}

export interface HabitLogRow {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  value: number;
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export function normalizeHabits(rows: unknown): HabitRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isObj).filter((r) => r.id != null).map((r) => {
    const target = Number(r.target);
    return {
      id: String(r.id),
      user_id: str(r.user_id),
      name: str(r.name, 'Habitude'),
      type: r.type === 'count' ? 'count' : 'boolean',
      target: Number.isFinite(target) && target > 0 ? target : 1,
      emoji: str(r.emoji),
      color: str(r.color),
      created_at: typeof r.created_at === 'string' ? r.created_at : undefined,
      reminder_time: typeof r.reminder_time === 'string' && r.reminder_time ? r.reminder_time : null,
      is_active: r.is_active !== false,
    };
  });
}

export function normalizeHabitLogs(rows: unknown): HabitLogRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isObj).filter((r) => r.habit_id != null).map((r) => ({
    id: String(r.id ?? `${r.habit_id}-${r.date}`),
    habit_id: String(r.habit_id),
    user_id: str(r.user_id),
    date: str(r.date).slice(0, 10),
    value: Number.isFinite(Number(r.value)) ? Number(r.value) : 0,
  }));
}
