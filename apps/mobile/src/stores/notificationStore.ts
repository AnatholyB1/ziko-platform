import { create } from 'zustand';
import type * as NotificationsType from 'expo-notifications';
import { supabase } from '../lib/supabase';

// Lazy load expo-notifications to avoid crashing when ExpoTopicSubscriptionModule
// native module is not linked (Expo Go on Android, SDK 54+).
function N(): typeof NotificationsType | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
}

interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  syncUnreadCount: (userId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => {
    set({ unreadCount: count });
    N()?.setBadgeCountAsync(count); // fire-and-forget
  },
  syncUnreadCount: async (userId) => {
    const { count, error } = await supabase
      .from('notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) {
      console.warn('[notificationStore] syncUnreadCount error:', error.message);
      return;
    }
    set({ unreadCount: count ?? 0 });
    N()?.setBadgeCountAsync(count ?? 0); // fire-and-forget
  },
}));
