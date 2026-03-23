import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import { useThemeStore } from '../../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';
import { useClipboardStore } from '../../../src/stores/clipboardStore';
import { useTranslation } from '@ziko/plugin-sdk';
import type { ProgramExercise, Exercise } from '@ziko/plugin-sdk';


interface ProgramDetail {
  id: string;
  name: string;
  description: string | null;
  days_per_week: number | null;
  is_active: boolean;
  cycle_weeks: number | null;
  progression_type: 'increment' | 'percentage' | null;
  progression_value: number | null;
  current_cycle_week: number | null;
  cycle_start_date: string | null;
}

interface WorkoutDay {
  id: string;
  program_id: string;
  day_of_week: number | null;
  name: string;
  order_index: number;
  program_exercises: (ProgramExercise & { exercises?: { name: string; muscle_groups: string[] } })[];
}

// ── Exercise config form state ────────────────────────────
interface ExerciseConfig {
  sets: string;
  repsMode: 'fixed' | 'range' | 'time' | 'timeRange';
  reps: string;
  repsMin: string;
  repsMax: string;
  duration: string;
  durationMin: string;
  durationMax: string;
  restSeconds: string;
  weightKg: string;
  notes: string;
}

const defaultConfig: ExerciseConfig = {
  sets: '3',
  repsMode: 'fixed',
  reps: '10',
  repsMin: '',
  repsMax: '',
  duration: '',
  durationMin: '',
  durationMax: '',
  restSeconds: '90',
  weightKg: '',
  notes: '',
};

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutDay[]>([]);
  const startSession = useWorkoutStore((s) => s.startSession);
  const exercises = useWorkoutStore((s) => s.exercises);
  const loadExercises = useWorkoutStore((s) => s.loadExercises);
  const copiedDay = useClipboardStore((s) => s.copiedDay);
  const theme = useThemeStore((s) => s.theme);
  const copyDay = useClipboardStore((s) => s.copyDay);
  const { t, tExercise } = useTranslation();

  const DAY_NAMES_T = ['', t('workout.dayMon'), t('workout.dayTue'), t('workout.dayWed'), t('workout.dayThu'), t('workout.dayFri'), t('workout.daySat'), t('workout.daySun')];
  const DAY_FULL_T = ['', t('workout.dayMonFull'), t('workout.dayTueFull'), t('workout.dayWedFull'), t('workout.dayThuFull'), t('workout.dayFriFull'), t('workout.daySatFull'), t('workout.daySunFull')];

  // Add workout day modal
  const [showAddDay, setShowAddDay] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [dayName, setDayName] = useState('');

  // Exercise picker modal
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [targetWorkoutIds, setTargetWorkoutIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);

  // Edit program name
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  // Move day modal
  const [showMoveDay, setShowMoveDay] = useState(false);
  const [movingWorkout, setMovingWorkout] = useState<WorkoutDay | null>(null);

  // Exercise config modal
  const [showConfig, setShowConfig] = useState(false);
  const [configExercise, setConfigExercise] = useState<Exercise | null>(null);
  const [config, setConfig] = useState<ExerciseConfig>(defaultConfig);

  // Cycle config
  const [showCycleConfig, setShowCycleConfig] = useState(false);

  const loadProgram = useCallback(async () => {
    if (!id) return;
    const { data: prog } = await supabase.from('workout_programs').select('*').eq('id', id).single();
    setProgram(prog as ProgramDetail);

    const { data: wkts } = await supabase
      .from('program_workouts')
      .select('*, program_exercises(*, exercises(name, muscle_groups))')
      .eq('program_id', id)
      .order('day_of_week');
    const workoutList = (wkts ?? []) as WorkoutDay[];
    setWorkouts(workoutList);

    // Auto-sync days_per_week with actual workout count
    const actualDays = workoutList.length;
    if (prog && prog.days_per_week !== actualDays) {
      await supabase.from('workout_programs').update({ days_per_week: actualDays }).eq('id', id);
      setProgram((prev) => prev ? { ...prev, days_per_week: actualDays } : prev);
    }
  }, [id]);

  useEffect(() => {
    loadProgram();
    if (exercises.length === 0) loadExercises();
  }, [id]);

  // ── Day used check ──────────────────────────────────────
  const usedDays = workouts.map((w) => w.day_of_week).filter(Boolean) as number[];

  // ── Add workout day ─────────────────────────────────────
  const handleAddDay = async () => {
    if (!id || !dayName.trim()) return;
    const { data } = await supabase
      .from('program_workouts')
      .insert({ program_id: id, name: dayName.trim(), day_of_week: selectedDay, order_index: selectedDay })
      .select()
      .single();
    if (data) {
      setShowAddDay(false);
      setDayName('');
      await loadProgram();
    }
  };

  const handleDeleteDay = (workoutId: string, name: string) => {
    showAlert(t('workout.deleteDay'), t('workout.deleteDayConfirm', { name }), [
      { text: t('general.cancel'), style: 'cancel' },
      {
        text: t('general.delete'), style: 'destructive', onPress: async () => {
          await supabase.from('program_workouts').delete().eq('id', workoutId);
          await loadProgram();
        },
      },
    ]);
  };

  // ── Copy day to clipboard ───────────────────────────────
  const handleCopyDay = (workout: WorkoutDay) => {
    copyDay({
      name: workout.name,
      day_of_week: workout.day_of_week,
      exercises: (workout.program_exercises ?? []).map((pe) => ({
        exercise_id: pe.exercise_id,
        sets: pe.sets, reps: pe.reps, reps_min: pe.reps_min, reps_max: pe.reps_max,
        duration_seconds: pe.duration_seconds, duration_min: pe.duration_min, duration_max: pe.duration_max,
        rest_seconds: pe.rest_seconds, weight_kg: pe.weight_kg, notes: pe.notes, order_index: pe.order_index,
      })),
    });
    showAlert(t('workout.copied'), t('workout.copiedDesc', { name: workout.name }));
  };

  // ── Duplicate day within this program ────────────────────
  const handleDuplicateDay = async (workout: WorkoutDay) => {
    if (!id) return;
    const { data: newW } = await supabase
      .from('program_workouts')
      .insert({ program_id: id, name: `${workout.name} (copy)`, day_of_week: null, order_index: (workouts.length + 1) })
      .select()
      .single();
    if (newW && (workout.program_exercises ?? []).length > 0) {
      const rows = workout.program_exercises.map((pe) => ({
        workout_id: newW.id,
        exercise_id: pe.exercise_id,
        sets: pe.sets, reps: pe.reps, reps_min: pe.reps_min, reps_max: pe.reps_max,
        duration_seconds: pe.duration_seconds, duration_min: pe.duration_min, duration_max: pe.duration_max,
        rest_seconds: pe.rest_seconds, weight_kg: pe.weight_kg, notes: pe.notes, order_index: pe.order_index,
      }));
      await supabase.from('program_exercises').insert(rows);
    }
    await loadProgram();
  };

  // ── Paste clipboard day into this program ────────────────
  const handlePasteDay = async () => {
    if (!id || !copiedDay) return;
    const { data: newW } = await supabase
      .from('program_workouts')
      .insert({ program_id: id, name: copiedDay.name, day_of_week: null, order_index: (workouts.length + 1) })
      .select()
      .single();
    if (newW && copiedDay.exercises.length > 0) {
      const rows = copiedDay.exercises.map((pe) => ({
        workout_id: newW.id,
        exercise_id: pe.exercise_id,
        sets: pe.sets, reps: pe.reps, reps_min: pe.reps_min, reps_max: pe.reps_max,
        duration_seconds: pe.duration_seconds, duration_min: pe.duration_min, duration_max: pe.duration_max,
        rest_seconds: pe.rest_seconds, weight_kg: pe.weight_kg, notes: pe.notes, order_index: pe.order_index,
      }));
      await supabase.from('program_exercises').insert(rows);
    }
    await loadProgram();
  };

  // ── Move day to another day of the week ────────────────
  const handleMoveDay = (workout: WorkoutDay) => {
    setMovingWorkout(workout);
    setShowMoveDay(true);
  };

  const confirmMoveDay = async (newDay: number | null) => {
    if (!movingWorkout) return;
    await supabase
      .from('program_workouts')
      .update({ day_of_week: newDay, order_index: newDay ?? movingWorkout.order_index })
      .eq('id', movingWorkout.id);
    setShowMoveDay(false);
    setMovingWorkout(null);
    await loadProgram();
  };

  // ── Swap two days ───────────────────────────────────────
  const handleSwapDay = async (newDay: number) => {
    if (!movingWorkout) return;
    // Find the workout currently occupying the target day
    const targetWorkout = workouts.find((w) => w.day_of_week === newDay);
    if (targetWorkout) {
      // Swap: move target to source's day
      await supabase
        .from('program_workouts')
        .update({ day_of_week: movingWorkout.day_of_week, order_index: movingWorkout.day_of_week ?? targetWorkout.order_index })
        .eq('id', targetWorkout.id);
    }
    // Move source to new day
    await supabase
      .from('program_workouts')
      .update({ day_of_week: newDay, order_index: newDay })
      .eq('id', movingWorkout.id);
    setShowMoveDay(false);
    setMovingWorkout(null);
    await loadProgram();
  };

  // ── Day action sheet ────────────────────────────────────
  const showDayActions = (workout: WorkoutDay) => {
    showAlert(workout.name, undefined, [
      { text: t('workout.moveDay'), onPress: () => handleMoveDay(workout) },
      { text: t('workout.duplicate'), onPress: () => handleDuplicateDay(workout) },
      { text: t('workout.copy'), onPress: () => handleCopyDay(workout) },
      { text: t('general.delete'), style: 'destructive', onPress: () => handleDeleteDay(workout.id, workout.name) },
      { text: t('general.cancel'), style: 'cancel' },
    ]);
  };

  // ── Open exercise picker for a workout day (or multiple) ─
  const openExercisePicker = (workoutIds: string[]) => {
    setTargetWorkoutIds(workoutIds);
    setSearchQuery('');
    setSelectedBodyPart(null);
    setShowExercisePicker(true);
  };

  const toggleTargetWorkout = (workoutId: string) => {
    setTargetWorkoutIds((prev) =>
      prev.includes(workoutId) ? prev.filter((id) => id !== workoutId) : [...prev, workoutId]
    );
  };

  // ── Select exercise → open config ────────────────────────
  const selectExercise = (exercise: Exercise) => {
    setConfigExercise(exercise);
    setConfig(defaultConfig);
    setShowExercisePicker(false);
    setShowConfig(true);
  };

  // ── Save exercise config to DB (multi-day) ───────────────
  const saveExerciseConfig = async () => {
    if (targetWorkoutIds.length === 0 || !configExercise) return;

    const rows = targetWorkoutIds.map((wId) => {
      const currentWorkout = workouts.find((w) => w.id === wId);
      const orderIndex = (currentWorkout?.program_exercises?.length ?? 0);

      const row: Record<string, unknown> = {
        workout_id: wId,
        exercise_id: configExercise.id,
        sets: parseInt(config.sets) || null,
        rest_seconds: parseInt(config.restSeconds) || null,
        weight_kg: parseFloat(config.weightKg) || null,
        notes: config.notes.trim() || null,
        order_index: orderIndex,
        reps: null,
        reps_min: null,
        reps_max: null,
        duration_seconds: null,
        duration_min: null,
        duration_max: null,
      };

      if (config.repsMode === 'fixed') {
        row.reps = parseInt(config.reps) || null;
      } else if (config.repsMode === 'range') {
        row.reps_min = parseInt(config.repsMin) || null;
        row.reps_max = parseInt(config.repsMax) || null;
      } else if (config.repsMode === 'time') {
        row.duration_seconds = parseInt(config.duration) || null;
      } else if (config.repsMode === 'timeRange') {
        row.duration_min = parseInt(config.durationMin) || null;
        row.duration_max = parseInt(config.durationMax) || null;
      }

      return row;
    });

    await supabase.from('program_exercises').insert(rows);
    setShowConfig(false);
    setConfigExercise(null);
    await loadProgram();
  };

  // ── Delete exercise from workout ─────────────────────────
  const handleDeleteExercise = (peId: string) => {
    showAlert(t('workout.removeExercise'), t('workout.removeExerciseConfirm'), [
      { text: t('general.cancel'), style: 'cancel' },
      {
        text: t('workout.remove'), style: 'destructive', onPress: async () => {
          await supabase.from('program_exercises').delete().eq('id', peId);
          await loadProgram();
        },
      },
    ]);
  };

  const handleStartWorkout = async (workout: WorkoutDay) => {
    await startSession(workout.id, workout.name);
    router.push('/(app)/workout/session');
  };

  const handleSetActive = async () => {
    if (!id) return;
    const store = useWorkoutStore.getState();
    await store.setActiveProgram(id);
    showAlert(t('workout.programActive'), t('workout.programActiveDesc'));
    loadProgram();
  };

  // ── Cycle helpers ──────────────────────────────────────
  const getCycledWeight = (baseWeight: number | null, week: number): number | null => {
    if (!baseWeight || !program?.cycle_weeks || !program?.progression_type || !program?.progression_value) return baseWeight;
    const weekOffset = (week - 1);
    if (program.progression_type === 'increment') {
      return Math.round((baseWeight + weekOffset * program.progression_value) * 100) / 100;
    }
    // percentage: add X% of base per week
    return Math.round(baseWeight * (1 + weekOffset * program.progression_value / 100) * 100) / 100;
  };

  const currentWeek = program?.current_cycle_week ?? 1;

  const handleSaveCycleConfig = async (
    cycleWeeks: number | null,
    progressionType: 'increment' | 'percentage' | null,
    progressionValue: number | null,
  ) => {
    if (!id) return;
    const update: Record<string, unknown> = {
      cycle_weeks: cycleWeeks,
      progression_type: progressionType,
      progression_value: progressionValue,
      current_cycle_week: cycleWeeks ? 1 : null,
      cycle_start_date: cycleWeeks ? new Date().toISOString().split('T')[0] : null,
    };
    await supabase.from('workout_programs').update(update).eq('id', id);
    setProgram((prev) => prev ? { ...prev, ...update } as ProgramDetail : prev);
    setShowCycleConfig(false);
  };

  const handleAdvanceWeek = async (direction: 1 | -1) => {
    if (!id || !program?.cycle_weeks) return;
    const newWeek = Math.max(1, Math.min(program.cycle_weeks, currentWeek + direction));
    await supabase.from('workout_programs').update({ current_cycle_week: newWeek }).eq('id', id);
    setProgram((prev) => prev ? { ...prev, current_cycle_week: newWeek } : prev);
  };

  const handleResetCycle = async () => {
    if (!id) return;
    await supabase.from('workout_programs').update({ current_cycle_week: 1, cycle_start_date: new Date().toISOString().split('T')[0] }).eq('id', id);
    setProgram((prev) => prev ? { ...prev, current_cycle_week: 1, cycle_start_date: new Date().toISOString().split('T')[0] } : prev);
  };

  // ── Filtered exercises for picker ────────────────────────
  const bodyParts = [...new Set(exercises.map((e) => (e as any).body_part).filter(Boolean))].sort();

  const filteredExercises = exercises.filter((e) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !searchQuery || e.name.toLowerCase().includes(q);
    const matchBodyPart = !selectedBodyPart || (e as any).body_part === selectedBodyPart;
    return matchSearch && matchBodyPart;
  });

  // ── Format exercise display string ────────────────────────
  const formatExerciseDetail = (pe: ProgramExercise) => {
    const parts: string[] = [];
    if (pe.sets) parts.push(`${pe.sets}×`);
    if (pe.reps) parts.push(`${pe.reps}`);
    else if (pe.reps_min && pe.reps_max) parts.push(`${pe.reps_min}-${pe.reps_max}`);
    else if (pe.duration_seconds) parts.push(`${pe.duration_seconds}s`);
    else if (pe.duration_min && pe.duration_max) parts.push(`${pe.duration_min}-${pe.duration_max}s`);

    if (pe.weight_kg) {
      const cycled = getCycledWeight(pe.weight_kg, currentWeek);
      if (cycled && program?.cycle_weeks && cycled !== pe.weight_kg) {
        parts.push(`@ ${cycled}kg`);
      } else {
        parts.push(`@ ${pe.weight_kg}kg`);
      }
    }
    if (pe.rest_seconds) parts.push(`| ${pe.rest_seconds}s rest`);
    return parts.join(' ');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {editingName ? (
            <TextInput
              value={editName}
              onChangeText={setEditName}
              autoFocus
              onBlur={async () => {
                const trimmed = editName.trim();
                if (trimmed && trimmed !== program?.name && id) {
                  await supabase.from('workout_programs').update({ name: trimmed }).eq('id', id);
                  setProgram((prev) => prev ? { ...prev, name: trimmed } : prev);
                }
                setEditingName(false);
              }}
              onSubmitEditing={async () => {
                const trimmed = editName.trim();
                if (trimmed && trimmed !== program?.name && id) {
                  await supabase.from('workout_programs').update({ name: trimmed }).eq('id', id);
                  setProgram((prev) => prev ? { ...prev, name: trimmed } : prev);
                }
                setEditingName(false);
              }}
              style={{ fontSize: 22, fontWeight: '800', color: theme.text, padding: 0, margin: 0, borderBottomWidth: 2, borderBottomColor: theme.primary }}
              returnKeyType="done"
            />
          ) : (
            <TouchableOpacity onPress={() => { setEditName(program?.name ?? ''); setEditingName(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }} numberOfLines={1}>
                  {program?.name ?? t('workout.programFallback')}
                </Text>
                <Ionicons name="pencil" size={14} color={theme.muted} />
              </View>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {program?.is_active && (
              <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600' }}>{t('workout.activeProgram')}</Text>
            )}
            <Text style={{ color: theme.muted, fontSize: 12 }}>
              {workouts.length}{t('workout.daysPerWeekShort')}
            </Text>
            {program?.cycle_weeks && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                <Ionicons name="trending-up" size={11} color={theme.primary} />
                <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '600' }}>
                  {t('workout.cycleWeekLabel', { current: String(currentWeek), total: String(program.cycle_weeks) })}
                </Text>
              </View>
            )}
          </View>
        </View>
        {!program?.is_active && (
          <TouchableOpacity onPress={handleSetActive} style={{ backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('workout.setActive')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        {program?.description ? (
          <Text style={{ color: theme.muted, fontSize: 14, marginBottom: 20 }}>{program.description}</Text>
        ) : null}

        {/* ── Cycle / Progressive Overload Section ──────────── */}
        {program?.cycle_weeks ? (
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.primary + '40' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="trending-up" size={16} color={theme.primary} />
                </View>
                <View>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{t('workout.progressiveOverload')}</Text>
                  <Text style={{ color: theme.muted, fontSize: 11 }}>
                    {program.progression_type === 'increment'
                      ? t('workout.cycleDescIncrement', { value: String(program.progression_value ?? 0) })
                      : t('workout.cycleDescPercentage', { value: String(program.progression_value ?? 0) })}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowCycleConfig(true)}>
                <Ionicons name="settings-outline" size={18} color={theme.muted} />
              </TouchableOpacity>
            </View>

            {/* Week progress bar */}
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 10 }}>
              {Array.from({ length: program.cycle_weeks }, (_, i) => i + 1).map((w) => (
                <View key={w} style={{
                  flex: 1, height: 6, borderRadius: 3,
                  backgroundColor: w <= currentWeek ? theme.primary : theme.border,
                }} />
              ))}
            </View>

            {/* Week navigation */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity disabled={currentWeek <= 1} onPress={() => handleAdvanceWeek(-1)}
                style={{ padding: 8, opacity: currentWeek <= 1 ? 0.3 : 1 }}>
                <Ionicons name="chevron-back" size={18} color={theme.text} />
              </TouchableOpacity>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
                {t('workout.cycleWeekOf', { current: String(currentWeek), total: String(program.cycle_weeks) })}
              </Text>
              <TouchableOpacity disabled={currentWeek >= program.cycle_weeks} onPress={() => handleAdvanceWeek(1)}
                style={{ padding: 8, opacity: currentWeek >= program.cycle_weeks ? 0.3 : 1 }}>
                <Ionicons name="chevron-forward" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Reset cycle */}
            {currentWeek >= program.cycle_weeks && (
              <TouchableOpacity onPress={handleResetCycle}
                style={{ backgroundColor: theme.primary + '18', borderRadius: 10, padding: 10, marginTop: 8, alignItems: 'center' }}>
                <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>{t('workout.resetCycle')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity onPress={() => setShowCycleConfig(true)}
            style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.border,
              flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trending-up-outline" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{t('workout.enableCycling')}</Text>
              <Text style={{ color: theme.muted, fontSize: 11 }}>{t('workout.enableCyclingDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </TouchableOpacity>
        )}

        {/* Workout days */}
        {workouts.map((workout) => (
          <View key={workout.id} style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}>
            {/* Day header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <TouchableOpacity onPress={() => showDayActions(workout)} style={{ flex: 1 }}>
                <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '600' }}>
                  {workout.day_of_week ? DAY_FULL_T[workout.day_of_week] : t('workout.anyDay')}
                </Text>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginTop: 2 }}>{workout.name}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => showDayActions(workout)}
                  style={{ backgroundColor: theme.background, borderRadius: 10, padding: 8 }}>
                  <Ionicons name="ellipsis-horizontal" size={16} color="#7A7670" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleStartWorkout(workout)}
                  style={{ backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('workout.start')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Exercises list */}
            {(workout.program_exercises ?? [])
              .sort((a, b) => a.order_index - b.order_index)
              .map((pe) => (
                <TouchableOpacity key={pe.id} onLongPress={() => handleDeleteExercise(pe.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: theme.background, borderRadius: 10, padding: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: theme.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barbell-outline" size={14} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>{tExercise(pe.exercises?.name ?? t('workout.exerciseFallback'))}</Text>
                    <Text style={{ color: theme.muted, fontSize: 11, marginTop: 1 }}>{formatExerciseDetail(pe)}</Text>
                  </View>
                </TouchableOpacity>
              ))}

            {/* Add exercise button */}
            <TouchableOpacity onPress={() => openExercisePicker([workout.id])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingVertical: 6 }}>
              <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
              <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '500' }}>{t('workout.addExercise')}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Paste copied day */}
        {copiedDay && (
          <TouchableOpacity onPress={handlePasteDay}
            style={{ backgroundColor: '#4CAF5018', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="clipboard-outline" size={18} color="#4CAF50" />
            <Text style={{ color: '#4CAF50', fontWeight: '600', fontSize: 14 }}>{t('workout.paste', { name: copiedDay.name })}</Text>
          </TouchableOpacity>
        )}

        {/* Add exercise to multiple days */}
        {workouts.length > 1 && (
          <TouchableOpacity onPress={() => openExercisePicker(workouts.map((w) => w.id))}
            style={{ backgroundColor: theme.primary + '18', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="copy-outline" size={18} color={theme.primary} />
            <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 14 }}>{t('workout.addExerciseMultiple')}</Text>
          </TouchableOpacity>
        )}

        {/* Add workout day button */}
        <TouchableOpacity onPress={() => {
          const firstAvailable = [1, 2, 3, 4, 5, 6, 7].find((d) => !usedDays.includes(d)) ?? 1;
          setSelectedDay(firstAvailable);
          setDayName('');
          setShowAddDay(true);
        }}
          style={{ borderWidth: 1.5, borderColor: theme.primary, borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="add" size={20} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 15 }}>{t('workout.addWorkoutDay')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Move Day Modal ─────────────────────────────────── */}
      <Modal visible={showMoveDay} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{t('workout.moveDayTitle')}</Text>
            <TouchableOpacity onPress={() => { setShowMoveDay(false); setMovingWorkout(null); }}>
              <Ionicons name="close" size={24} color="#7A7670" />
            </TouchableOpacity>
          </View>

          {movingWorkout && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ color: theme.muted, fontSize: 12 }}>{t('workout.movingFrom')}</Text>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginTop: 2 }}>
                {movingWorkout.name} — {movingWorkout.day_of_week ? DAY_FULL_T[movingWorkout.day_of_week] : t('workout.anyDay')}
              </Text>
            </View>
          )}

          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 12 }}>{t('workout.selectNewDay')}</Text>
          <View style={{ gap: 8 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const isCurrent = movingWorkout?.day_of_week === d;
              const occupiedBy = workouts.find((w) => w.day_of_week === d && w.id !== movingWorkout?.id);
              return (
                <TouchableOpacity
                  key={d}
                  disabled={isCurrent}
                  onPress={() => occupiedBy ? handleSwapDay(d) : confirmMoveDay(d)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: 14, borderRadius: 12,
                    backgroundColor: isCurrent ? theme.primary + '15' : theme.surface,
                    borderWidth: 1.5,
                    borderColor: isCurrent ? theme.primary : theme.border,
                    opacity: isCurrent ? 0.6 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: isCurrent ? theme.primary + '22' : theme.background,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ color: isCurrent ? theme.primary : theme.text, fontWeight: '700', fontSize: 13 }}>
                        {DAY_NAMES_T[d]}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{DAY_FULL_T[d]}</Text>
                      {occupiedBy && (
                        <Text style={{ color: theme.muted, fontSize: 12, marginTop: 1 }}>
                          {occupiedBy.name} — {t('workout.willSwap')}
                        </Text>
                      )}
                    </View>
                  </View>
                  {isCurrent ? (
                    <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                  ) : occupiedBy ? (
                    <Ionicons name="swap-horizontal" size={20} color={theme.primary} />
                  ) : (
                    <Ionicons name="arrow-forward" size={20} color={theme.muted} />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Option to unassign day */}
            {movingWorkout?.day_of_week && (
              <TouchableOpacity
                onPress={() => confirmMoveDay(null)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: 14, borderRadius: 12, marginTop: 8,
                  backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border,
                }}
              >
                <Ionicons name="close-circle-outline" size={18} color={theme.muted} />
                <Text style={{ color: theme.muted, fontWeight: '500', fontSize: 14 }}>{t('workout.unassignDay')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Add Day Modal ──────────────────────────────────── */}
      <Modal visible={showAddDay} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{t('workout.addWorkoutDay')}</Text>
            <TouchableOpacity onPress={() => setShowAddDay(false)}>
              <Ionicons name="close" size={24} color="#7A7670" />
            </TouchableOpacity>
          </View>

          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.workoutName')}</Text>
          <TextInput value={dayName} onChangeText={setDayName} placeholder={t('workout.workoutNamePlaceholder')}
            placeholderTextColor="#7A7670"
            style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 20 }} />

          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 8 }}>{t('workout.dayOfWeek')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const used = usedDays.includes(d);
              const selected = selectedDay === d;
              return (
                <TouchableOpacity key={d} disabled={used} onPress={() => setSelectedDay(d)}
                  style={{
                    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? theme.primary : used ? theme.border : theme.surface,
                    borderWidth: 1, borderColor: selected ? theme.primary : theme.border,
                    opacity: used ? 0.5 : 1,
                  }}>
                  <Text style={{ color: selected ? '#fff' : used ? theme.muted : theme.text, fontWeight: '600', fontSize: 13 }}>
                    {DAY_NAMES_T[d]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={handleAddDay} disabled={!dayName.trim()}
            style={{ backgroundColor: dayName.trim() ? theme.primary : theme.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('workout.addDay')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Exercise Picker Modal ─────────────────────────── */}
      <Modal visible={showExercisePicker} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>{t('workout.chooseExercise')}</Text>
              <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
                <Ionicons name="close" size={24} color="#7A7670" />
              </TouchableOpacity>
            </View>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('workout.searchExercises')}
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 12, color: theme.text, marginBottom: 12 }}
            />
            {/* Body part filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, maxHeight: 36 }}>
              <TouchableOpacity onPress={() => setSelectedBodyPart(null)}
                style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, marginRight: 6,
                  backgroundColor: !selectedBodyPart ? theme.primary : theme.surface, borderWidth: 1, borderColor: !selectedBodyPart ? theme.primary : theme.border }}>
                <Text style={{ color: !selectedBodyPart ? '#fff' : theme.muted, fontSize: 12, fontWeight: '500' }}>{t('workout.all')}</Text>
              </TouchableOpacity>
              {bodyParts.map((bp) => (
                <TouchableOpacity key={bp} onPress={() => setSelectedBodyPart(bp === selectedBodyPart ? null : bp)}
                  style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, marginRight: 6,
                    backgroundColor: selectedBodyPart === bp ? theme.primary : theme.surface, borderWidth: 1, borderColor: selectedBodyPart === bp ? theme.primary : theme.border }}>
                  <Text style={{ color: selectedBodyPart === bp ? '#fff' : theme.muted, fontSize: 12, fontWeight: '500', textTransform: 'capitalize' }}>{bp}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item: ex }) => (
              <TouchableOpacity onPress={() => selectExercise(ex)}
                style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: theme.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="barbell-outline" size={16} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '500', fontSize: 14 }}>{ex.name}</Text>
                  <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>
                    {[(ex as any).body_part, (ex as any).target_muscle].filter(Boolean).join(' · ') || ex.muscle_groups.join(', ')}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* ── Exercise Config Modal ─────────────────────────── */}
      <Modal visible={showConfig} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>{t('workout.configureExercise')}</Text>
              <TouchableOpacity onPress={() => { setShowConfig(false); setConfigExercise(null); }}>
                <Ionicons name="close" size={24} color="#7A7670" />
              </TouchableOpacity>
            </View>

            {/* Exercise name */}
            <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 20 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{configExercise?.name}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>
                {[(configExercise as any)?.body_part, (configExercise as any)?.target_muscle].filter(Boolean).join(' · ') || configExercise?.muscle_groups.join(', ')}
              </Text>
            </View>

            {/* Day selector — choose which days to add to */}
            {workouts.length > 1 && (
              <>
                <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 8 }}>{t('workout.addToDays')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  <TouchableOpacity
                    onPress={() => {
                      const allIds = workouts.map((w) => w.id);
                      setTargetWorkoutIds(targetWorkoutIds.length === workouts.length ? [] : allIds);
                    }}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                      backgroundColor: targetWorkoutIds.length === workouts.length ? theme.primary : theme.surface,
                      borderWidth: 1, borderColor: targetWorkoutIds.length === workouts.length ? theme.primary : theme.border,
                    }}>
                    <Text style={{ color: targetWorkoutIds.length === workouts.length ? '#fff' : theme.muted, fontWeight: '600', fontSize: 12 }}>{t('workout.all')}</Text>
                  </TouchableOpacity>
                  {workouts.map((w) => {
                    const isSelected = targetWorkoutIds.includes(w.id);
                    return (
                      <TouchableOpacity key={w.id} onPress={() => toggleTargetWorkout(w.id)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                          backgroundColor: isSelected ? theme.primary : theme.surface,
                          borderWidth: 1, borderColor: isSelected ? theme.primary : theme.border,
                        }}>
                        <Text style={{ color: isSelected ? '#fff' : theme.text, fontWeight: '500', fontSize: 12 }}>
                          {w.day_of_week ? DAY_NAMES_T[w.day_of_week] : w.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Sets */}
            <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.numSets')}</Text>
            <TextInput value={config.sets} onChangeText={(v) => setConfig({ ...config, sets: v })}
              keyboardType="number-pad" placeholder="3"
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 16 }} />

            {/* Reps mode selector */}
            <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 8 }}>{t('workout.repsDurationMode')}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {[
                { key: 'fixed' as const, label: t('workout.fixedReps') },
                { key: 'range' as const, label: t('workout.repRange') },
                { key: 'time' as const, label: t('workout.time') },
                { key: 'timeRange' as const, label: t('workout.timeRange') },
              ].map((m) => (
                <TouchableOpacity key={m.key} onPress={() => setConfig({ ...config, repsMode: m.key })}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                    backgroundColor: config.repsMode === m.key ? theme.primary : theme.surface,
                    borderWidth: 1, borderColor: config.repsMode === m.key ? theme.primary : theme.border,
                  }}>
                  <Text style={{ color: config.repsMode === m.key ? '#fff' : theme.muted, fontWeight: '500', fontSize: 11 }}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reps inputs based on mode */}
            {config.repsMode === 'fixed' && (
              <>
                <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.reps')}</Text>
                <TextInput value={config.reps} onChangeText={(v) => setConfig({ ...config, reps: v })}
                  keyboardType="number-pad" placeholder="10"
                  placeholderTextColor="#7A7670"
                  style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 16 }} />
              </>
            )}

            {config.repsMode === 'range' && (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.minReps')}</Text>
                  <TextInput value={config.repsMin} onChangeText={(v) => setConfig({ ...config, repsMin: v })}
                    keyboardType="number-pad" placeholder="8"
                    placeholderTextColor="#7A7670"
                    style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.maxReps')}</Text>
                  <TextInput value={config.repsMax} onChangeText={(v) => setConfig({ ...config, repsMax: v })}
                    keyboardType="number-pad" placeholder="12"
                    placeholderTextColor="#7A7670"
                    style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text }} />
                </View>
              </View>
            )}

            {config.repsMode === 'time' && (
              <>
                <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.durationSec')}</Text>
                <TextInput value={config.duration} onChangeText={(v) => setConfig({ ...config, duration: v })}
                  keyboardType="number-pad" placeholder="30"
                  placeholderTextColor="#7A7670"
                  style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 16 }} />
              </>
            )}

            {config.repsMode === 'timeRange' && (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.minSec')}</Text>
                  <TextInput value={config.durationMin} onChangeText={(v) => setConfig({ ...config, durationMin: v })}
                    keyboardType="number-pad" placeholder="30"
                    placeholderTextColor="#7A7670"
                    style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.maxSec')}</Text>
                  <TextInput value={config.durationMax} onChangeText={(v) => setConfig({ ...config, durationMax: v })}
                    keyboardType="number-pad" placeholder="60"
                    placeholderTextColor="#7A7670"
                    style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text }} />
                </View>
              </View>
            )}

            {/* Rest time */}
            <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.restBetween')}</Text>
            <TextInput value={config.restSeconds} onChangeText={(v) => setConfig({ ...config, restSeconds: v })}
              keyboardType="number-pad" placeholder="90"
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 16 }} />

            {/* Weight */}
            <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.weightOptional')}</Text>
            <TextInput value={config.weightKg} onChangeText={(v) => setConfig({ ...config, weightKg: v })}
              keyboardType="decimal-pad" placeholder="0"
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 16 }} />

            {/* Notes */}
            <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.notesOptional')}</Text>
            <TextInput value={config.notes} onChangeText={(v) => setConfig({ ...config, notes: v })}
              placeholder={t('workout.notesPlaceholder')} multiline
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 24, height: 70, textAlignVertical: 'top' }} />

            <TouchableOpacity onPress={saveExerciseConfig} disabled={targetWorkoutIds.length === 0}
              style={{ backgroundColor: targetWorkoutIds.length > 0 ? theme.primary : theme.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                {targetWorkoutIds.length > 1 ? t('workout.addToNDays', { count: String(targetWorkoutIds.length) }) : t('workout.addToWorkout')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Cycle Config Modal ────────────────────────────── */}
      <CycleConfigModal
        visible={showCycleConfig}
        onClose={() => setShowCycleConfig(false)}
        onSave={handleSaveCycleConfig}
        onDisable={() => handleSaveCycleConfig(null, null, null)}
        initialWeeks={program?.cycle_weeks ?? 4}
        initialType={program?.progression_type ?? 'increment'}
        initialValue={program?.progression_value ?? 2.5}
        hasCycle={!!program?.cycle_weeks}
        theme={theme}
        t={t}
      />
    </SafeAreaView>
  );
}

