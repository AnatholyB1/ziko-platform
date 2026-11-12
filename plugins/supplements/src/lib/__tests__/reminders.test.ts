import { describe, it, expect } from 'vitest';
import {
  parseTime,
  formatTime,
  shiftTime,
  withDefaultPrefs,
  buildReminderSlots,
  planNotifications,
  formatProductCount,
} from '../reminders';
import type { StackEntry } from '../moments';

const stack: StackEntry[] = [
  { id: '1', supplementId: 'a', name: 'Vitamine D3', dose: 1, doseUnit: 'gélule', moments: ['morning'] },
  { id: '2', supplementId: 'b', name: 'Oméga 3', dose: 2, doseUnit: 'gélule', moments: ['morning'] },
  { id: '3', supplementId: 'c', name: 'Magnésium', dose: 2, doseUnit: 'gélule', moments: ['evening'] },
];

describe('heures', () => {
  it('parseTime / formatTime', () => {
    expect(parseTime('08:00')).toEqual({ hour: 8, minute: 0 });
    expect(parseTime('21:30:00')).toEqual({ hour: 21, minute: 30 });
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('8h')).toBeNull();
    expect(parseTime(null)).toBeNull();
    expect(formatTime(8, 5)).toBe('08:05');
  });
  it('shiftTime : pas de 15 min, bouclage minuit', () => {
    expect(shiftTime('08:00', 15)).toBe('08:15');
    expect(shiftTime('08:00', -15)).toBe('07:45');
    expect(shiftTime('23:50', 15)).toBe('00:05');
    expect(shiftTime('00:05', -15)).toBe('23:50');
    expect(shiftTime('nope', 15)).toBe('nope');
  });
});

describe('creneaux', () => {
  it('valeurs par defaut 08:00 / 13:00 / 21:30, desactives', () => {
    const prefs = withDefaultPrefs([]);
    expect(prefs.map((p) => [p.moment, p.remindTime, p.enabled])).toEqual([
      ['morning', '08:00', false],
      ['noon', '13:00', false],
      ['evening', '21:30', false],
    ]);
  });
  it('heure invalide en base : retombe sur le defaut', () => {
    const prefs = withDefaultPrefs([{ moment: 'noon', enabled: true, remindTime: 'zz' }]);
    expect(prefs[1]).toEqual({ moment: 'noon', enabled: true, remindTime: '13:00' });
  });
  it('compte les produits par creneau', () => {
    const slots = buildReminderSlots(stack, []);
    expect(slots.map((s) => s.productCount)).toEqual([2, 0, 1]);
    expect(formatProductCount(2)).toBe('2 produits');
    expect(formatProductCount(1)).toBe('1 produit');
    expect(formatProductCount(0)).toBe('Aucun produit');
  });
});

describe('planNotifications (SU-6)', () => {
  it('un rappel par creneau actif listant les produits', () => {
    const slots = buildReminderSlots(stack, [
      { moment: 'morning', enabled: true, remindTime: '08:15' },
      { moment: 'evening', enabled: true, remindTime: '21:30' },
    ]);
    const plan = planNotifications(slots);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ identifier: 'ziko-supplements-morning', hour: 8, minute: 15, body: 'Vitamine D3, Oméga 3' });
    expect(plan[1]).toMatchObject({ moment: 'evening', hour: 21, minute: 30, body: 'Magnésium' });
  });
  it('creneau sans produit = aucune notification, meme active', () => {
    const slots = buildReminderSlots(stack, [{ moment: 'noon', enabled: true, remindTime: '13:00' }]);
    expect(planNotifications(slots)).toEqual([]);
  });
  it('desactive = aucune notification', () => {
    const slots = buildReminderSlots(stack, [{ moment: 'morning', enabled: false, remindTime: '08:00' }]);
    expect(planNotifications(slots)).toEqual([]);
  });
  it('3 notifications maximum par jour', () => {
    const full: StackEntry[] = [
      { id: '1', supplementId: 'a', name: 'A', dose: 1, doseUnit: null, moments: ['morning', 'noon', 'evening'] },
    ];
    const slots = buildReminderSlots(full, [
      { moment: 'morning', enabled: true, remindTime: '08:00' },
      { moment: 'noon', enabled: true, remindTime: '13:00' },
      { moment: 'evening', enabled: true, remindTime: '21:30' },
    ]);
    expect(planNotifications(slots)).toHaveLength(3);
  });
});
