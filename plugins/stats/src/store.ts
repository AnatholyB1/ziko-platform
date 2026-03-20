import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────
export type Period = '7d' | '30d' | '90d' | 'all';

export interface VolumePoint {
  date: string;
  volume: number;
}

export interface SessionPoint {
  week: string;
  count: number;
}

export interface MuscleGroupData {
  name: string;
  sets: number;
  color: string;
}

export interface ExerciseFrequency {
  exercise_id: string;
  name: string;
  count: number;
}

export interface ExerciseProgressionPoint {
  date: string;
  max_weight: number;
  avg_reps: number;
  avg_rpe: number | null;
  total_volume: number;
}

export interface SessionSummary {
  id: string;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  total_volume_kg: number | null;
  total_sets: number | null;
  total_reps: number | null;
  total_exercises: number | null;
  total_rest_seconds: number | null;
  total_duration_active_seconds: number | null;
  day_of_week: number | null;
}

export interface PersonalRecord {
  exercise_id: string;
  exercise_name: string;
  max_weight: number;
  max_reps: number;
  date: string;
}

// ── Store ────────────────────────────────────────────────
interface StatsState {
  period: Period;
  isLoading: boolean;
  volumeTimeline: VolumePoint[];
  sessionFrequency: SessionPoint[];
  muscleDistribution: MuscleGroupData[];
  topExercises: ExerciseFrequency[];
  recentSessions: SessionSummary[];
  personalRecords: PersonalRecord[];
  totalSessions: number;
  totalVolume: number;
  avgSessionDuration: number;
  avgRpe: number | null;

  setPeriod: (p: Period) => void;
  setLoading: (v: boolean) => void;
  setData: (data: Partial<StatsState>) => void;
}

export const useStatsStore = create<StatsState>()((set) => ({
  period: '30d',
  isLoading: false,
  volumeTimeline: [],
  sessionFrequency: [],
  muscleDistribution: [],
  topExercises: [],
  recentSessions: [],
  personalRecords: [],
  totalSessions: 0,
  totalVolume: 0,
  avgSessionDuration: 0,
  avgRpe: null,

  setPeriod: (period) => set({ period }),
  setLoading: (isLoading) => set({ isLoading }),
  setData: (data) => set(data),
}));

