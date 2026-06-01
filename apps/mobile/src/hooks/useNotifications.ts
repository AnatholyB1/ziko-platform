import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../stores/notificationStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationRow {
  id: string;
  user_id: string;
  category: 'coach' | 'workout' | 'gamification' | 'health' | 'system';
  type: string;
  title: string;
  body: string;
  data: { url?: string; [key: string]: unknown } | null;
  idempotency_key: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped';
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
}

interface NotifItem {
  id: string;
  cat: 'pr' | 'achievement' | 'coach' | 'community' | 'reminder';
  group: 'today' | 'earlier';
  icon: string; // Ionicons glyph
  tint: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  url?: string;
  action?: string;
}

// ── Mapping constants ─────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<NotificationRow['category'], string> = {
  coach: 'sparkles-outline',
  workout: 'fitness-outline',
  gamification: 'ribbon-outline',
  health: 'water-outline',
  system: 'notifications-outline',
};

const CATEGORY_TINT: Record<NotificationRow['category'], string> = {
  coach: '#7B5BD0',
  workout: '#FF5C1A',
  gamification: '#E8A33A',
  health: '#2E9E5B',
  system: '#2E7BF6',
};

const CATEGORY_CAT: Record<NotificationRow['category'], NotifItem['cat']> = {
  coach: 'coach',
  workout: 'reminder',
  gamification: 'achievement',
  health: 'reminder',
  system: 'reminder',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs} h`;
  // Check for yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notifDate = new Date(isoString);
  notifDate.setHours(0, 0, 0, 0);
  const daysDiff = Math.round((today.getTime() - notifDate.getTime()) / 86400000);
  if (daysDiff === 1) {
    const d = new Date(isoString);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `Hier · ${hh}:${mm}`;
  }
  const days = Math.floor(hrs / 24);
  return `Il y a ${days} j`;
}

function toGroup(isoString: string): 'today' | 'earlier' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notifDate = new Date(isoString);
  notifDate.setHours(0, 0, 0, 0);
  return notifDate.getTime() >= today.getTime() ? 'today' : 'earlier';
}

function mapRow(row: NotificationRow): NotifItem {
  return {
    id: row.id,
    cat: CATEGORY_CAT[row.category] ?? 'reminder',
    group: toGroup(row.created_at),
    icon: CATEGORY_ICON[row.category] ?? 'notifications-outline',
    tint: CATEGORY_TINT[row.category] ?? '#2E7BF6',
    title: row.title,
    body: row.body,
    time: toRelativeTime(row.created_at),
    unread: row.read_at === null,
    url: row.data?.url,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  const { data, isLoading } = useQuery<NotificationRow[]>({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('notification_log')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (rows ?? []) as NotificationRow[];
    },
  });

  // Sync unread count to store whenever data resolves
  const unreadCount = (data ?? []).filter((r) => r.read_at === null).length;
  if (data !== undefined) {
    setUnreadCount(unreadCount);
  }

  // ── markRead ──────────────────────────────────────────────
  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('notification_log')
        .update({ read_at: now })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  // ── markAllRead ───────────────────────────────────────────
  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('notification_log')
        .update({ read_at: now })
        .eq('user_id', userId)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      setUnreadCount(0);
    },
  });

  return {
    items: (data ?? []).map(mapRow),
    isLoading,
    unreadCount,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
  };
}
