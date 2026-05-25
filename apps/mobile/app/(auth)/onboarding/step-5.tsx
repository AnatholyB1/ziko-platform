import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OBContext } from './_layout';

const TOTAL = 7;
const STEP = 4; // 0-indexed → shows "5/7"

const EQUIP = [
  { id: 'gym',  label: 'Salle complète', sub: 'Barres, machines, racks',    icon: 'barbell-outline' as const },
  { id: 'home', label: 'Home gym',       sub: 'Haltères, banc, élastiques', icon: 'scale-outline'   as const },
  { id: 'body', label: 'Poids du corps', sub: 'Tractions, dips, push-ups',  icon: 'person-outline'  as const },
  { id: 'out',  label: 'Extérieur',      sub: 'Course, parc, calisthénie',  icon: 'walk-outline'    as const },
];

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
      <View style={{ flex: 1, paddingHorizontal: 22 }}>{children}</View>
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

export default function OnboardingStep5() {
  const { setObState } = useContext(OBContext);
  const [sel, setSel] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSel((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const canNext = sel.length > 0;

  const handleNext = () => {
    setObState({ equipment: sel });
    router.push('/(auth)/onboarding/step-6');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={canNext}>
        {/* OBHeader */}
        <View style={{ marginTop: 18, marginBottom: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>
            Étape 4
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '800', lineHeight: 31, letterSpacing: -0.5, color: '#1C1A17' }}>
            À quoi as-tu accès ?
          </Text>
          <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 8, lineHeight: 20 }}>
            Choisis tout ce qui s'applique.
          </Text>
        </View>

        {/* 2×2 grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {EQUIP.map((eq) => {
            const active = sel.includes(eq.id);
            return (
              <TouchableOpacity
                key={eq.id}
                onPress={() => toggle(eq.id)}
                style={{
                  width: '47.5%',
                  aspectRatio: 1,
                  padding: 14,
                  borderRadius: 16,
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 10,
                  backgroundColor: active ? 'rgba(255,92,26,0.05)' : '#FFFFFF',
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#FF5C1A' : '#E2E0DA',
                }}
              >
                {/* Top row: icon badge + check circle */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                  <View style={{
                    width: 38, height: 38, borderRadius: 11,
                    backgroundColor: active ? '#FF5C1A' : 'rgba(28,26,23,0.06)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={eq.icon} size={18} color={active ? '#fff' : '#1C1A17'} />
                  </View>
                  {active && (
                    <View style={{
                      width: 22, height: 22, borderRadius: 11, backgroundColor: '#FF5C1A',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </View>
                {/* Bottom: title + sub */}
                <View style={{ marginTop: 'auto' as any }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1C1A17' }}>{eq.label}</Text>
                  <Text style={{ fontSize: 10.5, color: '#6B6963', lineHeight: 16.5 }}>{eq.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </OBShell>
    </SafeAreaView>
  );
}