// ── Helper: date cutoff ─────────────────────────────────
function getCutoff(period: Period): string | null {
  if (period === 'all') return null;
  const d = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ── Muscle group color palette ──────────────────────────
const MUSCLE_COLORS: Record<string, string> = {
  chest: '#FF5C1A',
  back: '#2563EB',
  shoulders: '#7C3AED',
  biceps: '#EC4899',
  triceps: '#F59E0B',
  legs: '#10B981',
  quadriceps: '#10B981',
  hamstrings: '#059669',
  glutes: '#14B8A6',
  calves: '#6EE7B7',
  core: '#6366F1',
  abs: '#6366F1',
  forearms: '#D97706',
  traps: '#8B5CF6',
  lats: '#3B82F6',
  cardio: '#EF4444',
};

function getMuscleColor(name: string): string {
  const key = name.toLowerCase();
  return MUSCLE_COLORS[key] ?? '#9CA3AF';
}

// ── Data fetchers ───────────────────────────────────────
export async function fetchAllStats(supabase: any, period: Period) {
  const store = useStatsStore.getState();
  store.setLoading(true);

  try {
    const cutoff = getCutoff(period);
    const results = await Promise.all([
      fetchVolumeTrend(supabase, cutoff),
      fetchSessionFrequency(supabase, cutoff),
      fetchMuscleDistribution(supabase, cutoff),
      fetchTopExercises(supabase, cutoff),
      fetchRecentSessions(supabase, cutoff),
      fetchOverviewStats(supabase, cutoff),
      fetchPersonalRecords(supabase),
    ]);

    store.setData({
      volumeTimeline: results[0],
      sessionFrequency: results[1],
      muscleDistribution: results[2],
      topExercises: results[3],
      recentSessions: results[4],
      ...results[5],
      personalRecords: results[6],
    });
  } finally {
    store.setLoading(false);
  }
}

// 1. Volume over time (daily total_volume_kg)
async function fetchVolumeTrend(supabase: any, cutoff: string | null): Promise<VolumePoint[]> {
  let q = supabase
    .from('workout_sessions')
    .select('started_at, total_volume_kg')
    .not('ended_at', 'is', null)
    .order('started_at');

  if (cutoff) q = q.gte('started_at', cutoff);

  const { data } = await q;
  if (!data) return [];

  // Aggregate per day
  const byDay: Record<string, number> = {};
  for (const s of data) {
    const day = s.started_at.split('T')[0];
    byDay[day] = (byDay[day] ?? 0) + (s.total_volume_kg ?? 0);
  }

  return Object.entries(byDay)
    .map(([date, volume]) => ({ date, volume: Math.round(volume) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 2. Session frequency per week
async function fetchSessionFrequency(supabase: any, cutoff: string | null): Promise<SessionPoint[]> {
  let q = supabase
    .from('workout_sessions')
    .select('started_at')
    .not('ended_at', 'is', null)
    .order('started_at');

  if (cutoff) q = q.gte('started_at', cutoff);

  const { data } = await q;
  if (!data) return [];

  const byWeek: Record<string, number> = {};
  for (const s of data) {
    const d = new Date(s.started_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
    const key = weekStart.toISOString().split('T')[0];
    byWeek[key] = (byWeek[key] ?? 0) + 1;
  }

  return Object.entries(byWeek)
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

// 3. Muscle group distribution (from session_sets + exercises)
async function fetchMuscleDistribution(supabase: any, cutoff: string | null): Promise<MuscleGroupData[]> {
  let q = supabase
    .from('session_sets')
    .select('exercise_id, exercises(muscle_groups), session:workout_sessions!inner(started_at)')
    .eq('completed', true);

  if (cutoff) q = q.gte('session.started_at', cutoff);

  const { data } = await q;
  if (!data) return [];

  const counts: Record<string, number> = {};
  for (const row of data) {
    const groups: string[] = (row.exercises as any)?.muscle_groups ?? [];
    for (const g of groups) {
      counts[g] = (counts[g] ?? 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([name, sets]) => ({ name, sets, color: getMuscleColor(name) }))
    .sort((a, b) => b.sets - a.sets);
}

// 4. Top exercises by frequency
async function fetchTopExercises(supabase: any, cutoff: string | null): Promise<ExerciseFrequency[]> {
  let q = supabase
    .from('session_exercises')
    .select('exercise_id, exercises(name), session:workout_sessions!inner(started_at)')
    .gt('sets_completed', 0);

  if (cutoff) q = q.gte('session.started_at', cutoff);

  const { data } = await q;
  if (!data) return [];

  const counts: Record<string, { name: string; count: number }> = {};
  for (const row of data) {
    const id = row.exercise_id;
    if (!counts[id]) counts[id] = { name: (row.exercises as any)?.name ?? 'Unknown', count: 0 };
    counts[id].count++;
  }

  return Object.entries(counts)
    .map(([exercise_id, v]) => ({ exercise_id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// 5. Recent sessions
async function fetchRecentSessions(supabase: any, cutoff: string | null): Promise<SessionSummary[]> {
  let q = supabase
    .from('workout_sessions')
    .select('id, name, started_at, ended_at, total_volume_kg, total_sets, total_reps, total_exercises, total_rest_seconds, total_duration_active_seconds, day_of_week')
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(20);

  if (cutoff) q = q.gte('started_at', cutoff);

  const { data } = await q;
  return data ?? [];
}

// 6. Overview stats (aggregates)
async function fetchOverviewStats(supabase: any, cutoff: string | null) {
  let q = supabase
    .from('workout_sessions')
    .select('total_volume_kg, started_at, ended_at, total_duration_active_seconds')
    .not('ended_at', 'is', null);

  if (cutoff) q = q.gte('started_at', cutoff);

  const { data } = await q;
  if (!data || data.length === 0) {
    return { totalSessions: 0, totalVolume: 0, avgSessionDuration: 0, avgRpe: null };
  }

  const totalSessions = data.length;
  const totalVolume = data.reduce((sum: number, s: any) => sum + (s.total_volume_kg ?? 0), 0);

  const durations = data
    .map((s: any) => {
      if (s.total_duration_active_seconds) return s.total_duration_active_seconds;
      if (s.started_at && s.ended_at) {
        return (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000;
      }
      return 0;
    })
    .filter((d: number) => d > 0);

  const avgSessionDuration =
    durations.length > 0
      ? Math.round(durations.reduce((s: number, d: number) => s + d, 0) / durations.length)
      : 0;

  // Avg RPE from session_sets
  let avgRpe: number | null = null;
  let rpeQ = supabase
    .from('session_sets')
    .select('rpe, session:workout_sessions!inner(started_at)')
    .not('rpe', 'is', null);

  if (cutoff) rpeQ = rpeQ.gte('session.started_at', cutoff);

  const { data: rpeData } = await rpeQ;
  if (rpeData && rpeData.length > 0) {
    avgRpe = +(rpeData.reduce((s: number, r: any) => s + r.rpe, 0) / rpeData.length).toFixed(1);
  }

  return { totalSessions, totalVolume: Math.round(totalVolume), avgSessionDuration, avgRpe };
}

// 7. Personal records (max weight per exercise)
async function fetchPersonalRecords(supabase: any): Promise<PersonalRecord[]> {
  const { data } = await supabase
    .from('session_sets')
    .select('exercise_id, weight_kg, reps, completed_at, exercises(name)')
    .eq('completed', true)
    .not('weight_kg', 'is', null)
    .order('weight_kg', { ascending: false });

  if (!data) return [];

  const best: Record<string, PersonalRecord> = {};
  for (const row of data) {
    const id = row.exercise_id;
    if (!best[id] || row.weight_kg > best[id].max_weight) {
      best[id] = {
        exercise_id: id,
        exercise_name: (row.exercises as any)?.name ?? 'Unknown',
        max_weight: row.weight_kg,
        max_reps: row.reps ?? 0,
        date: row.completed_at ?? '',
      };
    }
  }

  return Object.values(best)
    .sort((a, b) => b.max_weight - a.max_weight)
    .slice(0, 20);
}

// ── Exercise progression fetcher ────────────────────────
export async function fetchExerciseProgression(
  supabase: any,
  exerciseId: string,
  period: Period,
): Promise<ExerciseProgressionPoint[]> {
  const cutoff = getCutoff(period);

  let q = supabase
    .from('session_sets')
    .select('weight_kg, reps, rpe, completed_at, session:workout_sessions!inner(started_at)')
    .eq('exercise_id', exerciseId)
    .eq('completed', true)
    .order('completed_at');

  if (cutoff) q = q.gte('session.started_at', cutoff);

  const { data } = await q;
  if (!data) return [];

  // Group by day
  const byDay: Record<string, { weights: number[]; reps: number[]; rpes: number[]; volume: number }> = {};
  for (const row of data) {
    const day = (row.completed_at ?? (row.session as any)?.started_at ?? '').split('T')[0];
    if (!day) continue;
    if (!byDay[day]) byDay[day] = { weights: [], reps: [], rpes: [], volume: 0 };
    const w = row.weight_kg ?? 0;
    const r = row.reps ?? 0;
    byDay[day].weights.push(w);
    byDay[day].reps.push(r);
    if (row.rpe != null) byDay[day].rpes.push(row.rpe);
    byDay[day].volume += w * r;
  }

  return Object.entries(byDay)
    .map(([date, d]) => ({
      date,
      max_weight: Math.max(...d.weights),
      avg_reps: +(d.reps.reduce((a, b) => a + b, 0) / d.reps.length).toFixed(1),
      avg_rpe: d.rpes.length > 0 ? +(d.rpes.reduce((a, b) => a + b, 0) / d.rpes.length).toFixed(1) : null,
      total_volume: Math.round(d.volume),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Session detail fetcher ──────────────────────────────
export async function fetchSessionDetail(supabase: any, sessionId: string) {
  const [sessionRes, exercisesRes, setsRes] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single(),
    supabase
      .from('session_exercises')
      .select('*, exercises(name, muscle_groups, category)')
      .eq('session_id', sessionId)
      .order('order_index'),
    supabase
      .from('session_sets')
      .select('*')
      .eq('session_id', sessionId)
      .order('exercise_order')
      .order('set_number'),
  ]);

  return {
    session: sessionRes.data,
    exercises: exercisesRes.data ?? [],
    sets: setsRes.data ?? [],
  };
}
