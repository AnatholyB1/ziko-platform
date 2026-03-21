import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useCardioStore, ACTIVITY_LABELS, formatPace } from '../store';
import type { CardioSession } from '../store';

export default function CardioDashboard({ supabase }: { supabase: any }) {
  const { sessions, setSessions, loading, setLoading, getTotalDistance, getTotalDuration, getSessionCount } = useCardioStore();
  const theme = useThemeStore((s) => s.theme);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('cardio_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50);

      setSessions(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalDist = getTotalDistance(30);
  const totalDur = getTotalDuration(30);
  const sessionCount = getSessionCount(30);

  const renderStat = (label: string, value: string, icon: string, color: string) => (
    <View style={{
      flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: theme.border, alignItems: 'center',
    }}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, marginTop: 6 }}>{value}</Text>
      <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );

  const renderSession = (session: CardioSession) => {
    const activity = ACTIVITY_LABELS[session.activity_type] ?? ACTIVITY_LABELS.other;
    return (
      <View
        key={session.id}
        style={{
          backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 10,
          borderWidth: 1, borderColor: theme.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: activity.color + '22',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 22 }}>{activity.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{activity.label}</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
              {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.muted, fontSize: 11 }}>Durée</Text>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{session.duration_min} min</Text>
          </View>
          {session.distance_km != null && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.muted, fontSize: 11 }}>Distance</Text>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{session.distance_km.toFixed(1)} km</Text>
            </View>
          )}
          {session.avg_pace_sec_per_km != null && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.muted, fontSize: 11 }}>Allure</Text>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{formatPace(session.avg_pace_sec_per_km)}</Text>
            </View>
          )}
          {session.calories_burned != null && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.muted, fontSize: 11 }}>Calories</Text>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{session.calories_burned} kcal</Text>
            </View>
          )}
        </View>

        {session.notes ? (
          <Text style={{ color: theme.muted, fontSize: 12, marginTop: 8 }} numberOfLines={2}>
            {session.notes}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <View>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>Cardio</Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>30 derniers jours</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(plugins)/cardio/log' as any)}
            style={{
              backgroundColor: theme.primary, borderRadius: 12,
              width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {renderStat('Distance', `${totalDist.toFixed(1)} km`, 'map-outline', '#FF5722')}
          {renderStat('Durée', `${totalDur} min`, 'time-outline', '#2196F3')}
          {renderStat('Sessions', `${sessionCount}`, 'calendar-outline', '#4CAF50')}
        </View>

        {/* Sessions list */}
        {loading && sessions.length === 0 ? (
          <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 40 }}>Chargement...</Text>
        ) : sessions.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🏃</Text>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, marginBottom: 8 }}>
              Aucune session
            </Text>
            <Text style={{ color: theme.muted, textAlign: 'center', fontSize: 14 }}>
              Enregistrez votre première session cardio pour commencer le suivi.
            </Text>
          </View>
        ) : (
          sessions.map(renderSession)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
