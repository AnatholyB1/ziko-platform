import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

const TOTAL = 8;
const STEP = 4;

const EQUIP = [
  { id: 'gym',        label: 'Salle complète', sub: 'Barres, machines, racks',    icon: 'barbell-outline' as const },
  { id: 'home',       label: 'Home gym',       sub: 'Haltères, banc, élastiques', icon: 'scale-outline' as const },
  { id: 'bodyweight', label: 'Poids du corps', sub: 'Tractions, dips, push-ups',  icon: 'person-outline' as const },
  { id: 'outdoor',    label: 'Extérieur',      sub: 'Course, parc, calisthénie',  icon: 'walk-outline' as const },
];

function OBShell({ step, total, onBack, onNext, canNext, children }: {
  step: number; total: number; onBack: () => void; onNext: () => void; canNext: boolean; children: React.ReactNode;
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
        <TouchableOpacity onPress={canNext ? onNext : undefined} style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A', opacity: canNext ? 1 : 0.35 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Continuer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingStep5() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    if (!selected || saving) return;
    setSaving(true);
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (uid) await supabase.from('user_profiles').update({ equipment: selected }).eq('id', uid);
    setSaving(false);
    router.push('/(auth)/onboarding/step-6' as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={!!selected && !saving}>
        <View style={{ marginTop: 18, marginBottom: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 4</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.5 }}>Quel équipement as-tu ?</Text>
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, lineHeight: 20 }}>Pour proposer les bons exercices et alternatives.</Text>
        </View>
        <View style={{ gap: 10 }}>
          {EQUIP.map((eq) => {
            const active = selected === eq.id;
            return (
              <TouchableOpacity
                key={eq.id}
                onPress={() => setSelected(eq.id)}
                style={{
                  padding: 14, borderRadius: 16,
                  backgroundColor: active ? '#FF5C1A' + '10' : theme.surface,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#FF5C1A' : theme.border,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FF5C1A' + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={eq.icon} size={20} color="#FF5C1A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{eq.label}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 3 }}>{eq.sub}</Text>
                </View>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: active ? 6 : 1.5,
                  borderColor: active ? '#FF5C1A' : theme.border,
                  backgroundColor: active ? '#fff' : 'transparent',
                }} />
              </TouchableOpacity>
            );
          })}
        </View>
      </OBShell>
    </SafeAreaView>
  );
}
