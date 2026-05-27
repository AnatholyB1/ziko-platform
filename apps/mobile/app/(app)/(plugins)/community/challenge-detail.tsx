import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../../src/lib/supabase';

// ── Types ──────────────────────────────────────────────────────

interface Challenge {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  duration_days: number;
  xp_reward: number;
  created_at: string;
}

interface Participant {
  id: string;
  challenge_id: string;
  user_id: string;
  score: number;
  joined_at: string;
  name?: string | null;
}

// ── Medal colors ───────────────────────────────────────────────

const MEDAL_COLORS = ['#F59E0B', '#6B7280', '#CD7C2F'];

// ── Screen ────────────────────────────────────────────────────

export default function ChallengeDetailRoute() {
  const { id: challengeId } = useLocalSearchParams<{ id: string }>();
  const theme = useThemeStore((s) => s.theme);

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myParticipation, setMyParticipation] = useState<Participant | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!challengeId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      // Load challenge details
      const { data: ch } = await supabase
        .from('challenges')
        .select('id, name, description, icon, duration_days, xp_reward, created_at')
        .eq('id', challengeId)
        .single();

      setChallenge(ch ?? null);

      // Load participants ordered by score DESC
      const { data: parts } = await supabase
        .from('challenge_participants')
        .select('id, challenge_id, user_id, score, joined_at')
        .eq('challenge_id', challengeId)
        .order('score', { ascending: false });

      const partList: Participant[] = parts ?? [];

      // Enrich with names
      if (partList.length > 0) {
        const ids = partList.map((p) => p.user_id);
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, name')
          .in('id', ids);
        const nameMap: Record<string, string> = {};
        (profiles ?? []).forEach((p: { id: string; name: string }) => { nameMap[p.id] = p.name; });
        partList.forEach((p) => { p.name = nameMap[p.user_id] ?? null; });
      }

      setParticipants(partList);

      if (user) {
        const mine = partList.find((p) => p.user_id === user.id) ?? null;
        setMyParticipation(mine);
      }
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleJoin = async () => {
    if (!challengeId || !userId || joining) return;
    setJoining(true);
    try {
      const { error } = await supabase.from('challenge_participants').insert({
        challenge_id: challengeId,
        user_id: userId,
        score: 0,
      });
      if (error) throw error;
      await loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      showAlert('Erreur', msg);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!myParticipation || leaving) return;
    showAlert(
      'Quitter le defi ?',
      'Ta progression sera perdue.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter', style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await supabase.from('challenge_participants').delete().eq('id', myParticipation.id);
              await loadData();
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  const myRank = myParticipation
    ? participants.findIndex((p) => p.user_id === userId) + 1
    : null;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!challenge) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.muted }}>Defi introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const top3 = participants.slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} tintColor={theme.primary} />
        }
      >
        {/* Dark header */}
        <View style={{
          backgroundColor: '#1C1A17', paddingHorizontal: 16,
          paddingTop: 12, paddingBottom: 24,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 36, height: 36, borderRadius: 11,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 16,
              backgroundColor: `${theme.primary}30`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 26 }}>{challenge.icon ?? '🏆'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFAF6', lineHeight: 26 }}>
                {challenge.name}
              </Text>
              {challenge.description ? (
                <Text style={{ fontSize: 13, color: 'rgba(255,250,246,0.6)', marginTop: 6, lineHeight: 19 }}>
                  {challenge.description}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={13} color="rgba(255,250,246,0.5)" />
                  <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.5)' }}>
                    {challenge.duration_days}j
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="flash-outline" size={13} color={theme.primary} />
                  <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '700' }}>
                    +{challenge.xp_reward} XP
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="people-outline" size={13} color="rgba(255,250,246,0.5)" />
                  <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.5)' }}>
                    {participants.length} participant{participants.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Join / Leave CTA */}
          {myParticipation ? (
            <TouchableOpacity
              onPress={handleLeave}
              disabled={leaving}
              style={{
                marginTop: 16, paddingVertical: 13, borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.7)' }}>
                {leaving ? 'Sortie...' : 'Quitter le defi'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleJoin}
              disabled={joining}
              style={{
                marginTop: 16, paddingVertical: 13, borderRadius: 12,
                backgroundColor: theme.primary, alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                {joining ? 'Inscription...' : 'Rejoindre le defi'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ padding: 16, gap: 12 }}>
          {/* Participant count chip */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
              backgroundColor: `${theme.primary}15`,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {myParticipation && myRank && (
              <View style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                backgroundColor: `${theme.text}0D`,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                  Ta position : #{myRank}
                </Text>
              </View>
            )}
          </View>

          {/* Leaderboard top 3 */}
          {top3.length > 0 && (
            <View style={{
              backgroundColor: theme.surface, borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: theme.border,
              shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Ionicons name="podium-outline" size={18} color={theme.primary} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
                  Classement
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                {top3.map((p, i) => {
                  const isMe = p.user_id === userId;
                  const medalColor = MEDAL_COLORS[i] ?? theme.muted;
                  const rankLabels = ['1er', '2eme', '3eme'];
                  return (
                    <View
                      key={p.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12,
                        backgroundColor: isMe ? `${theme.primary}0D` : `${theme.text}05`,
                        borderWidth: isMe ? 1.5 : 0,
                        borderColor: isMe ? `${theme.primary}40` : 'transparent',
                      }}
                    >
                      {/* Medal */}
                      <View style={{
                        width: 32, height: 32, borderRadius: 10,
                        backgroundColor: `${medalColor}20`,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: medalColor }}>
                          {rankLabels[i]}
                        </Text>
                      </View>

                      {/* Avatar initials */}
                      <View style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: `${theme.primary}18`,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: theme.primary }}>
                          {(p.name ?? '?').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>

                      {/* Name */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                          {p.name ?? 'Joueur'}{isMe ? ' (toi)' : ''}
                        </Text>
                      </View>

                      {/* Score */}
                      <Text style={{ fontSize: 16, fontWeight: '800', color: medalColor }}>
                        {p.score}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Full leaderboard (positions 4+) */}
          {participants.length > 3 && (
            <View style={{
              backgroundColor: theme.surface, borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: theme.border,
            }}>
              <Text style={{
                fontSize: 10, fontWeight: '800', color: theme.muted,
                letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
              }}>
                Autres participants
              </Text>
              <View style={{ gap: 0 }}>
                {participants.slice(3).map((p, i) => {
                  const rank = i + 4;
                  const isMe = p.user_id === userId;
                  return (
                    <View
                      key={p.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingVertical: 10,
                        borderBottomWidth: i < participants.length - 4 ? 1 : 0,
                        borderBottomColor: theme.border,
                        backgroundColor: isMe ? `${theme.primary}08` : 'transparent',
                        borderRadius: 8, paddingHorizontal: isMe ? 8 : 0,
                      }}
                    >
                      <Text style={{ width: 24, fontSize: 13, color: theme.muted, fontWeight: '700', textAlign: 'center' }}>
                        {rank}
                      </Text>
                      <View style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: `${theme.primary}15`,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary }}>
                          {(p.name ?? '?').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: isMe ? '700' : '500', color: theme.text }}>
                        {p.name ?? 'Joueur'}{isMe ? ' (toi)' : ''}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.muted }}>{p.score}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {participants.length === 0 && (
            <View style={{
              paddingVertical: 40, alignItems: 'center',
              backgroundColor: theme.surface, borderRadius: 16,
              borderWidth: 1, borderColor: theme.border,
            }}>
              <Ionicons name="people-outline" size={32} color={theme.muted} />
              <Text style={{ color: theme.muted, fontSize: 13, marginTop: 10 }}>
                Sois le premier a rejoindre !
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
