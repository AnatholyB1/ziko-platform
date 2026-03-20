import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useAuthStore } from '../../src/stores/authStore';
import { useWorkoutStore } from '../../src/stores/workoutStore';
import { useAIStore } from '../../src/stores/aiStore';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import { colors, Card, ProgressBar } from '@ziko/ui';
import { format, startOfDay, differenceInCalendarDays } from 'date-fns';

function StreakBadge({ count }: { count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warning + '20', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
      <Text style={{ fontSize: 14 }}>🔥</Text>
      <Text style={{ color: colors.warning, fontWeight: '700', fontSize: 13 }}>{count}d streak</Text>
    </View>
  );
}

function DaySummaryCard({
  title, value, unit, icon, color, delay = 0,
}: { title: string; value: string | number; unit?: string; icon: string; color: string; delay?: number }) {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', delay }}
      style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border }}
    >
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={{ color, fontWeight: '800', fontSize: 22, marginTop: 8 }}>{value}</Text>
      {unit && <Text style={{ color: colors.textMuted, fontSize: 11 }}>{unit}</Text>}
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{title}</Text>
    </MotiView>
  );
}

function QuickActionBtn({ icon, label, onPress, primary = false, delay = 0 }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean; delay?: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 350, delay }}
      style={{ flex: 1 }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={primary
          ? { backgroundColor: colors.primary, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 }
          : { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 6 }
        }
      >
        <Ionicons name={icon} size={22} color={primary ? '#fff' : colors.primary} />
        <Text style={{ color: primary ? '#fff' : colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
      </TouchableOpacity>
    </MotiView>
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

  const weeklyGoal = 4;

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}
        >
          <View>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>{greeting} 👋</Text>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 2 }}>
              {profile?.name ?? 'Athlete'}
            </Text>
          </View>
          {streak > 0 && <StreakBadge count={streak} />}
        </MotiView>

        {/* Weekly progress bar */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 80 }}
          style={{ marginBottom: 20 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
              Weekly goal
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {weeklyCount} / {weeklyGoal} sessions
            </Text>
          </View>
          <ProgressBar
            progress={weeklyCount / weeklyGoal}
            color={weeklyCount >= weeklyGoal ? colors.accent : colors.primary}
            height={8}
          />
        </MotiView>

        {/* Today summary */}
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
          Today — {format(new Date(), 'EEEE, MMM d')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          <DaySummaryCard title="This week" value={weeklyCount} icon="🏋️" color={colors.primary} delay={0} />
          <DaySummaryCard title="Today" value={todaySession ? '✔' : '—'} icon="⚡" color={todaySession ? colors.accent : colors.textMuted} delay={80} />
          <DaySummaryCard title="Goal" value={profile?.goal?.replace('_', ' ') ?? '—'} icon="🎯" color={colors.warning} delay={160} />
        </View>

        {/* Quick actions */}
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
          Quick actions
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <QuickActionBtn icon="play-circle" label="Start Workout" onPress={() => router.push('/(app)/workout/session')} primary delay={0} />
          <QuickActionBtn icon="list" label="Programs" onPress={() => router.push('/(app)/workout')} delay={80} />
          <QuickActionBtn icon="bar-chart" label="Progress" onPress={() => router.push('/(app)/workout/history')} delay={160} />
          <QuickActionBtn icon="sparkles" label="Ask AI" onPress={openChat} delay={240} />
        </View>

        {/* Plugin widgets */}
        {enabledPlugins.length > 0 && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 28, marginBottom: 12 }}>
              Active Plugins
            </Text>
            {enabledPlugins.map((pid, i) => {
              const manifests = usePluginRegistry.getState().manifests;
              const manifest = manifests[pid];
              const mainRoute = manifest?.routes.find((r) => r.showInTabBar) ?? manifest?.routes[0];
              const destination = mainRoute?.path ?? `/(app)/store/${pid}`;
              return (
                <MotiView
                  key={pid}
                  from={{ opacity: 0, translateX: -12 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 350, delay: i * 60 }}
                >
                  <TouchableOpacity
                    onPress={() => router.push(destination as any)}
                    activeOpacity={0.75}
                    style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={(manifest?.icon as any) ?? 'grid'} size={18} color={colors.primary} />
                    </View>
                    <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14, flex: 1 }}>
                      {manifest?.name ?? pid}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </MotiView>
              );
            })}
          </>
        )}

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 28, marginBottom: 12 }}>
              Recent Workouts
            </Text>
            {recentSessions.slice(0, 5).map((session, i) => (
              <MotiView
                key={session.id}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: i * 50 }}
              >
                <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{session.name ?? 'Workout'}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {format(new Date(session.started_at), 'EEE, MMM d')}
                    </Text>
                  </View>
                  {session.total_volume_kg != null && (
                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>
                      {session.total_volume_kg.toLocaleString()} kg
                    </Text>
                  )}
                </View>
              </MotiView>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
