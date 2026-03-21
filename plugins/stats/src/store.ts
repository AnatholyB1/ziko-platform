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

// ── Habits Stats Types ──────────────────────────────────
export interface HabitCompletionPoint {
  date: string;
  completed: number;
  total: number;
  rate: number;
}

export interface HabitPerformance {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: string;
  target: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
}

export interface HabitsOverview {
  totalHabits: number;
  avgDailyCompletion: number;
  bestDay: string;
  bestDayRate: number;
  totalCompletions: number;
  activeDays: number;
}

// ── Nutrition Stats Types ───────────────────────────────
export interface NutritionDayPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: number;
}

export interface MealTypeDistribution {
  type: string;
  label: string;
  count: number;
  avgCalories: number;
  color: string;
}

export interface NutritionOverview {
  totalMeals: number;
  avgDailyCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  daysTracked: number;
  topFoods: { name: string; count: number }[];
}

// ── Gamification Stats Types ────────────────────────────
export interface XPTimelinePoint {
  date: string;
  xp: number;
  cumulative: number;
}

export interface XPBySource {
  source: string;
  label: string;
  total: number;
  count: number;
  color: string;
}

export interface CoinFlow {
  date: string;
  earned: number;
  spent: number;
  balance: number;
}

export interface GamificationOverview {
  totalXP: number;
  currentLevel: number;
  levelTitle: string;
  totalCoins: number;
  coinsSpent: number;
  currentStreak: number;
  longestStreak: number;
  itemsOwned: number;
  totalPurchases: number;
  daysActive: number;
}

// ── Community Stats Types ───────────────────────────────
export interface CommunityOverview {
  totalFriends: number;
  messagesSent: number;
  challengesTotal: number;
  challengesWon: number;
  challengesLost: number;
  challengesTied: number;
  xpGifted: number;
  xpReceived: number;
  coinsGifted: number;
  coinsReceived: number;
  programsShared: number;
  groupWorkoutsDone: number;
  encouragementsSent: number;
  encouragementsReceived: number;
  invitesSent: number;
  invitesAccepted: number;
  reactionsSent: number;
}

export interface CommunityActivityPoint {
  date: string;
  messages: number;
  reactions: number;
}

// ── AI Stats Types ──────────────────────────────────────
export interface ConversationActivity {
  date: string;
  conversations: number;
  messages: number;
}

