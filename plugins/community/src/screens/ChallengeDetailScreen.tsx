import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  joinChallenge, type Challenge, type ChallengeParticipant, type ChallengeTeam, type FriendProfile,
} from '../store';

function Avatar({ name, size = 36 }: { name: string | null; size?: number }) {
  const theme = useThemeStore((s) => s.theme);
  const initial = (name || '?')[0].toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

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

const SCORING_LABELS: Record<string, string> = {
  volume: 'Volume total (kg)',
  sessions: 'Nombre de séances',
  xp: 'XP gagnée',
  habits: 'Habitudes complétées',
  custom: 'Personnalisé',
};

export default function ChallengeDetailScreen({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [profiles, setProfiles] = useState<Record<string, FriendProfile>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const { data } = await supabase
        .from('challenges')
        .select('*, challenge_participants(*), challenge_teams(*)')
        .eq('id', id)
        .single();

      if (data) {
        setChallenge(data);
        const userIds = (data.challenge_participants ?? []).map((p: any) => p.user_id);
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from('user_profiles')
            .select('id, name, avatar_url, goal')
            .in('id', userIds);
          const map: Record<string, FriendProfile> = {};
          (profs ?? []).forEach((p: FriendProfile) => { map[p.id] = p; });
          setProfiles(map);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (!challenge) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.muted }}>{loading ? 'Chargement...' : 'Défi introuvable'}</Text>
      </SafeAreaView>
    );
  }

  const participants = challenge.participants ?? challenge.challenge_participants ?? [];
  const teams = challenge.teams ?? challenge.challenge_teams ?? [];
  const isParticipant = participants.some((p: any) => p.user_id === userId);
  const isCreator = challenge.creator_id === userId;
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000));

  const sorted = [...participants].sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));

  const handleJoin = async (teamId?: string) => {
    await joinChallenge(supabase, challenge.id, teamId);
    Alert.alert('Rejoint !', 'Tu as rejoint le défi');
    load();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={{
          backgroundColor: theme.surface, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#1C1A17" />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 16,
              backgroundColor: challenge.type === '1v1' ? theme.primary + '18' : '#FFB80018',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={challenge.type === '1v1' ? 'flash' : 'people'} size={28}
                color={challenge.type === '1v1' ? theme.primary : '#FFB800'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{challenge.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <View style={{
                  backgroundColor: challenge.status === 'active' ? '#4CAF5018' : '#FFB80018',
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                }}>
                  <Text style={{
                    fontSize: 11, fontWeight: '600',
                    color: challenge.status === 'active' ? '#4CAF50' : '#FFB800',
                  }}>
                    {challenge.status === 'active' ? 'En cours' : challenge.status === 'pending' ? 'En attente' : 'Terminé'}
                  </Text>
                </View>
                {challenge.prize_coins > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={{ fontSize: 14 }}>🪙</Text>
                    <Text style={{ fontSize: 13, color: '#FFB800', fontWeight: '700' }}>{challenge.prize_coins}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Join button */}
          {!isParticipant && (challenge.status === 'pending' || challenge.status === 'active') && (
            <TouchableOpacity onPress={() => handleJoin()}
              style={{
                backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14,
                alignItems: 'center', marginTop: 16,
              }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Rejoindre le défi</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          {/* Info */}
          <Card>
            {challenge.description && (
              <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20, marginBottom: 12 }}>
                {challenge.description}
              </Text>
            )}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="trophy" size={16} color={theme.primary} />
                <Text style={{ fontSize: 13, color: theme.muted }}>Critère : {SCORING_LABELS[challenge.scoring] ?? challenge.scoring}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="calendar" size={16} color={theme.primary} />
                <Text style={{ fontSize: 13, color: theme.muted }}>
                  {new Date(challenge.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  {' → '}
                  {new Date(challenge.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </Text>
              </View>
              {challenge.status === 'active' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="time" size={16} color={theme.primary} />
                  <Text style={{ fontSize: 13, color: theme.primary, fontWeight: '600' }}>
                    {daysLeft} jour{daysLeft !== 1 ? 's' : ''} restant{daysLeft !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </Card>

          {/* Leaderboard */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Ionicons name="podium" size={20} color={theme.primary} />
              <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>Classement</Text>
            </View>

            {sorted.length === 0 ? (
              <Text style={{ color: theme.muted, fontSize: 13 }}>Aucun participant</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {sorted.map((p: any, i: number) => {
                  const profile = profiles[p.user_id];
                  const isMe = p.user_id === userId;
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <View key={p.id || p.user_id} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      backgroundColor: isMe ? theme.primary + '08' : 'transparent',
                      borderRadius: 12, padding: 10,
                      borderWidth: isMe ? 1 : 0, borderColor: theme.primary + '33',
                    }}>
                      <Text style={{ fontSize: 20, width: 28, textAlign: 'center' }}>
                        {i < 3 ? medals[i] : `${i + 1}.`}
                      </Text>
                      <Avatar name={profile?.name ?? null} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
                          {profile?.name ?? 'Joueur'}{isMe ? ' (toi)' : ''}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: theme.primary }}>
                        {p.score ?? 0}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          {/* Teams */}
          {teams.length > 0 && (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Ionicons name="people" size={20} color="#FFB800" />
                <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>Équipes</Text>
              </View>
              <View style={{ gap: 12 }}>
                {teams.map((team: any) => {
                  const teamMembers = sorted.filter((p: any) => p.team_id === team.id);
                  const teamScore = teamMembers.reduce((sum: number, p: any) => sum + (p.score ?? 0), 0);
                  return (
                    <View key={team.id} style={{
                      backgroundColor: theme.background, borderRadius: 12, padding: 12,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                          {team.emoji} {team.name}
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.primary }}>{teamScore}</Text>
                      </View>
                      {teamMembers.map((p: any) => {
                        const prof = profiles[p.user_id];
                        return (
                          <View key={p.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                            <Avatar name={prof?.name ?? null} size={28} />
                            <Text style={{ fontSize: 13, color: theme.text, flex: 1 }}>{prof?.name ?? 'Joueur'}</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.muted }}>{p.score ?? 0}</Text>
                          </View>
                        );
                      })}
                      {!isParticipant && (challenge.status === 'pending' || challenge.status === 'active') && (
                        <TouchableOpacity onPress={() => handleJoin(team.id)}
                          style={{ marginTop: 8, backgroundColor: '#FFB800', borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Rejoindre cette équipe</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
