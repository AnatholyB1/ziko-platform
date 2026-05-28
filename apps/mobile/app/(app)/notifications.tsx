import React, { useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { EmptyState } from '@ziko/ui';

// ── Types ─────────────────────────────────────────────────
type NotifType = 'coach_ai' | 'community' | 'records' | 'system';

interface Notification {
  id: string;
  user_id: string;
  type: NotifType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  action_url?: string | null;
}

// ── Constants ─────────────────────────────────────────────
const FILTERS = [
  { id: 'all', label: 'Tout' },
  { id: 'coach_ai', label: 'Coach IA' },
  { id: 'community', label: 'Communauté' },
  { id: 'records', label: 'Records' },
  { id: 'system', label: 'Système' },
];

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; tint: string }> = {
  coach_ai:  { icon: 'sparkles-outline',      tint: '#FF5C1A' },
  community: { icon: 'people-outline',         tint: '#7B5BD0' },
  records:   { icon: 'trophy-outline',         tint: '#F59E0B' },
  system:    { icon: 'settings-outline',       tint: '#6B6963' },
  default:   { icon: 'notifications-outline',  tint: '#2E7BF6' },
};

const SURFACE = '#FFFFFF';
const BORDER  = '#E2E0DA';
const TEXT    = '#1C1A17';
const MUTED   = '#6B6963';
const PRIMARY = '#FF5C1A';
const BG      = '#F7F6F3';

const SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

// ── Helpers ────────────────────────────────────────────────
function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Hier';
  return `Il y a ${days} j`;
}

// ── NFItem ─────────────────────────────────────────────────
interface NFItemProps {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  action_url?: string | null;
  onPress: () => void;
}

function NFItem({ id, type, title, body, read, created_at, action_url, onPress }: NFItemProps) {
  const meta = TYPE_META[type] ?? TYPE_META.default;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: SURFACE,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER,
        marginBottom: 8,
        padding: 14,
        flexDirection: 'row',
        gap: 12,
        ...SHADOW,
      }}
    >
      {/* Icon */}
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: meta.tint + '24',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Ionicons name={meta.icon} size={20} color={meta.tint} />
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT, lineHeight: 20 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 18 }} numberOfLines={2}>
          {body}
        </Text>
        <Text style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
          {relativeDate(created_at)}
        </Text>
        {action_url ? (
          <Text style={{ fontSize: 12, fontWeight: '700', color: PRIMARY, marginTop: 6 }}>
            Voir
          </Text>
        ) : null}
      </View>

      {/* Unread dot */}
      {!read ? (
        <View style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: PRIMARY, alignSelf: 'flex-start', marginTop: 3,
        }} />
      ) : null}
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState('all');

  // ── Fetch notifications ────────────────────────────────
  const { data, isLoading, isError } = useQuery<Notification[]>({
    queryKey: ['notifications', userId, activeFilter],
    queryFn: async () => {
      if (!userId) return [];
      let q = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (activeFilter !== 'all') {
        q = q.eq('type', activeFilter);
      }
      const { data: rows, error } = await q;
      if (error) throw error;
      return (rows ?? []) as Notification[];
    },
    enabled: !!userId,
  });

  // ── Mark single notification read ─────────────────────
  const markReadMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notifId);
      if (error) throw error;
    },
    onMutate: async (notifId: string) => {
      const key = ['notifications', userId, activeFilter];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Notification[]>(key);
      queryClient.setQueryData<Notification[]>(key, (old) =>
        (old ?? []).map((n) => n.id === notifId ? { ...n, read: true } : n)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['notifications', userId, activeFilter], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  // ── Mark all read ─────────────────────────────────────
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handlePress = (item: Notification) => {
    if (!item.read) markReadMutation.mutate(item.id);
    if (item.action_url) router.push(item.action_url as any);
  };

  // ── Render ─────────────────────────────────────────────
  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      );
    }
    if (isError) {
      return (
        <EmptyState
          variant="error"
          title="Impossible de charger"
          message="Vérifie ta connexion"
          ctaLabel="Réessayer"
          onCta={() => queryClient.invalidateQueries({ queryKey: ['notifications', userId] })}
        />
      );
    }
    return (
      <EmptyState
        variant="no-data"
        title="Pas encore de notifications"
        message="Elles apparaîtront ici dès qu'il y aura de l'activité"
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{
        backgroundColor: SURFACE,
        borderBottomWidth: 1, borderBottomColor: BORDER,
        padding: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: TEXT }}>
          Notifications
        </Text>
        <TouchableOpacity onPress={() => markAllReadMutation.mutate()}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: PRIMARY }}>Tout lire</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        {FILTERS.map((f) => {
          const active = f.id === activeFilter;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setActiveFilter(f.id)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                backgroundColor: active ? PRIMARY : SURFACE,
                borderWidth: active ? 0 : 1,
                borderColor: BORDER,
                marginRight: 6,
              }}
            >
              <Text style={{
                fontSize: 13, fontWeight: '600',
                color: active ? '#FFFFFF' : MUTED,
              }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      <FlatList<Notification>
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NFItem
            {...item}
            onPress={() => handlePress(item)}
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={renderEmpty}
      />
    </SafeAreaView>
  );
}