export interface AIOverview {
  totalConversations: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  avgMessagesPerConvo: number;
  avgConvosPerWeek: number;
  longestConversation: { id: string; title: string; messageCount: number } | null;
  activeDays: number;
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

// ════════════════════════════════════════════════════════
// HABITS STATS FETCHERS
// ════════════════════════════════════════════════════════

export async function fetchHabitsCompletionTimeline(
  supabase: any, cutoff: string | null,
): Promise<HabitCompletionPoint[]> {
  // Get all active habits to know total per day
  const { data: habits } = await supabase.from('habits').select('id').eq('is_active', true);
  const totalHabits = habits?.length ?? 0;
  if (totalHabits === 0) return [];

  let q = supabase.from('habit_logs').select('date, habit_id, value').order('date');
  if (cutoff) q = q.gte('date', cutoff.split('T')[0]);
  const { data: logs } = await q;
  if (!logs || logs.length === 0) return [];

  // Get habit targets to know completion
  const { data: habitsWithTarget } = await supabase.from('habits').select('id, target').eq('is_active', true);
  const targetMap: Record<string, number> = {};
  for (const h of (habitsWithTarget ?? [])) targetMap[h.id] = h.target;

  const byDay: Record<string, { completed: number; total: number }> = {};
  for (const log of logs) {
    const day = log.date;
    if (!byDay[day]) byDay[day] = { completed: 0, total: totalHabits };
    if (log.value >= (targetMap[log.habit_id] ?? 1)) byDay[day].completed++;
  }

  return Object.entries(byDay)
    .map(([date, d]) => ({
      date,
      completed: d.completed,
      total: d.total,
      rate: Math.round((d.completed / d.total) * 100),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchHabitPerformances(
  supabase: any, cutoff: string | null,
): Promise<HabitPerformance[]> {
  const { data: habits } = await supabase
    .from('habits').select('*').eq('is_active', true).order('sort_order');
  if (!habits) return [];

  let q = supabase.from('habit_logs').select('habit_id, date, value').order('date');
  if (cutoff) q = q.gte('date', cutoff.split('T')[0]);
  const { data: logs } = await q;

  const logsByHabit: Record<string, { date: string; value: number }[]> = {};
  for (const l of (logs ?? [])) {
    if (!logsByHabit[l.habit_id]) logsByHabit[l.habit_id] = [];
    logsByHabit[l.habit_id].push(l);
  }

  return habits.map((h: any) => {
    const hLogs = logsByHabit[h.id] ?? [];
    const completions = hLogs.filter(l => l.value >= h.target);
    const totalDays = new Set(hLogs.map(l => l.date)).size || 1;

    // Calculate streaks
    const completedDates = completions.map(l => l.date).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;
    for (let i = 0; i < completedDates.length; i++) {
      if (i === 0) { streak = 1; }
      else {
        const prev = new Date(completedDates[i - 1]);
        const curr = new Date(completedDates[i]);
        const diff = (curr.getTime() - prev.getTime()) / 86400000;
        streak = diff === 1 ? streak + 1 : 1;
      }
      longestStreak = Math.max(longestStreak, streak);
    }
    // Check if current streak is still active (last date is today or yesterday)
    if (completedDates.length > 0) {
      const lastDate = new Date(completedDates[completedDates.length - 1]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      lastDate.setHours(0, 0, 0, 0);
      const diffDays = (today.getTime() - lastDate.getTime()) / 86400000;
      currentStreak = diffDays <= 1 ? streak : 0;
    }

    return {
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      type: h.type,
      target: h.target,
      completionRate: Math.round((completions.length / totalDays) * 100),
      currentStreak,
      longestStreak,
      totalCompletions: completions.length,
    };
  });
}

export async function fetchHabitsOverview(
  supabase: any, cutoff: string | null,
): Promise<HabitsOverview> {
  const { data: habits } = await supabase.from('habits').select('id, target').eq('is_active', true);
  const totalHabits = habits?.length ?? 0;

  let q = supabase.from('habit_logs').select('habit_id, date, value');
  if (cutoff) q = q.gte('date', cutoff.split('T')[0]);
  const { data: logs } = await q;

  if (!logs || logs.length === 0 || totalHabits === 0) {
    return { totalHabits, avgDailyCompletion: 0, bestDay: '', bestDayRate: 0, totalCompletions: 0, activeDays: 0 };
  }

  const targetMap: Record<string, number> = {};
  for (const h of habits) targetMap[h.id] = h.target;

  const byDay: Record<string, number> = {};
  let totalCompletions = 0;
  for (const l of logs) {
    if (l.value >= (targetMap[l.habit_id] ?? 1)) {
      byDay[l.date] = (byDay[l.date] ?? 0) + 1;
      totalCompletions++;
    }
  }

  const days = Object.entries(byDay);
  const activeDays = days.length;
  const avgDailyCompletion = activeDays > 0
    ? Math.round(days.reduce((s, [, c]) => s + (c / totalHabits) * 100, 0) / activeDays)
    : 0;

  let bestDay = '';
  let bestDayRate = 0;
  for (const [date, count] of days) {
    const rate = (count / totalHabits) * 100;
    if (rate > bestDayRate) { bestDay = date; bestDayRate = Math.round(rate); }
  }

  return { totalHabits, avgDailyCompletion, bestDay, bestDayRate, totalCompletions, activeDays };
}

// ════════════════════════════════════════════════════════
// NUTRITION STATS FETCHERS
// ════════════════════════════════════════════════════════

export async function fetchNutritionTimeline(
  supabase: any, cutoff: string | null,
): Promise<NutritionDayPoint[]> {
  let q = supabase
    .from('nutrition_logs')
    .select('date, calories, protein_g, carbs_g, fat_g')
    .order('date');
  if (cutoff) q = q.gte('date', cutoff.split('T')[0]);
  const { data } = await q;
  if (!data) return [];

  const byDay: Record<string, NutritionDayPoint> = {};
  for (const row of data) {
    if (!byDay[row.date]) byDay[row.date] = { date: row.date, calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };
    byDay[row.date].calories += row.calories ?? 0;
    byDay[row.date].protein += Number(row.protein_g) || 0;
    byDay[row.date].carbs += Number(row.carbs_g) || 0;
    byDay[row.date].fat += Number(row.fat_g) || 0;
    byDay[row.date].meals++;
  }

  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchMealTypeDistribution(
  supabase: any, cutoff: string | null,
): Promise<MealTypeDistribution[]> {
  let q = supabase.from('nutrition_logs').select('meal_type, calories');
  if (cutoff) q = q.gte('date', cutoff.split('T')[0]);
  const { data } = await q;
  if (!data) return [];

  const LABELS: Record<string, string> = {
    breakfast: 'Petit-déj', lunch: 'Déjeuner', dinner: 'Dîner', snack: 'Snack',
  };
  const COLORS: Record<string, string> = {
    breakfast: '#FF5C1A', lunch: '#2563EB', dinner: '#7C3AED', snack: '#10B981',
  };

  const groups: Record<string, { count: number; totalCal: number }> = {};
  for (const row of data) {
    const t = row.meal_type;
    if (!groups[t]) groups[t] = { count: 0, totalCal: 0 };
    groups[t].count++;
    groups[t].totalCal += row.calories ?? 0;
  }

  return Object.entries(groups)
    .map(([type, g]) => ({
      type,
      label: LABELS[type] ?? type,
      count: g.count,
      avgCalories: g.count > 0 ? Math.round(g.totalCal / g.count) : 0,
      color: COLORS[type] ?? '#9CA3AF',
    }))
    .sort((a, b) => b.count - a.count);
}

export async function fetchNutritionOverview(
  supabase: any, cutoff: string | null,
): Promise<NutritionOverview> {
  let q = supabase.from('nutrition_logs').select('date, food_name, calories, protein_g, carbs_g, fat_g');
  if (cutoff) q = q.gte('date', cutoff.split('T')[0]);
  const { data } = await q;

  if (!data || data.length === 0) {
    return { totalMeals: 0, avgDailyCalories: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0, daysTracked: 0, topFoods: [] };
  }

  const days = new Set(data.map((r: any) => r.date));
  const daysTracked = days.size;
  const totalCal = data.reduce((s: number, r: any) => s + (r.calories ?? 0), 0);
  const totalP = data.reduce((s: number, r: any) => s + (Number(r.protein_g) || 0), 0);
  const totalC = data.reduce((s: number, r: any) => s + (Number(r.carbs_g) || 0), 0);
  const totalF = data.reduce((s: number, r: any) => s + (Number(r.fat_g) || 0), 0);

  // Top foods
  const foodCounts: Record<string, number> = {};
  for (const r of data) { foodCounts[r.food_name] = (foodCounts[r.food_name] ?? 0) + 1; }
  const topFoods = Object.entries(foodCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalMeals: data.length,
    avgDailyCalories: Math.round(totalCal / daysTracked),
    avgProtein: Math.round(totalP / daysTracked),
    avgCarbs: Math.round(totalC / daysTracked),
    avgFat: Math.round(totalF / daysTracked),
    daysTracked,
    topFoods,
  };
}

// ════════════════════════════════════════════════════════
// GAMIFICATION STATS FETCHERS
// ════════════════════════════════════════════════════════

export async function fetchXPTimeline(
  supabase: any, cutoff: string | null,
): Promise<XPTimelinePoint[]> {
  let q = supabase
    .from('xp_transactions')
    .select('amount, created_at')
    .order('created_at');
  if (cutoff) q = q.gte('created_at', cutoff);
  const { data } = await q;
  if (!data) return [];

  const byDay: Record<string, number> = {};
  for (const row of data) {
    const day = row.created_at.split('T')[0];
    byDay[day] = (byDay[day] ?? 0) + row.amount;
  }

  let cumulative = 0;
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, xp]) => {
      cumulative += xp;
      return { date, xp, cumulative };
    });
}

export async function fetchXPBySource(
  supabase: any, cutoff: string | null,
): Promise<XPBySource[]> {
  let q = supabase.from('xp_transactions').select('source, amount');
  if (cutoff) q = q.gte('created_at', cutoff);
  const { data } = await q;
  if (!data) return [];

  const LABELS: Record<string, string> = {
    workout: 'Séances', habit: 'Habitudes', streak_bonus: 'Bonus streak',
    level_up: 'Level up', achievement: 'Succès',
  };
  const COLORS: Record<string, string> = {
    workout: '#FF5C1A', habit: '#10B981', streak_bonus: '#F59E0B',
    level_up: '#7C3AED', achievement: '#2563EB',
  };

  const groups: Record<string, { total: number; count: number }> = {};
  for (const row of data) {
    if (!groups[row.source]) groups[row.source] = { total: 0, count: 0 };
    groups[row.source].total += row.amount;
    groups[row.source].count++;
  }

  return Object.entries(groups)
    .map(([source, g]) => ({
      source,
      label: LABELS[source] ?? source,
      total: g.total,
      count: g.count,
      color: COLORS[source] ?? '#9CA3AF',
    }))
    .sort((a, b) => b.total - a.total);
}

export async function fetchCoinFlow(
  supabase: any, cutoff: string | null,
): Promise<CoinFlow[]> {
  let q = supabase.from('coin_transactions').select('amount, created_at').order('created_at');
  if (cutoff) q = q.gte('created_at', cutoff);
  const { data } = await q;
  if (!data) return [];

  const byDay: Record<string, { earned: number; spent: number }> = {};
  for (const row of data) {
    const day = row.created_at.split('T')[0];
    if (!byDay[day]) byDay[day] = { earned: 0, spent: 0 };
    if (row.amount >= 0) byDay[day].earned += row.amount;
    else byDay[day].spent += Math.abs(row.amount);
  }

  let balance = 0;
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      balance += d.earned - d.spent;
      return { date, earned: d.earned, spent: d.spent, balance };
    });
}

export async function fetchGamificationOverview(
  supabase: any, cutoff: string | null,
): Promise<GamificationOverview> {
  const [profileRes, xpRes, coinRes, inventoryRes, levelRes] = await Promise.all([
    supabase.from('user_gamification').select('*').maybeSingle(),
    (() => { let q = supabase.from('xp_transactions').select('amount, source, created_at');
      if (cutoff) q = q.gte('created_at', cutoff); return q; })(),
    (() => { let q = supabase.from('coin_transactions').select('amount, created_at');
      if (cutoff) q = q.gte('created_at', cutoff); return q; })(),
    supabase.from('user_inventory').select('id'),
    supabase.from('level_definitions').select('title').eq('level', 1).maybeSingle(),
  ]);

  const profile = profileRes.data;
  const xpData = xpRes.data ?? [];
  const coinData = coinRes.data ?? [];

  const totalXP = profile?.xp ?? 0;
  const currentLevel = profile?.level ?? 1;
  const levelTitle = profile?.equipped_title ?? levelRes.data?.title ?? 'Débutant';
  const totalCoins = profile?.coins ?? 0;
  const coinsSpent = coinData
    .filter((c: any) => c.amount < 0)
    .reduce((s: number, c: any) => s + Math.abs(c.amount), 0);

  const activeDates = new Set(xpData.map((x: any) => x.created_at.split('T')[0]));
  const totalPurchases = coinData.filter((c: any) => c.amount < 0).length;

  return {
    totalXP,
    currentLevel,
    levelTitle,
    totalCoins,
    coinsSpent,
    currentStreak: profile?.current_streak ?? 0,
    longestStreak: profile?.longest_streak ?? 0,
    itemsOwned: inventoryRes.data?.length ?? 0,
    totalPurchases,
    daysActive: activeDates.size,
  };
}

// ════════════════════════════════════════════════════════
// AI / CONVERSATION STATS FETCHERS
// ════════════════════════════════════════════════════════

export async function fetchConversationActivity(
  supabase: any, cutoff: string | null,
): Promise<ConversationActivity[]> {
  let cq = supabase.from('ai_conversations').select('id, created_at').order('created_at');
  if (cutoff) cq = cq.gte('created_at', cutoff);
  const { data: convos } = await cq;
  if (!convos || convos.length === 0) return [];

  let mq = supabase.from('ai_messages').select('conversation_id, created_at').order('created_at');
  if (cutoff) mq = mq.gte('created_at', cutoff);
  const { data: msgs } = await mq;

  const byDay: Record<string, { conversations: Set<string>; messages: number }> = {};
  for (const c of convos) {
    const day = c.created_at.split('T')[0];
    if (!byDay[day]) byDay[day] = { conversations: new Set(), messages: 0 };
    byDay[day].conversations.add(c.id);
  }
  for (const m of (msgs ?? [])) {
    const day = m.created_at.split('T')[0];
    if (!byDay[day]) byDay[day] = { conversations: new Set(), messages: 0 };
    byDay[day].messages++;
  }

  return Object.entries(byDay)
    .map(([date, d]) => ({ date, conversations: d.conversations.size, messages: d.messages }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchAIOverview(
  supabase: any, cutoff: string | null,
): Promise<AIOverview> {
  let cq = supabase.from('ai_conversations').select('id, title, created_at');
  if (cutoff) cq = cq.gte('created_at', cutoff);
  const { data: convos } = await cq;

  let mq = supabase.from('ai_messages').select('conversation_id, role, created_at');
  if (cutoff) mq = mq.gte('created_at', cutoff);
  const { data: msgs } = await mq;

  const totalConversations = convos?.length ?? 0;
  const totalMessages = msgs?.length ?? 0;
  const userMessages = msgs?.filter((m: any) => m.role === 'user').length ?? 0;
  const assistantMessages = msgs?.filter((m: any) => m.role === 'assistant').length ?? 0;

  const avgMessagesPerConvo = totalConversations > 0
    ? Math.round((totalMessages / totalConversations) * 10) / 10
    : 0;

  // Messages per conversation for longest
  const msgCountByConvo: Record<string, number> = {};
  for (const m of (msgs ?? [])) {
    msgCountByConvo[m.conversation_id] = (msgCountByConvo[m.conversation_id] ?? 0) + 1;
  }

  let longestConversation: AIOverview['longestConversation'] = null;
  if (convos && convos.length > 0) {
    let maxCount = 0;
    for (const c of convos) {
      const cnt = msgCountByConvo[c.id] ?? 0;
      if (cnt > maxCount) {
        maxCount = cnt;
        longestConversation = { id: c.id, title: c.title ?? 'Sans titre', messageCount: cnt };
      }
    }
  }

  // Active days
  const activeDates = new Set((msgs ?? []).map((m: any) => m.created_at.split('T')[0]));

  // Avg conversations per week
  const weeks = new Set((convos ?? []).map((c: any) => {
    const d = new Date(c.created_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    return weekStart.toISOString().split('T')[0];
  }));
  const avgConvosPerWeek = weeks.size > 0
    ? Math.round((totalConversations / weeks.size) * 10) / 10
    : 0;

  return {
    totalConversations,
    totalMessages,
    userMessages,
    assistantMessages,
    avgMessagesPerConvo,
    avgConvosPerWeek,
    longestConversation,
    activeDays: activeDates.size,
  };
}

// ════════════════════════════════════════════════════════
// COMMUNITY STATS FETCHERS
// ════════════════════════════════════════════════════════

export async function fetchCommunityOverview(
  supabase: any, cutoff: string | null,
): Promise<CommunityOverview> {
  const [statsRes, friendsRes] = await Promise.all([
    supabase.from('community_user_stats').select('*').maybeSingle(),
    supabase.from('friendships').select('id').eq('status', 'accepted'),
  ]);

  const s = statsRes.data;
  const totalFriends = friendsRes.data?.length ?? 0;

  if (!s) {
    return {
      totalFriends,
      messagesSent: 0, challengesTotal: 0, challengesWon: 0,
      challengesLost: 0, challengesTied: 0,
      xpGifted: 0, xpReceived: 0, coinsGifted: 0, coinsReceived: 0,
      programsShared: 0, groupWorkoutsDone: 0,
      encouragementsSent: 0, encouragementsReceived: 0,
      invitesSent: 0, invitesAccepted: 0, reactionsSent: 0,
    };
  }

  return {
    totalFriends,
    messagesSent: s.messages_sent,
    challengesTotal: s.challenges_won + s.challenges_lost + s.challenges_tied,
    challengesWon: s.challenges_won,
    challengesLost: s.challenges_lost,
    challengesTied: s.challenges_tied,
    xpGifted: s.xp_gifted,
    xpReceived: s.xp_received,
    coinsGifted: s.coins_gifted,
    coinsReceived: s.coins_received,
    programsShared: s.programs_shared,
    groupWorkoutsDone: s.group_workouts_done,
    encouragementsSent: s.encouragements_sent,
    encouragementsReceived: s.encouragements_received,
    invitesSent: s.invites_sent,
    invitesAccepted: s.invites_accepted,
    reactionsSent: s.reactions_sent,
  };
}

export async function fetchCommunityActivity(
  supabase: any, cutoff: string | null,
): Promise<CommunityActivityPoint[]> {
  let q = supabase
    .from('community_messages')
    .select('created_at')
    .order('created_at');
  if (cutoff) q = q.gte('created_at', cutoff);
  const { data: msgs } = await q;
  if (!msgs || msgs.length === 0) return [];

  const byDay: Record<string, { messages: number; reactions: number }> = {};
  for (const m of msgs) {
    const day = m.created_at.split('T')[0];
    if (!byDay[day]) byDay[day] = { messages: 0, reactions: 0 };
    byDay[day].messages++;
  }

  // Also grab reactions
  let rq = supabase.from('screen_reactions').select('created_at').order('created_at');
  if (cutoff) rq = rq.gte('created_at', cutoff);
  const { data: reactions } = await rq;
  for (const r of (reactions ?? [])) {
    const day = r.created_at.split('T')[0];
    if (!byDay[day]) byDay[day] = { messages: 0, reactions: 0 };
    byDay[day].reactions++;
  }

  return Object.entries(byDay)
    .map(([date, d]) => ({ date, messages: d.messages, reactions: d.reactions }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
