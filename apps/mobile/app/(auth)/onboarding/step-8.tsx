import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

export default function OnboardingStep8() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        await supabase.from('user_profiles').update({ onboarding_done: true }).eq('id', uid);
      }
      await refreshProfile();
      router.replace('/(app)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: 'center', alignItems: 'flex-start' }}>
        {/* Progress — full */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, position: 'absolute', top: 14, left: 14, right: 14 }}>
          <View style={{ width: 32, height: 32 }} />
          <View style={{ flex: 1, height: 4, backgroundColor: '#FF5C1A', borderRadius: 999 }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>8/8</Text>
        </View>

        {/* Icon */}
        <View style={{
          width: 76, height: 76, borderRadius: 22,
          backgroundColor: '#FF5C1A',
          alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        }}>
          <Ionicons name="trophy" size={36} color="#fff" />
        </View>

        <Text style={{ fontSize: 40, fontWeight: '800', color: theme.text, lineHeight: 42, letterSpacing: -1, marginBottom: 14 }}>
          {"C'est parti\nsur Ziko."}
        </Text>
        <Text style={{ fontSize: 15, color: theme.muted, lineHeight: 22, marginBottom: 32 }}>
          Ton coach IA a tout en main. Première séance, on y va.
        </Text>

        {/* Benefits */}
        <View style={{ gap: 12, marginBottom: 40, width: '100%' }}>
          {[
            { icon: 'flash-outline' as const,   text: 'Programme IA généré selon ton profil' },
            { icon: 'barbell-outline' as const, text: 'Suivi de séances en temps réel' },
            { icon: 'heart-outline' as const,   text: 'Nutrition, sommeil, mesures — tout intégré' },
          ].map((b) => (
            <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: '#FF5C1A' + '18', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={b.icon} size={16} color="#FF5C1A" />
              </View>
              <Text style={{ fontSize: 14, color: theme.text, flex: 1 }}>{b.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={handleStart}
          disabled={isLoading}
          style={{
            paddingVertical: 18, borderRadius: 18,
            backgroundColor: '#FF5C1A', alignItems: 'center',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
            {isLoading ? 'Chargement…' : 'Commencer'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
