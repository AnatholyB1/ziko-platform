import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useMeasurementsStore } from '../store';
import { useCreditStore } from '../../../../apps/mobile/src/stores/creditStore';

// Awaitable credit earn helper — returns { credited } for toast triggering
async function earnCredit(supabase: any, source: string, key: string): Promise<{ credited: boolean }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { credited: false };
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const res = await fetch(`${API_URL}/credits/earn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ source, idempotency_key: key }),
    });
    if (!res.ok) return { credited: false };
    const data = await res.json();
    return { credited: data.credited === true };
  } catch {
    return { credited: false };
  }
}

function MeasureInput({ label, value, onChange, unit, theme }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          value={value} onChangeText={onChange}
          keyboardType="numeric" placeholder="—" placeholderTextColor={theme.muted}
          style={{
            flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: theme.border, color: theme.text,
            fontSize: 16, fontWeight: '700',
          }}
        />
        <Text style={{ color: theme.muted, fontSize: 14, marginLeft: 8, width: 30 }}>{unit}</Text>
      </View>
    </View>
  );
}

export default function MeasurementsLog({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { addEntry } = useMeasurementsStore();
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [arm, setArm] = useState('');
  const [thigh, setThigh] = useState('');
  const [hip, setHip] = useState('');
  const [saving, setSaving] = useState(false);

  const toNum = (v: string) => (v ? parseFloat(v) : null);

  const handleSave = async () => {
    if (!weight && !bodyFat && !waist && !chest && !arm && !thigh && !hip) {
      Alert.alert('Erreur', 'Remplis au moins un champ');
      return;
    }
    setSaving(true);
    const date = new Date().toISOString().split('T')[0];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const { data, error } = await supabase.from('body_measurements').insert({
        user_id: user.id,
        date,
        weight_kg: toNum(weight), body_fat_pct: toNum(bodyFat),
        waist_cm: toNum(waist), chest_cm: toNum(chest),
        arm_cm: toNum(arm), thigh_cm: toNum(thigh), hip_cm: toNum(hip),
      }).select().single();
      if (error) throw error;
      if (data) addEntry(data);
      // Earn credit and show toast if credited (D-11)
      if (data) earnCredit(supabase, 'measurement', (data as any).id).then((r) => {
        if (r.credited) useCreditStore.getState().showEarnToast();
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Sauvegarde impossible');
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginLeft: 12 }}>Nouvelle mesure</Text>
        </View>

        <MeasureInput label="Poids" value={weight} onChange={setWeight} unit="kg" theme={theme} />
        <MeasureInput label="% Graisse" value={bodyFat} onChange={setBodyFat} unit="%" theme={theme} />
        <MeasureInput label="Tour de taille" value={waist} onChange={setWaist} unit="cm" theme={theme} />
        <MeasureInput label="Poitrine" value={chest} onChange={setChest} unit="cm" theme={theme} />
        <MeasureInput label="Tour de bras" value={arm} onChange={setArm} unit="cm" theme={theme} />
        <MeasureInput label="Tour de cuisse" value={thigh} onChange={setThigh} unit="cm" theme={theme} />
        <MeasureInput label="Tour de hanches" value={hip} onChange={setHip} unit="cm" theme={theme} />

        <TouchableOpacity
          onPress={handleSave} disabled={saving}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 16,
            alignItems: 'center', marginTop: 20, opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