// ── Cycle Config Modal Component ─────────────────────────
function CycleConfigModal({
  visible, onClose, onSave, onDisable,
  initialWeeks, initialType, initialValue, hasCycle,
  theme, t,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (weeks: number, type: 'increment' | 'percentage', value: number) => void;
  onDisable: () => void;
  initialWeeks: number;
  initialType: 'increment' | 'percentage';
  initialValue: number;
  hasCycle: boolean;
  theme: any;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const [weeks, setWeeks] = useState(String(initialWeeks));
  const [type, setType] = useState<'increment' | 'percentage'>(initialType);
  const [value, setValue] = useState(String(initialValue));

  useEffect(() => {
    if (visible) {
      setWeeks(String(initialWeeks));
      setType(initialType);
      setValue(String(initialValue));
    }
  }, [visible]);

  const parsedWeeks = parseInt(weeks) || 4;
  const parsedValue = parseFloat(value) || 0;

  // Preview: show weight for each week with a 60kg example
  const exampleBase = 60;
  const previewWeights = Array.from({ length: Math.min(parsedWeeks, 12) }, (_, i) => {
    const w = i + 1;
    if (type === 'increment') return Math.round((exampleBase + i * parsedValue) * 100) / 100;
    return Math.round(exampleBase * (1 + i * parsedValue / 100) * 100) / 100;
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{t('workout.cycleConfigTitle')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#7A7670" />
            </TouchableOpacity>
          </View>

          {/* Explanation */}
          <View style={{ backgroundColor: theme.primary + '12', borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <Text style={{ color: theme.text, fontSize: 13, lineHeight: 20 }}>
              {t('workout.cycleExplanation')}
            </Text>
          </View>

          {/* Cycle length */}
          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.cycleWeeks')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <TouchableOpacity onPress={() => { const n = Math.max(2, parsedWeeks - 1); setWeeks(String(n)); }}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="remove" size={18} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 20 }}>{parsedWeeks}</Text>
              <Text style={{ color: theme.muted, fontSize: 11 }}>{t('workout.weeks')}</Text>
            </View>
            <TouchableOpacity onPress={() => { const n = Math.min(12, parsedWeeks + 1); setWeeks(String(n)); }}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Progression type */}
          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 8 }}>{t('workout.progressionType')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <TouchableOpacity onPress={() => { setType('increment'); setValue('2.5'); }}
              style={{
                flex: 1, padding: 14, borderRadius: 12, alignItems: 'center',
                backgroundColor: type === 'increment' ? theme.primary : theme.surface,
                borderWidth: 1.5, borderColor: type === 'increment' ? theme.primary : theme.border,
              }}>
              <Ionicons name="add-circle-outline" size={22} color={type === 'increment' ? '#fff' : theme.text} />
              <Text style={{ color: type === 'increment' ? '#fff' : theme.text, fontWeight: '700', fontSize: 14, marginTop: 6 }}>
                {t('workout.incrementKg')}
              </Text>
              <Text style={{ color: type === 'increment' ? '#fff' + 'CC' : theme.muted, fontSize: 11, marginTop: 2, textAlign: 'center' }}>
                {t('workout.incrementKgDesc')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setType('percentage'); setValue('5'); }}
              style={{
                flex: 1, padding: 14, borderRadius: 12, alignItems: 'center',
                backgroundColor: type === 'percentage' ? theme.primary : theme.surface,
                borderWidth: 1.5, borderColor: type === 'percentage' ? theme.primary : theme.border,
              }}>
              <Ionicons name="trending-up-outline" size={22} color={type === 'percentage' ? '#fff' : theme.text} />
              <Text style={{ color: type === 'percentage' ? '#fff' : theme.text, fontWeight: '700', fontSize: 14, marginTop: 6 }}>
                {t('workout.percentageMode')}
              </Text>
              <Text style={{ color: type === 'percentage' ? '#fff' + 'CC' : theme.muted, fontSize: 11, marginTop: 2, textAlign: 'center' }}>
                {t('workout.percentageModeDesc')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Progression value */}
          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>
            {type === 'increment' ? t('workout.incrementValue') : t('workout.percentageValue')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <TouchableOpacity onPress={() => { const n = Math.max(0.5, parsedValue - (type === 'increment' ? 0.5 : 1)); setValue(String(n)); }}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="remove" size={18} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 20 }}>
                {parsedValue}{type === 'increment' ? ' kg' : ' %'}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 11 }}>{t('workout.perWeek')}</Text>
            </View>
            <TouchableOpacity onPress={() => { const n = Math.min(type === 'increment' ? 20 : 50, parsedValue + (type === 'increment' ? 0.5 : 1)); setValue(String(n)); }}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Preview */}
          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 8 }}>{t('workout.cyclePreview')}</Text>
          <View style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 14, marginBottom: 24 }}>
            <Text style={{ color: theme.muted, fontSize: 11, marginBottom: 8 }}>
              {t('workout.cyclePreviewExample')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {previewWeights.map((w, i) => (
                <View key={i} style={{
                  backgroundColor: theme.primary + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                  minWidth: 70, alignItems: 'center',
                }}>
                  <Text style={{ color: theme.muted, fontSize: 10 }}>S{i + 1}</Text>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{w}kg</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity onPress={() => onSave(parsedWeeks, type, parsedValue)}
            style={{ backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('workout.saveCycleConfig')}</Text>
          </TouchableOpacity>

          {/* Disable cycling */}
          {hasCycle && (
            <TouchableOpacity onPress={onDisable}
              style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ color: '#E53E3E', fontWeight: '500', fontSize: 14 }}>{t('workout.disableCycling')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
