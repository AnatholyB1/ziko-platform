import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { frCount, setsCompletedLabel, daysLabel, nutritionRingSub } from '../frLabels';

describe('pluriels francais (UAT run 6)', () => {
  it('1 série / 2 séries', () => {
    expect(setsCompletedLabel(1)).toBe('1 série complétée');
    expect(setsCompletedLabel(0)).toBe('0 série complétée');
    expect(setsCompletedLabel(3)).toBe('3 séries complétées');
  });
  it('1 jour / N jours', () => {
    expect(daysLabel(1)).toBe('1 jour');
    expect(daysLabel(2)).toBe('2 jours');
  });
  it('pluriel par defaut', () => {
    expect(frCount(1, 'record')).toBe('1 record');
    expect(frCount(4, 'record')).toBe('4 records');
  });
});

describe('anneau Nutrition de l accueil', () => {
  it('affiche l objectif a cote des kcal', () => {
    expect(nutritionRingSub(490, 2000)).toBe('490 / 2000 kcal');
  });
  it('rien loggue : invitation', () => {
    expect(nutritionRingSub(0, 2000)).toBe('Loggue ton repas');
  });
  it('sans objectif exploitable : kcal seules (pas de "/ 0")', () => {
    expect(nutritionRingSub(490, null)).toBe('490 kcal');
    expect(nutritionRingSub(490, 0)).toBe('490 kcal');
  });
});

describe('cablage source (garde de regression, pas de rendu natif)', () => {
  const read = (p: string) => readFileSync(resolve(__dirname, '../../../../..', p), 'utf8');
  it('ecran de fin de seance : pluriel, pas de "Highlight" anglais', () => {
    const src = read('apps/mobile/app/(app)/workout/summary.tsx');
    expect(src).toMatch(/setsCompletedLabel\(totalSets\)/);
    expect(src).not.toMatch(/>\s*Highlight\s*</);
  });
  it('accueil : badge streak pluralise, kcal avec objectif', () => {
    const src = read('apps/mobile/app/(app)/index.tsx');
    expect(src).toMatch(/daysLabel\(streak\)/);
    expect(src).not.toMatch(/\{streak\} jours/);
    expect(src).toMatch(/nutritionRingSub\(kcal, kcalGoal\)/);
  });
});
