import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl,
} from 'react-native';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  useCommunityStore, loadCommunity, searchUsers,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
  sendEncouragement, sendXpGift, sendCoinGift,
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

// Status of a search result relative to the current user
type SearchResultStatus = 'none' | 'friend' | 'request_sent' | 'request_received';

interface SearchResult extends FriendProfile {
  status: SearchResultStatus;
}

export default function FriendsScreen({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { friends, pendingRequests, isLoading } = useCommunityStore();
  const [tab, setTab] = useState<Tab>('friends');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Track ids for which we just sent a request (optimistic UI)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => loadCommunity(supabase), [supabase]);
  useEffect(() => { load(); }, [load]);

  // Reset sent-ids when search results change
  useEffect(() => { setSentIds(new Set()); }, [results]);

  const doSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const raw = await searchUsers(supabase, query.trim());

      const friendIds = new Set(friends.map((f) => f.id));
      // Pending requests received — user ids of people who sent us a request
      const receivedIds = new Set(pendingRequests.map((r) => r.requester_id));
      // Pending requests sent by me — loaded from community store's outgoing requests
      // We load them fresh here to determine status correctly
      const { data: { user } } = await supabase.auth.getUser();
      let sentRequestIds = new Set<string>();
      if (user) {
        const { data: outgoing } = await supabase
          .from('friendships')
          .select('addressee_id')
          .eq('requester_id', user.id)
          .eq('status', 'pending');
        sentRequestIds = new Set((outgoing ?? []).map((r: any) => r.addressee_id));
      }

      const enriched: SearchResult[] = raw.map((u) => {
        let status: SearchResultStatus = 'none';
        if (friendIds.has(u.id)) status = 'friend';
        else if (sentRequestIds.has(u.id)) status = 'request_sent';
        else if (receivedIds.has(u.id)) status = 'request_received';
        return { ...u, status };
      });

      setResults(enriched);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (userId: string) => {
    await sendFriendRequest(supabase, userId);
    showAlert('Envoy\u00e9 !', 'Demande d\'ami envoy\u00e9e');
    setSentIds((prev) => new Set([...prev, userId]));
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
    showAlert('Retirer', `Retirer ${name || 'cet ami'} de ta liste ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: async () => { await removeFriend(supabase, friendshipId); load(); } },
    ]);
  };

  const handleGift = (friend: FriendProfile) => {
    showAlert(
      `Cadeau pour ${friend.name || 'Ami'}`,
      'Que veux-tu envoyer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: '\ud83d\udcaa Encourager', onPress: () => sendEncouragement(supabase, friend.id) },
        { text: '\u2b50 10 XP', onPress: () => sendXpGift(supabase, friend.id, 10, 'Cadeau !') },
        { text: '\ud83e\ude99 5 Pi\u00e8ces', onPress: async () => {
          try { await sendCoinGift(supabase, friend.id, 5, 'Cadeau !'); }
          catch { showAlert('Erreur', 'Pas assez de pi\u00e8ces'); }
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
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                  <Ionicons name="close-circle" size={18} color="#B0ADA8" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={doSearch}
              style={{ backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: searching ? 0.7 : 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {searching ? 'Recherche...' : 'Rechercher'}
              </Text>
            </TouchableOpacity>

            {results.map((u) => {
              const alreadySent = sentIds.has(u.id) || u.status === 'request_sent';
              const isFriend = u.status === 'friend';
              const hasIncomingRequest = u.status === 'request_received';

              return (
                <View key={u.id} style={{
                  backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: isFriend ? theme.primary + '40' : theme.border,
                }}>
                  {/* Row: avatar + info + profile button */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={u.name} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{u.name || 'Utilisateur'}</Text>
                      {u.goal ? (
                        <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>{u.goal}</Text>
                      ) : null}
                      {isFriend && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <Ionicons name="people" size={11} color={theme.primary} />
                          <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '600' }}>Ami</Text>
                        </View>
                      )}
                    </View>

                    {/* View Profile button — always visible */}
                    <TouchableOpacity
                      onPress={() => router.push(`/(app)/profile/${u.id}` as any)}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        backgroundColor: theme.primary + '18',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="person" size={16} color={theme.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Action row — shown only for non-friends */}
                  {!isFriend && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      {hasIncomingRequest ? (
                        // They sent us a request — show accept/decline
                        <>
                          <TouchableOpacity
                            onPress={async () => {
                              // Find the friendship id from pendingRequests
                              const req = pendingRequests.find((r) => r.requester_id === u.id);
                              if (req) { await acceptFriendRequest(supabase, req.id); load(); setResults((prev) => prev.filter((r) => r.id !== u.id)); }
                            }}
                            style={{
                              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                              gap: 6, height: 36, borderRadius: 10, backgroundColor: '#4CAF50',
                            }}
                          >
                            <Ionicons name="checkmark" size={14} color="#fff" />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Accepter</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={async () => {
                              const req = pendingRequests.find((r) => r.requester_id === u.id);
                              if (req) { await declineFriendRequest(supabase, req.id); load(); setResults((prev) => prev.filter((r) => r.id !== u.id)); }
                            }}
                            style={{
                              height: 36, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                              borderWidth: 1, borderColor: theme.border,
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.muted }}>Refuser</Text>
                          </TouchableOpacity>
                        </>
                      ) : alreadySent ? (
                        // Request already sent — disabled state
                        <View style={{
                          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                          gap: 6, height: 36, borderRadius: 10,
                          backgroundColor: theme.border,
                        }}>
                          <Ionicons name="time-outline" size={14} color={theme.muted} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.muted }}>Demande envoy\u00e9e</Text>
                        </View>
                      ) : (
                        // No relationship — show Add Friend
                        <TouchableOpacity
                          onPress={() => handleAddFriend(u.id)}
                          style={{
                            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                            gap: 6, height: 36, borderRadius: 10, backgroundColor: theme.primary,
                          }}
                        >
                          <Ionicons name="person-add" size={14} color="#fff" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Ajouter</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Friend actions row — shown only for already-friends */}
                  {isFriend && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <TouchableOpacity
                        onPress={async () => {
                          const { getOrCreateDMConversation } = await import('../store');
                          const convId = await getOrCreateDMConversation(supabase, u.id);
                          router.push(`/(app)/(plugins)/community/conversation?id=${convId}` as any);
                        }}
                        style={{
                          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                          gap: 6, height: 34, borderRadius: 10,
                          backgroundColor: '#4CAF5018', borderWidth: 1, borderColor: '#4CAF5030',
                        }}
                      >
                        <Ionicons name="chatbubble" size={14} color="#4CAF50" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#4CAF50' }}>Message</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleGift(u)}
                        style={{
                          width: 34, height: 34, borderRadius: 10,
                          backgroundColor: '#FFB80018', borderWidth: 1, borderColor: '#FFB80030',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="gift" size={15} color="#FFB800" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}

            {results.length === 0 && query.trim().length > 0 && !searching && (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="search-outline" size={36} color="#E2E0DA" />
                <Text style={{ textAlign: 'center', color: theme.muted, marginTop: 10, fontSize: 14 }}>
                  Aucun r\u00e9sultat pour "{query}"
                </Text>
              </View>
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
              <TouchableOpacity key={f.id} onPress={() => router.push(`/(app)/profile/${f.id}` as any)} style={{
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
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
