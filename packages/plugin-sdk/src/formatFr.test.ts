import { describe, it, expect } from 'vitest';
import { frCount, formatDecimalFr, formatLitersFr, formatKgFr, formatKcalFr } from './formatFr';

describe('formatFr (run 7 : 12.1L vs 2,0 L)', () => {
  it('litres : virgule + espace avant L', () => {
    expect(formatLitersFr(12100)).toBe('12,1 L');
    expect(formatLitersFr(2000)).toBe('2,0 L');
    expect(formatLitersFr(2500)).toBe('2,5 L');
    expect(formatLitersFr(-5)).toBe('0,0 L');
  });
  it('kg et kcal', () => {
    expect(formatKgFr(70.5)).toBe('70,5 kg');
    expect(formatKgFr(68, 1)).toBe('68,0 kg');
    expect(formatKcalFr(489.6)).toBe('490 kcal');
  });
  it('decimale sans zeros inutiles', () => {
    expect(formatDecimalFr(2, 1, true)).toBe('2');
    expect(formatDecimalFr(2.5, 1, true)).toBe('2,5');
    expect(formatDecimalFr(NaN)).toBe('0');
  });
  it('pluriel : 0 et 1 au singulier', () => {
    expect(frCount(1, 'série')).toBe('1 série');
    expect(frCount(0, 'série')).toBe('0 série');
    expect(frCount(2, 'série')).toBe('2 séries');
    expect(frCount(1, 'jour')).toBe('1 jour');
    expect(frCount(3, 'séance', 'séances')).toBe('3 séances');
  });
});
