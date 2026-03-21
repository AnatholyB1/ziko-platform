import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  Alert, Modal, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { colors as C } from '@ziko/ui';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';
import { useHabitsStore, DEFAULT_HABITS } from '../store';
import type { Habit } from '../store';
import { awardHabitXP } from '@ziko/plugin-gamification/store';
import {
  requestNotificationPermission,
  scheduleHabitReminder,
  cancelHabitReminder,
} from '../notifications';

// Cross-plugin: persona for agent name / coaching style
let usePersonaStore: any = null;
try { usePersonaStore = require('@ziko/plugin-persona').usePersonaStore; } catch {}

// Cross-plugin: nutrition store for calorie progress
let useNutritionStore: any = null;
try { useNutritionStore = require('@ziko/plugin-nutrition').useNutritionStore; } catch {}

// ── Motivational messages by coaching style ──────────────
const MOTIVATIONAL = {
  motivational: ['You\'re crushing it! 🔥', 'Keep the momentum going!', 'Every rep counts! 💪'],
  analytical: ['Stay consistent with your metrics.', 'Track, measure, improve.', 'Data doesn\'t lie — great work.'],
  friendly: ['Hey, you\'re doing amazing! 😊', 'Small steps, big results!', 'I\'m proud of you! 🌟'],
  strict: ['No excuses — complete your habits.', 'Discipline beats motivation.', 'Stay the course.'],
};

function getMotivation(style = 'motivational', completed: number, total: number): string {
  const msgs = MOTIVATIONAL[style as keyof typeof MOTIVATIONAL] ?? MOTIVATIONAL.motivational;
  const pct = total > 0 ? completed / total : 0;
  if (pct === 1) return `Perfect day! All ${total} habits done! 🏆`;
  if (pct >= 0.5) return msgs[0];
  if (pct > 0) return msgs[1];
  return msgs[2];
}

// ── Progress Ring ─────────────────────────────────────────
function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const theme = useThemeStore((s) => s.theme);
  const pct = total > 0 ? completed / total : 0;
  const color = pct === 1 ? C.accent : pct >= 0.5 ? theme.primary : C.warning;
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 14 }}
      style={{ alignItems: 'center', justifyContent: 'center', width: 80, height: 80 }}
    >
      <View style={{
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 6, borderColor: theme.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          position: 'absolute', width: 80, height: 80, borderRadius: 40,
          borderWidth: 6, borderColor: 'transparent',
          borderTopColor: color,
          transform: [{ rotate: `${pct * 360 - 90}deg` }],
        }} />
        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }}>{completed}</Text>
        <Text style={{ color: theme.muted, fontSize: 11 }}>/ {total}</Text>
      </View>
    </MotiView>
  );
}

