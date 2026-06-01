import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion } from '@ziko/ui';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Constants ─────────────────────────────────────────────────────────────────

const FRIEND_COLORS = ['#E94B3C', '#2E7BF6', '#7B5BD0', '#2E9E5B', '#F59E0B', '#FF5C1A'];
const hashColor = (name: string) => FRIEND_COLORS[name.charCodeAt(0) % FRIEND_COLORS.length];

const TABS = ['Fil', 'Défis', 'Groupes'];

const CARD_STYLE = {
  backgroundColor: '#FFFFFF' as const,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E2E0DA' as const,
  shadowColor: '#1C1A17' as const,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Friendship {
  requester_id: string;
  addressee_id: string;
}

interface UserProfile {
  name: string;
}

interface WorkoutSession {
  id: string;
  name: string;
  user_id: string;
  started_at: string;
  total_duration_seconds: number;
  user_profiles: UserProfile;
}

interface ChallengeParticipant {
  user_id: string;
  score: number;
  status: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  type: string;
  scoring: string;
  start_date: string;
  end_date: string;
  status: string;
  prize_coins: number | null;
  challenge_participants: ChallengeParticipant[] | null;
}

interface CommunityPluginProps {
  supabase: any;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function estimatedTarget(scoring: string, startDate: string, endDate: string): number {
  const daysTotal = differenceInDays(new Date(endDate), new Date(startDate));
  switch (scoring) {
    case 'sessions': return (daysTotal / 7) * 3;
    case 'volume': return 10000;
    case 'habits': return daysTotal;
    default: return 100;
  }
}

// ─── Shimmer placeholder ───────────────────────────────────────────────────────

function ShimmerCard() {
  return (
    <View style={[CARD_STYLE, { padding: 16, marginBottom: 12, height: 80 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E2E0DA' }} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: '#E2E0DA' }} />
          <View style={{ height: 10, width: '40%', borderRadius: 5, backgroundColor: '#E2E0DA' }} />
        </View>
      </View>
    </View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CommunityPlugin({ supabase }: CommunityPluginProps) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Fil');

  // ── Current user ──────────────────────────────────────────────────────────────
  const { data: userInfo } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
  const userId = userInfo?.id ?? null;

  // ── Friendships query ─────────────────────────────────────────────────────────
  const { data: friendships = [] } = useQuery<Friendship[]>({
    queryKey: ['friendships', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const friendIds = friendships.map((f) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id
  );

  // ── Friend feed query ─────────────────────────────────────────────────────────
  const {
    data: feedSessions = [],
    isLoading: feedLoading,
    isError: feedError,
    refetch: refetchFeed,
  } = useQuery<WorkoutSession[]>({
    queryKey: ['friend_feed', userId, friendIds],
    queryFn: async () => {
      if (!userId || friendIds.length === 0) return [];
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, name, user_id, started_at, total_duration_seconds, user_profiles!inner(name)')
        .in('user_id', friendIds)
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId && friendIds.length > 0,
  });

  // ── Challenges query ──────────────────────────────────────────────────────────
  const {
    data: challenges = [],
    isLoading: challengesLoading,
  } = useQuery<Challenge[]>({
    queryKey: ['challenges_active', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenges')
        .select('*, challenge_participants!left(user_id, score, status)')
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString())
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Join challenge mutation ────────────────────────────────────────────────────
  const joinMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase
        .from('challenge_participants')
        .insert({ challenge_id: challengeId, user_id: userId, status: 'joined' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges_active', userId] });
    },
  });

  // ─── Fil tab ───────────────────────────────────────────────────────────────────

  function renderFilTab() {
    if (feedLoading) {
      return (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </View>
      );
    }

    if (feedError) {
      return (
        <View style={{ paddingHorizontal: 16, paddingTop: 32, alignItems: 'center' }}>
          <Ionicons name="cloud-offline-outline" size={40} color={theme.muted} />
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, textAlign: 'center' }}>
            Impossible de charger le fil
          </Text>
          <TouchableOpacity
            onPress={() => refetchFeed()}
            style={{
              marginTop: 12,
              backgroundColor: theme.primary,
              borderRadius: 12,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (friendIds.length === 0) {
      return (
        <View style={{ paddingHorizontal: 16, paddingTop: 32, alignItems: 'center' }}>
          <Ionicons name="people-outline" size={48} color={theme.muted} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 12, textAlign: 'center' }}>
            Ton fil est vide pour l'instant.
          </Text>
          <Text style={{ fontSize: 13, color: theme.muted, marginTop: 8, textAlign: 'center' }}>
            Ajoute des amis pour voir leur activité ici.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/(plugins)/community/friends' as any)}
            style={{
              marginTop: 16,
              backgroundColor: theme.primary,
              borderRadius: 12,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Trouver des amis</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <AISuggestion
          text="Tes amis restent actifs. Consulte le fil pour rester motivé !"
          tintColor="#2E7BF6"
        />
        <View style={{ height: 12 }} />

        {feedSessions.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Ionicons name="newspaper-outline" size={40} color={theme.muted} />
            <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, textAlign: 'center' }}>
              Aucune activité récente de tes amis
            </Text>
          </View>
        ) : feedSessions.map((session) => {
          const friendName = session.user_profiles?.name ?? 'Ami';
          const initials = getInitials(friendName);
          const avatarColor = hashColor(friendName);
          const durationMin = Math.round(session.total_duration_seconds / 60);
          const agoText = formatDistanceToNow(new Date(session.started_at), { addSuffix: true, locale: fr });

          return (
            <View
              key={session.id}
              style={[CARD_STYLE, { padding: 16, marginBottom: 12 }]}
            >
              {/* Header row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: avatarColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{initials}</Text>
                </View>
                {/* Content */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{friendName}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>
                    {session.name ?? 'Séance'}
                  </Text>
                </View>
                {/* Ago time */}
                <Text style={{ fontSize: 11, color: theme.muted }}>{agoText}</Text>
              </View>

              {/* Session value card */}
              <View style={{
                marginTop: 10,
                backgroundColor: 'rgba(255,92,26,0.08)',
                padding: 8,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}>
                <Ionicons name="barbell-outline" size={14} color={theme.primary} />
                <Text style={{ fontSize: 13, color: theme.text, flex: 1 }}>{session.name ?? 'Séance'}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>{durationMin} min</Text>
              </View>

              {/* Like / comment ghost buttons */}
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="heart-outline" size={16} color={theme.muted} />
                  <Text style={{ fontSize: 12, color: theme.muted }}>J'aime</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="chatbubble-outline" size={14} color={theme.muted} />
                  <Text style={{ fontSize: 12, color: theme.muted }}>Commenter</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // ─── Défis tab ─────────────────────────────────────────────────────────────────

  function renderDefisTab() {
    if (challengesLoading) {
      return (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <ShimmerCard />
          <ShimmerCard />
        </View>
      );
    }

    if (challenges.length === 0) {
      return (
        <View style={{ paddingHorizontal: 16, paddingTop: 32, alignItems: 'center' }}>
          <Ionicons name="trophy-outline" size={48} color={theme.muted} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 12 }}>
            Aucun défi actif
          </Text>
          <Text style={{ fontSize: 13, color: theme.muted, marginTop: 8, textAlign: 'center' }}>
            Les défis disponibles apparaîtront ici
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {challenges.map((challenge) => {
          const participants = challenge.challenge_participants ?? [];
          const isEnrolled = participants.some((p) => p.user_id === userId);
          const userParticipant = participants.find((p) => p.user_id === userId);
          const target = estimatedTarget(challenge.scoring, challenge.start_date, challenge.end_date);
          const progress = isEnrolled && userParticipant
            ? Math.min(1, (userParticipant.score ?? 0) / target)
            : 0;
          const daysLeft = differenceInDays(new Date(challenge.end_date), new Date());

          return (
            <View key={challenge.id} style={[CARD_STYLE, { padding: 16, marginBottom: 12 }]}>
              {/* Title + enrolled chip */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, flex: 1 }}>
                  {challenge.title}
                </Text>
                {isEnrolled && (
                  <View style={{
                    backgroundColor: 'rgba(255,92,26,0.1)',
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    marginLeft: 8,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>Inscrit</Text>
                  </View>
                )}
              </View>

              {/* Description */}
              {challenge.description ? (
                <Text style={{ fontSize: 13, color: theme.muted, marginTop: 6 }} numberOfLines={2}>
                  {challenge.description}
                </Text>
              ) : null}

              {/* Stats row */}
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="people-outline" size={13} color={theme.muted} />
                  <Text style={{ fontSize: 12, color: theme.muted }}>
                    {participants.length} participant{participants.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={13} color={theme.muted} />
                  <Text style={{ fontSize: 12, color: theme.muted }}>
                    {daysLeft > 0 ? `${daysLeft} jour${daysLeft !== 1 ? 's' : ''}` : 'Terminé'}
                  </Text>
                </View>
              </View>

              {/* Progress bar (if enrolled) */}
              {isEnrolled && (
                <View style={{ marginTop: 10 }}>
                  <View style={{
                    height: 4,
                    backgroundColor: 'rgba(255,92,26,0.15)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      height: 4,
                      width: `${Math.round(progress * 100)}%` as any,
                      backgroundColor: theme.primary,
                      borderRadius: 2,
                    }} />
                  </View>
                  <Text style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                    {Math.round(progress * 100)}% accompli
                  </Text>
                </View>
              )}

              {/* CTA buttons */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {isEnrolled ? (
                  <TouchableOpacity
                    onPress={() => router.push(`/(app)/(plugins)/community/challenge-detail?id=${challenge.id}` as any)}
                    style={{
                      flex: 1,
                      backgroundColor: theme.primary,
                      borderRadius: 10,
                      paddingVertical: 9,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                      Voir le classement
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => joinMutation.mutate(challenge.id)}
                    disabled={joinMutation.isPending}
                    style={{
                      flex: 1,
                      backgroundColor: joinMutation.isPending ? theme.muted : theme.primary,
                      borderRadius: 10,
                      paddingVertical: 9,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                      {joinMutation.isPending ? 'Inscription...' : "Rejoindre le défi"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // ─── Groupes tab ───────────────────────────────────────────────────────────────

  function renderGroupesTab() {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 32, alignItems: 'center' }}>
        <Ionicons name="people-outline" size={48} color={theme.muted} />
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 12 }}>
          Groupes bientôt disponibles
        </Text>
        <Text style={{ fontSize: 13, color: theme.muted, marginTop: 8, textAlign: 'center' }}>
          Les groupes d'entraînement arrivent prochainement.
        </Text>
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
      }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>Communauté</Text>
        <TouchableOpacity
          onPress={() => router.push('/(app)/(plugins)/community/friends' as any)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="person-add-outline" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* SubTabs */}
      <View style={{ paddingHorizontal: 16 }}>
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </View>

      {/* Tab content */}
      {activeTab === 'Fil' && renderFilTab()}
      {activeTab === 'Défis' && renderDefisTab()}
      {activeTab === 'Groupes' && renderGroupesTab()}
    </SafeAreaView>
  );
}
