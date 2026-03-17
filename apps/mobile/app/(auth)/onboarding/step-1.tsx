import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

export default function OnboardingStep1() {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState('');

  const handleNext = async () => {
    if (!name.trim() || !user) return;
    await supabase
      .from('user_profiles')
      .update({ name: name.trim() })
      .eq('id', user.id);
    router.push('/(auth)/onboarding/step-2');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <View style={{ flex: 1, padding: 24 }}>
        {/* Progress */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= 1 ? '#6C63FF' : '#2E2E40',
              }}
            />
          ))}
        </View>

        <Text style={{ color: '#8888A8', marginTop: 32, fontSize: 13 }}>Step 1 of 5</Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#F0F0F5', marginTop: 8 }}>
          What's your name?
        </Text>
        <Text style={{ color: '#8888A8', marginTop: 8, fontSize: 15 }}>
          Let's personalise your experience.
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your first name"
          placeholderTextColor="#8888A8"
          autoFocus
          style={{
            backgroundColor: '#1A1A24',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#2E2E40',
            paddingHorizontal: 16,
            paddingVertical: 14,
            color: '#F0F0F5',
            fontSize: 18,
            marginTop: 32,
          }}
        />

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={handleNext}
          disabled={!name.trim()}
          style={{
            backgroundColor: name.trim() ? '#6C63FF' : '#2E2E40',
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Continue →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
