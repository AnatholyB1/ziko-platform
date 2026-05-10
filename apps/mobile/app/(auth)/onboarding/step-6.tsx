import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

const TOTAL = 8;
const STEP = 5;

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
      <View style={{ flex: 1 }}>{children}</View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <TouchableOpacity onPress={canNext ? onNext : undefined} style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A', opacity: canNext ? 1 : 0.35 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Continuer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingStep6() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = age.length > 0 && weight.length > 0 && height.length > 0;

  const handleNext = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (uid) {
      await supabase.from('user_profiles').update({
        age: parseInt(age, 10),
        weight_kg: parseFloat(weight),
        height_cm: parseFloat(height),
      }).eq('id', uid);
    }
    setSaving(false);
    router.push('/(auth)/onboarding/step-7' as any);
  };

  const fieldStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 14, paddingVertical: 14,
    color: theme.text, fontSize: 14,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={isValid && !saving}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}>
            <View style={{ marginTop: 18, marginBottom: 22 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 5</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.5 }}>Quelques infos sur toi</Text>
              <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, lineHeight: 20 }}>Pour calibrer tes objectifs caloriques et ta progression.</Text>
            </View>
            <View style={{ gap: 16 }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Âge</Text>
                <TextInput value={age} onChangeText={setAge} placeholder="25" placeholderTextColor={theme.muted} keyboardType="number-pad" style={fieldStyle} />
              </View>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Poids (kg)</Text>
                <TextInput value={weight} onChangeText={setWeight} placeholder="75" placeholderTextColor={theme.muted} keyboardType="decimal-pad" style={fieldStyle} />
              </View>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Taille (cm)</Text>
                <TextInput value={height} onChangeText={setHeight} placeholder="175" placeholderTextColor={theme.muted} keyboardType="decimal-pad" style={fieldStyle} />
              </View>
            </View>
          </ScrollView>
        </OBShell>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
