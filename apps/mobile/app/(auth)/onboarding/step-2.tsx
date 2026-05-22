import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { OBContext } from './_layout';

const TOTAL = 7;
const STEP = 1; // 0-indexed → displays 2/7

const OB_GOALS = [
  { id: 'strength',    label: 'Gagner en force',   sub: 'Plus lourd, plus fort',    icon: 'barbell-outline' as const,  tint: '#FF5C1A' },
  { id: 'muscle_gain', label: 'Prendre du muscle',  sub: 'Hypertrophie, volume',     icon: 'flash-outline' as const,    tint: '#7B5BD0' },
  { id: 'fat_loss',    label: 'Perdre du gras',     sub: 'Sécher, recomposition',    icon: 'flame-outline' as const,    tint: '#E94B3C' },
  { id: 'endurance',   label: 'Endurance',          sub: 'Cardio, souffle, course',  icon: 'walk-outline' as const,     tint: '#2E7BF6' },
  { id: 'health',      label: 'Forme générale',     sub: 'Bouger plus, vivre mieux', icon: 'heart-outline' as const,    tint: '#2E9E5B' },
];

function OBShell({ step, total, onBack, onNext, canNext, children }: {
  step: number; total: number; onBack: () => void; onNext: () => void; canNext: boolean; children: React.ReactNode;
}) {
  const theme = useThemeStore((s) => s.theme);

  const fillWidth = useSharedValue(((step + 1) / total) * 100);
  React.useEffect(() => {
    fillWidth.value = withTiming(((step + 1) / total) * 100, { duration: 350 });
  }, [step, total]);
  const animStyle = useAnimatedStyle(() => ({ width: `${fillWidth.value}%` as any }));

  const ctaOpacity = useSharedValue(canNext ? 1 : 0.35);
  React.useEffect(() => {
    ctaOpacity.value = withTiming(canNext ? 1 : 0.35, { duration: 200 });
  }, [canNext]);
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingTop: 14, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={onBack}
          style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(28,26,23,0.06)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(28,26,23,0.08)', borderRadius: 999, overflow: 'hidden' }}>
          <Animated.View style={[{ height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999 }, animStyle]} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, minWidth: 28, textAlign: 'right' }}>{step + 1}/{total}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 22 }}>{children}</View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <Animated.View style={ctaStyle}>
          <TouchableOpacity
            onPress={canNext ? onNext : undefined}
            style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Continuer</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

export default function OnboardingStep2() {
  const theme = useThemeStore((s) => s.theme);
  const { setObState } = useContext(OBContext);
  const [selected, setSelected] = useState<string | null>(null);
  const canNext = !!selected;

  const handleNext = () => {
    if (!selected) return;
    setObState({ goal: selected });
    router.push('/(auth)/onboarding/step-3');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={canNext}>
        <View style={{ marginTop: 18, marginBottom: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 1</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 31, letterSpacing: -0.5 }}>Quel est ton objectif principal ?</Text>
          <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 8, lineHeight: 20 }}>On adapte tout — programmes, conseils, nutrition.</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {OB_GOALS.map((g) => {
            const active = selected === g.id;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => setSelected(g.id)}
                style={{
                  padding: 14, borderRadius: 16, marginBottom: 10,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  backgroundColor: active ? g.tint + '10' : '#FFFFFF',
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? g.tint : '#E2E0DA',
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: g.tint + '24', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={g.icon} size={20} color={g.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{g.label}</Text>
                  <Text style={{ fontSize: 11.5, color: '#6B6963', marginTop: 2 }}>{g.sub}</Text>
                </View>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: active ? 6 : 1.5,
                  borderColor: active ? g.tint : '#E2E0DA',
                  backgroundColor: active ? '#fff' : 'transparent',
                }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </OBShell>
    </SafeAreaView>
  );
}
