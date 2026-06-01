import { describe, it, expect } from 'vitest';
import {
  estimate1RM,
  buildSBDData,
  buildRPEData,
  buildTonnageData,
  buildIntensityData,
} from '@/lib/dashboard/powerlifting';

// Helper to build a minimal RawRow-like object
function makeRow(overrides: {
  weight_kg: number;
  reps: number;
  rpe?: number | null;
  started_at?: string;
  exercise_name?: string;
  session_id?: string;
}) {
  return {
    weight_kg: overrides.weight_kg,
    reps: overrides.reps,
    rpe: overrides.rpe ?? null,
    workout_sessions: {
      id: overrides.session_id ?? 'sess-1',
      started_at: overrides.started_at ?? '2024-01-15T10:00:00Z',
      user_id: 'user-1',
    },
    exercises: {
      name: overrides.exercise_name ?? 'Squat',
    },
  };
}

describe('estimate1RM', () => {
  it('returns weight unchanged when reps === 1', () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it('applies Epley formula for reps > 1', () => {
    // 100 * (1 + 10/30) = 133.333...
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1);
  });

  it('80kg x 5 reps -> 93.33', () => {
    // 80 * (1 + 5/30) = 93.333...
    expect(estimate1RM(80, 5)).toBeCloseTo(93.33, 1);
  });

  it('100kg x 5 reps -> 116.67', () => {
    // 100 * (1 + 5/30) = 116.666...
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 1);
  });
});

describe('buildSBDData', () => {
  it('returns one entry per date with max estimated 1RM when two rows same date/lift', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, exercise_name: 'Squat', started_at: '2024-01-15T10:00:00Z' }),
      makeRow({ weight_kg: 120, reps: 3, exercise_name: 'Squat', started_at: '2024-01-15T10:00:00Z' }),
    ];
    const result = buildSBDData(rows);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    // max of estimate1RM(100,5)~=116.67 vs estimate1RM(120,3)~=132 -> 132
    expect(result[0].squat).toBeGreaterThan(130);
  });

  it('builds SBDDataPoint with squat/bench/deadlift for rows on same date', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, exercise_name: 'Squat', started_at: '2024-01-15T10:00:00Z' }),
      makeRow({ weight_kg: 80, reps: 5, exercise_name: 'Bench Press', started_at: '2024-01-15T10:00:00Z' }),
      makeRow({ weight_kg: 140, reps: 3, exercise_name: 'Deadlift', started_at: '2024-01-15T10:00:00Z' }),
    ];
    const result = buildSBDData(rows);
    expect(result[0].squat).toBeDefined();
    expect(result[0].bench).toBeDefined();
    expect(result[0].deadlift).toBeDefined();
  });

  it('omits lift field when no matching rows exist for that lift', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, exercise_name: 'Squat', started_at: '2024-01-15T10:00:00Z' }),
    ];
    const result = buildSBDData(rows);
    expect(result[0].squat).toBeDefined();
    expect(result[0].bench).toBeUndefined();
    expect(result[0].deadlift).toBeUndefined();
  });

  it('separates entries by date', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, exercise_name: 'Squat', started_at: '2024-01-15T10:00:00Z' }),
      makeRow({ weight_kg: 110, reps: 5, exercise_name: 'Squat', started_at: '2024-01-22T10:00:00Z' }),
    ];
    const result = buildSBDData(rows);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[1].date).toBe('2024-01-22');
  });
});

describe('buildRPEData', () => {
  it('averages RPE values for same session date', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, rpe: 7, started_at: '2024-01-15T10:00:00Z' }),
      makeRow({ weight_kg: 100, reps: 5, rpe: 8, started_at: '2024-01-15T10:00:00Z' }),
      makeRow({ weight_kg: 100, reps: 5, rpe: 9, started_at: '2024-01-15T10:00:00Z' }),
    ];
    const result = buildRPEData(rows);
    expect(result).toHaveLength(1);
    expect(result[0].rpe).toBeCloseTo(8, 1);
  });

  it('excludes rows with null rpe', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, rpe: null, started_at: '2024-01-15T10:00:00Z' }),
      makeRow({ weight_kg: 100, reps: 5, rpe: 8, started_at: '2024-01-15T10:00:00Z' }),
    ];
    const result = buildRPEData(rows);
    expect(result[0].rpe).toBe(8);
  });

  it('returns empty array when all rows have null rpe', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, rpe: null, started_at: '2024-01-15T10:00:00Z' }),
    ];
    const result = buildRPEData(rows);
    expect(result).toHaveLength(0);
  });
});

describe('buildTonnageData', () => {
  it('sums weight_kg x reps per ISO week', () => {
    // Two rows in same week
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, started_at: '2024-01-15T10:00:00Z' }), // Monday week 3
      makeRow({ weight_kg: 80, reps: 3, started_at: '2024-01-17T10:00:00Z' }),  // Wednesday same week
    ];
    const result = buildTonnageData(rows);
    expect(result).toHaveLength(1);
    // 100*5 + 80*3 = 500 + 240 = 740
    expect(result[0].tonnage).toBe(740);
  });

  it('creates separate entries for different ISO weeks', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, started_at: '2024-01-08T10:00:00Z' }), // week 2
      makeRow({ weight_kg: 100, reps: 5, started_at: '2024-01-15T10:00:00Z' }), // week 3
    ];
    const result = buildTonnageData(rows);
    expect(result).toHaveLength(2);
  });

  it('labels weeks sequentially as Sem. 1, Sem. 2, ...', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, started_at: '2024-01-08T10:00:00Z' }),
      makeRow({ weight_kg: 100, reps: 5, started_at: '2024-01-15T10:00:00Z' }),
    ];
    const result = buildTonnageData(rows);
    expect(result[0].week).toBe('Sem. 1');
    expect(result[1].week).toBe('Sem. 2');
  });
});

describe('buildIntensityData', () => {
  it('computes intensity as (avgWeight / estimate1RM(avgWeight, avgReps)) * 100', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, started_at: '2024-01-15T10:00:00Z' }),
    ];
    const result = buildIntensityData(rows);
    // intensity = (100 / estimate1RM(100, 5)) * 100 = (100 / 116.67) * 100 ~= 85.7
    expect(result[0].intensity).toBeCloseTo(85.7, 0);
  });

  it('averages weights and reps across sets in same session before computing intensity', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, started_at: '2024-01-15T10:00:00Z' }),
      makeRow({ weight_kg: 80, reps: 3, started_at: '2024-01-15T10:00:00Z' }),
    ];
    const result = buildIntensityData(rows);
    // avgWeight = 90, avgReps = round(4) = 4
    // intensity = (90 / estimate1RM(90, 4)) * 100 = (90 / (90*(1+4/30))) * 100 = 1/(1+4/30)*100 ~= 88.2
    expect(result).toHaveLength(1);
    expect(result[0].intensity).toBeGreaterThan(80);
    expect(result[0].intensity).toBeLessThan(100);
  });

  it('returns separate entries for different dates', () => {
    const rows = [
      makeRow({ weight_kg: 100, reps: 5, started_at: '2024-01-15T10:00:00Z' }),
      makeRow({ weight_kg: 100, reps: 5, started_at: '2024-01-22T10:00:00Z' }),
    ];
    const result = buildIntensityData(rows);
    expect(result).toHaveLength(2);
  });
});
