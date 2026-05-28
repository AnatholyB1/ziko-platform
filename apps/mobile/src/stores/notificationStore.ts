import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';

interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  syncUnreadCount: (userId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => {
    set({ unreadCount: count });
    Notifications.setBadgeCountAsync(count); // fire-and-forget
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
    Notifications.setBadgeCountAsync(count ?? 0); // fire-and-forget
  },
}));
