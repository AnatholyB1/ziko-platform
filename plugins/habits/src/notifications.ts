import { Platform } from 'react-native';
import type * as NotificationsType from 'expo-notifications';
import type { Habit } from './store';

// expo-notifications v56+ requires ExpoTopicSubscriptionModule native module.
// This module may not be present in Expo Go or older dev builds.
// NEVER call N() at module load time — only call inside exported functions at runtime.
function N(): typeof NotificationsType | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
}

// Lazy one-time notification handler setup (called at runtime, not module load time).
let _handlerSet = false;
function ensureHandler(n: typeof NotificationsType): void {
  if (_handlerSet) return;
  _handlerSet = true;
  n.setNotificationHandler({
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
  ensureHandler(n);
  try {
    const existing = await n.getPermissionsAsync() as any;
    if (existing.granted) return true;
    const result = await n.requestPermissionsAsync() as any;
    return result.granted;
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
  ensureHandler(n);
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

export async function scheduleAllReminders(
  habits: Habit[],
  agentName: string,
): Promise<void> {
  for (const habit of habits) {
    if (habit.reminder_time && habit.is_active) {
      await scheduleHabitReminder(habit, agentName);
    }
  }
}
