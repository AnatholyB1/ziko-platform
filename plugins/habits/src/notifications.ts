import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Habit } from './store';

// Handle incoming notifications while app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
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
  try {
    const [h, m] = habit.reminder_time.split(':').map(Number);
    // Cancel any existing notification for this habit first
    await cancelHabitReminder(habit.id);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${habit.emoji} ${habit.name}`,
        body: `${agentName} here — don't forget your ${habit.name.toLowerCase()} today! 💪`,
        data: { habitId: habit.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: h,
        minute: m,
      } as any,
    });
  } catch (e) {
    console.warn('[Habits] scheduleHabitReminder failed:', e);
  }
}

export async function cancelHabitReminder(habitId: string): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.content.data?.habitId === habitId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
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
