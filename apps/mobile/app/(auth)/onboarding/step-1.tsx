import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '@ziko/plugin-sdk';

export default function OnboardingStep1() {
  const theme = useThemeStore((s) => s.theme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: 'center' }}>
          {/* Gradient icon badge */}
          <LinearGradient
            colors={['#FF5C1A', '#FF8E5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 76, height: 76, borderRadius: 22,
              shadowColor: 'rgba(255,92,26,0.55)',
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 20,
              shadowOpacity: 1,
              elevation: 8,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 28,
            }}
          >
            <Ionicons name="flash" size={36} color="#fff" />
          </LinearGradient>

          <Text style={{
            fontSize: 40, fontWeight: '800', color: theme.text,
            lineHeight: 42, letterSpacing: -1.2, marginBottom: 14,
          }}>
            {'Bienvenue\nsur Ziko'}
            <Text style={{ color: '#FF5C1A' }}>.</Text>
          </Text>
          <Text style={{ fontSize: 15, color: theme.muted, lineHeight: 22, maxWidth: 320, marginBottom: 28 }}>
            Ton coach perso, tes séances, ta nutrition, tes records — tout au même endroit.
          </Text>

          {/* Benefit bullets */}
          <View style={{ gap: 10 }}>
            {[
              { icon: 'sparkles-outline' as const, text: 'Programmes générés par IA selon ta forme du jour' },
              { icon: 'barbell-outline' as const, text: 'Suivi précis : volume, RPE, PR, progression' },
              { icon: 'trophy-outline' as const, text: 'Objectifs concrets, streak motivante' },
            ].map((b) => (
              <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 30, height: 30, borderRadius: 9,
                  backgroundColor: 'rgba(255,92,26,0.12)', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={b.icon} size={15} color="#FF5C1A" />
                </View>
                <Text style={{ fontSize: 13.5, color: theme.text, flex: 1 }}>{b.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/onboarding/step-2')}
            style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Allez, on y va</Text>
          </TouchableOpacity>
          <Text style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: theme.muted }}>
            {'Déjà un compte ? '}
            <Text onPress={() => router.replace('/(auth)/login')} style={{ color: '#FF5C1A', fontWeight: '700' }}>
              Se connecter
            </Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
