import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useStretchingStore } from '../store';

export default function StretchingSession({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const { routines, startRoutine, nextExercise, stopRoutine, activeRoutine, currentExerciseIndex } = useStretchingStore();
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const routine = routines.find((r) => r.id === routineId);
    if (routine) startRoutine(routine);
    return () => { stopRoutine(); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [routineId]);

  useEffect(() => {
    if (activeRoutine && activeRoutine.exercises[currentExerciseIndex]) {
      setTimer(activeRoutine.exercises[currentExerciseIndex].duration_seconds);
      setIsRunning(true);
    }
  }, [currentExerciseIndex, activeRoutine]);

  useEffect(() => {
    if (isRunning && timer > 0) {
      intervalRef.current = setInterval(() => setTimer((t) => t - 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, timer > 0]);

  if (!activeRoutine) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.muted }}>Routine introuvable</Text>
      </SafeAreaView>
    );
  }

  const exercise = activeRoutine.exercises[currentExerciseIndex];
  const isLast = currentExerciseIndex === activeRoutine.exercises.length - 1;
  const progress = (currentExerciseIndex + 1) / activeRoutine.exercises.length;

  const handleNext = async () => {
    if (isLast) {
      // Save log
      try {
        await supabase.from('stretching_logs').insert({
          routine_id: activeRoutine.id,
          routine_name: activeRoutine.name,
          duration_seconds: activeRoutine.exercises.reduce((s, e) => s + e.duration_seconds, 0),
          date: new Date().toISOString().split('T')[0],
        });
      } catch {}
      stopRoutine();
      router.back();
    } else {
      nextExercise();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 20, flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => { stopRoutine(); router.back(); }}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ color: theme.muted, fontSize: 14 }}>
            {currentExerciseIndex + 1} / {activeRoutine.exercises.length}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={{ height: 4, backgroundColor: theme.border, borderRadius: 2, marginTop: 16 }}>
          <View style={{ height: 4, backgroundColor: theme.primary, borderRadius: 2, width: `${progress * 100}%` }} />
        </View>

        {/* Exercise */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
            {exercise.name}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', marginTop: 12, paddingHorizontal: 20 }}>
            {exercise.instructions}
          </Text>

          {/* Timer */}
          <View style={{
            marginTop: 40, width: 140, height: 140, borderRadius: 70,
            borderWidth: 6, borderColor: timer > 0 ? theme.primary : '#4CAF50',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: theme.text, fontSize: 40, fontWeight: '800' }}>{timer}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>sec</Text>
          </View>

          <TouchableOpacity onPress={() => setIsRunning(!isRunning)} style={{ marginTop: 20 }}>
            <Ionicons name={isRunning ? 'pause-circle' : 'play-circle'} size={48} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Next button */}
        <TouchableOpacity
          onPress={handleNext}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 16,
            alignItems: 'center', marginBottom: 20,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {isLast ? 'Terminer ✓' : 'Suivant →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
