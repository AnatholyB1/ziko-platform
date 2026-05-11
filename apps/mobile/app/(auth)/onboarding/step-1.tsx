import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

export default function OnboardingStep1() {
  const theme = useThemeStore((s) => s.theme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: 'center' }}>
          {/* Icon */}
          <View style={{
            width: 76, height: 76, borderRadius: 22,
            backgroundColor: '#FF5C1A',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 28,
          }}>
            <Ionicons name="flash" size={36} color="#fff" />
          </View>

          <Text style={{
            fontSize: 40, fontWeight: '800', color: theme.text,
            lineHeight: 42, letterSpacing: -1, marginBottom: 14,
          }}>
            {'Bienvenue\nsur Ziko.'}
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
                  backgroundColor: '#FF5C1A' + '20', alignItems: 'center', justifyContent: 'center',
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
