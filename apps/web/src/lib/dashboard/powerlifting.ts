import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SBDDataPoint {
  date: string;
  squat?: number;
  bench?: number;
  deadlift?: number;
}

export interface RPEDataPoint {
  date: string;
  rpe: number;
}

export interface TonnageDataPoint {
  week: string;
  tonnage: number;
}

export interface IntensityDataPoint {
  date: string;
  intensity: number;
}

export interface PowerliftingData {
  sbd: SBDDataPoint[];
  rpe: RPEDataPoint[];
  tonnage: TonnageDataPoint[];
  intensity: IntensityDataPoint[];
}

interface RawRow {
  weight_kg: number;
  reps: number;
  rpe: number | null;
  workout_sessions: {
    id: string;
    started_at: string;
    user_id: string;
  };
  exercises: {
    name: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGE_DAYS: Record<'week' | 'month' | '3m', number> = {
  week: 7,
  month: 30,
  '3m': 90,
};

export const SBD_KEYWORDS = {
  squat: ['squat', 'back squat', 'front squat', 'low bar squat'],
  bench: ['bench', 'bench press', 'développé couché'],
  deadlift: ['deadlift', 'soulevé de terre', 'romanian deadlift', 'rdl'],
};

// ─── Utilities ────────────────────────────────────────────────────────────────

export function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

function matchesLift(name: string, lift: 'squat' | 'bench' | 'deadlift'): boolean {
  const lower = name.toLowerCase();
  return SBD_KEYWORDS[lift].some((kw) => lower.includes(kw));
}

function dateLabel(isoString: string): string {
  return isoString.slice(0, 10);
}

function getISOWeekMonday(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

// ─── Transform functions ──────────────────────────────────────────────────────

export function buildSBDData(rows: RawRow[]): SBDDataPoint[] {
  const byDate = new Map<string, { squat?: number; bench?: number; deadlift?: number }>();

  for (const row of rows) {
    const date = dateLabel(row.workout_sessions.started_at);
    const e1rm = estimate1RM(row.weight_kg, row.reps);
    const entry = byDate.get(date) ?? {};

    for (const lift of ['squat', 'bench', 'deadlift'] as const) {
      if (matchesLift(row.exercises.name, lift)) {
        const current = entry[lift] ?? 0;
        entry[lift] = Math.max(current, e1rm);
      }
    }

    byDate.set(date, entry);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entry]) => ({ date, ...entry }));
}

export function buildRPEData(rows: RawRow[]): RPEDataPoint[] {
  const byDate = new Map<string, { sum: number; count: number }>();

  for (const row of rows) {
    if (row.rpe === null) continue;
    const date = dateLabel(row.workout_sessions.started_at);
    const entry = byDate.get(date) ?? { sum: 0, count: 0 };
    entry.sum += row.rpe;
    entry.count += 1;
    byDate.set(date, entry);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date,
      rpe: Math.round((sum / count) * 10) / 10,
    }));
}

export function buildTonnageData(rows: RawRow[]): TonnageDataPoint[] {
  const byWeek = new Map<string, number>();

  for (const row of rows) {
    const weekKey = getISOWeekMonday(row.workout_sessions.started_at);
    const current = byWeek.get(weekKey) ?? 0;
    byWeek.set(weekKey, current + row.weight_kg * row.reps);
  }

  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, tonnage], i) => ({
      week: `Sem. ${i + 1}`,
      tonnage,
    }));
}

export function buildIntensityData(rows: RawRow[]): IntensityDataPoint[] {
  const byDate = new Map<string, { weights: number[]; reps: number[] }>();

  for (const row of rows) {
    const date = dateLabel(row.workout_sessions.started_at);
    const entry = byDate.get(date) ?? { weights: [], reps: [] };
    entry.weights.push(row.weight_kg);
    entry.reps.push(row.reps);
    byDate.set(date, entry);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { weights, reps }]) => {
      const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
      const avgReps = Math.round(reps.reduce((a, b) => a + b, 0) / reps.length);
      const intensity = (avgWeight / estimate1RM(avgWeight, avgReps)) * 100;
      return {
        date,
        intensity: Math.round(intensity * 10) / 10,
      };
    });
}

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function fetchPowerliftingData(
  supabase: SupabaseClient,
  clientId: string,
  dateRange: 'week' | 'month' | '3m'
): Promise<PowerliftingData> {
  const days = DATE_RANGE_DAYS[dateRange];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from('session_sets')
    .select(`
      weight_kg,
      reps,
      rpe,
      workout_sessions!inner ( id, started_at, user_id ),
      exercises!inner ( name )
    `)
    .eq('workout_sessions.user_id', clientId)
    .gte('workout_sessions.started_at', cutoffDate.toISOString())
    .not('weight_kg', 'is', null)
    .not('reps', 'is', null);

  if (error) throw new Error(error.message);

  const rows = data as unknown as RawRow[];

  return {
    sbd: buildSBDData(rows),
    rpe: buildRPEData(rows),
    tonnage: buildTonnageData(rows),
    intensity: buildIntensityData(rows),
  };
}
