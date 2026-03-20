import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import { useAuthStore } from '../../../src/stores/authStore';

export default function WorkoutSessionScreen() {
  const startSession = useWorkoutStore((s) => s.startSession);
  const endSession = useWorkoutStore((s) => s.endSession);
  const currentSession = useWorkoutStore((s) => s.currentSession);
  const activeSets = useWorkoutStore((s) => s.activeSets);
  const completeSet = useWorkoutStore((s) => s.completeSet);
  const addSet = useWorkoutStore((s) => s.addSet);
  const exercises = useWorkoutStore((s) => s.exercises);
  const loadExercises = useWorkoutStore((s) => s.loadExercises);
  const restTimer = useWorkoutStore((s) => s.restTimer);
  const startRestTimer = useWorkoutStore((s) => s.startRestTimer);
  const stopRestTimer = useWorkoutStore((s) => s.stopRestTimer);
  const tickRestTimer = useWorkoutStore((s) => s.tickRestTimer);

  const [elapsed, setElapsed] = useState(0);
  const [showExercises, setShowExercises] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionExercises, setSessionExercises] = useState<{ id: string; name: string; sets: { reps: string; weight: string }[] }[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const restRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    loadExercises();
    startSession(undefined, 'Quick Workout');
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (restTimer !== null && restTimer > 0) {
      restRef.current = setInterval(() => tickRestTimer(), 1000);
    } else {
      clearInterval(restRef.current);
    }
    return () => clearInterval(restRef.current);
  }, [restTimer]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const addExerciseToSession = (exercise: { id: string; name: string }) => {
    setSessionExercises((prev) => [...prev, { id: exercise.id, name: exercise.name, sets: [{ reps: '', weight: '' }] }]);
    setShowExercises(false);
  };

  const addSetToExercise = (exerciseIndex: number) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex] = { ...updated[exerciseIndex], sets: [...updated[exerciseIndex].sets, { reps: '', weight: '' }] };
      return updated;
    });
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'reps' | 'weight', value: string) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const sets = [...updated[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      updated[exIdx] = { ...updated[exIdx], sets };
      return updated;
    });
  };

  const completeSetHandler = async (exIdx: number, setIdx: number) => {
    const ex = sessionExercises[exIdx];
    const set = ex.sets[setIdx];
    await completeSet(ex.id, setIdx + 1);
    startRestTimer(60);
    Alert.alert('Set completed! 🎯', 'Rest timer started (60s)');
  };

  const handleEndSession = async () => {
    Alert.alert('End Workout', 'Are you sure you want to finish this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish', style: 'destructive', onPress: async () => {
          await endSession();
          router.back();
        },
      },
    ]);
  };

  const filteredExercises = exercises.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 18 }}>Active Session</Text>
          <Text style={{ color: '#FF5C1A', fontSize: 14, fontWeight: '600' }}>{formatTime(elapsed)}</Text>
        </View>
        <TouchableOpacity onPress={handleEndSession} style={{ backgroundColor: '#F4433622', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 14 }}>End</Text>
        </TouchableOpacity>
      </View>

      {/* Rest timer */}
      {restTimer !== null && restTimer > 0 && (
        <View style={{ marginHorizontal: 20, backgroundColor: '#FF5C1A22', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Ionicons name="timer" size={18} color="#FF5C1A" style={{ marginRight: 8 }} />
          <Text style={{ color: '#FF5C1A', fontWeight: '600', flex: 1 }}>Rest: {formatTime(restTimer)}</Text>
          <TouchableOpacity onPress={stopRestTimer}>
            <Ionicons name="close-circle" size={20} color="#FF5C1A" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 120 }}>
        {sessionExercises.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 48 }}>
            <Text style={{ fontSize: 40 }}>🏋️</Text>
            <Text style={{ color: '#1C1A17', fontSize: 16, fontWeight: '600', marginTop: 12 }}>Add your first exercise</Text>
            <Text style={{ color: '#7A7670', marginTop: 8, textAlign: 'center' }}>Tap the button below to pick exercises</Text>
          </View>
        )}

        {sessionExercises.map((ex, exIdx) => (
          <View key={`${ex.id}-${exIdx}`} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E0DA' }}>
            <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 15, marginBottom: 12 }}>{ex.name}</Text>

            {/* Set headers */}
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ color: '#7A7670', fontSize: 12, width: 30 }}>Set</Text>
              <Text style={{ color: '#7A7670', fontSize: 12, flex: 1, textAlign: 'center' }}>Reps</Text>
              <Text style={{ color: '#7A7670', fontSize: 12, flex: 1, textAlign: 'center' }}>Weight (kg)</Text>
              <View style={{ width: 40 }} />
            </View>

            {ex.sets.map((set, setIdx) => (
              <View key={setIdx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <Text style={{ color: '#7A7670', fontSize: 14, width: 22 }}>{setIdx + 1}</Text>
                <TextInput
                  value={set.reps}
                  onChangeText={(v) => updateSet(exIdx, setIdx, 'reps', v)}
                  placeholder="12"
                  placeholderTextColor="#7A7670"
                  keyboardType="number-pad"
                  style={{ flex: 1, backgroundColor: '#252535', borderRadius: 8, padding: 10, color: '#1C1A17', textAlign: 'center' }}
                />
                <TextInput
                  value={set.weight}
                  onChangeText={(v) => updateSet(exIdx, setIdx, 'weight', v)}
                  placeholder="60"
                  placeholderTextColor="#7A7670"
                  keyboardType="decimal-pad"
                  style={{ flex: 1, backgroundColor: '#252535', borderRadius: 8, padding: 10, color: '#1C1A17', textAlign: 'center' }}
                />
                <TouchableOpacity onPress={() => completeSetHandler(exIdx, setIdx)} style={{ backgroundColor: '#4CAF5022', borderRadius: 8, padding: 8 }}>
                  <Ionicons name="checkmark" size={16} color="#4CAF50" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity onPress={() => addSetToExercise(exIdx)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Ionicons name="add-circle-outline" size={16} color="#FF5C1A" />
              <Text style={{ color: '#FF5C1A', fontSize: 13 }}>Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          onPress={() => setShowExercises(true)}
          style={{ borderWidth: 1.5, borderColor: '#FF5C1A', borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
        >
          <Ionicons name="add" size={20} color="#FF5C1A" />
          <Text style={{ color: '#FF5C1A', fontWeight: '600', fontSize: 15 }}>Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise picker modal */}
      <Modal visible={showExercises} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#F7F6F3', padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#1C1A17', fontSize: 20, fontWeight: '700' }}>Choose Exercise</Text>
            <TouchableOpacity onPress={() => setShowExercises(false)}>
              <Ionicons name="close" size={24} color="#7A7670" />
            </TouchableOpacity>
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search exercises…"
            placeholderTextColor="#7A7670"
            style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 12, color: '#1C1A17', marginBottom: 16 }}
          />
          <ScrollView>
            {filteredExercises.map((ex) => (
              <TouchableOpacity key={ex.id} onPress={() => addExerciseToSession(ex)}
                style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E0DA', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#FF5C1A22', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="barbell-outline" size={16} color="#FF5C1A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1C1A17', fontWeight: '500', fontSize: 14 }}>{ex.name}</Text>
                  <Text style={{ color: '#7A7670', fontSize: 11, marginTop: 2 }}>{ex.muscle_groups.join(', ')}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
