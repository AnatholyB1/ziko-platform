import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { OBContext } from './_layout';

const TOTAL = 7;
const STEP = 2; // 0-indexed → displays 3/7

const OB_LEVELS = [
  { id: 'beg',  label: 'Débutant',       sub: '<6 mois ou reprise après pause',   barsFilled: 1 },
  { id: 'med',  label: 'Intermédiaire',  sub: '6 mois – 2 ans, technique propre', barsFilled: 2 },
  { id: 'conf', label: 'Confirmé',       sub: '2+ ans, programmes structurés',    barsFilled: 3 },
];

const BAR_HEIGHTS = [18, 24, 30];

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

export default function OnboardingStep3() {
  const theme = useThemeStore((s) => s.theme);
  const { setObState } = useContext(OBContext);
  const [selected, setSelected] = useState<string | null>(null);
  const canNext = !!selected;

  const handleNext = () => {
    if (!selected) return;
    setObState({ level: selected });
    router.push('/(auth)/onboarding/step-4');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={canNext}>
        {/* OBHeader */}
        <View style={{ marginTop: 18, marginBottom: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 2</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 31, letterSpacing: -0.5 }}>Ton niveau actuel ?</Text>
          <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 8, lineHeight: 20 }}>Pas de jugement — c'est juste pour calibrer la difficulté.</Text>
        </View>

        {/* Level cards */}
        <View style={{ gap: 10 }}>
          {OB_LEVELS.map((lv) => {
            const active = selected === lv.id;
            return (
              <TouchableOpacity
                key={lv.id}
                onPress={() => setSelected(lv.id)}
                style={{
                  padding: 16, borderRadius: 16,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  backgroundColor: active ? 'rgba(255,92,26,0.05)' : '#FFFFFF',
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#FF5C1A' : '#E2E0DA',
                }}
              >
                {/* Bar indicator */}
                <View style={{ width: 44, height: 44, flexDirection: 'row', alignItems: 'flex-end', gap: 3, justifyContent: 'center' }}>
                  {BAR_HEIGHTS.map((h, barIndex) => (
                    <View
                      key={barIndex}
                      style={{
                        width: 6, height: h, borderRadius: 2,
                        backgroundColor: barIndex < lv.barsFilled ? '#FF5C1A' : 'rgba(28,26,23,0.12)',
                      }}
                    />
                  ))}
                </View>

                {/* Text */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17' }}>{lv.label}</Text>
                  <Text style={{ fontSize: 11.5, color: '#6B6963', marginTop: 2 }}>{lv.sub}</Text>
                </View>

                {/* Checkmark (selected only) */}
                {active && <Ionicons name="checkmark" size={18} color="#FF5C1A" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </OBShell>
    </SafeAreaView>
  );
}