// ── Habit Card ────────────────────────────────────────────
function HabitCard({
  habit,
  value,
  streak,
  onToggle,
  onIncrement,
  onReminderPress,
}: {
  habit: Habit;
  value: number;
  streak: number;
  onToggle: () => void;
  onIncrement: () => void;
  onReminderPress: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const isCompleted = value >= habit.target;
  const isAuto = habit.source !== 'manual';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
      style={{
        backgroundColor: theme.surface,
        borderRadius: 18,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: isCompleted ? habit.color + '66' : theme.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Emoji + color dot */}
        <View style={{
          width: 48, height: 48, borderRadius: 14,
          backgroundColor: habit.color + '22',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 24 }}>{habit.emoji}</Text>
        </View>

        {/* Name + streak */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{habit.name}</Text>
            {isAuto && (
              <View style={{ backgroundColor: theme.primaryLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: theme.muted, fontSize: 10 }}>auto</Text>
              </View>
            )}
          </View>
          {streak > 0 && (
            <Text style={{ color: C.warning, fontSize: 12, marginTop: 2 }}>🔥 {t('habits.streakDays', { count: String(streak) })}</Text>
          )}
        </View>

        {/* Reminder button */}
        <TouchableOpacity onPress={onReminderPress} style={{ padding: 4 }}>
          <Ionicons
            name={habit.reminder_time ? 'notifications' : 'notifications-outline'}
            size={18}
            color={habit.reminder_time ? habit.color : theme.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Progress / action */}
      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {habit.type === 'boolean' ? (
          <TouchableOpacity
            onPress={!isAuto ? onToggle : undefined}
            disabled={isAuto}
            style={{
              flex: 1,
              backgroundColor: isCompleted ? habit.color : theme.primaryLight,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: isAuto ? 0.8 : 1,
            }}
          >
            <Ionicons
              name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={isCompleted ? '#fff' : theme.muted}
            />
            <Text style={{ color: isCompleted ? '#fff' : theme.muted, fontWeight: '600', fontSize: 14 }}>
              {isCompleted ? t('habits.done') : isAuto ? t('habits.autoTracked') : t('habits.markDone')}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Count progress bar + buttons */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>
                  {value} / {habit.target} {habit.unit ?? ''}
                </Text>
                {isCompleted && <Text style={{ color: C.accent, fontSize: 13 }}>{t('habits.goalReached')}</Text>}
              </View>
              <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3 }}>
                <View style={{
                  width: `${Math.min((value / habit.target) * 100, 100)}%`,
                  height: '100%',
                  backgroundColor: isCompleted ? C.accent : habit.color,
                  borderRadius: 3,
                }} />
              </View>
            </View>
            <TouchableOpacity
              onPress={onIncrement}
              style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: habit.color,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </MotiView>
  );
}

// ── Reminder Time Modal ───────────────────────────────────
function ReminderModal({
  visible,
  habit,
  onClose,
  onSave,
  onRemove,
}: {
  visible: boolean;
  habit: Habit | null;
  onClose: () => void;
  onSave: (time: string) => void;
  onRemove: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [time, setTime] = useState('08:00');
  useEffect(() => { if (habit?.reminder_time) setTime(habit.reminder_time); }, [habit]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, marginBottom: 4 }}>
            {habit?.emoji} {t('habits.setReminder')}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 14, marginBottom: 20 }}>
            {t('habits.reminderForHabit', { name: habit?.name ?? '' })}
          </Text>
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
            placeholderTextColor={theme.muted}
            keyboardType="numbers-and-punctuation"
            style={{
              backgroundColor: theme.background,
              borderRadius: 12,
              padding: 14,
              color: theme.text,
              fontSize: 22,
              textAlign: 'center',
              letterSpacing: 4,
              marginBottom: 16,
            }}
          />
          <TouchableOpacity
            onPress={() => onSave(time)}
            style={{ backgroundColor: theme.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('habits.saveReminder')}</Text>
          </TouchableOpacity>
          {habit?.reminder_time && (
            <TouchableOpacity
              onPress={onRemove}
              style={{ borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 }}
            >
              <Text style={{ color: C.error, fontSize: 14 }}>{t('habits.removeReminder')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={{ padding: 14, alignItems: 'center' }}>
            <Text style={{ color: theme.muted, fontSize: 14 }}>{t('general.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Dashboard ────────────────────────────────────────
export default function HabitsDashboardScreen({ supabase }: { supabase: any }) {
  const {
    habits, setHabits, setTodayLogs, setAllLogs, setIsLoading,
    isLoading, getTodayValue, isCompletedToday, getCompletedCount, getStreak, updateLog,
  } = useHabitsStore();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  const [refreshing, setRefreshing] = useState(false);
  const [reminderHabit, setReminderHabit] = useState<Habit | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Cross-plugin: persona
  const agentName = usePersonaStore ? usePersonaStore((s: any) => s.agentName) : 'Ziko';
  const coachingStyle = usePersonaStore ? usePersonaStore((s: any) => s.coachingStyle) : 'motivational';

  // Cross-plugin: nutrition calorie total
  const nutritionLogs = useNutritionStore ? useNutritionStore((s: any) => s.todayLogs) : [];
  const calorieGoal = useNutritionStore ? useNutritionStore((s: any) => s.calorieGoal) : 0;
  const totalCalories: number = nutritionLogs.reduce((sum: number, l: any) => sum + (l.calories ?? 0), 0);

  // ── Load data ────────────────────────────────────────────
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const today = new Date().toISOString().split('T')[0];

      // Load habits
      let { data: habitsData } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order');

      // Auto-init default habits on first run
      if (!habitsData || habitsData.length === 0) {
        const toInsert = DEFAULT_HABITS.map((h, i) => ({
          ...h,
          user_id: user.id,
          sort_order: i,
        }));
        const { data: inserted } = await supabase.from('habits').insert(toInsert).select('*');
        habitsData = inserted ?? [];
        // Schedule default reminders
        const granted = await requestNotificationPermission();
        if (granted) {
          for (const h of (habitsData as Habit[])) {
            if (h.reminder_time) await scheduleHabitReminder(h, agentName);
          }
        }
      }

      setHabits((habitsData ?? []) as Habit[]);

      // Load today's logs
      const { data: todayData } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);
      setTodayLogs(todayData ?? []);

      // Load last 30 days for streaks
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: historyData } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', since.toISOString().split('T')[0]);
      setAllLogs(historyData ?? []);

      // Auto-sync: workout_auto habits
      const autoWorkoutHabits = (habitsData as Habit[]).filter((h) => h.source === 'workout_auto');
      if (autoWorkoutHabits.length > 0) {
        const { data: sessions } = await supabase
          .from('workout_sessions')
          .select('id')
          .eq('user_id', user.id)
          .gte('started_at', today)
          .limit(1);
        if (sessions && sessions.length > 0) {
          for (const h of autoWorkoutHabits) {
            const alreadyLogged = (todayData ?? []).find((l: any) => l.habit_id === h.id);
            if (!alreadyLogged) {
              await supabase.from('habit_logs').upsert({
                habit_id: h.id, user_id: user.id, date: today, value: 1,
              }, { onConflict: 'habit_id,date' });
              updateLog(h.id, 1);
            }
          }
        }
      }

      // Auto-sync: nutrition_auto habits
      const autoNutritionHabits = (habitsData as Habit[]).filter((h) => h.source === 'nutrition_auto');
      if (autoNutritionHabits.length > 0) {
        const { data: nutritionRows } = await supabase
          .from('nutrition_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', today)
          .limit(1);
        if (nutritionRows && nutritionRows.length > 0) {
          for (const h of autoNutritionHabits) {
            const alreadyLogged = (todayData ?? []).find((l: any) => l.habit_id === h.id);
            if (!alreadyLogged) {
              await supabase.from('habit_logs').upsert({
                habit_id: h.id, user_id: user.id, date: today, value: 1,
              }, { onConflict: 'habit_id,date' });
              updateLog(h.id, 1);
            }
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [agentName]);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // ── Toggle boolean habit ─────────────────────────────────
  const handleToggle = async (habit: Habit) => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    const currentValue = getTodayValue(habit.id);
    const newValue = currentValue >= 1 ? 0 : 1;

    if (newValue === 0) {
      await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('date', today);
    } else {
      await supabase.from('habit_logs').upsert(
        { habit_id: habit.id, user_id: userId, date: today, value: 1 },
        { onConflict: 'habit_id,date' },
      );
    }
    updateLog(habit.id, newValue);
    if (newValue >= 1) {
      try { await awardHabitXP(supabase, habit.name); } catch {}
    }
  };

  // ── Increment count habit ────────────────────────────────
  const handleIncrement = async (habit: Habit) => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    const currentValue = getTodayValue(habit.id);
    const newValue = currentValue + 1;

    await supabase.from('habit_logs').upsert(
      { habit_id: habit.id, user_id: userId, date: today, value: newValue },
      { onConflict: 'habit_id,date' },
    );
    updateLog(habit.id, newValue);
    if (newValue === habit.target) {
      try { await awardHabitXP(supabase, habit.name); } catch {}
    }
  };

  // ── Save/remove reminder ──────────────────────────────────
  const handleSaveReminder = async (time: string) => {
    if (!reminderHabit || !userId) return;
    // Validate HH:MM
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      Alert.alert(t('habits.invalidTime'), t('habits.invalidTimeDesc'));
      return;
    }
    await supabase.from('habits').update({ reminder_time: time }).eq('id', reminderHabit.id);
    const updatedHabit = { ...reminderHabit, reminder_time: time };
    const granted = await requestNotificationPermission();
    if (granted) {
      await scheduleHabitReminder(updatedHabit, agentName);
    }
    setHabits(habits.map((h) => h.id === reminderHabit.id ? updatedHabit : h));
    setReminderHabit(null);
  };

  const handleRemoveReminder = async () => {
    if (!reminderHabit) return;
    await supabase.from('habits').update({ reminder_time: null }).eq('id', reminderHabit.id);
    await cancelHabitReminder(reminderHabit.id);
    setHabits(habits.map((h) => h.id === reminderHabit.id ? { ...h, reminder_time: null } : h));
    setReminderHabit(null);
  };

  const completedCount = getCompletedCount();
  const activeHabits = habits.filter((h) => h.is_active);
  const motivation = getMotivation(coachingStyle, completedCount, activeHabits.length);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 380 }}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}
        >
          <View>
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              {format(new Date(), 'EEEE, MMM d')}
            </Text>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
              {t('habits.dailyHabits')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(plugins)/habits/log' as any)}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 12,
              width: 40, height: 40,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </MotiView>

        {/* Progress summary */}
        <MotiView
          from={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 80 }}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 20,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <ProgressRing completed={completedCount} total={activeHabits.length} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>
              {completedCount === activeHabits.length && activeHabits.length > 0
                ? t('habits.perfectDay')
                : t('habits.doneOfTotal', { done: String(completedCount), total: String(activeHabits.length) })}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
              {motivation}
            </Text>
            <Text style={{ color: theme.primary, fontSize: 12, marginTop: 6 }}>
              — {agentName}
            </Text>
          </View>
        </MotiView>

        {/* Cross-plugin: nutrition card */}
        {calorieGoal > 0 && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 350, delay: 160 }}
            style={{
              backgroundColor: C.accent + '11',
              borderRadius: 16,
              padding: 14,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: C.accent + '33',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 22 }}>🥗</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                {t('habits.nutritionToday')}
              </Text>
              <View style={{ height: 4, backgroundColor: theme.border, borderRadius: 2, marginTop: 6 }}>
                <View style={{
                  width: `${Math.min((totalCalories / calorieGoal) * 100, 100)}%`,
                  height: '100%', backgroundColor: C.accent, borderRadius: 2,
                }} />
              </View>
            </View>
            <Text style={{ color: C.accent, fontWeight: '700', fontSize: 14 }}>
              {totalCalories} / {calorieGoal} kcal
            </Text>
          </MotiView>
        )}

        {/* Habit cards */}
        {isLoading && habits.length === 0 ? (
          <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 40 }}>{t('habits.loadingHabits')}</Text>
        ) : activeHabits.length === 0 ? (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={{ alignItems: 'center', marginTop: 40 }}
          >
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🌱</Text>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, marginBottom: 8 }}>{t('habits.noHabits')}</Text>
            <Text style={{ color: theme.muted, textAlign: 'center', fontSize: 14 }}>
              {t('habits.noHabitsDesc')}
            </Text>
          </MotiView>
        ) : (
          activeHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              value={getTodayValue(habit.id)}
              streak={getStreak(habit.id)}
              onToggle={() => handleToggle(habit)}
              onIncrement={() => handleIncrement(habit)}
              onReminderPress={() => setReminderHabit(habit)}
            />
          ))
        )}
      </ScrollView>

      <ReminderModal
        visible={reminderHabit !== null}
        habit={reminderHabit}
        onClose={() => setReminderHabit(null)}
        onSave={handleSaveReminder}
        onRemove={handleRemoveReminder}
      />
    </SafeAreaView>
  );
}
