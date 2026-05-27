import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HyroxStationPoint = {
  station: string;
  time_seconds: number;
};

export type HyroxFinishPoint = {
  date: string;
  finish_time_seconds: number;
};

export type HyroxVolumePoint = {
  week: string;
  sessions: number;
  distance_km: number;
};

export type HyroxData = {
  stationSplits: HyroxStationPoint[];
  finishTimes: HyroxFinishPoint[];
  weeklyVolume: HyroxVolumePoint[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGE_DAYS: Record<'week' | 'month' | '3m', number> = {
  week: 7,
  month: 30,
  '3m': 90,
};

const HYROX_STATIONS = [
  'SkiErg',
  'Sled Push',
  'Sled Pull',
  'Burpee Broad Jump',
  'RowErg',
  'Farmers Carry',
  'Sandbag Lunges',
  'Wall Balls',
];

const STATION_WEIGHTS = [0.12, 0.15, 0.13, 0.10, 0.12, 0.10, 0.16, 0.12];

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function fetchHyroxData(
  supabase: SupabaseClient,
  clientId: string,
  dateRange: 'week' | 'month' | '3m'
): Promise<HyroxData> {
  const days = DATE_RANGE_DAYS[dateRange];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await supabase
    .from('cardio_sessions')
    .select('started_at, duration_min, distance_km, title, activity_type')
    .eq('user_id', clientId)
    .in('activity_type', ['hyrox', 'functional'])
    .gte('started_at', cutoff.toISOString())
    .order('started_at', { ascending: true });

  if (error) {
    console.error('[hyrox] fetch error:', error);
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    started_at: string;
    duration_min: number | null;
    distance_km: number | null;
    title: string | null;
    activity_type: string;
  }>;

  // Finish time trend: each session's duration as finish time proxy
  const finishTimes: HyroxFinishPoint[] = rows.map((r) => ({
    date: r.started_at.slice(0, 10),
    finish_time_seconds: (r.duration_min ?? 0) * 60,
  }));

  // Weekly volume: group by ISO week (Monday-anchored)
  const weekMap = new Map<string, { sessions: number; distance_km: number }>();
  for (const r of rows) {
    const date = new Date(r.started_at);
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const existing = weekMap.get(key) ?? { sessions: 0, distance_km: 0 };
    weekMap.set(key, {
      sessions: existing.sessions + 1,
      distance_km: existing.distance_km + (r.distance_km ?? 0),
    });
  }
  const weeklyVolume: HyroxVolumePoint[] = Array.from(weekMap.entries()).map(
    ([week, v]) => ({ week, ...v })
  );

  // Station splits: derive from Hyrox standard stations using duration proportions
  // Use most recent session's total time to estimate per-station splits
  const lastSession = rows[rows.length - 1];
  const stationSplits: HyroxStationPoint[] = lastSession
    ? HYROX_STATIONS.map((station, i) => ({
        station,
        time_seconds: Math.round((lastSession.duration_min ?? 60) * 60 * STATION_WEIGHTS[i]),
      }))
    : [];

  return { stationSplits, finishTimes, weeklyVolume };
}
