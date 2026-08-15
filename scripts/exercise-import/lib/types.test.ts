// Unit tests for scripts/exercise-import/lib/types.ts
// Framework: vitest (backend/api/src/coach/dashboards/tools.test.ts convention —
// describe/test/expect, fixture consts at the top, ZodError rejection assertions)
import { describe, test, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  DatasetExerciseSchema,
  MatchReportSchema,
  PHASE3_STATUS_HINT,
} from './types';

// ─── Fixtures ────────────────────────────────────────────────────────────

// Real shape verified live against exercises.schema.json ($defs.exercise).
const VALID_DATASET_RECORD = {
  id: '0001',
  name: '3/4 Sit-Up',
  category: 'strength',
  body_part: 'waist',
  equipment: 'body weight',
  instructions: {
    en: 'Lie on your back...',
    fr: 'Allongez-vous sur le dos...',
  },
  instruction_steps: {
    en: ['Lie on your back with knees bent.', 'Curl up partway.'],
    fr: ['Allongez-vous sur le dos, genoux plies.', 'Enroulez-vous partiellement.'],
  },
  muscle_group: 'abdominals',
  secondary_muscles: ['hip flexors'],
  target: 'abs',
  media_id: '0001',
  image: 'images/0001.jpg',
  gif_url: 'videos/0001.gif',
  attribution: 'Gym visual',
  created_at: '2026-01-01T00:00:00.000Z',
};

const VALID_MATCH_REPORT = {
  generated_at: '2026-08-15T00:00:00.000Z',
  dataset_commit: 'abc1234',
  dataset_count: 1324,
  production_count: 1318,
  thresholds: { tier2: 0.87 },
  warnings: { duplicate_production_names: [] },
  counts: { matched: 0, unmatched_new: 0, unmatched_legacy: 0, ambiguous: 0 },
  matched: [],
  unmatched_new: [],
  unmatched_legacy: [],
  ambiguous: [],
};

// ─── DatasetExerciseSchema ─────────────────────────────────────────────────

describe('DatasetExerciseSchema', () => {
  test('(a) parses a valid dataset record', () => {
    expect(() => DatasetExerciseSchema.parse(VALID_DATASET_RECORD)).not.toThrow();
  });

  test('(b) tolerates an unknown extra field (external tolerance)', () => {
    const withExtra = { ...VALID_DATASET_RECORD, some_future_field: 'benign' };
    expect(() => DatasetExerciseSchema.parse(withExtra)).not.toThrow();
    const parsed = DatasetExerciseSchema.parse(withExtra) as Record<string, unknown>;
    expect(parsed.some_future_field).toBeUndefined(); // stripped, not rejected
  });

  test('(c) throws ZodError when instruction_steps is missing', () => {
    const { instruction_steps, ...missing } = VALID_DATASET_RECORD;
    expect(() => DatasetExerciseSchema.parse(missing)).toThrow(ZodError);
  });

  test('(d) throws when image points into videos/ (wrong-directory path rejected by regex)', () => {
    expect(() =>
      DatasetExerciseSchema.parse({ ...VALID_DATASET_RECORD, image: 'videos/x.gif' }),
    ).toThrow(ZodError);
  });

  test('(e) throws when image is a path-traversal payload', () => {
    expect(() =>
      DatasetExerciseSchema.parse({ ...VALID_DATASET_RECORD, image: '../../etc/passwd' }),
    ).toThrow(ZodError);
  });

  test('(f) throws when id is not a 4-digit string', () => {
    expect(() =>
      DatasetExerciseSchema.parse({ ...VALID_DATASET_RECORD, id: '12' }),
    ).toThrow(ZodError);
  });
});

// ─── MatchReportSchema (internal — strict) ─────────────────────────────────

describe('MatchReportSchema', () => {
  test('parses a valid report', () => {
    expect(() => MatchReportSchema.parse(VALID_MATCH_REPORT)).not.toThrow();
  });

  test('(g) throws ZodError on an unknown top-level key (internal strictness)', () => {
    const withExtra = { ...VALID_MATCH_REPORT, unexpected_field: 'nope' };
    expect(() => MatchReportSchema.parse(withExtra)).toThrow(ZodError);
  });
});

// ─── PHASE3_STATUS_HINT ─────────────────────────────────────────────────────

describe('PHASE3_STATUS_HINT', () => {
  test('(h) has exactly the four category keys, each mapping to a Phase 1 enum value', () => {
    const keys = Object.keys(PHASE3_STATUS_HINT).sort();
    expect(keys).toEqual(['ambiguous', 'matched', 'unmatched_legacy', 'unmatched_new'].sort());

    const PHASE1_ENUM = ['matched', 'inserted', 'skipped', 'needs_review'];
    for (const value of Object.values(PHASE3_STATUS_HINT)) {
      expect(PHASE1_ENUM).toContain(value);
    }
  });

  test('unmatched_new maps to inserted and ambiguous maps to needs_review', () => {
    expect(PHASE3_STATUS_HINT.unmatched_new).toBe('inserted');
    expect(PHASE3_STATUS_HINT.ambiguous).toBe('needs_review');
  });
});
