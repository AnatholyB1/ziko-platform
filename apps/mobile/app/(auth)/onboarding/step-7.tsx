import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

const TOTAL = 8;
const STEP = 6;

function OBShell({ step, total, onBack, onNext, children }: {
  step: number; total: number; onBack: () => void; onNext: () => void; children: React.ReactNode;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <TouchableOpacity onPress={onBack} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.text + '10', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: theme.text + '14', borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${((step + 1) / total) * 100}%` as any, height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999 }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{step + 1}/{total}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 22 }}>{children}</View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <TouchableOpacity onPress={onNext} style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Tout est bon !</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingStep7() {
  const theme = useThemeStore((s) => s.theme);

  const items = [
    { icon: 'checkmark-circle-outline' as const, color: '#2E9E5B', text: 'Ton objectif et ton niveau enregistrés' },
    { icon: 'checkmark-circle-outline' as const, color: '#2E9E5B', text: 'Fréquence et équipement configurés' },
    { icon: 'checkmark-circle-outline' as const, color: '#2E9E5B', text: 'Profil morphologique créé' },
    { icon: 'sparkles-outline' as const, color: '#FF5C1A', text: 'Le Coach IA va personnaliser ton plan' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={() => router.push('/(auth)/onboarding/step-8' as any)}>
        <View style={{ marginTop: 18, marginBottom: 28 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Préparation</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.5 }}>Ton profil est prêt</Text>
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, lineHeight: 20 }}>Voici ce qu'on a configuré pour toi.</Text>
        </View>

        <View style={{
          backgroundColor: theme.surface, borderRadius: 20,
          borderWidth: 1, borderColor: theme.border, padding: 20, gap: 14,
        }}>
          {items.map((item) => (
            <View key={item.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 11,
                backgroundColor: item.color + '18',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={{ fontSize: 14, color: theme.text, flex: 1, lineHeight: 19 }}>{item.text}</Text>
            </View>
          ))}
        </View>
      </OBShell>
    </SafeAreaView>
  );
}
