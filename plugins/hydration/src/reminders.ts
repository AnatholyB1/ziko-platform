/**
 * Rappels d'hydratation (notifications locales planifiees).
 * Le module expo-notifications est injecte (`NotifModule`) : tests sans RN, et chargement
 * paresseux en prod (jamais au chargement du module, cf. plugins/habits/src/notifications.ts).
 */
import { Platform } from 'react-native';
import { computeReminderTimes, type HydrationSettings } from './settings';

export const REMINDER_ID_PREFIX = 'hydration-reminder-';

/** Sous-ensemble d'expo-notifications utilise ici. */
export interface NotifModule {
  getPermissionsAsync(): Promise<{ granted: boolean; canAskAgain?: boolean }>;
  requestPermissionsAsync(): Promise<{ granted: boolean; canAskAgain?: boolean }>;
  scheduleNotificationAsync(req: {
    identifier?: string;
    content: { title: string; body: string; data?: Record<string, unknown> };
    trigger: Record<string, unknown>;
  }): Promise<string>;
  cancelScheduledNotificationAsync(id: string): Promise<void>;
  getAllScheduledNotificationsAsync(): Promise<{ identifier: string }[]>;
  SchedulableTriggerInputTypes: { DAILY: string; DATE: string };
}

export function loadNotifModule(): NotifModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotifModule;
  } catch {
    return null;
  }
}

/** 'undetermined' : pas encore accordee ni definitivement refusee (on peut encore demander). */
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function getReminderPermission(n: NotifModule | null, ask: boolean): Promise<PermissionState> {
  if (!n) return 'unavailable';
  try {
    const cur = await n.getPermissionsAsync();
    if (cur.granted) return 'granted';
    if (cur.canAskAgain === false) return 'denied';
    if (!ask) return 'undetermined';
    const res = await n.requestPermissionsAsync();
    return res.granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export async function cancelHydrationReminders(n: NotifModule): Promise<void> {
  const all = await n.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((x) => x.identifier.startsWith(REMINDER_ID_PREFIX)).map((x) => n.cancelScheduledNotificationAsync(x.identifier)),
  );
}

export interface SyncOptions {
  /** Objectif du jour atteint : plus aucun rappel aujourd'hui. */
  goalReachedToday?: boolean;
  now?: Date;
}

/**
 * Remplace tous les rappels d'hydratation par ceux des reglages.
 * - eteint : 0 notification.
 * - normal : 1 declencheur DAILY par horaire (n = floor((fin - debut) / intervalle) + 1).
 * - objectif atteint : 0 rappel pour le reste du jour ; on planifie des declencheurs uniques
 *   pour DEMAIN (les DAILY sont restaures a la prochaine ouverture de l'ecran Hydratation).
 * Retourne le nombre de notifications planifiees.
 */
export async function syncHydrationReminders(n: NotifModule, s: HydrationSettings, opts: SyncOptions = {}): Promise<number> {
  await cancelHydrationReminders(n);
  if (!s.remindersEnabled) return 0;
  const times = computeReminderTimes(s);
  const now = opts.now ?? new Date();
  let count = 0;
  for (let i = 0; i < times.length; i++) {
    const hour = Math.floor(times[i] / 60);
    const minute = times[i] % 60;
    const content = { title: 'Hydratation', body: 'C\'est l\'heure de boire un verre d\'eau.', data: { type: 'hydration_reminder' } };
    if (opts.goalReachedToday) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, minute, 0, 0);
      await n.scheduleNotificationAsync({
        identifier: `${REMINDER_ID_PREFIX}next-${i}`,
        content,
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: d },
      });
    } else {
      await n.scheduleNotificationAsync({
        identifier: `${REMINDER_ID_PREFIX}${i}`,
        content,
        trigger: { type: n.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
    }
    count++;
  }
  return count;
}
