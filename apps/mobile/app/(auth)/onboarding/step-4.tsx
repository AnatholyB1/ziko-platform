import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, FadeIn } from 'react-native-reanimated';
import { OBContext } from './_layout';

const TOTAL = 7;
const STEP = 3; // 0-indexed → displays 4/7

const TIPS: Record<number, string> = {
  1: 'Bon démarrage. On vise le full body.',
  2: 'Bon démarrage. On vise le full body.',
  3: 'Format idéal débutant — full body × 3.',
  4: 'Le sweet spot. Push / Pull / Legs / Upper.',
  5: 'Solide. PPL + bras / épaules dédiés.',
  6: 'Volume élevé — on surveillera la récup.',
  7: 'Volume élevé — on surveillera la récup.',
};

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
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B6963', minWidth: 28, textAlign: 'right' }}>{step + 1}/{total}</Text>
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

export default function OnboardingStep4() {
  const theme = useThemeStore((s) => s.theme);
  const { setObState } = useContext(OBContext);
  const [v, setV] = useState(4);
  // canNext is always true since default is 4 (valid)
  const canNext = true;

  const handleNext = () => {
    setObState({ frequency: v });
    router.push('/(auth)/onboarding/step-5');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={canNext}>
        {/* OBHeader */}
        <View style={{ marginTop: 18, marginBottom: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 3</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 31, letterSpacing: -0.5 }}>Combien de séances par semaine ?</Text>
          <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 8, lineHeight: 20 }}>Sois honnête. Mieux vaut 3 séances tenues que 6 prévues.</Text>
        </View>

        {/* Frequency card */}
        <View style={{ padding: 22, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E0DA' }}>
          {/* Big number display */}
          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <Text style={{ fontSize: 64, fontWeight: '800', color: '#FF5C1A', lineHeight: 64 }}>{v}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B6963', marginTop: 4 }}>
              {v} séance{v > 1 ? 's' : ''} par semaine
            </Text>
          </View>

          {/* 7-button grid */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setV(n)}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: 10,
                  backgroundColor: v === n ? '#FF5C1A' : 'rgba(28,26,23,0.05)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontWeight: '800', fontSize: 14, color: v === n ? '#fff' : '#1C1A17' }}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* AI tip card */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(255,92,26,0.08)', marginTop: 16 }}>
            <Ionicons name="sparkles-outline" size={13} color="#FF5C1A" />
            <Animated.Text
              key={v}
              entering={FadeIn.duration(200)}
              style={{ fontSize: 11.5, color: '#6B6963', flex: 1 }}
            >
              {TIPS[v] ?? TIPS[4]}
            </Animated.Text>
          </View>
        </View>
      </OBShell>
    </SafeAreaView>
  );
}
