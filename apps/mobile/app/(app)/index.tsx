import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useWorkoutStore } from '../../src/stores/workoutStore';
import { useAIStore } from '../../src/stores/aiStore';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import { format, startOfDay, differenceInCalendarDays } from 'date-fns';

function StreakBadge({ count }: { count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF980022', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
      <Text style={{ fontSize: 14 }}>🔥</Text>
      <Text style={{ color: '#FF9800', fontWeight: '700', fontSize: 13 }}>{count} day streak</Text>
    </View>
  );
}

function DaySummaryCard({
  title, value, unit, icon, color,
}: { title: string; value: string | number; unit?: string; icon: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2E2E40' }}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={{ color, fontWeight: '700', fontSize: 22, marginTop: 8 }}>{value}</Text>
      {unit && <Text style={{ color: '#8888A8', fontSize: 11 }}>{unit}</Text>}
      <Text style={{ color: '#8888A8', fontSize: 12, marginTop: 4 }}>{title}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const profile = useAuthStore((s) => s.profile);
  const recentSessions = useWorkoutStore((s) => s.recentSessions);
  const loadRecentSessions = useWorkoutStore((s) => s.loadRecentSessions);
  const openChat = useAIStore((s) => s.openChat);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    loadRecentSessions(30);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecentSessions(30);
    setRefreshing(false);
  };

  // Calculate streak
  const streak = React.useMemo(() => {
    if (!recentSessions.length) return 0;
    const uniqueDays = new Set(
      recentSessions.map((s) => format(new Date(s.started_at), 'yyyy-MM-dd')),
    );
    let current = 0;
    let date = startOfDay(new Date());
    while (uniqueDays.has(format(date, 'yyyy-MM-dd'))) {
      current++;
      date = new Date(date.getTime() - 86400000);
    }
    return current;
  }, [recentSessions]);

  const todaySession = recentSessions.find(
    (s) => differenceInCalendarDays(new Date(), new Date(s.started_at)) === 0,
  );

  const weeklyCount = recentSessions.filter(
    (s) => differenceInCalendarDays(new Date(), new Date(s.started_at)) < 7,
  ).length;

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <View>
            <Text style={{ color: '#8888A8', fontSize: 14 }}>{greeting} 👋</Text>
            <Text style={{ color: '#F0F0F5', fontSize: 26, fontWeight: '800', marginTop: 2 }}>
              {profile?.name ?? 'Athlete'}
            </Text>
          </View>
          <StreakBadge count={streak} />
        </View>

        {/* Today summary */}
        <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
          Today — {format(new Date(), 'EEEE, MMM d')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          <DaySummaryCard title="Sessions this week" value={weeklyCount} icon="🏋️" color="#6C63FF" />
          <DaySummaryCard title="Today's workout" value={todaySession ? '✓' : '—'} icon="⚡" color={todaySession ? '#4CAF50' : '#8888A8'} />
          <DaySummaryCard title="Goal" value={profile?.goal?.replace('_', ' ') ?? '—'} icon="🎯" color="#FF6584" />
        </View>

        {/* Quick actions */}
        <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
          Quick actions
        </Text>
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.push('/(app)/workout/session')}
            style={{ backgroundColor: '#6C63FF', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <Ionicons name="play-circle" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Start Workout</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push('/(app)/workout')}
              style={{ flex: 1, backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2E2E40', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="list" size={20} color="#6C63FF" />
              <Text style={{ color: '#F0F0F5', fontSize: 13, fontWeight: '500' }}>My Programs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(app)/workout/history')}
              style={{ flex: 1, backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2E2E40', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="bar-chart" size={20} color="#6C63FF" />
              <Text style={{ color: '#F0F0F5', fontSize: 13, fontWeight: '500' }}>Progress</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openChat}
              style={{ flex: 1, backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2E2E40', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="sparkles" size={20} color="#6C63FF" />
              <Text style={{ color: '#F0F0F5', fontSize: 13, fontWeight: '500' }}>Ask AI</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Plugin widgets */}
        {enabledPlugins.length > 0 && (
          <>
            <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 16, marginTop: 28, marginBottom: 12 }}>
              Active Plugins
            </Text>
            {enabledPlugins.map((pid) => (
              <TouchableOpacity
                key={pid}
                onPress={() => router.push(`/(app)/store/${pid}` as any)}
                style={{ backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2E2E40', marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#6C63FF22', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="grid" size={18} color="#6C63FF" />
                </View>
                <Text style={{ color: '#F0F0F5', fontWeight: '500', fontSize: 14, flex: 1 }}>{pid === 'nutrition' ? '🥗 Nutrition Tracker' : pid === 'persona' ? '🎭 AI Persona' : pid}</Text>
                <Ionicons name="chevron-forward" size={16} color="#8888A8" />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <>
            <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 16, marginTop: 28, marginBottom: 12 }}>
              Recent Workouts
            </Text>
            {recentSessions.slice(0, 5).map((session) => (
              <View
                key={session.id}
                style={{ backgroundColor: '#1A1A24', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2E2E40', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' }}
              >
                <View>
                  <Text style={{ color: '#F0F0F5', fontWeight: '600', fontSize: 14 }}>{session.name ?? 'Workout'}</Text>
                  <Text style={{ color: '#8888A8', fontSize: 12, marginTop: 2 }}>
                    {format(new Date(session.started_at), 'EEE, MMM d')}
                  </Text>
                </View>
                {session.total_volume_kg && (
                  <Text style={{ color: '#6C63FF', fontWeight: '600', fontSize: 14 }}>
                    {session.total_volume_kg.toLocaleString()} kg
                  </Text>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
