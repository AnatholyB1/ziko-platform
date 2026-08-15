// Unit tests for scripts/exercise-import/lib/category.ts
import { describe, it, expect } from 'vitest';
import { ALLOWED_CATEGORIES, mapDatasetCategory, collectUnmappableCategories } from './category';

// ─── ALLOWED_CATEGORIES ─────────────────────────────────────────────────────

describe('ALLOWED_CATEGORIES', () => {
  it('matches the six literal values from migration 004 exactly', () => {
    expect(ALLOWED_CATEGORIES).toEqual([
      'strength',
      'cardio',
      'flexibility',
      'balance',
      'sports',
      'stretching',
    ]);
  });
});

// ─── mapDatasetCategory ─────────────────────────────────────────────────────

describe('mapDatasetCategory', () => {
  it('maps an exact allowed value to itself', () => {
    expect(mapDatasetCategory('strength')).toBe('strength');
  });

  it('trims and lowercases before matching', () => {
    expect(mapDatasetCategory('  Strength ')).toBe('strength');
  });

  it('is case-insensitive', () => {
    expect(mapDatasetCategory('STRETCHING')).toBe('stretching');
  });

  it('returns null for an unknown value (no silent coercion to a default)', () => {
    expect(mapDatasetCategory('plyometrics')).toBeNull();
  });

  it('returns null for null', () => {
    expect(mapDatasetCategory(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(mapDatasetCategory(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(mapDatasetCategory('')).toBeNull();
  });
});

// ─── collectUnmappableCategories ────────────────────────────────────────────

describe('collectUnmappableCategories', () => {
  it('returns an empty array when all categories map', () => {
    const records = [
      { id: '0001', category: 'strength' },
      { id: '0002', category: 'Cardio' },
      { id: '0003', category: 'stretching' },
    ];
    expect(collectUnmappableCategories(records)).toEqual([]);
  });

  it('groups every unmappable raw value once, with the dataset ids that carry it, sorted deterministically', () => {
    const records = [
      { id: '0003', category: 'plyometrics' },
      { id: '0001', category: 'plyometrics' },
      { id: '0002', category: 'olympic' },
      { id: '0004', category: 'strength' }, // mappable — excluded
    ];

    const result = collectUnmappableCategories(records);

    expect(result).toEqual([
      { value: 'olympic', dataset_ids: ['0002'] },
      { value: 'plyometrics', dataset_ids: ['0001', '0003'] },
    ]);
  });
});
