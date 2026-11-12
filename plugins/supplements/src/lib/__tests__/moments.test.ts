import { describe, it, expect } from 'vitest';
import {
  normalizeMoments,
  toggleMoment,
  formatMoments,
  formatDose,
  defaultDose,
  stepDose,
  buildTodayGroups,
  formatProgress,
  formatDayLabel,
  intakeKey,
  type StackEntry,
} from '../moments';

const stack: StackEntry[] = [
  { id: '1', supplementId: 'vitd', name: 'Vitamine D3', dose: 1, doseUnit: 'gélule', moments: ['morning'] },
  { id: '2', supplementId: 'crea', name: 'Créatine', dose: 5, doseUnit: 'g', moments: ['noon'] },
  { id: '3', supplementId: 'mag', name: 'Magnésium', dose: 2, doseUnit: 'gélule', moments: ['morning', 'evening'] },
];

describe('moments', () => {
  it('normalise : dedupe, ordre Matin/Midi/Soir, ignore l inconnu', () => {
    expect(normalizeMoments(['evening', 'morning', 'morning', 'night', null])).toEqual(['morning', 'evening']);
    expect(normalizeMoments(null)).toEqual([]);
  });
  it('toggle multi-choix', () => {
    expect(toggleMoment([], 'evening')).toEqual(['evening']);
    expect(toggleMoment(['evening'], 'morning')).toEqual(['morning', 'evening']);
    expect(toggleMoment(['morning', 'evening'], 'morning')).toEqual(['evening']);
  });
  it('formatMoments', () => {
    expect(formatMoments(['evening', 'morning'])).toBe('Matin, Soir');
  });
});

describe('dose', () => {
  it('formatDose gere pluriel et unites invariables', () => {
    expect(formatDose(1, 'gélule')).toBe('1 gélule');
    expect(formatDose(2, 'gélule')).toBe('2 gélules');
    expect(formatDose(2, 'gélules')).toBe('2 gélules');
    expect(formatDose(1, 'gélules')).toBe('1 gélule');
    expect(formatDose(5, 'g')).toBe('5 g');
    expect(formatDose(0.5, 'mesure')).toBe('0,5 mesure');
    expect(formatDose(NaN, null)).toBe('1 dose');
    expect(formatDose(3, null)).toBe('3 doses');
  });
  it('defaultDose depuis serving_size', () => {
    expect(defaultDose('30 g')).toEqual({ dose: 30, unit: 'g' });
    expect(defaultDose('2 gélules')).toEqual({ dose: 2, unit: 'gélule' });
    expect(defaultDose('1 mesure (30 g)')).toEqual({ dose: 1, unit: 'mesure' });
    expect(defaultDose(null)).toEqual({ dose: 1, unit: 'dose' });
    expect(defaultDose('une cuillère')).toEqual({ dose: 1, unit: 'dose' });
  });
  it('stepper ne descend jamais sous un pas', () => {
    expect(stepDose(1, 'gélule', -1)).toBe(1);
    expect(stepDose(1, 'gélule', 1)).toBe(2);
    expect(stepDose(5, 'mg', 1)).toBe(10);
    expect(stepDose(5, 'mg', -1)).toBe(5);
  });
});

describe('formatDayLabel', () => {
  it('jour + date en francais', () => {
    expect(formatDayLabel(new Date(2026, 10, 12, 10))).toBe('Jeudi 12 nov.');
    expect(formatDayLabel(new Date(2026, 2, 1, 10))).toBe('Dimanche 1 mars');
  });
});

describe('Aujourd hui', () => {
  it('SU-5 : un produit a 2 moments apparait aux 2 creneaux', () => {
    const groups = buildTodayGroups(stack, new Set());
    expect(groups.map((g) => g.moment)).toEqual(['morning', 'noon', 'evening']);
    const mag = groups.flatMap((g) => g.rows).filter((r) => r.supplementId === 'mag');
    expect(mag.map((r) => r.moment)).toEqual(['morning', 'evening']);
    expect(groups[0].rows.map((r) => r.name)).toEqual(['Vitamine D3', 'Magnésium']);
    expect(groups[0].rows[0].doseLabel).toBe('1 gélule');
  });
  it('omet les moments vides', () => {
    const groups = buildTodayGroups([stack[1]], new Set());
    expect(groups.map((g) => g.moment)).toEqual(['noon']);
  });
  it('stack vide : aucun groupe, 0 sur 0', () => {
    const groups = buildTodayGroups([], new Set());
    expect(groups).toEqual([]);
    expect(formatProgress(groups)).toEqual({ taken: 0, total: 0, label: '0 sur 0 pris' });
  });
  it('progression "3 sur 5 pris"', () => {
    const taken = new Set([intakeKey('vitd', 'morning'), intakeKey('crea', 'noon'), intakeKey('mag', 'evening')]);
    const groups = buildTodayGroups(stack, taken);
    expect(formatProgress(groups)).toEqual({ taken: 3, total: 4, label: '3 sur 4 pris' });
  });
});
