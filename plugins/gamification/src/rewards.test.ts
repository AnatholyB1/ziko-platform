import { describe, it, expect } from 'vitest';
import { isMaxLevel, levelCaption, historyLabel } from './rewards';

const levels = [1, 2, 3, 4, 5].map((level) => ({ level }));

describe('isMaxLevel / levelCaption (UAT run2 P12)', () => {
  it('niveau 3 sur 5 : pas "maximum"', () => {
    const isMax = isMaxLevel(3, levels, 4);
    expect(isMax).toBe(false);
    expect(levelCaption({ nextLevel: 4, xpToNext: 120, isMax })).toBe('120 XP pour le niveau 4');
  });
  it('catalogue vide (illisible) : jamais "maximum", libelle neutre', () => {
    const isMax = isMaxLevel(3, [], null);
    expect(isMax).toBe(false);
    expect(levelCaption({ nextLevel: null, xpToNext: 0, isMax })).not.toMatch(/maximum/i);
  });
  it('vrai dernier niveau : "maximum"', () => {
    const isMax = isMaxLevel(5, levels, null);
    expect(isMax).toBe(true);
    expect(levelCaption({ nextLevel: null, xpToNext: 0, isMax })).toBe('Niveau maximum atteint');
  });
  it('pas de niveau suivant mais niveau joueur sous le max du catalogue : pas "maximum"', () => {
    expect(isMaxLevel(3, levels, null)).toBe(false);
  });
});

describe('historyLabel nettoie les emoji herites', () => {
  it('retire l\'emoji de tete', () => {
    expect(historyLabel({ source: 'purchase', description: '\u{1F6D2} Achat : Banniere' })).toBe('Achat : Banniere');
  });
});
