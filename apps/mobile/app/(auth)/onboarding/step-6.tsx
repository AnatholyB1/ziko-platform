import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OBContext } from './_layout';

const TOTAL = 7;
const STEP = 5; // 0-indexed → shows "6/7"

function OBShell({
  step, total, onBack, onNext, canNext, children,
}: {
  step: number; total: number; onBack: () => void; onNext: () => void; canNext: boolean; children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <TouchableOpacity
          onPress={onBack}
          style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(28,26,23,0.06)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={16} color="#1C1A17" />
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(28,26,23,0.08)', borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${((step + 1) / total) * 100}%` as any, height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999 }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B6963' }}>{step + 1}/{total}</Text>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <TouchableOpacity
          onPress={canNext ? onNext : undefined}
          style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A', opacity: canNext ? 1 : 0.35 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Continuer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface BioFieldProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function BioField({ label, unit, value, min, max, step, onChange }: BioFieldProps) {
  return (
    <View style={{
      padding: 14, backgroundColor: '#FFFFFF', borderRadius: 12,
      borderWidth: 1, borderColor: '#E2E0DA', marginBottom: 10,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B6963', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#1C1A17' }}>{value}</Text>
          <Text style={{ fontSize: 12, color: '#6B6963' }}>{unit}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(min, +(value - step).toFixed(1)))}
          style={{
            width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(28,26,23,0.06)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1C1A17' }}>−</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(28,26,23,0.08)', borderRadius: 999 }}>
          <View style={{
            width: `${((value - min) / (max - min)) * 100}%` as any,
            height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999,
          }} />
        </View>
        <TouchableOpacity
          onPress={() => onChange(Math.min(max, +(value + step).toFixed(1)))}
          style={{
            width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(28,26,23,0.06)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1C1A17' }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingStep6() {
  const { setObState } = useContext(OBContext);
  const [sex, setSex] = useState<string | null>(null);
  const [age, setAge] = useState(28);
  const [height, setHeight] = useState(178);
  const [weight, setWeight] = useState(76);

  const canNext = !!sex && age >= 14 && age <= 90 && height > 100 && weight > 30;

  const handleNext = () => {
    setObState({ sex, age, height, weight });
    router.push('/(auth)/onboarding/step-7');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={canNext}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* OBHeader */}
          <View style={{ marginTop: 18, marginBottom: 22 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>
              Étape 5
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', lineHeight: 31, letterSpacing: -0.5, color: '#1C1A17' }}>
              Quelques infos sur toi
            </Text>
            <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 8, lineHeight: 20 }}>
              Pour calculer tes besoins caloriques et tes charges.
            </Text>
          </View>

          {/* Sex selector */}
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B6963', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Sexe
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { id: 'm', label: 'Homme' },
                { id: 'f', label: 'Femme' },
                { id: 'x', label: 'Autre' },
              ].map((s) => {
                const active = sex === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSex(s.id)}
                    style={{
                      flex: 1, padding: 12, borderRadius: 12, alignItems: 'center',
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? '#FF5C1A' : '#E2E0DA',
                      backgroundColor: active ? 'rgba(255,92,26,0.08)' : '#FFFFFF',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#FF5C1A' : '#1C1A17' }}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Bio sliders */}
          <BioField label="Âge" unit="ans" value={age} min={14} max={90} step={1} onChange={setAge} />
          <BioField label="Taille" unit="cm" value={height} min={130} max={220} step={1} onChange={setHeight} />
          <BioField label="Poids" unit="kg" value={weight} min={35} max={180} step={0.5} onChange={setWeight} />

          {/* Privacy note */}
          <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 10, lineHeight: 16 }}>
            {'🔒 Ces données restent privées. Tu peux les modifier à tout moment.'}
          </Text>
        </ScrollView>
      </OBShell>
    </SafeAreaView>
  );
}
