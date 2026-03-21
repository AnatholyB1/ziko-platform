import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAIProgramsStore } from '../store';

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: '💪 Prise de muscle',
  fat_loss: '🔥 Perte de gras',
  strength: '🏋️ Force',
  endurance: '🏃 Endurance',
  general_fitness: '🎯 Forme générale',
};

const SPLIT_LABELS: Record<string, string> = {
  full_body: 'Full Body',
  upper_lower: 'Upper / Lower',
  ppl: 'Push / Pull / Legs',
  bro_split: 'Bro Split',
  custom: 'Custom',
};

export default function AIProgramsDashboard({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { programs, setPrograms, isLoading, setIsLoading } = useAIProgramsStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('ai_generated_programs')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setPrograms(data);
    } catch {}
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Programmes IA</Text>
        <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>Générés par ton coach IA</Text>

        <TouchableOpacity
          onPress={() => router.push('/(app)/(plugins)/ai-programs/generate')}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 16,
            alignItems: 'center', marginTop: 20, flexDirection: 'row',
            justifyContent: 'center', gap: 8,
          }}
        >
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Générer un programme</Text>
        </TouchableOpacity>

        {programs.length > 0 ? (
          <>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
              Mes programmes
            </Text>
            {programs.map((p) => (
              <View key={p.id} style={{
                backgroundColor: theme.surface, borderRadius: 14, padding: 16,
                marginBottom: 10, borderWidth: 1, borderColor: theme.border,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{p.name}</Text>
                    <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
                      {GOAL_LABELS[p.goal] ?? p.goal} · {SPLIT_LABELS[p.split_type] ?? p.split_type} · {p.days_per_week}j/sem
                    </Text>
                  </View>
                  {p.is_active && (
                    <View style={{ backgroundColor: '#4CAF5020', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '700' }}>Actif</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>
                  Créé le {new Date(p.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Ionicons name="sparkles-outline" size={48} color={theme.border} />
            <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 16 }}>
              Aucun programme IA généré{'\n'}Appuie sur le bouton pour en créer un !
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
