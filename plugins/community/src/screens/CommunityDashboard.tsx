import React, { useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Image,
} from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCommunityStore, loadCommunity } from '../store';

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={[{
      backgroundColor: theme.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: theme.border,
    }, style]}>
      {children}
    </View>
  );
}

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

function SectionHeader({ icon, label, count, onSeeAll }: {
  icon: string; label: string; count?: number; onSeeAll?: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon as any} size={20} color={theme.primary} />
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>
          {label}{count !== undefined ? ` (${count})` : ''}
        </Text>
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>Voir tout</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function CommunityDashboard({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const {
    friends, pendingRequests, conversations, activeChallenges,
    groupWorkouts, stats, recentEncouragements, isLoading,
  } = useCommunityStore();

  const load = useCallback(() => loadCommunity(supabase), []);
  useEffect(() => { load(); }, [load]);

  const openGroupWorkouts = groupWorkouts.filter((g) => g.status === 'open' || g.status === 'in_progress');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>Communauté</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => router.push('/(app)/(plugins)/community/invite' as any)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="share-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(app)/(plugins)/community/friends' as any)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person-add-outline" size={20} color={theme.primary} />
            {pendingRequests.length > 0 && (
              <View style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{pendingRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Quick Stats Row ──────────────────────── */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { label: 'Amis', value: friends.length, icon: 'people', color: theme.primary },
            { label: 'Défis', value: activeChallenges.length, icon: 'trophy', color: '#FFB800' },
            { label: 'Messages', value: stats?.messages_sent ?? 0, icon: 'chatbubbles', color: '#4CAF50' },
          ].map((s) => (
            <Card key={s.label} style={{ flex: 1, alignItems: 'center', padding: 14 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: s.color + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <Ionicons name={s.icon as any} size={18} color={s.color} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{s.value}</Text>
              <Text style={{ fontSize: 11, color: theme.muted, fontWeight: '600', marginTop: 2 }}>{s.label}</Text>
            </Card>
          ))}
        </View>

        {/* ── Pending Friend Requests ─────────────── */}
        {pendingRequests.length > 0 && (
          <Card>
            <SectionHeader icon="person-add" label="Demandes d'amis" count={pendingRequests.length}
              onSeeAll={() => router.push('/(app)/(plugins)/community/friends' as any)} />
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              Tu as {pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} en attente
            </Text>
          </Card>
        )}

        {/* ── Friends ─────────────────────────────── */}
        <Card>
          <SectionHeader icon="people" label="Amis" count={friends.length}
            onSeeAll={() => router.push('/(app)/(plugins)/community/friends' as any)} />
          {friends.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Ionicons name="people-outline" size={40} color="#E2E0DA" />
              <Text style={{ color: theme.muted, fontSize: 13, marginTop: 8 }}>Ajoute des amis pour commencer !</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(plugins)/community/friends' as any)}
                style={{ marginTop: 12, backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Chercher des amis</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {friends.slice(0, 10).map((f) => (
                <TouchableOpacity key={f.id} style={{ alignItems: 'center', width: 64 }}
                  onPress={() => router.push(`/(app)/(plugins)/community/compare?friendId=${f.id}` as any)}>
                  <Avatar name={f.name} size={48} />
                  <Text numberOfLines={1} style={{ fontSize: 11, color: theme.text, fontWeight: '600', marginTop: 4 }}>
                    {f.name || 'Ami'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Card>

        {/* ── Messages ────────────────────────────── */}
        <Card>
          <SectionHeader icon="chatbubbles" label="Messages" count={conversations.length}
            onSeeAll={() => router.push('/(app)/(plugins)/community/chat' as any)} />
          {conversations.length === 0 ? (
            <Text style={{ color: theme.muted, fontSize: 13 }}>Aucune conversation pour l'instant</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {conversations.slice(0, 3).map((conv) => (
                <TouchableOpacity key={conv.id}
                  onPress={() => router.push(`/(app)/(plugins)/community/conversation?id=${conv.id}` as any)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#4CAF5018', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={conv.type === 'group' ? 'people' : 'chatbubble'} size={18} color="#4CAF50" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
                      {conv.name || 'Conversation'}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                      {conv.last_message?.content ?? 'Aucun message'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {/* ── Active Challenges ───────────────────── */}
        <Card>
          <SectionHeader icon="trophy" label="Défis actifs" count={activeChallenges.length}
            onSeeAll={() => router.push('/(app)/(plugins)/community/challenges' as any)} />
          {activeChallenges.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Ionicons name="trophy-outline" size={36} color="#E2E0DA" />
              <Text style={{ color: theme.muted, fontSize: 13, marginTop: 8 }}>Aucun défi en cours</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(plugins)/community/create-challenge' as any)}
                style={{ marginTop: 12, backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Créer un défi</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {activeChallenges.slice(0, 3).map((c) => (
                <TouchableOpacity key={c.id}
                  onPress={() => router.push(`/(app)/(plugins)/community/challenge-detail?id=${c.id}` as any)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 12,
                    backgroundColor: c.type === '1v1' ? theme.primary + '18' : '#FFB80018',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={c.type === '1v1' ? 'flash' : 'people'} size={18} color={c.type === '1v1' ? theme.primary : '#FFB800'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{c.title}</Text>
                    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                      {c.type === '1v1' ? '1v1' : 'Équipe'} · {c.participants?.length ?? 0} joueur{(c.participants?.length ?? 0) > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: c.status === 'active' ? '#4CAF5018' : '#FFB80018', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: c.status === 'active' ? '#4CAF50' : '#FFB800' }}>
                      {c.status === 'active' ? 'En cours' : 'En attente'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {/* ── Group Workouts ──────────────────────── */}
        {openGroupWorkouts.length > 0 && (
          <Card>
            <SectionHeader icon="barbell" label="Séances de groupe" count={openGroupWorkouts.length} />
            <View style={{ gap: 10 }}>
              {openGroupWorkouts.slice(0, 3).map((gw) => (
                <View key={gw.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barbell" size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{gw.title}</Text>
                    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                      {gw.participants?.length ?? 0}/{gw.max_participants} participants
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* ── Recent Encouragements ───────────────── */}
        {recentEncouragements.length > 0 && (
          <Card>
            <SectionHeader icon="heart" label="Encouragements reçus" count={recentEncouragements.length} />
            <View style={{ gap: 8 }}>
              {recentEncouragements.slice(0, 5).map((e) => (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 24 }}>{e.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: theme.text }}>{e.message || 'Continue comme ça !'}</Text>
                    <Text style={{ fontSize: 11, color: theme.muted }}>
                      {new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* ── Community Stats ─────────────────────── */}
        {stats && (
          <Card>
            <SectionHeader icon="bar-chart" label="Tes stats communautaires" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'Défis gagnés', value: stats.challenges_won, emoji: '🏆' },
                { label: 'XP offert', value: stats.xp_gifted, emoji: '⭐' },
                { label: 'XP reçu', value: stats.xp_received, emoji: '🎁' },
                { label: 'Pièces offertes', value: stats.coins_gifted, emoji: '🪙' },
                { label: 'Programmes partagés', value: stats.programs_shared, emoji: '📋' },
                { label: 'Encouragements', value: stats.encouragements_sent, emoji: '💪' },
              ].map((s) => (
                <View key={s.label} style={{
                  width: '48%' as any, backgroundColor: theme.background, borderRadius: 12, padding: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                }}>
                  <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{s.value}</Text>
                    <Text style={{ fontSize: 11, color: theme.muted }}>{s.label}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
