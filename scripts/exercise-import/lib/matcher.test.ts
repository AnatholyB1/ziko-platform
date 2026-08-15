// Unit tests for scripts/exercise-import/lib/matcher.ts
import { describe, test, expect } from 'vitest';
import {
  findDuplicateNames,
  buildNameIndex,
  tier1Match,
  tier2Match,
  tier3Candidates,
  computeFieldConflicts,
  categorizeAll,
} from './matcher';
import type { DatasetExercise, ProductionExercise } from './types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeDatasetExercise(overrides: Partial<DatasetExercise> = {}): DatasetExercise {
  return {
    id: '0001',
    name: 'Barbell Squat',
    category: 'strength',
    body_part: 'upper legs',
    equipment: 'barbell',
    instructions: { en: 'Do the squat.' },
    instruction_steps: { en: ['Step 1', 'Step 2'] },
    muscle_group: 'quadriceps',
    secondary_muscles: ['glutes'],
    target: 'quadriceps',
    media_id: 'm0001',
    image: 'images/0001.jpg',
    gif_url: 'videos/0001.gif',
    attribution: 'Gym visual',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProductionExercise(overrides: Partial<ProductionExercise> = {}): ProductionExercise {
  return {
    id: 'prod-1',
    name: 'Barbell Squat',
    name_fr: null,
    category: 'strength',
    body_part: 'upper legs',
    equipment: 'barbell',
    target_muscle: 'quadriceps',
    secondary_muscles: ['glutes'],
    is_custom: false,
    ...overrides,
  };
}

// ─── findDuplicateNames ──────────────────────────────────────────────────────

describe('findDuplicateNames', () => {
  test('returns an empty array when every production name is unique', () => {
    const production = [
      makeProductionExercise({ id: 'p1', name: 'Barbell Squat' }),
      makeProductionExercise({ id: 'p2', name: 'Barbell Bench Press' }),
    ];
    expect(findDuplicateNames(production)).toEqual([]);
  });

  test('reports a group of size > 1 for two rows sharing a normalized name', () => {
    const production = [
      makeProductionExercise({ id: 'p1', name: 'Lat Pulldown' }),
      makeProductionExercise({ id: 'p2', name: 'lat  pulldown' }),
    ];
    const duplicates = findDuplicateNames(production);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].normalized_name).toBe('lat pulldown');
    expect(duplicates[0].exercise_ids.sort()).toEqual(['p1', 'p2']);
  });
});

// ─── buildNameIndex / tier1Match ─────────────────────────────────────────────

describe('tier1Match', () => {
  test('resolves via byName when the dataset name matches production name exactly', () => {
    const production = [makeProductionExercise({ id: 'p1', name: 'Overhead Press' })];
    const index = buildNameIndex(production);
    const result = tier1Match(makeDatasetExercise({ name: 'Overhead Press' }), index);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].id).toBe('p1');
    expect(result.matched_on).toBe('name');
  });

  test('falls back to byNameFr when byName yields nothing', () => {
    const production = [makeProductionExercise({ id: 'p1', name: 'Something Else', name_fr: 'Burpee' })];
    const index = buildNameIndex(production);
    const result = tier1Match(makeDatasetExercise({ name: 'Burpee' }), index);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].id).toBe('p1');
    expect(result.matched_on).toBe('name_fr');
  });

  test('returns an empty rows array when nothing matches', () => {
    const production = [makeProductionExercise({ id: 'p1', name: 'Overhead Press' })];
    const index = buildNameIndex(production);
    const result = tier1Match(makeDatasetExercise({ name: 'Totally Different' }), index);
    expect(result.rows.length).toBe(0);
  });
});

// ─── tier2Match ───────────────────────────────────────────────────────────

