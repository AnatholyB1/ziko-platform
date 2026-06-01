import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { supabase } from '../../../../src/lib/supabase';

export default function AIProgramDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useThemeStore((s) => s.theme);
  const [expandedDay, setExpandedDay] = useState<number | null>(0);

  const { data: program, isLoading } = useQuery({
    queryKey: ['ai_program', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_generated_programs')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const days: any[] = program?.program_data?.days
    ?? program?.program_data?.sessions
    ?? program?.program_data?.workouts
    ?? [];

  const programName: string = program?.program_data?.name ?? program?.name ?? 'Programme IA';
  const goal: string = program?.goal ?? '';
  const splitType: string = program?.split_type ?? '';
  const daysPerWeek: number = program?.days_per_week ?? days.length;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!program) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.muted} />
        <Text style={{ color: theme.muted, marginTop: 12, fontSize: 14 }}>Programme introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: theme.primary, fontWeight: '700' }}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#1C1A17', paddingTop: 56, paddingBottom: 20,
        paddingHorizontal: 16,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: 'rgba(255,250,246,0.12)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}
        >
          <Ionicons name="chevron-back" size={18} color="#FFFAF6" />
        </TouchableOpacity>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,250,246,0.55)', marginBottom: 6 }}>
          Programme actif
        </Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFAF6', lineHeight: 28 }}>{programName}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {goal ? (
            <View style={{ backgroundColor: 'rgba(255,92,26,0.20)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF8E5A', textTransform: 'capitalize' }}>{goal.replace('_', ' ')}</Text>
            </View>
          ) : null}
          {splitType ? (
            <View style={{ backgroundColor: 'rgba(255,250,246,0.10)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,250,246,0.65)', textTransform: 'capitalize' }}>{splitType.replace('_', ' ')}</Text>
            </View>
          ) : null}
          <View style={{ backgroundColor: 'rgba(255,250,246,0.10)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,250,246,0.65)' }}>{daysPerWeek}j/semaine</Text>
          </View>
        </View>
      </View>

      {/* Days list */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {days.map((day: any, idx: number) => {
          const dayName: string = day.name ?? day.title ?? `Séance ${idx + 1}`;
          const exercises: any[] = day.exercises ?? day.sets ?? [];
          const isExpanded = expandedDay === idx;

          return (
            <View key={idx} style={{
              backgroundColor: theme.surface,
              borderRadius: 16, marginBottom: 10,
              shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
              overflow: 'hidden',
            }}>
              <TouchableOpacity
                onPress={() => setExpandedDay(isExpanded ? null : idx)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  padding: 16, gap: 12,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: theme.primary + '18',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: theme.primary }}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{dayName}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>{exercises.length} exercices</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.muted}
                />
              </TouchableOpacity>

              {isExpanded && exercises.length > 0 && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
                  <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 4 }} />
                  {exercises.map((ex: any, ei: number) => (
                    <View key={ei} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{
                        width: 22, height: 22, borderRadius: 6,
                        backgroundColor: theme.primary + '14',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary }}>{ei + 1}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 13, color: theme.text, textTransform: 'capitalize' }}>
                        {ex.name ?? ex.exercise_name ?? 'Exercice'}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.muted, fontWeight: '600' }}>
                        {ex.sets != null ? `${ex.sets}×${ex.reps ?? ''}` : ex.scheme ?? ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity
          onPress={() => router.push('/(app)/workout' as any)}
          activeOpacity={0.85}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, height: 52,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8, marginTop: 8,
          }}
        >
          <Ionicons name="play-outline" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Démarrer la séance</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
