import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import type { ProgramExercise, Exercise } from '@ziko/plugin-sdk';

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

  // Add workout day modal
  const [showAddDay, setShowAddDay] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [dayName, setDayName] = useState('');

  // Exercise picker modal
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [targetWorkoutId, setTargetWorkoutId] = useState<string | null>(null);
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
    Alert.alert('Delete Workout Day', `Remove "${name}" and all its exercises?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('program_workouts').delete().eq('id', workoutId);
          await loadProgram();
        },
      },
    ]);
  };

  // ── Open exercise picker for a workout day ───────────────
  const openExercisePicker = (workoutId: string) => {
    setTargetWorkoutId(workoutId);
    setSearchQuery('');
    setSelectedBodyPart(null);
    setShowExercisePicker(true);
  };

  // ── Select exercise → open config ────────────────────────
  const selectExercise = (exercise: Exercise) => {
    setConfigExercise(exercise);
    setConfig(defaultConfig);
    setShowExercisePicker(false);
    setShowConfig(true);
  };

  // ── Save exercise config to DB ───────────────────────────
  const saveExerciseConfig = async () => {
    if (!targetWorkoutId || !configExercise) return;

    const currentWorkout = workouts.find((w) => w.id === targetWorkoutId);
    const orderIndex = (currentWorkout?.program_exercises?.length ?? 0);

    const insert: Record<string, unknown> = {
      workout_id: targetWorkoutId,
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
      insert.reps = parseInt(config.reps) || null;
    } else if (config.repsMode === 'range') {
      insert.reps_min = parseInt(config.repsMin) || null;
      insert.reps_max = parseInt(config.repsMax) || null;
    } else if (config.repsMode === 'time') {
      insert.duration_seconds = parseInt(config.duration) || null;
    } else if (config.repsMode === 'timeRange') {
      insert.duration_min = parseInt(config.durationMin) || null;
      insert.duration_max = parseInt(config.durationMax) || null;
    }

    await supabase.from('program_exercises').insert(insert);
    setShowConfig(false);
    setConfigExercise(null);
    await loadProgram();
  };

  // ── Delete exercise from workout ─────────────────────────
  const handleDeleteExercise = (peId: string) => {
    Alert.alert('Remove Exercise', 'Remove this exercise from the workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
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
    Alert.alert('Program Active', 'This program is now your active training program.');
    loadProgram();
  };

  // ── Filtered exercises for picker ────────────────────────
  const bodyParts = [...new Set(exercises.map((e) => (e as any).body_part).filter(Boolean))].sort();

  const filteredExercises = exercises.filter((e) => {
    const matchSearch = !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase());
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#1C1A17' }} numberOfLines={1}>
            {program?.name ?? 'Program'}
          </Text>
          {program?.is_active && (
            <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600' }}>Active program</Text>
          )}
        </View>
        {!program?.is_active && (
          <TouchableOpacity onPress={handleSetActive} style={{ backgroundColor: '#FF5C1A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Set Active</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        {program?.description ? (
          <Text style={{ color: '#7A7670', fontSize: 14, marginBottom: 20 }}>{program.description}</Text>
        ) : null}

        {/* Workout days */}
        {workouts.map((workout) => (
          <View key={workout.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E0DA' }}>
            {/* Day header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FF5C1A', fontSize: 11, fontWeight: '600' }}>
                  {workout.day_of_week ? DAY_FULL[workout.day_of_week] : 'Any day'}
                </Text>
                <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 16, marginTop: 2 }}>{workout.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => handleStartWorkout(workout)}
                  style={{ backgroundColor: '#FF5C1A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Start</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteDay(workout.id, workout.name)}
                  style={{ backgroundColor: '#F4433622', borderRadius: 10, padding: 8 }}>
                  <Ionicons name="trash-outline" size={16} color="#F44336" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Exercises list */}
            {(workout.program_exercises ?? [])
              .sort((a, b) => a.order_index - b.order_index)
              .map((pe) => (
                <TouchableOpacity key={pe.id} onLongPress={() => handleDeleteExercise(pe.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: '#F7F6F3', borderRadius: 10, padding: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: '#FF5C1A22', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barbell-outline" size={14} color="#FF5C1A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1C1A17', fontSize: 13, fontWeight: '500' }}>{pe.exercises?.name ?? 'Exercise'}</Text>
                    <Text style={{ color: '#7A7670', fontSize: 11, marginTop: 1 }}>{formatExerciseDetail(pe)}</Text>
                  </View>
                </TouchableOpacity>
              ))}

            {/* Add exercise button */}
            <TouchableOpacity onPress={() => openExercisePicker(workout.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingVertical: 6 }}>
              <Ionicons name="add-circle-outline" size={18} color="#FF5C1A" />
              <Text style={{ color: '#FF5C1A', fontSize: 13, fontWeight: '500' }}>Add exercise</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add workout day button */}
        <TouchableOpacity onPress={() => {
          const firstAvailable = [1, 2, 3, 4, 5, 6, 7].find((d) => !usedDays.includes(d)) ?? 1;
          setSelectedDay(firstAvailable);
          setDayName('');
          setShowAddDay(true);
        }}
          style={{ borderWidth: 1.5, borderColor: '#FF5C1A', borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="add" size={20} color="#FF5C1A" />
          <Text style={{ color: '#FF5C1A', fontWeight: '600', fontSize: 15 }}>Add Workout Day</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Add Day Modal ──────────────────────────────────── */}
      <Modal visible={showAddDay} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#F7F6F3', padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ color: '#1C1A17', fontSize: 22, fontWeight: '700' }}>Add Workout Day</Text>
            <TouchableOpacity onPress={() => setShowAddDay(false)}>
              <Ionicons name="close" size={24} color="#7A7670" />
            </TouchableOpacity>
          </View>

          <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Workout name *</Text>
          <TextInput value={dayName} onChangeText={setDayName} placeholder="e.g. Push, Legs, Upper Body"
            placeholderTextColor="#7A7670"
            style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17', marginBottom: 20 }} />

          <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 8 }}>Day of the week</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const used = usedDays.includes(d);
              const selected = selectedDay === d;
              return (
                <TouchableOpacity key={d} disabled={used} onPress={() => setSelectedDay(d)}
                  style={{
                    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? '#FF5C1A' : used ? '#E2E0DA' : '#FFFFFF',
                    borderWidth: 1, borderColor: selected ? '#FF5C1A' : '#E2E0DA',
                    opacity: used ? 0.5 : 1,
                  }}>
                  <Text style={{ color: selected ? '#fff' : used ? '#7A7670' : '#1C1A17', fontWeight: '600', fontSize: 13 }}>
                    {DAY_NAMES[d]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={handleAddDay} disabled={!dayName.trim()}
            style={{ backgroundColor: dayName.trim() ? '#FF5C1A' : '#E2E0DA', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Add Day</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Exercise Picker Modal ─────────────────────────── */}
      <Modal visible={showExercisePicker} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#1C1A17', fontSize: 20, fontWeight: '700' }}>Choose Exercise</Text>
              <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
                <Ionicons name="close" size={24} color="#7A7670" />
              </TouchableOpacity>
            </View>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search exercises…"
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 12, color: '#1C1A17', marginBottom: 12 }}
            />
            {/* Body part filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, maxHeight: 36 }}>
              <TouchableOpacity onPress={() => setSelectedBodyPart(null)}
                style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, marginRight: 6,
                  backgroundColor: !selectedBodyPart ? '#FF5C1A' : '#FFFFFF', borderWidth: 1, borderColor: !selectedBodyPart ? '#FF5C1A' : '#E2E0DA' }}>
                <Text style={{ color: !selectedBodyPart ? '#fff' : '#7A7670', fontSize: 12, fontWeight: '500' }}>All</Text>
              </TouchableOpacity>
              {bodyParts.map((bp) => (
                <TouchableOpacity key={bp} onPress={() => setSelectedBodyPart(bp === selectedBodyPart ? null : bp)}
                  style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, marginRight: 6,
                    backgroundColor: selectedBodyPart === bp ? '#FF5C1A' : '#FFFFFF', borderWidth: 1, borderColor: selectedBodyPart === bp ? '#FF5C1A' : '#E2E0DA' }}>
                  <Text style={{ color: selectedBodyPart === bp ? '#fff' : '#7A7670', fontSize: 12, fontWeight: '500', textTransform: 'capitalize' }}>{bp}</Text>
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
                style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E0DA', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#FF5C1A22', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="barbell-outline" size={16} color="#FF5C1A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1C1A17', fontWeight: '500', fontSize: 14 }}>{ex.name}</Text>
                  <Text style={{ color: '#7A7670', fontSize: 11, marginTop: 2 }}>
                    {[(ex as any).body_part, (ex as any).target_muscle].filter(Boolean).join(' · ') || ex.muscle_groups.join(', ')}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={20} color="#FF5C1A" />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* ── Exercise Config Modal ─────────────────────────── */}
      <Modal visible={showConfig} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#1C1A17', fontSize: 20, fontWeight: '700' }}>Configure Exercise</Text>
              <TouchableOpacity onPress={() => { setShowConfig(false); setConfigExercise(null); }}>
                <Ionicons name="close" size={24} color="#7A7670" />
              </TouchableOpacity>
            </View>

            {/* Exercise name */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E0DA', marginBottom: 20 }}>
              <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 16 }}>{configExercise?.name}</Text>
              <Text style={{ color: '#7A7670', fontSize: 12, marginTop: 4 }}>
                {[(configExercise as any)?.body_part, (configExercise as any)?.target_muscle].filter(Boolean).join(' · ') || configExercise?.muscle_groups.join(', ')}
              </Text>
            </View>

            {/* Sets */}
            <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Number of sets</Text>
            <TextInput value={config.sets} onChangeText={(v) => setConfig({ ...config, sets: v })}
              keyboardType="number-pad" placeholder="3"
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17', marginBottom: 16 }} />

            {/* Reps mode selector */}
            <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 8 }}>Reps / Duration mode</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {[
                { key: 'fixed' as const, label: 'Fixed reps' },
                { key: 'range' as const, label: 'Rep range' },
                { key: 'time' as const, label: 'Time' },
                { key: 'timeRange' as const, label: 'Time range' },
              ].map((m) => (
                <TouchableOpacity key={m.key} onPress={() => setConfig({ ...config, repsMode: m.key })}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                    backgroundColor: config.repsMode === m.key ? '#FF5C1A' : '#FFFFFF',
                    borderWidth: 1, borderColor: config.repsMode === m.key ? '#FF5C1A' : '#E2E0DA',
                  }}>
                  <Text style={{ color: config.repsMode === m.key ? '#fff' : '#7A7670', fontWeight: '500', fontSize: 11 }}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reps inputs based on mode */}
            {config.repsMode === 'fixed' && (
              <>
                <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Reps</Text>
                <TextInput value={config.reps} onChangeText={(v) => setConfig({ ...config, reps: v })}
                  keyboardType="number-pad" placeholder="10"
                  placeholderTextColor="#7A7670"
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17', marginBottom: 16 }} />
              </>
            )}

            {config.repsMode === 'range' && (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Min reps</Text>
                  <TextInput value={config.repsMin} onChangeText={(v) => setConfig({ ...config, repsMin: v })}
                    keyboardType="number-pad" placeholder="8"
                    placeholderTextColor="#7A7670"
                    style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17' }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Max reps</Text>
                  <TextInput value={config.repsMax} onChangeText={(v) => setConfig({ ...config, repsMax: v })}
                    keyboardType="number-pad" placeholder="12"
                    placeholderTextColor="#7A7670"
                    style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17' }} />
                </View>
              </View>
            )}

            {config.repsMode === 'time' && (
              <>
                <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Duration (seconds)</Text>
                <TextInput value={config.duration} onChangeText={(v) => setConfig({ ...config, duration: v })}
                  keyboardType="number-pad" placeholder="30"
                  placeholderTextColor="#7A7670"
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17', marginBottom: 16 }} />
              </>
            )}

            {config.repsMode === 'timeRange' && (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Min (seconds)</Text>
                  <TextInput value={config.durationMin} onChangeText={(v) => setConfig({ ...config, durationMin: v })}
                    keyboardType="number-pad" placeholder="30"
                    placeholderTextColor="#7A7670"
                    style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17' }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Max (seconds)</Text>
                  <TextInput value={config.durationMax} onChangeText={(v) => setConfig({ ...config, durationMax: v })}
                    keyboardType="number-pad" placeholder="60"
                    placeholderTextColor="#7A7670"
                    style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17' }} />
                </View>
              </View>
            )}

            {/* Rest time */}
            <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Rest between sets (seconds)</Text>
            <TextInput value={config.restSeconds} onChangeText={(v) => setConfig({ ...config, restSeconds: v })}
              keyboardType="number-pad" placeholder="90"
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17', marginBottom: 16 }} />

            {/* Weight */}
            <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Weight (kg) — optional</Text>
            <TextInput value={config.weightKg} onChangeText={(v) => setConfig({ ...config, weightKg: v })}
              keyboardType="decimal-pad" placeholder="0"
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17', marginBottom: 16 }} />

            {/* Notes */}
            <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>Notes — optional</Text>
            <TextInput value={config.notes} onChangeText={(v) => setConfig({ ...config, notes: v })}
              placeholder="e.g. tempo 3-1-2, pause at bottom" multiline
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 14, color: '#1C1A17', marginBottom: 24, height: 70, textAlignVertical: 'top' }} />

            <TouchableOpacity onPress={saveExerciseConfig}
              style={{ backgroundColor: '#FF5C1A', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Add to Workout</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
