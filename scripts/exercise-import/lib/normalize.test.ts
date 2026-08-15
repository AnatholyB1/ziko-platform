// Unit tests for scripts/exercise-import/lib/normalize.ts
import { describe, test, expect } from 'vitest';
import {
  normalizeExerciseName,
  similarityRatio,
  TIER2_THRESHOLD,
  groupByNormalizedName,
} from './normalize';

describe('normalizeExerciseName', () => {
  test('strips accents (combining marks) and lowercases', () => {
    const result = normalizeExerciseName('Développé couché');
    expect(result).toBe('developpe couche');
    // no combining marks remain
    expect(/[̀-ͯ]/.test(result)).toBe(false);
  });

  test('collapses case and whitespace', () => {
    expect(normalizeExerciseName('  Barbell   BENCH Press ')).toBe('barbell bench press');
  });

  test('preserves meaningful punctuation ("3/4 Sit-Up" -> "3/4 sit-up")', () => {
    expect(normalizeExerciseName('3/4 Sit-Up')).toBe('3/4 sit-up');
  });

  test('returns empty string for null/undefined input', () => {
    expect(normalizeExerciseName(null)).toBe('');
    expect(normalizeExerciseName(undefined)).toBe('');
  });
});

describe('similarityRatio', () => {
  test('returns exactly 1 for identical strings', () => {
    expect(similarityRatio('barbell squat', 'barbell squat')).toBe(1);
  });

  test('does not divide by zero for two empty strings', () => {
    const result = similarityRatio('', '');
    expect(Number.isFinite(result)).toBe(true);
  });

  test('scores a near-miss pair above TIER2_THRESHOLD', () => {
    const score = similarityRatio('barbell bench press', 'barbell bench-press');
    expect(score).toBeGreaterThanOrEqual(TIER2_THRESHOLD);
  });

  test('scores a genuinely different pair below TIER2_THRESHOLD', () => {
    const score = similarityRatio('barbell squat', 'barbell bench press');
    expect(score).toBeLessThan(TIER2_THRESHOLD);
  });
});

describe('groupByNormalizedName', () => {
  test('groups two rows whose names differ only by case/accent into one 2-element array', () => {
    const rows = [{ name: 'Développé Couché' }, { name: 'developpe couche' }];
    const groups = groupByNormalizedName(rows, (r) => r.name);
    expect(groups.size).toBe(1);
    const group = groups.get('developpe couche');
    expect(group).toBeDefined();
    expect(group!.length).toBe(2);
  });

  test('skips rows whose normalized name is empty', () => {
    const rows = [{ name: '' }, { name: null }, { name: 'Squat' }];
    const groups = groupByNormalizedName(rows, (r) => r.name);
    expect(groups.size).toBe(1);
    expect(groups.get('squat')!.length).toBe(1);
  });
});
