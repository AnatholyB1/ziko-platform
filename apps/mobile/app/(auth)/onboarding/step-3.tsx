import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
import type { FitnessGoal } from '@ziko/plugin-sdk';

const GOALS: { id: FitnessGoal; label: string; emoji: string; description: string }[] = [
  { id: 'muscle_gain', label: 'Build Muscle', emoji: '💪', description: 'Increase muscle mass and strength' },
  { id: 'fat_loss', label: 'Lose Fat', emoji: '🔥', description: 'Reduce body fat while preserving muscle' },
  { id: 'maintenance', label: 'Stay in Shape', emoji: '⚖️', description: 'Maintain current physique and health' },
  { id: 'endurance', label: 'Build Endurance', emoji: '🏃', description: 'Improve cardiovascular fitness and stamina' },
];

export default function OnboardingStep3() {
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<FitnessGoal | null>(null);

  const handleNext = async () => {
    if (!selected) return;
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    await supabase.from('user_profiles').update({ goal: selected }).eq('id', uid);
    router.push('/(auth)/onboarding/step-4');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ flex: 1, padding: 24 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 3 ? '#FF5C1A' : '#E2E0DA' }} />
          ))}
        </View>

        <Text style={{ color: '#7A7670', marginTop: 32, fontSize: 13 }}>Step 3 of 5</Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#1C1A17', marginTop: 8 }}>
          What's your goal?
        </Text>
        <Text style={{ color: '#7A7670', marginTop: 8, fontSize: 15, marginBottom: 32 }}>
          This helps Ziko personalise your programme and advice.
        </Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {GOALS.map((goal) => (
            <TouchableOpacity
              key={goal.id}
              onPress={() => setSelected(goal.id)}
              style={{
                backgroundColor: selected === goal.id ? '#FF5C1A22' : '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: selected === goal.id ? '#FF5C1A' : '#E2E0DA',
                padding: 20,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <Text style={{ fontSize: 28 }}>{goal.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1C1A17', fontWeight: '600', fontSize: 16 }}>{goal.label}</Text>
                <Text style={{ color: '#7A7670', fontSize: 13, marginTop: 2 }}>{goal.description}</Text>
              </View>
              {selected === goal.id && (
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E0DA' }}>
            <Text style={{ color: '#7A7670', fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNext} disabled={!selected} style={{ flex: 2, backgroundColor: selected ? '#FF5C1A' : '#E2E0DA', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
