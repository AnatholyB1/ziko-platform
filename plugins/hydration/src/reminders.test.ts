import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { syncHydrationReminders, getReminderPermission, REMINDER_ID_PREFIX, type NotifModule } from './reminders';
import { __setHapticsForTest, lightImpact } from './haptics';
import { DEFAULT_SETTINGS } from './settings';

function fakeNotif(granted = true, canAskAgain = true) {
  const store = new Map<string, any>();
  const n: NotifModule = {
    getPermissionsAsync: async () => ({ granted, canAskAgain }),
    requestPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
    scheduleNotificationAsync: async (req) => { store.set(req.identifier!, req); return req.identifier!; },
    cancelScheduledNotificationAsync: async (id) => { store.delete(id); },
    getAllScheduledNotificationsAsync: async () => [...store.keys()].map((identifier) => ({ identifier })),
    SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
  };
  return { n, store };
}
const on = { ...DEFAULT_SETTINGS, remindersEnabled: true };

describe('syncHydrationReminders (HY-5)', () => {
  it('08:00-21:00 / 90 min = exactement 9 DAILY, 08:00 puis 20:00', async () => {
    const { n, store } = fakeNotif();
    expect(await syncHydrationReminders(n, on)).toBe(9);
    const all = [...store.values()].map((r) => r.trigger);
    expect(all).toHaveLength(9);
    expect(all.every((t) => t.type === 'daily')).toBe(true);
    expect(all[0]).toMatchObject({ hour: 8, minute: 0 });
    expect(all[8]).toMatchObject({ hour: 20, minute: 0 });
  });
  it('interrupteur eteint = 0 et purge les anciens', async () => {
    const { n, store } = fakeNotif();
    await syncHydrationReminders(n, on);
    expect(await syncHydrationReminders(n, { ...on, remindersEnabled: false })).toBe(0);
    expect(store.size).toBe(0);
  });
  it('re-synchroniser ne duplique pas', async () => {
    const { n, store } = fakeNotif();
    await syncHydrationReminders(n, on);
    await syncHydrationReminders(n, { ...on, reminderIntervalMin: 120 });
    expect(store.size).toBe(7);
  });
  it('objectif atteint : aucun rappel aujourd\'hui, uniques demain', async () => {
    const { n, store } = fakeNotif();
    const now = new Date(2026, 5, 10, 15, 0);
    await syncHydrationReminders(n, on, { goalReachedToday: true, now });
    const reqs = [...store.values()];
    expect(reqs).toHaveLength(9);
    expect(reqs.every((r) => r.trigger.type === 'date' && r.trigger.date > now && r.trigger.date.getDate() === 11)).toBe(true);
  });
  it('ne touche pas aux notifications des autres plugins', async () => {
    const { n, store } = fakeNotif();
    store.set('habit-1', {});
    await syncHydrationReminders(n, on);
    expect(store.has('habit-1')).toBe(true);
    expect([...store.keys()].filter((k) => k.startsWith(REMINDER_ID_PREFIX))).toHaveLength(9);
  });
});

describe('permission (HY-6)', () => {
  it('accordee', async () => expect(await getReminderPermission(fakeNotif(true).n, true)).toBe('granted'));
  it('refusee sans possibilite de redemander = denied', async () => expect(await getReminderPermission(fakeNotif(false, false).n, true)).toBe('denied'));
  it('refusee apres demande = denied', async () => expect(await getReminderPermission(fakeNotif(false, true).n, true)).toBe('denied'));
  it('lecture seule (ask=false) ne demande pas', async () => expect(await getReminderPermission(fakeNotif(false, true).n, false)).toBe('denied'));
  it('module absent = unavailable', async () => expect(await getReminderPermission(null, true)).toBe('unavailable'));
});

describe('haptique (HY-3)', () => {
  it('declenche une impulsion legere', async () => {
    const impactAsync = vi.fn().mockResolvedValue(undefined);
    __setHapticsForTest({ impactAsync, ImpactFeedbackStyle: { Light: 'light' } });
    await lightImpact();
    expect(impactAsync).toHaveBeenCalledWith('light');
    __setHapticsForTest(null);
  });
});
