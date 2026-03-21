import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useMeasurementsStore } from '../store';

function StatCard({ label, value, unit, diff, theme }: { label: string; value: number | null; unit: string; diff: number; theme: any }) {
  const diffColor = diff > 0 ? '#4CAF50' : diff < 0 ? '#F44336' : theme.muted;
  return (
    <View style={{
      flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: theme.border, alignItems: 'center', minWidth: '45%',
    }}>
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', marginTop: 4 }}>
        {value != null ? `${value}` : '—'} <Text style={{ fontSize: 12, fontWeight: '400' }}>{unit}</Text>
      </Text>
      {diff !== 0 && (
        <Text style={{ color: diffColor, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
          {diff > 0 ? '+' : ''}{diff.toFixed(1)}
        </Text>
      )}
    </View>
  );
}

export default function MeasurementsDashboard({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { entries, setEntries, isLoading, setIsLoading, getLatest, getProgress } = useMeasurementsStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('body_measurements')
        .select('*')
        .order('date', { ascending: false })
        .limit(60);
      if (data) setEntries(data);
    } catch {}
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const latest = getLatest();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Mesures</Text>
        <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>Suivi corporel</Text>

        <TouchableOpacity
          onPress={() => router.push('/(app)/(plugins)/measurements/log')}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 16,
            alignItems: 'center', marginTop: 20,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Nouvelle mesure</Text>
        </TouchableOpacity>

        {latest ? (
          <>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
              Dernière mesure — {latest.date}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <StatCard label="Poids" value={latest.weight_kg} unit="kg" diff={getProgress('weight_kg').diff} theme={theme} />
              <StatCard label="Graisse" value={latest.body_fat_pct} unit="%" diff={getProgress('body_fat_pct').diff} theme={theme} />
              <StatCard label="Taille" value={latest.waist_cm} unit="cm" diff={getProgress('waist_cm').diff} theme={theme} />
              <StatCard label="Poitrine" value={latest.chest_cm} unit="cm" diff={getProgress('chest_cm').diff} theme={theme} />
              <StatCard label="Bras" value={latest.arm_cm} unit="cm" diff={getProgress('arm_cm').diff} theme={theme} />
              <StatCard label="Cuisse" value={latest.thigh_cm} unit="cm" diff={getProgress('thigh_cm').diff} theme={theme} />
            </View>
          </>
        ) : (
          <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 40 }}>
            Aucune mesure enregistrée
          </Text>
        )}

        {/* History */}
        {entries.length > 1 && (
          <>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
              Historique
            </Text>
            {entries.slice(1, 10).map((e) => (
              <View key={e.id} style={{
                backgroundColor: theme.surface, borderRadius: 12, padding: 14,
                marginBottom: 8, borderWidth: 1, borderColor: theme.border,
                flexDirection: 'row', justifyContent: 'space-between',
              }}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{e.date}</Text>
                <Text style={{ color: theme.muted }}>
                  {e.weight_kg ? `${e.weight_kg}kg` : ''} {e.body_fat_pct ? `· ${e.body_fat_pct}%` : ''}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
