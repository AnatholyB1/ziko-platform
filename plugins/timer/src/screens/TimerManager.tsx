import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useTimerStore } from '../store';
import type { TimerPreset } from '../store';

const TYPE_COLORS: Record<string, string> = {
  tabata: '#F44336', hiit: '#FF9800', emom: '#2196F3', custom: '#9C27B0',
};

export default function TimerManager({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { customPresets, setCustomPresets, removeCustomPreset } = useTimerStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadPresets = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('timer_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const mapped: TimerPreset[] = (data ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        work_seconds: d.work_sec,
        rest_seconds: d.rest_sec,
        rounds: d.rounds,
        is_builtin: false,
      }));
      setCustomPresets(mapped);
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }, [supabase]);

  const handleDelete = (preset: TimerPreset) => {
    Alert.alert(
      'Supprimer',
      `Supprimer "${preset.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('timer_presets')
                .delete()
                .eq('id', preset.id);
              if (error) throw error;
              removeCustomPreset(preset.id);
            } catch (err: any) {
              Alert.alert('Erreur', err.message ?? 'Impossible de supprimer');
            }
          },
        },
      ],
    );
  };

  const totalSeconds = (p: TimerPreset) =>
    (p.work_seconds + p.rest_seconds) * p.rounds;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadPresets} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color={theme.primary} />
            </TouchableOpacity>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>Mes chronos</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(plugins)/timer/editor' as any)}
            style={{
              backgroundColor: theme.primary, borderRadius: 12,
              paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row',
              alignItems: 'center', gap: 6,
            }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Créer</Text>
          </TouchableOpacity>
        </View>

        {customPresets.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>⏱️</Text>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 17 }}>Aucun chrono personnalisé</Text>
            <Text style={{ color: theme.muted, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
              Créez vos propres chronos HIIT, Tabata ou intervalles personnalisés
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(plugins)/timer/editor' as any)}
              style={{
                backgroundColor: theme.primary, borderRadius: 14,
                paddingHorizontal: 24, paddingVertical: 14, marginTop: 24,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Créer mon premier chrono</Text>
            </TouchableOpacity>
          </View>
        ) : (
          customPresets.map((preset) => {
            const color = TYPE_COLORS[preset.type] || '#9C27B0';
            const totalMin = Math.ceil(totalSeconds(preset) / 60);

            return (
              <View
                key={preset.id}
                style={{
                  backgroundColor: theme.surface, borderRadius: 14, padding: 16,
                  marginBottom: 10, borderWidth: 1, borderColor: theme.border,
                  flexDirection: 'row', alignItems: 'center',
                }}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: color + '20',
                  justifyContent: 'center', alignItems: 'center', marginRight: 14,
                }}>
                  <Ionicons name="timer" size={22} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{preset.name}</Text>
                  <Text style={{ color: theme.muted, fontSize: 13 }}>
                    {preset.work_seconds > 0 ? `${preset.work_seconds}s work` : ''}
                    {preset.rest_seconds > 0 ? ` / ${preset.rest_seconds}s rest` : ''}
                    {' · '}{preset.rounds} rounds · ~{totalMin} min
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(plugins)/timer/editor' as any, params: { presetId: preset.id } })}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="pencil" size={20} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(preset)}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="trash" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
