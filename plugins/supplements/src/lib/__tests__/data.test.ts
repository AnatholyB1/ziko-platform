import { describe, it, expect } from 'vitest';
import {
  localDateKey,
  mapStackRow,
  validateStackInput,
  upsertStackItem,
  removeStackItem,
  fetchStack,
  fetchIntakes,
  setIntake,
  fetchReminderPrefs,
  saveReminderPref,
} from '../data';
import { fakeSupabase, callsOf } from './fakeSupabase';

describe('localDateKey', () => {
  it('jour local, pas UTC', () => {
    // 00:30 heure locale : toISOString() donnerait la veille en UTC+1/+2 ; localDateKey reste sur le jour local.
    expect(localDateKey(new Date(2026, 10, 12, 0, 30))).toBe('2026-11-12');
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('stack', () => {
  it('mapStackRow normalise les moments et la dose', () => {
    const e = mapStackRow({
      id: 's1',
      supplement_id: 'p1',
      dose: '2.00',
      dose_unit: 'gélule',
      moments: ['evening', 'morning'],
      supplement: { name: 'Magnésium', brand: { name: 'Lysa' } },
    });
    expect(e).toEqual({
      id: 's1',
      supplementId: 'p1',
      name: 'Magnésium',
      brandName: 'Lysa',
      dose: 2,
      doseUnit: 'gélule',
      moments: ['morning', 'evening'],
    });
  });

  it('validation : dose > 0 et au moins un moment', () => {
    expect(validateStackInput({ supplementId: 'p', dose: 0, doseUnit: 'g', moments: ['morning'] })).toMatch(/dose/i);
    expect(validateStackInput({ supplementId: 'p', dose: NaN, doseUnit: 'g', moments: ['morning'] })).toMatch(/dose/i);
    expect(validateStackInput({ supplementId: 'p', dose: 1, doseUnit: 'g', moments: [] })).toMatch(/moment/i);
    expect(validateStackInput({ supplementId: 'p', dose: 1, doseUnit: 'g', moments: ['morning'] })).toBeNull();
  });

  it('upsert : une ligne par (user, produit), moments normalises', async () => {
    const { client, log } = fakeSupabase(() => ({}));
    await upsertStackItem(client, 'u1', { supplementId: 'p1', dose: 2, doseUnit: 'gélule', moments: ['evening', 'morning'] });
    const up = callsOf(log[0].calls, 'upsert')[0];
    expect(log[0].table).toBe('ziko_user_supplement_stack');
    expect(up.args[0]).toEqual({ user_id: 'u1', supplement_id: 'p1', dose: 2, dose_unit: 'gélule', moments: ['morning', 'evening'] });
    expect(up.args[1]).toEqual({ onConflict: 'user_id,supplement_id' });
  });

  it('upsert refuse une entree invalide sans appeler la base', async () => {
    const { client, log } = fakeSupabase(() => ({}));
    await expect(upsertStackItem(client, 'u1', { supplementId: 'p', dose: 1, doseUnit: null, moments: [] })).rejects.toThrow();
    expect(log).toHaveLength(0);
  });

  it('remove / fetch ciblent l utilisateur', async () => {
    const a = fakeSupabase(() => ({}));
    await removeStackItem(a.client, 'u1', 'p1');
    expect(callsOf(a.log[0].calls, 'delete')).toHaveLength(1);
    expect(callsOf(a.log[0].calls, 'eq').map((c) => c.args)).toEqual([['user_id', 'u1'], ['supplement_id', 'p1']]);

    const b = fakeSupabase(() => ({ data: [] }));
    expect(await fetchStack(b.client, 'u1')).toEqual([]);
    expect(callsOf(b.log[0].calls, 'eq')[0].args).toEqual(['user_id', 'u1']);
  });
});

describe('prises', () => {
  it('fetchIntakes -> cles produit:moment', async () => {
    const { client } = fakeSupabase(() => ({ data: [{ supplement_id: 'a', moment: 'morning' }, { supplement_id: 'b', moment: 'noon' }] }));
    const set = await fetchIntakes(client, 'u1', '2026-11-12');
    expect([...set]).toEqual(['a:morning', 'b:noon']);
  });
  it('cocher = upsert idempotent, decocher = delete', async () => {
    const on = fakeSupabase(() => ({}));
    await setIntake(on.client, 'u1', 'a', 'morning', '2026-11-12', true);
    const up = callsOf(on.log[0].calls, 'upsert')[0];
    expect(up.args[0]).toMatchObject({ user_id: 'u1', supplement_id: 'a', moment: 'morning', date: '2026-11-12' });
    expect(up.args[1]).toEqual({ onConflict: 'user_id,supplement_id,moment,date' });

    const off = fakeSupabase(() => ({}));
    await setIntake(off.client, 'u1', 'a', 'morning', '2026-11-12', false);
    expect(callsOf(off.log[0].calls, 'delete')).toHaveLength(1);
    expect(callsOf(off.log[0].calls, 'eq')).toHaveLength(4);
  });
});

describe('prefs de rappel', () => {
  it('complete avec les defauts et tronque time "08:00:00"', async () => {
    const { client } = fakeSupabase(() => ({ data: [{ moment: 'morning', enabled: true, remind_time: '07:45:00' }] }));
    const prefs = await fetchReminderPrefs(client, 'u1');
    expect(prefs).toEqual([
      { moment: 'morning', enabled: true, remindTime: '07:45' },
      { moment: 'noon', enabled: false, remindTime: '13:00' },
      { moment: 'evening', enabled: false, remindTime: '21:30' },
    ]);
  });
  it('save = upsert sur (user, moment)', async () => {
    const { client, log } = fakeSupabase(() => ({}));
    await saveReminderPref(client, 'u1', { moment: 'evening', enabled: true, remindTime: '22:00' });
    const up = callsOf(log[0].calls, 'upsert')[0];
    expect(up.args[0]).toEqual({ user_id: 'u1', moment: 'evening', enabled: true, remind_time: '22:00' });
    expect(up.args[1]).toEqual({ onConflict: 'user_id,moment' });
  });
});
