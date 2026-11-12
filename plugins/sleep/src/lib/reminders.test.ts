import { describe, it, expect } from 'vitest';
import { syncBedtimeReminder, SLEEP_REMINDER_ID, type NotifModule } from './reminders';

function fake() {
  const store = new Map<string, any>();
  const n: NotifModule = {
    scheduleNotificationAsync: async (req) => { store.set(req.identifier!, req); return req.identifier!; },
    cancelScheduledNotificationAsync: async (id) => { store.delete(id); },
    getAllScheduledNotificationsAsync: async () => [...store.keys()].map((identifier) => ({ identifier })),
    SchedulableTriggerInputTypes: { DAILY: 'daily' },
  };
  return { n, store };
}

describe('rappel du coucher (D-10, SL-5)', () => {
  it('allume : un declencheur DAILY a l\'heure choisie', async () => {
    const { n, store } = fake();
    expect(await syncBedtimeReminder(n, true, '22:30')).toBe(1);
    expect(store.get(SLEEP_REMINDER_ID).trigger).toEqual({ type: 'daily', hour: 22, minute: 30 });
  });
  it('changer l\'heure remplace sans dupliquer', async () => {
    const { n, store } = fake();
    await syncBedtimeReminder(n, true, '22:30');
    await syncBedtimeReminder(n, true, '21:45');
    expect(store.size).toBe(1);
    expect(store.get(SLEEP_REMINDER_ID).trigger).toMatchObject({ hour: 21, minute: 45 });
  });
  it('eteint ou heure invalide : 0 notification', async () => {
    const { n, store } = fake();
    await syncBedtimeReminder(n, true, '22:30');
    expect(await syncBedtimeReminder(n, false, '22:30')).toBe(0);
    expect(store.size).toBe(0);
    expect(await syncBedtimeReminder(n, true, 'xx')).toBe(0);
  });
  it('ne touche pas aux notifications des autres plugins', async () => {
    const { n, store } = fake();
    store.set('hydration-reminder-0', {});
    await syncBedtimeReminder(n, true, '22:30');
    expect(store.has('hydration-reminder-0')).toBe(true);
  });
});
