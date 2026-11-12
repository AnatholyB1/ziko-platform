import { describe, it, expect } from 'vitest';
import {
  goalLabel, capitalizeFirst, exerciseDisplayName, formatDateFr,
  topInsetShortfall, clampFabPosition, snapFabX, tabsSideMargin, MONTHS_FR_LONG, MONTHS_FR_SHORT,
} from './displayLabels';

describe('goalLabel (XCUT-01)', () => {
  it('traduit les slugs connus', () => {
    expect(goalLabel('muscle_gain')).toBe('Prise de muscle');
    expect(goalLabel('fat_loss')).toBe('Perte de gras');
    expect(goalLabel('health')).toBe('Santé générale');
  });
  it('ne renvoie jamais un slug brut', () => {
    expect(goalLabel('some_new_goal')).toBe('Some new goal');
    expect(goalLabel('MUSCLE_GAIN')).toBe('Prise de muscle');
  });
  it('laisse un texte deja lisible', () => {
    expect(goalLabel('Prise de masse')).toBe('Prise de masse');
  });
  it('gere vide / null', () => {
    expect(goalLabel(null, 'Ajoute ton objectif')).toBe('Ajoute ton objectif');
    expect(goalLabel('  ')).toBe('');
  });
});

describe('exerciseDisplayName (XCUT-06)', () => {
  it('majuscule initiale', () => {
    expect(exerciseDisplayName('développé couché')).toBe('Développé couché');
    expect(exerciseDisplayName('élévations latérales')).toBe('Élévations latérales');
  });
  it('privilegie name_fr puis le dictionnaire', () => {
    expect(exerciseDisplayName('Bench Press', 'développé couché')).toBe('Développé couché');
    expect(exerciseDisplayName('Bench Press', null, { 'Bench Press': 'Développé couché' })).toBe('Développé couché');
    expect(exerciseDisplayName('Unknown Lift')).toBe('Unknown Lift');
  });
  it('ramene les TOUT-MAJUSCULES en casse de phrase', () => {
    expect(exerciseDisplayName('SQUAT BARRE')).toBe('Squat barre');
  });
  it('capitalizeFirst vide', () => {
    expect(capitalizeFirst(undefined)).toBe('');
  });
});

describe('formatDateFr (XCUT-02)', () => {
  const may = new Date(2026, 4, 5);
  it('ne produit jamais "May"', () => {
    expect(formatDateFr(may, { day: 'numeric', month: 'long' })).toBe('5 mai');
    expect(formatDateFr(may, { month: 'short', year: '2-digit' })).toBe('mai 26');
  });
  it('mois courts/longs', () => {
    expect(formatDateFr(new Date(2026, 10, 12), { day: 'numeric', month: 'short' })).toBe('12 nov.');
    expect(formatDateFr(new Date(2026, 10, 12), { month: 'long' })).toBe('novembre');
  });
  it('jour de semaine', () => {
    expect(formatDateFr(new Date(2026, 10, 12), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
      .toBe('jeudi 12 novembre 2026');
  });
  it('numerique par defaut et 2-digit', () => {
    expect(formatDateFr(new Date(2026, 10, 2))).toBe('2/11/2026');
    expect(formatDateFr(new Date(2026, 10, 2), { day: '2-digit', month: '2-digit' })).toBe('02/11');
  });
  it('entrees invalides -> chaine vide', () => {
    expect(formatDateFr('nope')).toBe('');
    expect(formatDateFr(null)).toBe('');
  });
  it('aucun mois en anglais dans les tables', () => {
    const en = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
    for (const m of [...MONTHS_FR_LONG, ...MONTHS_FR_SHORT]) {
      if (['mars', 'mai', 'juin'].includes(m)) continue;
      expect(m).not.toMatch(/^(may|march|june|july|august|october|december|january|february|april)/i);
    }
    expect(MONTHS_FR_LONG).toHaveLength(12);
    expect(en.test('mai')).toBe(false);
  });
});

describe('topInsetShortfall (XCUT-03)', () => {
  it('complete le manque sous la barre de statut', () => {
    expect(topInsetShortfall(0, 24)).toBe(24);
    expect(topInsetShortfall(10, 24)).toBe(14);
  });
  it('0 si deja degage (pas de double padding)', () => {
    expect(topInsetShortfall(24, 24)).toBe(0);
    expect(topInsetShortfall(80, 24)).toBe(0);
  });
  it('valeurs non finies -> 0', () => {
    expect(topInsetShortfall(NaN, 24)).toBe(0);
  });
});

describe('FAB bug (XCUT-04)', () => {
  const b = { screenW: 400, screenH: 800, size: 42, insetTop: 24, insetBottom: 16, tabBarH: 70, gutter: 16 };
  it('reste dans la zone utile (hors barre d\'onglets et barre de statut)', () => {
    expect(clampFabPosition(-50, -50, b)).toEqual({ x: 16, y: 40 });
    const p = clampFabPosition(9999, 9999, b);
    expect(p.x).toBe(400 - 42 - 16);
    expect(p.y).toBe(800 - 42 - 16 - 70 - 16);
  });
  it('s\'accroche au bord le plus proche', () => {
    expect(snapFabX(30, b)).toBe(16);
    expect(snapFabX(300, b)).toBe(342);
  });
});

describe('tabsSideMargin (XCUT-05)', () => {
  it('ajoute la gouttiere 16 quand la barre touche les bords', () => {
    expect(tabsSideMargin(400, 400)).toBe(16);
    expect(tabsSideMargin(390, 400)).toBe(16);
  });
  it('0 quand le parent a deja des marges (pas de double marge)', () => {
    expect(tabsSideMargin(368, 400)).toBe(0);
  });
  it('entrees invalides -> 0', () => {
    expect(tabsSideMargin(NaN, 400)).toBe(0);
  });
});
