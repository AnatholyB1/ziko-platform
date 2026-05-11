import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';

export default function PublicProfileScreen() {
  const theme = useThemeStore((s) => s.theme);
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [following, setFollowing] = useState(false);
  const [profile, setProfile] = useState<{ name: string; goal: string; totalWorkouts: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_profiles')
      .select('name, goal, total_workouts')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setProfile({ name: data.name, goal: data.goal, totalWorkouts: (data as any).total_workouts ?? 0 });
      });
  }, [userId]);

  const initials = profile?.name
    ? profile.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Hero */}
      <View style={{ height: 160, backgroundColor: theme.cardDark, position: 'relative' }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3, backgroundColor: theme.primary }} />
        <View style={{ position: 'absolute', top: 52, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => showAlert('Options', 'Signaler, bloquer…')}
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 16, marginTop: -42 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
            <View style={{
              width: 84, height: 84, borderRadius: 22,
              backgroundColor: theme.violet, alignItems: 'center', justifyContent: 'center',
              borderWidth: 4, borderColor: theme.background,
            }}>
              <Text style={{ fontWeight: '800', fontSize: 30, color: '#fff' }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, paddingBottom: 8, flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => setFollowing((f) => !f)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
                  backgroundColor: following ? theme.text + '14' : theme.text,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: following ? theme.text : theme.background }}>
                  {following ? 'Suivi ✓' : 'Suivre'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => showAlert('Message', 'Chat bientôt disponible.')}
                style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: theme.border }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>
            {profile?.name ?? 'Chargement…'}
          </Text>
          <Text style={{ fontSize: 12, color: theme.muted }}>
            Objectif : {profile?.goal ?? '—'}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {[
              { v: profile?.totalWorkouts ?? 0, l: 'Séances' },
              { v: '—', l: 'Défis' },
              { v: '—', l: 'Abonnés' },
            ].map((s, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{s.v}</Text>
                <Text style={{ fontSize: 10, color: theme.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' }}>{s.l}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
