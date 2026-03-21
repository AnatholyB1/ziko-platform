import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useAuthStore } from '../../src/stores/authStore';
import { useWorkoutStore } from '../../src/stores/workoutStore';
import { useAIStore } from '../../src/stores/aiStore';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import { useTranslation } from '@ziko/plugin-sdk';
import { colors, Card, ProgressBar } from '@ziko/ui';
import { useThemeStore } from '../../src/stores/themeStore';
import { format, startOfDay, differenceInCalendarDays, addDays, getDay } from 'date-fns';
import type { ProgramExercise } from '@ziko/plugin-sdk';

function StreakBadge({ count, primary }: { count: number; primary?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warning + '20', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
      <Text style={{ fontSize: 14 }}>{"\uD83D\uDD25"}</Text>
      <Text style={{ color: colors.warning, fontWeight: '700', fontSize: 13 }}>{count}d</Text>
    </View>
  );
}

function DaySummaryCard({
  title, value, unit, icon, color, delay = 0,
}: { title: string; value: string | number; unit?: string; icon: string; color: string; delay?: number }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', delay }}
      style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: theme.border }}
    >
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={{ color, fontWeight: '800', fontSize: 22, marginTop: 8 }}>{value}</Text>
      {unit && <Text style={{ color: theme.muted, fontSize: 11 }}>{unit}</Text>}
      <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>{title}</Text>
    </MotiView>
  );
}

