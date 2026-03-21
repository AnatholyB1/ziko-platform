import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCommunityStore } from '../store';

interface UserStats {
  totalSessions: number;
  totalVolume: number;
  totalDuration: number;
  streak: number;
  challengesWon: number;
  habitsCompleted: number;
  xpTotal: number;
}

const EMPTY_STATS: UserStats = {
  totalSessions: 0,
  totalVolume: 0,
  totalDuration: 0,
  streak: 0,
  challengesWon: 0,
  habitsCompleted: 0,
  xpTotal: 0,
};

async function fetchUserStats(supabase: any, userId: string): Promise<UserStats> {
  const [sessionsRes, gamifRes, communityRes, habitsRes] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select('id, total_volume_kg, duration_seconds')
      .eq('user_id', userId)
      .eq('status', 'completed'),
    supabase
      .from('user_gamification')
      .select('xp, current_streak')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('community_user_stats')
      .select('challenges_won')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('habit_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('completed', true),
  ]);

  const sessions = sessionsRes.data ?? [];
  const totalVolume = sessions.reduce((s: number, r: any) => s + (r.total_volume_kg ?? 0), 0);
  const totalDuration = sessions.reduce((s: number, r: any) => s + (r.duration_seconds ?? 0), 0);

  return {
    totalSessions: sessions.length,
    totalVolume: Math.round(totalVolume),
    totalDuration: Math.round(totalDuration / 60),
    streak: gamifRes.data?.current_streak ?? 0,
    challengesWon: communityRes.data?.challenges_won ?? 0,
    habitsCompleted: (habitsRes.data ?? []).length,
    xpTotal: gamifRes.data?.xp ?? 0,
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

interface CompareRowProps {
  label: string;
  icon: string;
  myVal: number;
  theirVal: number;
  unit?: string;
}

function CompareRow({ label, icon, myVal, theirVal, unit = '' }: CompareRowProps) {
  const theme = useThemeStore((s) => s.theme);
  const myWins = myVal > theirVal;
  const tied = myVal === theirVal;

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10,
      borderWidth: 1, borderColor: theme.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 6 }}>
        <Ionicons name={icon as any} size={16} color="#7A7670" />
        <Text style={{ fontSize: 13, color: theme.muted, fontWeight: '600' }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* My value */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{
            fontSize: 24, fontWeight: '800',
            color: myWins ? theme.primary : tied ? theme.text : theme.muted,
          }}>
            {formatNumber(myVal)}
          </Text>
          {unit ? <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{unit}</Text> : null}
        </View>

        {/* VS indicator */}
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: tied ? '#E2E0DA20' : myWins ? theme.primary + '14' : '#7A767014',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {tied ? (
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted }}>=</Text>
          ) : (
            <Ionicons
              name={myWins ? 'arrow-back' : 'arrow-forward'}
              size={16}
              color={myWins ? theme.primary : theme.muted}
            />
          )}
        </View>

        {/* Their value */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{
            fontSize: 24, fontWeight: '800',
            color: !myWins && !tied ? theme.primary : tied ? theme.text : theme.muted,
          }}>
            {formatNumber(theirVal)}
          </Text>
          {unit ? <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{unit}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export default function CompareScreen({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const params = useLocalSearchParams<{ friendId?: string }>();
  const { friends } = useCommunityStore();
  const [selectedFriend, setSelectedFriend] = useState(params.friendId || '');
  const [myStats, setMyStats] = useState<UserStats>(EMPTY_STATS);
  const [friendStats, setFriendStats] = useState<UserStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);

  const friend = friends.find((f) => f.id === selectedFriend);

  const loadStats = useCallback(async () => {
    if (!selectedFriend) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [mine, theirs] = await Promise.all([
        fetchUserStats(supabase, user.id),
        fetchUserStats(supabase, selectedFriend),
      ]);
      setMyStats(mine);
      setFriendStats(theirs);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedFriend]);

  useEffect(() => {
    if (selectedFriend) loadStats();
  }, [selectedFriend, loadStats]);

  const myWins = [
    myStats.totalSessions > friendStats.totalSessions,
    myStats.totalVolume > friendStats.totalVolume,
    myStats.totalDuration > friendStats.totalDuration,
    myStats.streak > friendStats.streak,
    myStats.challengesWon > friendStats.challengesWon,
    myStats.habitsCompleted > friendStats.habitsCompleted,
    myStats.xpTotal > friendStats.xpTotal,
  ].filter(Boolean).length;

  const theirWins = [
    friendStats.totalSessions > myStats.totalSessions,
    friendStats.totalVolume > myStats.totalVolume,
    friendStats.totalDuration > myStats.totalDuration,
    friendStats.streak > myStats.streak,
    friendStats.challengesWon > myStats.challengesWon,
    friendStats.habitsCompleted > myStats.habitsCompleted,
    friendStats.xpTotal > myStats.xpTotal,
  ].filter(Boolean).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text, flex: 1 }}>Comparer</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStats} tintColor={theme.primary} />}
      >
        {/* Friend selector */}
        {!params.friendId && friends.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 8 }}>
              Choisis un ami à comparer
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {friends.map((f) => {
                const active = selectedFriend === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setSelectedFriend(f.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      paddingHorizontal: 14, height: 40, borderRadius: 20,
                      backgroundColor: active ? theme.primary : theme.surface,
                      borderWidth: 1, borderColor: active ? theme.primary : theme.border,
                    }}
                  >
                    <View style={{
                      width: 26, height: 26, borderRadius: 13,
                      backgroundColor: active ? '#FFFFFF30' : theme.primary + '18',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? theme.surface : theme.primary }}>
                        {(f.name || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? theme.surface : theme.text }}>
                      {f.name || 'Ami'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {!selectedFriend ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="stats-chart-outline" size={48} color="#E2E0DA" />
            <Text style={{ fontSize: 16, color: theme.muted, marginTop: 12 }}>
              Sélectionne un ami pour comparer vos stats
            </Text>
          </View>
        ) : loading ? (
          <ActivityIndicator color={theme.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* VS Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 20, paddingHorizontal: 10,
            }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="person" size={28} color={theme.primary} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginTop: 6 }}>Toi</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.primary }}>{myWins}</Text>
              </View>

              <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: theme.text, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: theme.surface, fontWeight: '800', fontSize: 14 }}>VS</Text>
              </View>

              <View style={{ alignItems: 'center', flex: 1 }}>
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: theme.primary }}>
                    {(friend?.name || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginTop: 6 }}>
                  {friend?.name || 'Ami'}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.muted }}>{theirWins}</Text>
              </View>
            </View>

            {/* Stat comparisons */}
            <CompareRow label="Séances" icon="fitness" myVal={myStats.totalSessions} theirVal={friendStats.totalSessions} />
            <CompareRow label="Volume total" icon="barbell" myVal={myStats.totalVolume} theirVal={friendStats.totalVolume} unit="kg" />
            <CompareRow label="Temps d'entraînement" icon="time" myVal={myStats.totalDuration} theirVal={friendStats.totalDuration} unit="min" />
            <CompareRow label="Série actuelle" icon="flame" myVal={myStats.streak} theirVal={friendStats.streak} unit="jours" />
            <CompareRow label="Défis gagnés" icon="trophy" myVal={myStats.challengesWon} theirVal={friendStats.challengesWon} />
            <CompareRow label="Habitudes complétées" icon="checkmark-circle" myVal={myStats.habitsCompleted} theirVal={friendStats.habitsCompleted} />
            <CompareRow label="XP total" icon="star" myVal={myStats.xpTotal} theirVal={friendStats.xpTotal} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
