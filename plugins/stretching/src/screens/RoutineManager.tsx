import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useStretchingStore } from '../store';
import type { StretchRoutine } from '../store';

const typeLabels: Record<string, string> = {
  pre_workout: '🔥 Pré-workout',
  post_workout: '❄️ Post-workout',
  recovery: '💆 Récupération',
  full_body: '🧘 Corps entier',
  custom: '✨ Personnalisé',
};

export default function RoutineManager({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { customRoutines, setCustomRoutines, deleteCustomRoutine } = useStretchingStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadCustomRoutines = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('stretching_routines')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) {
        setCustomRoutines(data.map((r: any) => ({
          ...r, is_custom: true,
          muscle_groups: r.muscle_groups ?? [],
          exercises: r.exercises ?? [],
        })));
      }
    } catch {}
  }, [supabase]);

  useEffect(() => { loadCustomRoutines(); }, [loadCustomRoutines]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCustomRoutines();
    setRefreshing(false);
  }, [loadCustomRoutines]);

  const handleDelete = (routine: StretchRoutine) => {
    Alert.alert(
      'Supprimer',
      `Supprimer "${routine.name}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('stretching_routines').delete().eq('id', routine.id);
              deleteCustomRoutine(routine.id);
            } catch {}
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginLeft: 12, flex: 1 }}>
            Mes routines
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/(plugins)/stretching/editor' as any)}
            style={{ backgroundColor: theme.primary, borderRadius: 10, padding: 8 }}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {customRoutines.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ fontSize: 48 }}>🧘</Text>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700', marginTop: 16 }}>Aucune routine personnalisée</Text>
            <Text style={{ color: theme.muted, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
              Crée tes propres routines d'étirements adaptées à tes besoins
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(app)/(plugins)/stretching/editor' as any)}
              style={{
                backgroundColor: theme.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14,
                marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8,
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Créer une routine</Text>
            </TouchableOpacity>
          </View>
        ) : (
          customRoutines.map((routine) => (
            <View key={routine.id} style={{
              backgroundColor: theme.surface, borderRadius: 16, padding: 16,
              marginBottom: 12, borderWidth: 1, borderColor: theme.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{routine.name}</Text>
                  <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
                    {typeLabels[routine.type] ?? routine.type} · {routine.duration_minutes} min · {routine.exercises.length} exercices
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(app)/(plugins)/stretching/session' as any, params: { routineId: routine.id } })}
                  style={{
                    flex: 1, backgroundColor: theme.primary, borderRadius: 10,
                    paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Lancer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(app)/(plugins)/stretching/editor' as any, params: { editId: routine.id } })}
                  style={{
                    flex: 1, backgroundColor: theme.surface, borderRadius: 10,
                    paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
                    borderWidth: 1, borderColor: theme.border,
                  }}
                >
                  <Ionicons name="pencil" size={14} color={theme.text} />
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(routine)}
                  style={{
                    backgroundColor: '#F4433615', borderRadius: 10,
                    paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#F44336" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
