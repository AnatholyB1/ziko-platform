import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const FEATURES = [
  { emoji: '🏋️', title: 'Workout Tracker', desc: 'Log sessions, track PRs, rest timer' },
  { emoji: '🤖', title: 'AI Coach', desc: 'Personalised advice anytime, anywhere' },
  { emoji: '🔌', title: 'Plugin Store', desc: 'Add Nutrition Tracker, custom AI personas and more' },
  { emoji: '📊', title: 'Progress Charts', desc: 'Visualise your improvement over time' },
];

export default function OnboardingStep4() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ flex: 1, padding: 24 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 4 ? '#FF5C1A' : '#E2E0DA' }} />
          ))}
        </View>

        <Text style={{ color: '#7A7670', marginTop: 32, fontSize: 13 }}>Step 4 of 5</Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#1C1A17', marginTop: 8 }}>
          What Ziko offers
        </Text>
        <Text style={{ color: '#7A7670', marginTop: 8, fontSize: 15, marginBottom: 32 }}>
          A complete fitness platform that grows with you.
        </Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {FEATURES.map((f) => (
            <View
              key={f.title}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#E2E0DA',
                padding: 20,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <Text style={{ fontSize: 28 }}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1C1A17', fontWeight: '600', fontSize: 16 }}>{f.title}</Text>
                <Text style={{ color: '#7A7670', fontSize: 13, marginTop: 2 }}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E0DA' }}>
            <Text style={{ color: '#7A7670', fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/onboarding/step-5')} style={{ flex: 2, backgroundColor: '#FF5C1A', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
