import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

export default function OnboardingStep2() {
  const user = useAuthStore((s) => s.user);
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const isValid = age && weight && height;

  const handleNext = async () => {
    if (!isValid) return;
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    await supabase
      .from('user_profiles')
      .update({
        age: parseInt(age, 10),
        weight_kg: parseFloat(weight),
        height_cm: parseFloat(height),
      })
      .eq('id', uid);
    router.push('/(auth)/onboarding/step-3');
  };

  const fieldStyle = {
    backgroundColor: '#1A1A24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E2E40',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F0F0F5',
    fontSize: 15,
    marginBottom: 16,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <View style={{ flex: 1, padding: 24 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 2 ? '#6C63FF' : '#2E2E40' }} />
          ))}
        </View>

        <Text style={{ color: '#8888A8', marginTop: 32, fontSize: 13 }}>Step 2 of 5</Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#F0F0F5', marginTop: 8 }}>
          Your measurements
        </Text>
        <Text style={{ color: '#8888A8', marginTop: 8, fontSize: 15, marginBottom: 32 }}>
          Used to calculate your caloric needs and track progress.
        </Text>

        <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Age</Text>
        <TextInput value={age} onChangeText={setAge} placeholder="25" placeholderTextColor="#8888A8" keyboardType="number-pad" style={fieldStyle} />
        <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Weight (kg)</Text>
        <TextInput value={weight} onChangeText={setWeight} placeholder="75" placeholderTextColor="#8888A8" keyboardType="decimal-pad" style={fieldStyle} />
        <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Height (cm)</Text>
        <TextInput value={height} onChangeText={setHeight} placeholder="175" placeholderTextColor="#8888A8" keyboardType="decimal-pad" style={fieldStyle} />

        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2E2E40' }}>
            <Text style={{ color: '#8888A8', fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNext} disabled={!isValid} style={{ flex: 2, backgroundColor: isValid ? '#6C63FF' : '#2E2E40', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
