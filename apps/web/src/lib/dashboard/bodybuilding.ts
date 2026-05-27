import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MuscleVolumePoint = {
  muscle_group: string;
  sets: number;
  volume_kg: number;
};

// Progressive overload: top 3 exercises by volume, max weight per session
export type OverloadPoint = {
  date: string;
  [exerciseName: string]: number | string;
};

export type BodyweightPoint = {
  date: string;
  weight_kg: number;
};

export type BodybuildingData = {
  muscleVolume: MuscleVolumePoint[];
  progressiveOverload: OverloadPoint[];
  topExercises: string[]; // top 3 exercise names for legend
  bodyweight: BodyweightPoint[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGE_DAYS: Record<'week' | 'month' | '3m', number> = {
  week: 7,
  month: 30,
  '3m': 90,
};

// ─── Utilities ────────────────────────────────────────────────────────────────

// Map exercise names to French muscle group names (simplified heuristic)
export function inferMuscleGroup(exerciseName: string): string {
  const name = exerciseName.toLowerCase();
  if (
    name.includes('squat') ||
    name.includes('leg') ||
    name.includes('lunge') ||
    name.includes('deadlift')
  )
    return 'Jambes';
  if (
    name.includes('bench') ||
    name.includes('chest') ||
    name.includes('pec') ||
    name.includes('développé')
  )
    return 'Pectoraux';
  if (
    name.includes('row') ||
    name.includes('pull') ||
    name.includes('lat') ||
    name.includes('dos')
  )
    return 'Dos';
  if (
    name.includes('shoulder') ||
    name.includes('press') ||
    name.includes('épaule') ||
    name.includes('overhead')
  )
    return 'Épaules';
  if (name.includes('curl') || name.includes('bicep')) return 'Biceps';
  if (name.includes('tricep') || name.includes('extension') || name.includes('dip'))
    return 'Triceps';
  if (
    name.includes('core') ||
    name.includes('crunch') ||
    name.includes('plank') ||
    name.includes('abdo')
  )
    return 'Abdos';
  return 'Autre';
}

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function fetchBodybuildingData(
  supabase: SupabaseClient,
  clientId: string,
  dateRange: 'week' | 'month' | '3m'
): Promise<BodybuildingData> {
  const days = DATE_RANGE_DAYS[dateRange];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const [setsResult, bodyweightResult] = await Promise.all([
    supabase
      .from('session_sets')
      .select(`
        weight_kg,
        reps,
        workout_sessions!inner (
          started_at,
          user_id
        ),
        exercises!inner (
          name,
          muscle_groups
        )
      `)
      .eq('workout_sessions.user_id', clientId)
      .gte('workout_sessions.started_at', cutoffDate.toISOString())
      .not('weight_kg', 'is', null)
      .not('reps', 'is', null),
    supabase
      .from('body_measurements')
      .select('measured_at, weight_kg')
      .eq('user_id', clientId)
      .gte('measured_at', cutoffDate.toISOString())
      .not('weight_kg', 'is', null)
      .order('measured_at', { ascending: true }),
  ]);

  if (setsResult.error) {
    console.error('[bodybuilding] sets fetch error:', setsResult.error);
    throw new Error(setsResult.error.message);
  }
  if (bodyweightResult.error) {
    console.error('[bodybuilding] bodyweight fetch error:', bodyweightResult.error);
    throw new Error(bodyweightResult.error.message);
  }

  const sets = (setsResult.data ?? []) as unknown as Array<{
    weight_kg: number;
    reps: number;
    workout_sessions: { started_at: string; user_id: string };
    exercises: { name: string; muscle_groups?: string[] };
  }>;

  // ── Muscle volume: aggregate sets + volume per muscle group ──────────────

  const muscleMap = new Map<string, { sets: number; volume_kg: number }>();

  for (const s of sets) {
    const exerciseName = (s.exercises as { name: string; muscle_groups?: string[] })?.name ?? '';
    const muscleGroups = (s.exercises as { name: string; muscle_groups?: string[] })
      ?.muscle_groups;
    const group =
      muscleGroups && muscleGroups.length > 0
        ? muscleGroups[0]
        : inferMuscleGroup(exerciseName);
    const existing = muscleMap.get(group) ?? { sets: 0, volume_kg: 0 };
    muscleMap.set(group, {
      sets: existing.sets + 1,
      volume_kg: existing.volume_kg + (s.weight_kg ?? 0) * (s.reps ?? 0),
    });
  }

  const muscleVolume: MuscleVolumePoint[] = Array.from(muscleMap.entries())
    .map(([muscle_group, v]) => ({ muscle_group, ...v }))
    .sort((a, b) => b.volume_kg - a.volume_kg);

  // ── Progressive overload: top 3 exercises by total volume ────────────────

  const exerciseVolumeMap = new Map<string, number>();
  for (const s of sets) {
    const name = (s.exercises as { name: string })?.name ?? 'Unknown';
    exerciseVolumeMap.set(
      name,
      (exerciseVolumeMap.get(name) ?? 0) + (s.weight_kg ?? 0) * (s.reps ?? 0)
    );
  }
  const topExercises = Array.from(exerciseVolumeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  // Build progressive overload data points: max weight per session per top exercise
  const overloadByDate = new Map<string, Record<string, number>>();
  for (const s of sets) {
    const name = (s.exercises as { name: string })?.name ?? '';
    if (!topExercises.includes(name)) continue;
    const date =
      (s.workout_sessions as { started_at: string })?.started_at?.slice(0, 10) ?? '';
    const existing = overloadByDate.get(date) ?? {};
    if (!existing[name] || (s.weight_kg ?? 0) > existing[name]) {
      existing[name] = s.weight_kg ?? 0;
    }
    overloadByDate.set(date, existing);
  }
  const progressiveOverload: OverloadPoint[] = Array.from(overloadByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));

  // ── Bodyweight trend ──────────────────────────────────────────────────────

  const bodyweight: BodyweightPoint[] = (bodyweightResult.data ?? []).map((r) => ({
    date: (r.measured_at as string).slice(0, 10),
    weight_kg: r.weight_kg as number,
  }));

  return { muscleVolume, progressiveOverload, topExercises, bodyweight };
}