describe('tier2Match', () => {
  test('returns a candidate at or above the threshold, sorted descending', () => {
    const production = [makeProductionExercise({ id: 'p1', name: 'Barbell Bench-Press' })];
    const candidates = tier2Match(makeDatasetExercise({ name: 'Barbell Bench Press' }), production);
    expect(candidates.length).toBe(1);
    expect(candidates[0].exercise_id).toBe('p1');
    expect(candidates[0].tier).toBe('tier2');
  });

  test('excludes a candidate scoring below the threshold', () => {
    const production = [makeProductionExercise({ id: 'p1', name: 'Barbell Bench Press' })];
    const candidates = tier2Match(makeDatasetExercise({ name: 'Barbell Squat' }), production);
    expect(candidates.length).toBe(0);
  });
});

// ─── tier3Candidates ──────────────────────────────────────────────────────

describe('tier3Candidates', () => {
  test('produces a candidate when at least 2 of 3 attributes agree', () => {
    const production = [
      makeProductionExercise({
        id: 'p1',
        name: 'Totally Unrelated Label',
        body_part: 'chest',
        equipment: 'barbell',
        target_muscle: 'pectorals',
      }),
    ];
    const dataset = makeDatasetExercise({
      name: 'Zzyzx Nonexistent Term',
      body_part: 'chest',
      equipment: 'barbell',
      target: 'triceps', // disagrees — still 2/3 (body_part, equipment)
    });
    const candidates = tier3Candidates(dataset, production);
    expect(candidates.length).toBe(1);
    expect(candidates[0].tier).toBe('tier3');
    expect(candidates[0].matched_on).toBe('attributes');
    expect(candidates[0].score).toBeCloseTo(2 / 3);
  });

  test('produces no candidates when only 1 of 3 attributes agree', () => {
    const production = [
      makeProductionExercise({
        id: 'p1',
        name: 'Totally Unrelated Label',
        body_part: 'chest',
        equipment: 'machine',
        target_muscle: 'triceps',
      }),
    ];
    const dataset = makeDatasetExercise({
      name: 'Zzyzx Nonexistent Term',
      body_part: 'chest',
      equipment: 'barbell',
      target: 'biceps',
    });
    expect(tier3Candidates(dataset, production)).toEqual([]);
  });
});

// ─── computeFieldConflicts ────────────────────────────────────────────────

describe('computeFieldConflicts', () => {
  test('returns an empty array when all three fields agree', () => {
    const dataset = makeDatasetExercise({ body_part: 'chest', equipment: 'barbell', target: 'pectorals' });
    const production = makeProductionExercise({ body_part: 'chest', equipment: 'barbell', target_muscle: 'pectorals' });
    expect(computeFieldConflicts(dataset, production)).toEqual([]);
  });

  test('reports a plain field name when values disagree', () => {
    const dataset = makeDatasetExercise({ body_part: 'chest', equipment: 'barbell', target: 'pectorals' });
    const production = makeProductionExercise({ body_part: 'back', equipment: 'barbell', target_muscle: 'pectorals' });
    expect(computeFieldConflicts(dataset, production)).toEqual(['body_part']);
  });

  test('labels a null production value as missing-in-production, not a plain conflict', () => {
    const dataset = makeDatasetExercise({ body_part: 'chest', equipment: 'barbell', target: 'pectorals' });
    const production = makeProductionExercise({ body_part: null, equipment: 'barbell', target_muscle: 'pectorals' });
    expect(computeFieldConflicts(dataset, production)).toEqual(['body_part:missing-in-production']);
  });
});

// ─── categorizeAll ────────────────────────────────────────────────────────

