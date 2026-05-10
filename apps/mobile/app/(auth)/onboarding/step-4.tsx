import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

const TOTAL = 8;
const STEP = 3;

const FREQS = [
  { id: '2',  label: '2 fois / semaine', sub: 'Entrainement léger, début progressif' },
  { id: '3',  label: '3 fois / semaine', sub: 'Le sweet spot pour la plupart' },
  { id: '4',  label: '4 fois / semaine', sub: 'Programme structuré par groupes' },
  { id: '5+', label: '5+ fois / semaine', sub: 'Haute fréquence, récup optimale' },
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

export default function OnboardingStep4() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    if (!selected || saving) return;
    setSaving(true);
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (uid) await supabase.from('user_profiles').update({ workout_frequency: selected }).eq('id', uid);
    setSaving(false);
    router.push('/(auth)/onboarding/step-5');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={!!selected && !saving}>
        <View style={{ marginTop: 18, marginBottom: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 3</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.5 }}>Combien de fois par semaine ?</Text>
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, lineHeight: 20 }}>Pour construire un programme adapté à ton rythme.</Text>
        </View>
        <View style={{ gap: 10 }}>
          {FREQS.map((f) => {
            const active = selected === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setSelected(f.id)}
                style={{
                  padding: 18, borderRadius: 16,
                  backgroundColor: active ? '#FF5C1A' + '10' : theme.surface,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#FF5C1A' : theme.border,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{f.label}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 3 }}>{f.sub}</Text>
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
