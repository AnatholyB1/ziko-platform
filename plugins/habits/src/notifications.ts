import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import type { Habit } from './store';

// expo-notifications throws at native module init time on Expo Go Android (SDK 53+).
// Use require() lazily so the native module is never loaded in that environment.
const isExpoGoAndroid =
  Constants.appOwnership === 'expo' && Platform.OS === 'android';

function N(): typeof NotificationsType | null {
  if (isExpoGoAndroid || Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
}

// Initialise the foreground notification handler once at module load,
// only when the native module is actually available.
const mod = N();
if (mod) {
  mod.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const n = N();
  if (!n) return false;
  try {
    const { status: existing } = await n.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await n.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleHabitReminder(
  habit: Habit,
  agentName: string = 'Ziko',
): Promise<void> {
  if (!habit.reminder_time) return;
  const n = N();
  if (!n) return;
  try {
    const [h, m] = habit.reminder_time.split(':').map(Number);
    await cancelHabitReminder(habit.id);
    await n.scheduleNotificationAsync({
      content: {
        title: `${habit.emoji} ${habit.name}`,
        body: `${agentName} here — don't forget your ${habit.name.toLowerCase()} today! 💪`,
        data: { habitId: habit.id },
      },
      trigger: {
        type: n.SchedulableTriggerInputTypes.DAILY,
        hour: h,
        minute: m,
      } as any,
    });
  } catch (e) {
    console.warn('[Habits] scheduleHabitReminder failed:', e);
  }
}

export async function cancelHabitReminder(habitId: string): Promise<void> {
  const n = N();
  if (!n) return;
  try {
    const all = await n.getAllScheduledNotificationsAsync();
    for (const notif of all) {
      if (notif.content.data?.habitId === habitId) {
        await n.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.warn('[Habits] cancelHabitReminder failed:', e);
  }
}

export async function schedulAllReminders(
  habits: Habit[],
  agentName: string,
): Promise<void> {
  for (const habit of habits) {
    if (habit.reminder_time && habit.is_active) {
      await scheduleHabitReminder(habit, agentName);
    }
  }
}