describe('categorizeAll', () => {
  test('Tier 1 exact English name match categorizes as matched (tier1, matched_on name)', () => {
    const dataset = [makeDatasetExercise({ id: '0001', name: 'Overhead Press' })];
    const production = [makeProductionExercise({ id: 'p1', name: 'Overhead Press' })];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].tier).toBe('tier1');
    expect(result.matched[0].matched_on).toBe('name');
    expect(result.matched[0].exercise_id).toBe('p1');
  });

  test('Tier 1 is accent/case/whitespace insensitive', () => {
    const dataset = [makeDatasetExercise({ id: '0001', name: 'Dumbbell Curl' })];
    const production = [makeProductionExercise({ id: 'p1', name: 'dumbbell  curl' })];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].exercise_id).toBe('p1');
  });

  test('Tier 1 matches via name_fr when byName yields nothing', () => {
    const dataset = [makeDatasetExercise({ id: '0001', name: 'Burpee' })];
    const production = [makeProductionExercise({ id: 'p1', name: 'Something Else', name_fr: 'Burpee' })];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].matched_on).toBe('name_fr');
  });

  test('Tier 1 with conflicting body_part still matches (D-02) and reports the conflict', () => {
    const dataset = [makeDatasetExercise({ id: '0001', name: 'Overhead Press', body_part: 'shoulders' })];
    const production = [makeProductionExercise({ id: 'p1', name: 'Overhead Press', body_part: 'chest' })];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].field_conflicts).toContain('body_part');
  });

  test('Tier 1 collision (two production rows sharing a normalized name) is ambiguous, not matched', () => {
    const dataset = [makeDatasetExercise({ id: '0001', name: 'Lat Pulldown' })];
    const production = [
      makeProductionExercise({ id: 'p1', name: 'Lat Pulldown' }),
      makeProductionExercise({ id: 'p2', name: 'Lat Pulldown' }),
    ];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(0);
    expect(result.ambiguous.length).toBe(1);
    expect(result.ambiguous[0].candidates.length).toBe(2);
    expect(result.duplicate_production_names.length).toBeGreaterThan(0);
    expect(result.duplicate_production_names[0].normalized_name).toBe('lat pulldown');
  });

  test('Tier 2 fuzzy match (no exact match available) categorizes as matched (tier2)', () => {
    const dataset = [makeDatasetExercise({ id: '0001', name: 'Barbell Bench Press' })];
    const production = [makeProductionExercise({ id: 'p1', name: 'Barbell Bench-Press' })];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].tier).toBe('tier2');
    expect(result.matched[0].score).toBeGreaterThanOrEqual(0.87 - 1e-9);
  });

  test('Tier 2 below-threshold pair does not match', () => {
    // Attributes deliberately disagree on all 3 fields so this exercises the
    // Tier 2 threshold in isolation without an incidental Tier 3 pickup.
    const dataset = [
      makeDatasetExercise({ id: '0001', name: 'Barbell Squat', body_part: 'upper legs', equipment: 'barbell', target: 'quadriceps' }),
    ];
    const production = [
      makeProductionExercise({ id: 'p1', name: 'Barbell Bench Press', body_part: 'chest', equipment: 'machine', target_muscle: 'pectorals' }),
    ];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(0);
    expect(result.unmatched_new.length).toBe(1);
  });

  test('Tier 2 multi-candidate is ambiguous with at most 3 candidates, sorted by descending score', () => {
    const dataset = [makeDatasetExercise({ id: '0001', name: 'Seated Rear Delt Fly Machine' })];
    const production = [
      makeProductionExercise({ id: 'p1', name: 'Seated Rear Delt Fly Machines' }), // +1 char
      makeProductionExercise({ id: 'p2', name: 'Seated Rear Delt Fly Machiness' }), // +2 chars
    ];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(0);
    expect(result.ambiguous.length).toBe(1);
    const candidates = result.ambiguous[0].candidates;
    expect(candidates.length).toBeLessThanOrEqual(3);
    expect(candidates.length).toBe(2);
    expect(candidates[0].score).toBeGreaterThanOrEqual(candidates[1].score);
    expect(candidates[0].exercise_id).toBe('p1');
  });

  test('Tier 3 attribute-overlap result is ambiguous, never matched', () => {
    const dataset = [
      makeDatasetExercise({
        id: '0001',
        name: 'Zzyzx Quantum Movement',
        body_part: 'waist',
        equipment: 'resistance band',
        target: 'obliques',
      }),
    ];
    const production = [
      makeProductionExercise({
        id: 'p1',
        name: 'Totally Unrelated Label Xyz',
        body_part: 'waist',
        equipment: 'resistance band',
        target_muscle: 'obliques',
      }),
    ];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(0);
    expect(result.ambiguous.length).toBe(1);
    expect(result.ambiguous[0].reason).toContain('attribute-overlap');
    expect(result.ambiguous[0].candidates[0].tier).toBe('tier3');
  });

  test('Tier 3 with only 1 of 3 agreeing falls through to unmatched_new with no candidates', () => {
    const dataset = [
      makeDatasetExercise({
        id: '0001',
        name: 'Zzyzx Solo Agreement Move',
        body_part: 'chest',
        equipment: 'barbell',
        target: 'biceps',
      }),
    ];
    const production = [
      makeProductionExercise({
        id: 'p1',
        name: 'Totally Unrelated Label Abc',
        body_part: 'chest',
        equipment: 'machine',
        target_muscle: 'triceps',
      }),
    ];
    const result = categorizeAll(dataset, production);
    expect(result.ambiguous.length).toBe(0);
    expect(result.unmatched_new.length).toBe(1);
  });

  test('Precedence: an exact match wins over a fuzzy candidate, and the fuzzy row remains available', () => {
    const dataset = [makeDatasetExercise({ id: '0001', name: 'Barbell Bench Press' })];
    const production = [
      makeProductionExercise({ id: 'fuzzy-a', name: 'Barbell Bench-Press' }), // would fuzzy-match
      makeProductionExercise({ id: 'exact-b', name: 'Barbell Bench Press' }), // exact match wins
    ];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].exercise_id).toBe('exact-b');
    // The fuzzy row was never claimed — it surfaces as unmatched_legacy, not matched.
    expect(result.unmatched_legacy.some((row) => row.exercise_id === 'fuzzy-a')).toBe(true);
    expect(result.matched.some((row) => row.exercise_id === 'fuzzy-a')).toBe(false);
  });

  test('Consumption: a production row matched by one dataset record is not offered to a later one', () => {
    const dataset = [
      makeDatasetExercise({ id: '0001', name: 'Barbell Squat' }),
      makeDatasetExercise({ id: '0002', name: 'Barbell Squats' }), // would fuzzy-match the same row
    ];
    const production = [makeProductionExercise({ id: 'p1', name: 'Barbell Squat' })];
    const result = categorizeAll(dataset, production);
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].dataset_id).toBe('0001');
    expect(result.unmatched_new.some((row) => row.dataset_id === '0002')).toBe(true);
  });

  test('Legacy: a production row nothing matches appears exactly once in unmatched_legacy', () => {
    const dataset = [makeDatasetExercise({ id: '0001', name: 'Something Entirely Different' })];
    const production = [
      makeProductionExercise({
        id: 'p1',
        name: 'Ancient Forgotten Exercise',
        body_part: 'neck',
        equipment: 'none',
        target_muscle: 'neck',
      }),
    ];
    const result = categorizeAll(dataset, production);
    const occurrences = result.unmatched_legacy.filter((row) => row.exercise_id === 'p1');
    expect(occurrences.length).toBe(1);
  });

  test('Every ambiguous row carries human_decision === null', () => {
    const dataset = [makeDatasetExercise({ id: '0001', name: 'Lat Pulldown' })];
    const production = [
      makeProductionExercise({ id: 'p1', name: 'Lat Pulldown' }),
      makeProductionExercise({ id: 'p2', name: 'Lat Pulldown' }),
    ];
    const result = categorizeAll(dataset, production);
    expect(result.ambiguous.length).toBeGreaterThan(0);
    for (const row of result.ambiguous) {
      expect(row.human_decision).toBeNull();
    }
  });

  test('Empty inputs: categorizeAll([], []) returns all-empty arrays without throwing', () => {
    expect(() => categorizeAll([], [])).not.toThrow();
    const result = categorizeAll([], []);
    expect(result.matched).toEqual([]);
    expect(result.unmatched_new).toEqual([]);
    expect(result.unmatched_legacy).toEqual([]);
    expect(result.ambiguous).toEqual([]);
    expect(result.duplicate_production_names).toEqual([]);
  });

  test('Totals invariant + no-overlap invariant across a mixed 6-record fixture', () => {
    const dataset: DatasetExercise[] = [
      makeDatasetExercise({ id: '0001', name: 'Overhead Press', body_part: 'shoulders', equipment: 'barbell', target: 'shoulders' }), // -> tier1 matched
      makeDatasetExercise({ id: '0002', name: 'Barbell Bench Press', body_part: 'chest', equipment: 'barbell', target: 'chest' }), // -> tier2 matched
      makeDatasetExercise({ id: '0003', name: 'Lat Pulldown', body_part: 'back', equipment: 'cable', target: 'lats' }), // -> tier1 collision ambiguous
      makeDatasetExercise({ id: '0004', name: 'Seated Rear Delt Fly Machine', body_part: 'upper arms', equipment: 'machine', target: 'rear delts' }), // -> tier2 multi ambiguous
      makeDatasetExercise({ id: '0005', name: 'Zzyzx Quantum Movement', body_part: 'waist', equipment: 'resistance band', target: 'obliques' }), // -> tier3 ambiguous
      makeDatasetExercise({ id: '0006', name: 'Vortex Kinetic Drill Unmatched', body_part: 'cardio', equipment: 'none', target: 'full body' }), // -> unmatched_new
    ];

    const production: ProductionExercise[] = [
      makeProductionExercise({ id: 'prod-1', name: 'Overhead Press', body_part: 'shoulders', equipment: 'barbell', target_muscle: 'shoulders' }),
      makeProductionExercise({ id: 'prod-2', name: 'Barbell Bench-Press', body_part: 'chest', equipment: 'barbell', target_muscle: 'chest' }),
      makeProductionExercise({ id: 'prod-3a', name: 'Lat Pulldown', body_part: 'back', equipment: 'cable', target_muscle: 'lats' }),
      makeProductionExercise({ id: 'prod-3b', name: 'Lat Pulldown', body_part: 'back', equipment: 'machine', target_muscle: 'lats' }),
      makeProductionExercise({ id: 'prod-4a', name: 'Seated Rear Delt Fly Machines', body_part: 'upper arms', equipment: 'machine', target_muscle: 'rear delts' }),
      makeProductionExercise({ id: 'prod-4b', name: 'Seated Rear Delt Fly Machiness', body_part: 'upper arms', equipment: 'machine', target_muscle: 'rear delts' }),
      makeProductionExercise({ id: 'prod-5', name: 'Totally Unrelated Label Xyz', body_part: 'waist', equipment: 'resistance band', target_muscle: 'obliques' }),
      makeProductionExercise({ id: 'prod-6', name: 'Ancient Forgotten Exercise', body_part: 'neck', equipment: 'none', target_muscle: 'neck' }),
    ];

    const result = categorizeAll(dataset, production);

    // Totals invariant
    expect(result.matched.length + result.unmatched_new.length + result.ambiguous.length).toBe(dataset.length);

    // Sanity on the breakdown this fixture was designed to produce.
    expect(result.matched.length).toBe(2);
    expect(result.ambiguous.length).toBe(3);
    expect(result.unmatched_new.length).toBe(1);

    // No-overlap invariant: no production id appears in both matched and unmatched_legacy.
    const matchedIds = new Set(result.matched.map((row) => row.exercise_id));
    const legacyIds = new Set(result.unmatched_legacy.map((row) => row.exercise_id));
    for (const id of matchedIds) {
      expect(legacyIds.has(id)).toBe(false);
    }
    // prod-6 was never referenced by any dataset row — it must show up as legacy.
    expect(legacyIds.has('prod-6')).toBe(true);
  });
});
