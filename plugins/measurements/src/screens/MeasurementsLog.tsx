import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore, showAlert, useCreditStore, getActionPrimary, localDateKey, requestQuestRefresh } from '@ziko/plugin-sdk';
import { useQueryClient } from '@tanstack/react-query';
import { parseDecimal, ENTRY_ORDER, getMeasure } from '../lib/goals';
import { GOALS_QUERY_KEY, RECENT_MEASURES_QUERY_KEY } from './GoalsTab';
import { useMeasurementsStore } from '../store';

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

function MeasureInput({ label, value, onChange, unit, theme, required }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          value={value} onChangeText={onChange}
          keyboardType="decimal-pad" placeholder={required ? '—' : 'Facultatif'} accessibilityLabel={label} placeholderTextColor={theme.muted}
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
  const queryClient = useQueryClient();
  const [entry, setEntry] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // E15 : seul le poids est obligatoire.
    const weightVal = parseDecimal(entry.weight_kg ?? '');
    if (weightVal == null || weightVal <= 0) {
      showAlert('Erreur', 'Le poids est requis');
      return;
    }
    setSaving(true);
    const date = localDateKey();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const { data, error } = await supabase.from('ziko_body_measurements').insert({
        user_id: user.id,
        date,
        weight_kg: weightVal,
        ...Object.fromEntries(
          ENTRY_ORDER.filter((k) => k !== 'weight_kg')
            .map((k) => [k, parseDecimal(entry[k] ?? '')] as const)
            .filter(([, v]) => v != null),
        ),
      }).select().single();
      if (error) throw error;
      requestQuestRefresh(); // quetes : progression re-mesuree (debounce)
      if (data) addEntry(data);
      queryClient.invalidateQueries({ queryKey: [RECENT_MEASURES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [GOALS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['latest_measurement'] });
      // Earn credit and show toast if credited (D-11)
      if (data) earnCredit(supabase, 'measurement', (data as any).id).then((r) => {
        if (r.credited) useCreditStore.getState().showEarnToast();
      });
      router.back();
    } catch (e: any) {
      showAlert('Erreur', e.message ?? 'Sauvegarde impossible');
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

        {ENTRY_ORDER.map((key) => {
          const def = getMeasure(key)!;
          const required = key === 'weight_kg';
          return (
            <MeasureInput
              key={key}
              label={required ? `${def.label} (obligatoire)` : def.label}
              value={entry[key] ?? ''}
              onChange={(v: string) => setEntry((e) => ({ ...e, [key]: v }))}
              unit={def.unit}
              theme={theme}
              required={required}
            />
          );
        })}

        <TouchableOpacity
          onPress={handleSave} disabled={saving}
          style={{
            backgroundColor: getActionPrimary(theme), borderRadius: 14, padding: 16,
            alignItems: 'center', marginTop: 20, opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {saving ? 'Sauvegarde...' : 'Enregistrer la mesure'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
