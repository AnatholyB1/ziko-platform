import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useWorkoutStore } from '../../../src/stores/workoutStore';

interface ProgramDetail {
  id: string;
  name: string;
  description: string | null;
  days_per_week: number | null;
  is_active: boolean;
}

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const startSession = useWorkoutStore((s) => s.startSession);

  useEffect(() => {
    if (!id) return;
    supabase.from('workout_programs').select('*').eq('id', id).single()
      .then(({ data }) => setProgram(data));
    supabase.from('program_workouts').select('*, program_exercises(*, exercises(name, muscle_groups))').eq('program_id', id).order('day_of_week')
      .then(({ data }) => setWorkouts(data ?? []));
  }, [id]);

  const handleStartWorkout = async (workout: any) => {
    await startSession(workout.id, workout.name);
    router.push('/(app)/workout/session');
  };

  const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: '#1C1A17' }} numberOfLines={1}>
          {program?.name ?? 'Program'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        {program?.description && (
          <Text style={{ color: '#7A7670', fontSize: 14, marginBottom: 20 }}>{program.description}</Text>
        )}

        {workouts.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ fontSize: 40 }}>📋</Text>
            <Text style={{ color: '#7A7670', fontSize: 15, marginTop: 12 }}>No workouts in this program yet</Text>
          </View>
        )}

        {workouts.map((workout) => (
          <View key={workout.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E0DA' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View>
                <Text style={{ color: '#FF5C1A', fontSize: 11, fontWeight: '600' }}>
                  {workout.day_of_week ? DAY_NAMES[workout.day_of_week] : 'Any day'}
                </Text>
                <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 16, marginTop: 2 }}>{workout.name}</Text>
              </View>
              <TouchableOpacity onPress={() => handleStartWorkout(workout)}
                style={{ backgroundColor: '#FF5C1A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Start</Text>
              </TouchableOpacity>
            </View>

            {(workout.program_exercises ?? []).map((pe: any) => (
              <View key={pe.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF5C1A' }} />
                <Text style={{ color: '#1C1A17', fontSize: 13, flex: 1 }}>{pe.exercises?.name}</Text>
                <Text style={{ color: '#7A7670', fontSize: 12 }}>{pe.sets}×{pe.reps}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
