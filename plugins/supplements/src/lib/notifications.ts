// Programmation des notifications locales (expo-notifications, chargement paresseux comme plugins/habits).
// Separe de reminders.ts pour que la logique pure reste testable sans react-native.
import { Platform } from 'react-native';
import { REMINDER_DATA_KIND, REMINDER_ID_PREFIX, type PlannedNotification } from './reminders';

type NotificationsModule = typeof import('expo-notifications');

function N(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
}

export type SyncStatus = 'ok' | 'denied' | 'unavailable';

/** Cree/renouvelle les notifications du plan ; supprime les anciennes de ce plugin. */
export async function syncSupplementReminders(plan: readonly PlannedNotification[]): Promise<SyncStatus> {
  const n = N();
  if (!n) return 'unavailable';
  try {
    // Annule toutes les notifications de ce plugin (reprogrammation propre a chaque changement).
    const existing = await n.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((e) => (e.content?.data as any)?.kind === REMINDER_DATA_KIND || e.identifier?.startsWith(REMINDER_ID_PREFIX))
        .map((e) => n.cancelScheduledNotificationAsync(e.identifier)),
    );
    if (plan.length === 0) return 'ok';

    const perm = (await n.getPermissionsAsync()) as any;
    let granted = !!perm.granted;
    if (!granted) granted = !!((await n.requestPermissionsAsync()) as any).granted;
    if (!granted) return 'denied';

    for (const p of plan) {
      await n.scheduleNotificationAsync({
        identifier: p.identifier,
        content: { title: p.title, body: p.body, data: { kind: REMINDER_DATA_KIND, moment: p.moment } },
        trigger: { type: n.SchedulableTriggerInputTypes.DAILY, hour: p.hour, minute: p.minute } as any,
      });
    }
    return 'ok';
  } catch (e) {
    console.warn('[Supplements] syncSupplementReminders failed:', e);
    return 'unavailable';
  }
}

/** Notifications planifiees de ce plugin (pour la verification SU-6). */
export async function listSupplementReminders(): Promise<Array<{ identifier: string; hour: number | null; minute: number | null }>> {
  const n = N();
  if (!n) return [];
  try {
    const all = await n.getAllScheduledNotificationsAsync();
    return all
      .filter((e) => e.identifier?.startsWith(REMINDER_ID_PREFIX))
      .map((e) => {
        const trig = e.trigger as any;
        return { identifier: e.identifier, hour: trig?.hour ?? null, minute: trig?.minute ?? null };
      });
  } catch {
    return [];
  }
}
