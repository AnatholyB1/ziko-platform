import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../src/stores/themeStore';

type NotifCat = 'pr' | 'achievement' | 'coach' | 'community' | 'reminder';
type NotifGroup = 'today' | 'earlier';

interface NotifItem {
  id: string;
  cat: NotifCat;
  group: NotifGroup;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  action?: string;
}

const FILTERS = [
  { id: 'all', label: 'Tout' },
  { id: 'pr', label: 'PR & Victoires' },
  { id: 'coach', label: 'Coach IA' },
  { id: 'community', label: 'Communauté' },
  { id: 'reminder', label: 'Rappels' },
];

const INITIAL_ITEMS: NotifItem[] = [
  {
    id: '1', cat: 'pr', group: 'today', icon: 'trophy-outline', tint: '#E8A33A',
    title: 'Nouveau PR — Squat',
    body: "Tu as soulevé 120 kg au squat, +5 kg de ton record précédent. Continue comme ça !",
    time: "Il y a 12 min", unread: true, action: 'Voir le PR',
  },
  {
    id: '2', cat: 'coach', group: 'today', icon: 'sparkles-outline', tint: '#7B5BD0',
    title: 'Ton coach IA a analysé ta semaine',
    body: "Volume en hausse de 8 %. Je recommande d'augmenter légèrement le repos demain.",
    time: "Il y a 45 min", unread: true, action: 'Lire l\'analyse',
  },
  {
    id: '3', cat: 'community', group: 'today', icon: 'people-outline', tint: '#2E7BF6',
    title: 'Marco T. a accepté ton défi',
    body: "Le défi «  30 jours push » est lancé. Première vérification dans 7 jours.",
    time: "Il y a 1 h", unread: true,
  },
  {
    id: '4', cat: 'reminder', group: 'today', icon: 'notifications-outline', tint: '#FF5C1A',
    title: 'Séance Pull prévue ce soir',
    body: 'Rappel : Pull Day à 18 h 30. 6 exercices planifiés.',
    time: "Il y a 2 h", unread: false, action: 'Voir la séance',
  },
  {
    id: '5', cat: 'achievement', group: 'earlier', icon: 'ribbon-outline', tint: '#2E9E5B',
    title: 'Badge débloqué — Régularité 🔥',
    body: "10 séances consécutives sans interruption. Tu es dans le top 5 % de tes amis.",
    time: "Hier · 19:32", unread: false,
  },
  {
    id: '6', cat: 'coach', group: 'earlier', icon: 'fitness-outline', tint: '#7B5BD0',
    title: 'Programme ajusté automatiquement',
    body: "Suite à ton sommeil court cette semaine, la charge de jeudi a été réduite de 10 %.",
    time: "Hier · 08:10", unread: false,
  },
  {
    id: '7', cat: 'community', group: 'earlier', icon: 'chatbubble-outline', tint: '#2E7BF6',
    title: 'Sophie R. a commenté ton post',
    body: "« Incroyable ce squat, tu m'inspires ! »",
    time: "Il y a 2 j", unread: false,
  },
  {
    id: '8', cat: 'pr', group: 'earlier', icon: 'barbell-outline', tint: '#E8A33A',
    title: 'PR estimé — Développé couché',
    body: "Basé sur tes séries d'hier, ton 1RM estimé est maintenant de 95 kg.",
    time: "Il y a 3 j", unread: false, action: 'Voir le calcul',
  },
  {
    id: '9', cat: 'reminder', group: 'earlier', icon: 'water-outline', tint: '#2E9E5B',
    title: 'Objectif hydratation atteint',
    body: "Tu as bu 2,4 L aujourd'hui. Objectif dépassé de 20 % !",
    time: "Il y a 4 j", unread: false,
  },
];

export default function NotificationsScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState<NotifItem[]>(INITIAL_ITEMS);

  const filtered = items.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'pr') return n.cat === 'pr' || n.cat === 'achievement';
    return n.cat === filter;
  });

  const today = filtered.filter((n) => n.group === 'today');
  const earlier = filtered.filter((n) => n.group === 'earlier');
  const unreadCount = items.filter((n) => n.unread).length;

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  const tapNotif = (id: string) => setItems((prev) => prev.map((n) => n.id === id ? { ...n, unread: false } : n));

  const cardStyle = {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
  };

  const sectionLabel = (label: string) => (
    <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' as const, color: theme.muted, paddingVertical: 10, paddingHorizontal: 4 }}>
      {label}
    </Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: theme.text + '0F', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={18} color={theme.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>
            Notifications{unreadCount > 0 ? (
              <Text style={{ color: theme.primary }}> · {unreadCount}</Text>
            ) : null}
          </Text>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllRead}
            style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.text + '0F' }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.text }}>Tout marquer lu</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, gap: 6 }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={{
                paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
                backgroundColor: active ? theme.text : theme.text + '0D',
                marginRight: 6,
              }}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: active ? '#fff' : theme.text }}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', padding: 60 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: theme.text + '0D', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="notifications-outline" size={24} color={theme.muted} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>Tu es à jour</Text>
            <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>Pas de notification dans cette catégorie.</Text>
          </View>
        )}

        {today.length > 0 && (
          <>
            {sectionLabel("Aujourd'hui")}
            <View style={{ gap: 8 }}>
              {today.map((n) => (
                <NotifCard key={n.id} item={n} theme={theme} onTap={() => tapNotif(n.id)} />
              ))}
            </View>
          </>
        )}

        {earlier.length > 0 && (
          <>
            {sectionLabel('Plus tôt')}
            <View style={{ gap: 8 }}>
              {earlier.map((n) => (
                <NotifCard key={n.id} item={n} theme={theme} onTap={() => tapNotif(n.id)} />
              ))}
            </View>
          </>
        )}

        {/* Settings CTA */}
        <TouchableOpacity
          style={{ marginTop: 18, padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Ionicons name="settings-outline" size={13} color={theme.muted} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.muted }}>Paramètres de notifications</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function NotifCard({ item, theme, onTap }: { item: NotifItem; theme: any; onTap: () => void }) {
  return (
    <TouchableOpacity
      onPress={onTap}
      style={{
        backgroundColor: item.unread ? item.tint + '0A' : theme.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      {/* Unread dot */}
      {item.unread && (
        <View style={{ position: 'absolute', top: 14, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />
      )}

      {/* Icon */}
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: item.tint + '24', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Ionicons name={item.icon} size={17} color={item.tint} />
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingRight: item.unread ? 12 : 0 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, lineHeight: 18 }}>{item.title}</Text>
        <Text style={{ fontSize: 12, color: theme.muted, marginTop: 3, lineHeight: 17 }}>{item.body}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <Text style={{ fontSize: 10.5, color: theme.muted, fontWeight: '600' }}>{item.time}</Text>
          {item.action && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.primary + '1F' }}>
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.primary }}>{item.action}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
