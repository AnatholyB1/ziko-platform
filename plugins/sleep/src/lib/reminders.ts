/**
 * Rappel du coucher : notification locale quotidienne (D-10). Module expo-notifications injecte
 * (tests sans RN, chargement paresseux en prod). Aucun envoi serveur.
 */
import { parseHHMM } from './sleep';

export const SLEEP_REMINDER_ID = 'sleep-bedtime-reminder';

export interface NotifModule {
  scheduleNotificationAsync(req: {
    identifier?: string;
    content: { title: string; body: string; data?: Record<string, unknown> };
    trigger: Record<string, unknown>;
  }): Promise<string>;
  cancelScheduledNotificationAsync(id: string): Promise<void>;
  getAllScheduledNotificationsAsync(): Promise<{ identifier: string }[]>;
  SchedulableTriggerInputTypes: { DAILY: string };
}

export function loadNotifModule(): NotifModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotifModule;
  } catch {
    return null;
  }
}

/** Remplace le rappel : eteint ou heure invalide = 0 notification ; allume = 1 declencheur DAILY. Retourne le nombre planifie. */
export async function syncBedtimeReminder(n: NotifModule, enabled: boolean, time: string): Promise<number> {
  const all = await n.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((x) => x.identifier === SLEEP_REMINDER_ID).map((x) => n.cancelScheduledNotificationAsync(x.identifier)));
  const t = parseHHMM(time);
  if (!enabled || t == null) return 0;
  await n.scheduleNotificationAsync({
    identifier: SLEEP_REMINDER_ID,
    content: { title: 'Sommeil', body: "C'est bientôt l'heure de te coucher.", data: { type: 'sleep_reminder' } },
    trigger: { type: n.SchedulableTriggerInputTypes.DAILY, hour: Math.floor(t / 60), minute: t % 60 },
  });
  return 1;
}