function QuickActionBtn({ icon, label, onPress, primary = false, delay = 0 }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean; delay?: number;
}) {
  const theme = useThemeStore((s) => s.theme);
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
          ? { backgroundColor: theme.primary, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 }
          : { backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center', gap: 6 }
        }
      >
        <Ionicons name={icon} size={22} color={primary ? '#fff' : theme.primary} />
        <Text style={{ color: primary ? '#fff' : theme.text, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
      </TouchableOpacity>
    </MotiView>
  );
}

export default function DashboardScreen() {
  const { t, tExercise } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const recentSessions = useWorkoutStore((s) => s.recentSessions);
  const loadRecentSessions = useWorkoutStore((s) => s.loadRecentSessions);
  const activeProgram = useWorkoutStore((s) => s.activeProgram);
  const loadPrograms = useWorkoutStore((s) => s.loadPrograms);
  const startSession = useWorkoutStore((s) => s.startSession);
  const openChat = useAIStore((s) => s.openChat);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
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
    if (h < 12) return t('greeting.morning');
    if (h < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  }, []);

  // -- Weekly calendar data ----------------------------------
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

  const DAY_LABELS = [t('day.mon'), t('day.tue'), t('day.wed'), t('day.thu'), t('day.fri'), t('day.sat'), t('day.sun')];

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

  // Map of dbDay ? workout for quick lookup
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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 20 + insets.top, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}
        >
          <View>
            <Text style={{ color: theme.muted, fontSize: 14 }}>{greeting} {"\uD83D\uDC4B"}</Text>
            <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', marginTop: 2 }}>
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
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
              {t('home.weeklyGoal')}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              {weeklyCount} / {weeklyGoal} sessions
            </Text>
          </View>
          <ProgressBar
            progress={weeklyCount / weeklyGoal}
            color={weeklyCount >= weeklyGoal ? colors.accent : theme.primary}
            height={8}
          />
        </MotiView>

        {/* Weekly calendar strip - interactive */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 120 }}
          style={{ marginBottom: 20 }}
        >
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
            {t('home.thisWeek')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {weekDays.map((day, i) => {
              const hasWorkout = scheduledDays.has(day.dbDay);
              const hadSession = sessionDates.has(format(day.date, 'yyyy-MM-dd'));
              const isSelected = selectedDayIndex === i;
              const isPast = differenceInCalendarDays(new Date(), day.date) > 0;

              let bgColor = 'transparent';
              let borderW = 0;
              if (isSelected) { bgColor = theme.primary; borderW = 0; }
              else if (day.isToday) { bgColor = theme.primary + '18'; borderW = 2; }
              else if (hasWorkout) { bgColor = theme.surface; borderW = 1; }

              return (
                <TouchableOpacity key={i} activeOpacity={0.7}
                  onPress={() => setSelectedDayIndex(isSelected ? null : i)}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
                    backgroundColor: bgColor,
                    borderWidth: borderW,
                    borderColor: day.isToday && !isSelected ? theme.primary : theme.border,
                  }}>
                  <Text style={{ color: isSelected ? '#fff' : theme.muted, fontSize: 10, fontWeight: '600' }}>
                    {DAY_LABELS[i]}
                  </Text>
                  <Text style={{ color: isSelected ? '#fff' : theme.text, fontSize: 15, fontWeight: '700', marginTop: 2 }}>
                    {format(day.date, 'd')}
                  </Text>
                  {/* Status dot */}
                  {hadSession && hasWorkout ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? '#fff' : '#4CAF50', marginTop: 3 }} />
                  ) : hasWorkout && !hadSession && isPast ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? '#ffffff99' : '#F44336', marginTop: 3 }} />
                  ) : hasWorkout && !hadSession ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? '#ffffff66' : theme.primary, marginTop: 3 }} />
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
              <Text style={{ color: theme.muted, fontSize: 10 }}>{t('home.completed')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary }} />
              <Text style={{ color: theme.muted, fontSize: 10 }}>{t('home.scheduled')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F44336' }} />
              <Text style={{ color: theme.muted, fontSize: 10 }}>{t('home.missed')}</Text>
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
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
                    {isToday ? `Today - ${dayLabel}` : dayLabel}
                  </Text>

                  {workoutToShow ? (
                    <View style={{
                      backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1,
                      borderColor: isDone ? '#4CAF50' : theme.border,
                    }}>
                      {/* Status badge */}
                      {isDone && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                          <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600' }}>{t('home.completed')}</Text>
                        </View>
                      )}
                      {!isDone && isPast && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <Ionicons name="close-circle" size={16} color="#F44336" />
                          <Text style={{ color: '#F44336', fontSize: 12, fontWeight: '600' }}>{t('home.missed')}</Text>
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '600' }}>{activeProgram.name}</Text>
                          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 17, marginTop: 2 }}>{workoutToShow.name}</Text>
                          <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
                            {workoutToShow.program_exercises?.length ?? 0} exercises
                          </Text>
                        </View>
                        {!isDone && (isToday || !isPast) && (
                          <TouchableOpacity onPress={() => handleStartWorkout(workoutToShow)}
                            style={{ backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
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
                              backgroundColor: isDone ? '#4CAF5022' : theme.primary + '22',
                            }}>
                              <Ionicons name={isDone ? 'checkmark' : 'barbell-outline'} size={12} color={isDone ? '#4CAF50' : theme.primary} />
                            </View>
                            <Text style={{ color: isDone ? theme.muted : theme.text, fontSize: 13, flex: 1,
                              textDecorationLine: isDone ? 'line-through' : 'none' }}>{tExercise(pe.exercises?.name ?? 'Exercise')}</Text>
                            <Text style={{ color: theme.muted, fontSize: 11 }}>{formatExerciseDetail(pe)}</Text>
                          </View>
                        ))}
                    </View>
                  ) : (
                    <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
                      <Text style={{ fontSize: 28 }}>{"\uD83D\uDE34"}</Text>
                      <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginTop: 8 }}>{t('home.restDay')}</Text>
                      <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>{t('home.noWorkout')}</Text>
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
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
              Today - {format(new Date(), 'EEEE, MMM d')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DaySummaryCard title={t('home.thisWeek')} value={weeklyCount} icon={"\uD83C\uDFCB\uFE0F"} color={theme.primary} delay={0} />
              <DaySummaryCard title={t('general.today')} value={todaySession ? '\u2705' : '\u274C'} icon="\uD83D\uDCCA" color={todaySession ? colors.accent : theme.muted} delay={80} />
              <DaySummaryCard title="Goal" value={profile?.goal?.replace('_', ' ') ?? '-'} icon={"\uD83C\uDFAF"} color={colors.warning} delay={160} />
            </View>
          </MotiView>
        )}

        {/* Quick actions */}
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
          {t('home.quickActions')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <QuickActionBtn icon="play-circle" label={t('home.startWorkout')} onPress={() => router.push('/(app)/workout/session')} primary delay={0} />
          <QuickActionBtn icon="list" label={t('home.programs')} onPress={() => router.push('/(app)/workout')} delay={80} />
          <QuickActionBtn icon="bar-chart" label={t('home.progress')} onPress={() => router.push('/(app)/workout/history')} delay={160} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <QuickActionBtn icon="chatbubble-ellipses" label={t('home.chat')} onPress={() => router.push('/(app)/(plugins)/community/chat' as any)} delay={200} />
          <QuickActionBtn icon="storefront" label={t('home.shop')} onPress={() => router.push('/(app)/(plugins)/gamification/shop' as any)} delay={260} />
          <QuickActionBtn icon="sparkles" label={t('home.askAI')} onPress={openChat} delay={320} />
        </View>

        {/* Calorie tracker shortcut - nutrition plugin */}
        {enabledPlugins.includes('nutrition') && (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350, delay: 260 }}
          >
            <TouchableOpacity
              onPress={() => router.push('/(app)/(plugins)/nutrition/log' as any)}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: theme.surface, borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: '#FF5C1A44', marginBottom: 8,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 14, backgroundColor: '#FF5C1A18',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 22 }}>🥗</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{t('home.trackCalories')}</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{t('home.trackCaloriesDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.muted} />
            </TouchableOpacity>
          </MotiView>
        )}

        {/* Challenges entry - community plugin */}
        {enabledPlugins.includes('community') && (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350, delay: 300 }}
          >
            <TouchableOpacity
              onPress={() => router.push('/(app)/(plugins)/community/challenges' as any)}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: theme.surface, borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: theme.primary + '44', marginBottom: 8,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 14, backgroundColor: theme.primary + '18',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="trophy" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{t('home.challenges')}</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{t('home.challengeDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.muted} />
            </TouchableOpacity>
          </MotiView>
        )}

        {/* Plugin widgets */}
        {enabledPlugins.length > 0 && (
          <>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginTop: 28, marginBottom: 12 }}>
              {t('home.activePlugins')}
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
                    style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={(manifest?.icon as any) ?? 'grid'} size={18} color={theme.primary} />
                    </View>
                    <Text style={{ color: theme.text, fontWeight: '500', fontSize: 14, flex: 1 }}>
                      {manifest?.name ?? pid}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.muted} />
                  </TouchableOpacity>
                </MotiView>
              );
            })}
          </>
        )}

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginTop: 28, marginBottom: 12 }}>
              {t('home.recentWorkouts')}
            </Text>
            {recentSessions.slice(0, 5).map((session, i) => (
              <MotiView
                key={session.id}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: i * 50 }}
              >
                <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{session.name ?? 'Workout'}</Text>
                    <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
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
    </View>
  );
}
