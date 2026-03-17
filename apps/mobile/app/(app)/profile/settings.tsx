import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
import type { FitnessGoal } from '@ziko/plugin-sdk';

const GOALS: { id: FitnessGoal; label: string }[] = [
  { id: 'muscle_gain', label: 'Build Muscle' },
  { id: 'fat_loss', label: 'Lose Fat' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'endurance', label: 'Endurance' },
];

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [name, setName] = useState(profile?.name ?? '');
  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [weight, setWeight] = useState(profile?.weight_kg?.toString() ?? '');
  const [height, setHeight] = useState(profile?.height_cm?.toString() ?? '');
  const [goal, setGoal] = useState<FitnessGoal | null>(profile?.goal ?? null);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from('user_profiles').update({
      name: name.trim(),
      age: age ? parseInt(age) : null,
      weight_kg: weight ? parseFloat(weight) : null,
      height_cm: height ? parseFloat(height) : null,
      goal,
    }).eq('id', user.id);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      await refreshProfile();
      Alert.alert('Saved!', 'Your profile has been updated.');
    }
    setIsSaving(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#8888A8" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: '#F0F0F5' }}>Edit Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Full name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#8888A8" style={fieldStyle} />

        <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Age</Text>
        <TextInput value={age} onChangeText={setAge} placeholder="25" placeholderTextColor="#8888A8" keyboardType="number-pad" style={fieldStyle} />

        <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Weight (kg)</Text>
        <TextInput value={weight} onChangeText={setWeight} placeholder="75" placeholderTextColor="#8888A8" keyboardType="decimal-pad" style={fieldStyle} />

        <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Height (cm)</Text>
        <TextInput value={height} onChangeText={setHeight} placeholder="175" placeholderTextColor="#8888A8" keyboardType="decimal-pad" style={fieldStyle} />

        <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 10 }}>Fitness Goal</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {GOALS.map((g) => (
            <TouchableOpacity key={g.id} onPress={() => setGoal(g.id)}
              style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: goal === g.id ? '#6C63FF' : '#1A1A24', borderWidth: 1, borderColor: goal === g.id ? '#6C63FF' : '#2E2E40' }}>
              <Text style={{ color: goal === g.id ? '#fff' : '#8888A8', fontWeight: '500', fontSize: 14 }}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={handleSave} disabled={isSaving}
          style={{ backgroundColor: isSaving ? '#5A52D5' : '#6C63FF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', opacity: isSaving ? 0.7 : 1 }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{isSaving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
