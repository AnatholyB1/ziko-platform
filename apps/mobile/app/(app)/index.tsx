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
import { format, startOfDay, differenceInCalendarDays, addDays, getDay } from 'date-fns';
import type { ProgramExercise } from '@ziko/plugin-sdk';

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
  const activeProgram = useWorkoutStore((s) => s.activeProgram);
  const loadPrograms = useWorkoutStore((s) => s.loadPrograms);
  const startSession = useWorkoutStore((s) => s.startSession);
  const openChat = useAIStore((s) => s.openChat);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = React.useState<number | null>(null);

  useEffect(() => {
    loadRecentSessions(30);
    loadPrograms();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRecentSessions(30), loadPrograms()]);
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

  // ── Weekly calendar data ──────────────────────────────────
  // JS getDay: 0=Sun, DB day_of_week: 1=Mon..7=Sun
  const jsToDb = (jsDay: number) => (jsDay === 0 ? 7 : jsDay);
  const todayDbDay = jsToDb(getDay(new Date()));

  const weekDays = React.useMemo(() => {
    const today = startOfDay(new Date());
    const jsToday = getDay(today); // 0=Sun
    const mondayOffset = jsToday === 0 ? -6 : 1 - jsToday;
    const monday = addDays(today, mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      const dbDay = i + 1; // 1=Mon..7=Sun
      return { date, dbDay, isToday: differenceInCalendarDays(date, today) === 0 };
    });
  }, []);

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Find today's workout from the active program
  const todaysWorkout = React.useMemo(() => {
    if (!activeProgram?.program_workouts) return null;
    return activeProgram.program_workouts.find((w) => w.day_of_week === todayDbDay) ?? null;
  }, [activeProgram, todayDbDay]);

  // Scheduled days set from active program
  const scheduledDays = React.useMemo(() => {
    if (!activeProgram?.program_workouts) return new Set<number>();
    return new Set(activeProgram.program_workouts.map((w) => w.day_of_week).filter(Boolean) as number[]);
  }, [activeProgram]);

  // Map of dbDay → workout for quick lookup
  const workoutsByDay = React.useMemo(() => {
    const map = new Map<number, typeof todaysWorkout>();
    if (!activeProgram?.program_workouts) return map;
    activeProgram.program_workouts.forEach((w) => {
      if (w.day_of_week) map.set(w.day_of_week, w);
    });
    return map;
  }, [activeProgram]);

  // Session dates set for quick "done" check
  const sessionDates = React.useMemo(() => {
    return new Set(recentSessions.map((s) => format(new Date(s.started_at), 'yyyy-MM-dd')));
  }, [recentSessions]);

  // Selected day info
  const selectedDay = selectedDayIndex !== null ? weekDays[selectedDayIndex] : null;
  const selectedWorkout = selectedDay ? workoutsByDay.get(selectedDay.dbDay) ?? null : null;
  const selectedDayDone = selectedDay ? sessionDates.has(format(selectedDay.date, 'yyyy-MM-dd')) : false;
  const selectedIsPast = selectedDay ? differenceInCalendarDays(new Date(), selectedDay.date) > 0 : false;
  const selectedIsToday = selectedDay?.isToday ?? false;

  const formatExerciseDetail = (pe: ProgramExercise) => {
    const parts: string[] = [];
    if (pe.sets) parts.push(`${pe.sets}×`);
    if (pe.reps) parts.push(`${pe.reps}`);
    else if (pe.reps_min && pe.reps_max) parts.push(`${pe.reps_min}-${pe.reps_max}`);
    else if (pe.duration_seconds) parts.push(`${pe.duration_seconds}s`);
    else if (pe.duration_min && pe.duration_max) parts.push(`${pe.duration_min}-${pe.duration_max}s`);
    if (pe.weight_kg) parts.push(`@ ${pe.weight_kg}kg`);
    return parts.join(' ');
  };

  const handleStartWorkout = async (workout: typeof todaysWorkout) => {
    if (!workout) return;
    await startSession(workout.id, workout.name);
    router.push('/(app)/workout/session');
  };

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

        {/* Weekly calendar strip — interactive */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 120 }}
          style={{ marginBottom: 20 }}
        >
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
            This week
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {weekDays.map((day, i) => {
              const hasWorkout = scheduledDays.has(day.dbDay);
              const hadSession = sessionDates.has(format(day.date, 'yyyy-MM-dd'));
              const isSelected = selectedDayIndex === i;
              const isPast = differenceInCalendarDays(new Date(), day.date) > 0;

              let bgColor = 'transparent';
              let borderW = 0;
              if (isSelected) { bgColor = colors.primary; borderW = 0; }
              else if (day.isToday) { bgColor = colors.primary + '18'; borderW = 2; }
              else if (hasWorkout) { bgColor = colors.surface; borderW = 1; }

              return (
                <TouchableOpacity key={i} activeOpacity={0.7}
                  onPress={() => setSelectedDayIndex(isSelected ? null : i)}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
                    backgroundColor: bgColor,
                    borderWidth: borderW,
                    borderColor: day.isToday && !isSelected ? colors.primary : colors.border,
                  }}>
                  <Text style={{ color: isSelected ? '#fff' : colors.textMuted, fontSize: 10, fontWeight: '600' }}>
                    {DAY_LABELS[i]}
                  </Text>
                  <Text style={{ color: isSelected ? '#fff' : colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 }}>
                    {format(day.date, 'd')}
                  </Text>
                  {/* Status dot */}
                  {hadSession && hasWorkout ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? '#fff' : '#4CAF50', marginTop: 3 }} />
                  ) : hasWorkout && !hadSession && isPast ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? '#ffffff99' : '#F44336', marginTop: 3 }} />
                  ) : hasWorkout && !hadSession ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? '#ffffff66' : colors.primary, marginTop: 3 }} />
                  ) : (
                    <View style={{ width: 6, height: 6, marginTop: 3 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' }} />
              <Text style={{ color: colors.textMuted, fontSize: 10 }}>Done</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <Text style={{ color: colors.textMuted, fontSize: 10 }}>Scheduled</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F44336' }} />
              <Text style={{ color: colors.textMuted, fontSize: 10 }}>Missed</Text>
            </View>
          </View>
        </MotiView>

        {/* Selected day detail OR today's workout */}
        {activeProgram ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350, delay: 180 }}
            style={{ marginBottom: 24 }}
            key={selectedDayIndex ?? 'today'}
          >
            {(() => {
              const dayToShow = selectedDay ?? weekDays.find((d) => d.isToday);
              const workoutToShow = selectedWorkout ?? (selectedDayIndex === null ? todaysWorkout : null);
              const isDone = selectedDay ? selectedDayDone : !!todaySession;
              const dayLabel = dayToShow ? format(dayToShow.date, 'EEEE, MMM d') : format(new Date(), 'EEEE, MMM d');
              const isToday = selectedIsToday || selectedDayIndex === null;
              const isPast = selectedDay ? selectedIsPast : false;

              return (
                <>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
                    {isToday ? `Today — ${dayLabel}` : dayLabel}
                  </Text>

                  {workoutToShow ? (
                    <View style={{
                      backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1,
                      borderColor: isDone ? '#4CAF50' : colors.border,
                    }}>
                      {/* Status badge */}
                      {isDone && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                          <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600' }}>Completed</Text>
                        </View>
                      )}
                      {!isDone && isPast && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <Ionicons name="close-circle" size={16} color="#F44336" />
                          <Text style={{ color: '#F44336', fontSize: 12, fontWeight: '600' }}>Missed</Text>
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>{activeProgram.name}</Text>
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 17, marginTop: 2 }}>{workoutToShow.name}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                            {workoutToShow.program_exercises?.length ?? 0} exercises
                          </Text>
                        </View>
                        {!isDone && (isToday || !isPast) && (
                          <TouchableOpacity onPress={() => handleStartWorkout(workoutToShow)}
                            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Start</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {(workoutToShow.program_exercises ?? [])
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((pe) => (
                          <View key={pe.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <View style={{
                              width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                              backgroundColor: isDone ? '#4CAF5022' : colors.primary + '22',
                            }}>
                              <Ionicons name={isDone ? 'checkmark' : 'barbell-outline'} size={12} color={isDone ? '#4CAF50' : colors.primary} />
                            </View>
                            <Text style={{ color: isDone ? colors.textMuted : colors.text, fontSize: 13, flex: 1,
                              textDecorationLine: isDone ? 'line-through' : 'none' }}>{pe.exercises?.name ?? 'Exercise'}</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{formatExerciseDetail(pe)}</Text>
                          </View>
                        ))}
                    </View>
                  ) : (
                    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                      <Text style={{ fontSize: 28 }}>😌</Text>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginTop: 8 }}>Rest day</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>No workout scheduled</Text>
                    </View>
                  )}
                </>
              );
            })()}
          </MotiView>
        ) : (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 400, delay: 180 }}
            style={{ marginBottom: 24 }}
          >
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
              Today — {format(new Date(), 'EEEE, MMM d')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DaySummaryCard title="This week" value={weeklyCount} icon="🏋️" color={colors.primary} delay={0} />
              <DaySummaryCard title="Today" value={todaySession ? '✔' : '—'} icon="⚡" color={todaySession ? colors.accent : colors.textMuted} delay={80} />
              <DaySummaryCard title="Goal" value={profile?.goal?.replace('_', ' ') ?? '—'} icon="🎯" color={colors.warning} delay={160} />
            </View>
          </MotiView>
        )}

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
