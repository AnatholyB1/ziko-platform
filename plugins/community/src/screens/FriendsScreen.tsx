import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert,
} from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  useCommunityStore, loadCommunity, searchUsers,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
  sendScreenReaction, sendEncouragement, sendXpGift, sendCoinGift,
  type FriendProfile,
} from '../store';

function Avatar({ name, size = 44 }: { name: string | null; size?: number }) {
  const theme = useThemeStore((s) => s.theme);
  const initial = (name || '?')[0].toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}

type Tab = 'friends' | 'pending' | 'search';

export default function FriendsScreen({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { friends, pendingRequests, isLoading } = useCommunityStore();
  const [tab, setTab] = useState<Tab>('friends');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(() => loadCommunity(supabase), []);
  useEffect(() => { load(); }, [load]);

  const doSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const r = await searchUsers(supabase, query.trim());
      // Filter out already-friends
      const friendIds = new Set(friends.map((f) => f.id));
      setResults(r.filter((u) => !friendIds.has(u.id)));
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (userId: string) => {
    await sendFriendRequest(supabase, userId);
    Alert.alert('Envoyé !', 'Demande d\'ami envoyée');
    setResults((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleAccept = async (id: string) => {
    await acceptFriendRequest(supabase, id);
    load();
  };

  const handleDecline = async (id: string) => {
    await declineFriendRequest(supabase, id);
    load();
  };

  const handleRemove = (friendshipId: string, name: string) => {
    Alert.alert('Retirer', `Retirer ${name || 'cet ami'} de ta liste ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: async () => { await removeFriend(supabase, friendshipId); load(); } },
    ]);
  };

  const handleGift = (friend: FriendProfile) => {
    Alert.alert(
      `Cadeau pour ${friend.name || 'Ami'}`,
      'Que veux-tu envoyer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: '💪 Encourager', onPress: () => sendEncouragement(supabase, friend.id) },
        { text: '⭐ 10 XP', onPress: () => sendXpGift(supabase, friend.id, 10, 'Cadeau !') },
        { text: '🪙 5 Pièces', onPress: async () => {
          try { await sendCoinGift(supabase, friend.id, 5, 'Cadeau !'); }
          catch { Alert.alert('Erreur', 'Pas assez de pièces'); }
        }},
      ]
    );
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'friends', label: 'Amis', icon: 'people' },
    { key: 'pending', label: `En attente (${pendingRequests.length})`, icon: 'time' },
    { key: 'search', label: 'Chercher', icon: 'search' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text, flex: 1 }}>Amis</Text>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                height: 36, paddingHorizontal: 14, borderRadius: 20,
                backgroundColor: active ? theme.text : theme.surface,
                borderWidth: 1, borderColor: active ? theme.text : theme.border,
              }}>
              <Ionicons name={t.icon as any} size={14} color={active ? theme.surface : theme.muted} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? theme.surface : theme.text }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 10, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={theme.primary} />}
      >
        {/* Search tab */}
        {tab === 'search' && (
          <>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
              paddingHorizontal: 14, height: 46,
            }}>
              <Ionicons name="search" size={18} color="#7A7670" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Chercher un utilisateur..."
                placeholderTextColor="#B0ADA8"
                onSubmitEditing={doSearch}
                returnKeyType="search"
                style={{ flex: 1, fontSize: 15, color: theme.text }}
              />
            </View>
            <TouchableOpacity onPress={doSearch}
              style={{ backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {searching ? 'Recherche...' : 'Rechercher'}
              </Text>
            </TouchableOpacity>
            {results.map((u) => (
              <View key={u.id} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: theme.border,
              }}>
                <Avatar name={u.name} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{u.name || 'Utilisateur'}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted }}>{u.goal || ''}</Text>
                </View>
                <TouchableOpacity onPress={() => handleAddFriend(u.id)}
                  style={{ backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Ionicons name="person-add" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {results.length === 0 && query.length > 0 && !searching && (
              <Text style={{ textAlign: 'center', color: theme.muted, marginTop: 20 }}>Aucun résultat</Text>
            )}
          </>
        )}

        {/* Pending tab */}
        {tab === 'pending' && (
          <>
            {pendingRequests.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#E2E0DA" />
                <Text style={{ color: theme.muted, fontSize: 14, marginTop: 8 }}>Aucune demande en attente</Text>
              </View>
            )}
            {pendingRequests.map((req) => (
              <View key={req.id} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: theme.primary + '33',
              }}>
                <Avatar name="?" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>Demande d'ami</Text>
                  <Text style={{ fontSize: 12, color: theme.muted }}>
                    {new Date(req.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleAccept(req.id)}
                  style={{ backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDecline(req.id)}
                  style={{ backgroundColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Ionicons name="close" size={16} color="#7A7670" />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Friends tab */}
        {tab === 'friends' && (
          <>
            {friends.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="people-outline" size={48} color="#E2E0DA" />
                <Text style={{ color: theme.muted, fontSize: 14, marginTop: 8 }}>Pas encore d'amis</Text>
                <TouchableOpacity onPress={() => setTab('search')}
                  style={{ marginTop: 12, backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Chercher des amis</Text>
                </TouchableOpacity>
              </View>
            )}
            {friends.map((f) => (
              <View key={f.id} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: theme.border,
              }}>
                <Avatar name={f.name} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{f.name || 'Ami'}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted }}>{f.goal || ''}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity onPress={() => handleGift(f)}
                    style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFB80018', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="gift" size={16} color="#FFB800" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => {
                    const convId = await (await import('../store')).getOrCreateDMConversation(supabase, f.id);
                    router.push(`/(app)/(plugins)/community/conversation?id=${convId}` as any);
                  }}
                    style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#4CAF5018', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="chatbubble" size={16} color="#4CAF50" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push(`/(app)/(plugins)/community/compare?friendId=${f.id}` as any)}
                    style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="stats-chart" size={16} color={theme.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
