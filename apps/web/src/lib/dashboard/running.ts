import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RunningPacePoint = {
  date: string;
  pace_min_per_km: number;
};

export type RunningDistanceWeekPoint = {
  week: string;
  distance_km: number;
};

export type RunningVO2MaxPoint = {
  date: string;
  vo2max: number;
};

export type RunningSessionPoint = {
  date: string;
  distance_km: number;
  activity_type: string;
};

export type RunningData = {
  paceTrend: RunningPacePoint[];
  weeklyDistance: RunningDistanceWeekPoint[];
  vo2maxTrend: RunningVO2MaxPoint[];
  sessionDistances: RunningSessionPoint[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGE_DAYS: Record<'week' | 'month' | '3m', number> = {
  week: 7,
  month: 30,
  '3m': 90,
};

// ─── Utilities ────────────────────────────────────────────────────────────────

// VO2max estimate from pace (min/km): simplified Jack Daniels approximation
// speedKmH = 60 / paceMinPerKm → speedMPerMin = speedKmH * 1000 / 60 → VO2max ≈ speedMPerMin * 0.2
function estimateVO2Max(paceMinPerKm: number): number {
  if (!paceMinPerKm || paceMinPerKm <= 0) return 0;
  const speedKmH = 60 / paceMinPerKm;
  const speedMPerMin = (speedKmH * 1000) / 60;
  return Math.round(speedMPerMin * 0.2 * 10) / 10;
}

function getISOWeekMonday(isoString: string): string {
  const date = new Date(isoString);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function fetchRunningData(
  supabase: SupabaseClient,
  clientId: string,
  dateRange: 'week' | 'month' | '3m'
): Promise<RunningData> {
  const days = DATE_RANGE_DAYS[dateRange];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from('cardio_sessions')
    .select('started_at, duration_min, distance_km, activity_type, pace, heart_rate')
    .eq('user_id', clientId)
    .in('activity_type', ['running', 'cycling', 'cardio'])
    .gte('started_at', cutoffDate.toISOString())
    .order('started_at', { ascending: true });

  if (error) {
    console.error('[running] fetch error:', error);
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    started_at: string;
    duration_min: number | null;
    distance_km: number | null;
    activity_type: string;
    pace: number | null;
    heart_rate: number | null;
  }>;

  // ─── Pace trend ────────────────────────────────────────────────────────────
  // Use pace column if set, else compute from duration_min / distance_km
  const paceTrend: RunningPacePoint[] = rows
    .map((r) => {
      let pace = r.pace ?? null;
      if (!pace && r.duration_min && r.distance_km && r.distance_km > 0) {
        pace = r.duration_min / r.distance_km;
      }
      if (!pace || pace <= 0) return null;
      return {
        date: r.started_at.slice(0, 10),
        pace_min_per_km: Math.round(pace * 100) / 100,
      };
    })
    .filter((p): p is RunningPacePoint => p !== null);

  // ─── Weekly distance ───────────────────────────────────────────────────────
  const weekMap = new Map<string, number>();
  for (const r of rows) {
    const key = getISOWeekMonday(r.started_at);
    weekMap.set(key, (weekMap.get(key) ?? 0) + (r.distance_km ?? 0));
  }
  const weeklyDistance: RunningDistanceWeekPoint[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, distance_km]) => ({
      week,
      distance_km: Math.round(distance_km * 10) / 10,
    }));

  // ─── VO2max trend ──────────────────────────────────────────────────────────
  const vo2maxTrend: RunningVO2MaxPoint[] = paceTrend
    .map((p) => ({
      date: p.date,
      vo2max: estimateVO2Max(p.pace_min_per_km),
    }))
    .filter((p) => p.vo2max > 0);

  // ─── Session distances ─────────────────────────────────────────────────────
  const sessionDistances: RunningSessionPoint[] = rows
    .filter((r) => r.distance_km != null && r.distance_km > 0)
    .map((r) => ({
      date: r.started_at.slice(0, 10),
      distance_km: r.distance_km!,
      activity_type: r.activity_type,
    }));

  return { paceTrend, weeklyDistance, vo2maxTrend, sessionDistances };
}
