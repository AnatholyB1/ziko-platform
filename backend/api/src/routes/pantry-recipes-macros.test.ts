import { describe, it, expect } from 'vitest';
import { DEFAULT_TARGETS, resolveTargets, resolveDate, sumMeals, remainingMacros } from './pantry-recipes-macros.js';

describe('resolveTargets', () => {
  it('reads the nutrition plugin goals', () => {
    expect(resolveTargets({ calorie_goal: 2500, protein_goal: 170, carbs_goal: 280, fat_goal: 70 })).toEqual({
      calories: 2500,
      protein_g: 170,
      carbs_g: 280,
      fat_g: 70,
    });
  });
  it('accepts the *_g aliases and numeric strings', () => {
    const t = resolveTargets({ calorie_goal: '2400', protein_goal_g: 150 });
    expect(t.calories).toBe(2400);
    expect(t.protein_g).toBe(150);
  });
  it('falls back per field on null, zero, negative, junk', () => {
    expect(resolveTargets(null)).toEqual(DEFAULT_TARGETS);
    expect(resolveTargets({ calorie_goal: 0, protein_goal: -3, carbs_goal: 'abc', fat_goal: null })).toEqual(DEFAULT_TARGETS);
    expect(resolveTargets('nope')).toEqual(DEFAULT_TARGETS);
  });
});

describe('resolveDate', () => {
  const now = new Date('2026-11-12T23:30:00Z');
  it('keeps a valid local date from the client', () => {
    expect(resolveDate('2026-11-13', now)).toBe('2026-11-13');
  });
  it('ignores malformed or impossible dates and uses UTC today', () => {
    expect(resolveDate('13/11/2026', now)).toBe('2026-11-12');
    expect(resolveDate('2026-02-31', now)).toBe('2026-11-12');
    expect(resolveDate(undefined, now)).toBe('2026-11-12');
    expect(resolveDate(42, now)).toBe('2026-11-12');
  });
});

describe('sumMeals / remainingMacros', () => {
  it('sums and subtracts, never below zero', () => {
    const consumed = sumMeals([
      { calories: '300.5', protein_g: 20, carbs_g: null, fat_g: undefined },
      { calories: 2000, protein_g: 10 },
    ]);
    expect(consumed).toEqual({ calories: 2300.5, protein_g: 30, carbs_g: 0, fat_g: 0 });
    expect(remainingMacros({ calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 }, consumed)).toEqual({
      calories: 0,
      protein_g: 120,
      carbs_g: 250,
      fat_g: 65,
    });
  });
});
