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

  // Exercise config modal
  const [showConfig, setShowConfig] = useState(false);
  const [configExercise, setConfigExercise] = useState<Exercise | null>(null);
  const [config, setConfig] = useState<ExerciseConfig>(defaultConfig);

  const loadProgram = useCallback(async () => {
    if (!id) return;
    const { data: prog } = await supabase.from('workout_programs').select('*').eq('id', id).single();
    setProgram(prog as ProgramDetail);

    const { data: wkts } = await supabase
      .from('program_workouts')
      .select('*, program_exercises(*, exercises(name, muscle_groups))')
      .eq('program_id', id)
      .order('day_of_week');
    setWorkouts((wkts ?? []) as WorkoutDay[]);
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

  // ── Day action sheet ────────────────────────────────────
  const showDayActions = (workout: WorkoutDay) => {
    showAlert(workout.name, undefined, [
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

    if (pe.weight_kg) parts.push(`@ ${pe.weight_kg}kg`);
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
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }} numberOfLines={1}>
            {program?.name ?? t('workout.programFallback')}
          </Text>
          {program?.is_active && (
            <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600' }}>{t('workout.activeProgram')}</Text>
          )}
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
    </SafeAreaView>
  );
}
