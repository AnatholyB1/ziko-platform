import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';
import { useStretchingStore } from '../store';
import type { StretchRoutine } from '../store';

const BUILT_IN_ROUTINES: StretchRoutine[] = [
  {
    id: 'pre-upper', name: 'Échauffement Haut du Corps', type: 'pre_workout',
    muscle_groups: ['shoulders', 'chest', 'back'], duration_minutes: 8,
    exercises: [
      { id: 'e1', name: 'Rotations d\'épaules', muscle_group: 'shoulders', duration_seconds: 30, instructions: 'Grands cercles, 15 dans chaque sens', image_url: null },
      { id: 'e2', name: 'Ouverture pectorale', muscle_group: 'chest', duration_seconds: 30, instructions: 'Bras en croix, ouvrir la poitrine', image_url: null },
      { id: 'e3', name: 'Cat-Cow', muscle_group: 'back', duration_seconds: 45, instructions: 'À quatre pattes, alterner dos rond / dos creux', image_url: null },
      { id: 'e4', name: 'Cercles de bras', muscle_group: 'shoulders', duration_seconds: 30, instructions: 'Petits puis grands cercles', image_url: null },
    ],
  },
  {
    id: 'pre-lower', name: 'Échauffement Bas du Corps', type: 'pre_workout',
    muscle_groups: ['quads', 'hamstrings', 'glutes', 'calves'], duration_minutes: 8,
    exercises: [
      { id: 'e5', name: 'Squats dynamiques', muscle_group: 'quads', duration_seconds: 45, instructions: 'Squats lents et contrôlés', image_url: null },
      { id: 'e6', name: 'Fentes marchées', muscle_group: 'quads', duration_seconds: 45, instructions: 'Alterner les jambes en avançant', image_url: null },
      { id: 'e7', name: 'Balanciers de jambe', muscle_group: 'hamstrings', duration_seconds: 30, instructions: 'Avant-arrière, 15 par jambe', image_url: null },
      { id: 'e8', name: 'Rotations de hanches', muscle_group: 'glutes', duration_seconds: 30, instructions: 'Grands cercles, chaque sens', image_url: null },
    ],
  },
  {
    id: 'post-full', name: 'Retour au Calme Complet', type: 'post_workout',
    muscle_groups: ['full_body'], duration_minutes: 12,
    exercises: [
      { id: 'e9', name: 'Étirement ischio-jambiers', muscle_group: 'hamstrings', duration_seconds: 45, instructions: 'Debout, penché en avant, jambes tendues', image_url: null },
      { id: 'e10', name: 'Étirement quadriceps', muscle_group: 'quads', duration_seconds: 45, instructions: 'Debout, attraper le pied derrière', image_url: null },
      { id: 'e11', name: 'Pigeon pose', muscle_group: 'glutes', duration_seconds: 60, instructions: 'Chaque côté, rester détendu', image_url: null },
      { id: 'e12', name: 'Étirement pectoral mur', muscle_group: 'chest', duration_seconds: 45, instructions: 'Bras contre le mur, tourner le buste', image_url: null },
      { id: 'e13', name: 'Child\'s pose', muscle_group: 'back', duration_seconds: 60, instructions: 'Genoux écartés, bras devant', image_url: null },
    ],
  },
  {
    id: 'recovery', name: 'Récupération Active', type: 'recovery',
    muscle_groups: ['full_body'], duration_minutes: 15,
    exercises: [
      { id: 'e14', name: 'Foam roll dos', muscle_group: 'back', duration_seconds: 60, instructions: 'Rouler lentement du bas au haut du dos', image_url: null },
      { id: 'e15', name: 'Foam roll quadriceps', muscle_group: 'quads', duration_seconds: 60, instructions: 'Sur le ventre, rouler chaque cuisse', image_url: null },
      { id: 'e16', name: 'Étirement du psoas', muscle_group: 'hip_flexors', duration_seconds: 45, instructions: 'Genou au sol, pousser les hanches en avant', image_url: null },
      { id: 'e17', name: 'Torsion allongée', muscle_group: 'back', duration_seconds: 45, instructions: 'Sur le dos, genoux sur le côté', image_url: null },
    ],
  },
];

function RoutineCard({ routine, theme }: { routine: StretchRoutine; theme: any }) {
  const typeLabels: Record<string, string> = {
    pre_workout: '🔥 Pré-workout',
    post_workout: '❄️ Post-workout',
    recovery: '💆 Récupération',
    full_body: '🧘 Corps entier',
  };
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/(app)/(plugins)/stretching/session', params: { routineId: routine.id } })}
      style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: theme.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{routine.name}</Text>
          <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
            {typeLabels[routine.type] ?? routine.type} · {routine.duration_minutes} min · {routine.exercises.length} exercices
          </Text>
        </View>
        <Ionicons name="play-circle" size={32} color={theme.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function StretchingDashboard({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { logs, setLogs, setRoutines, customRoutines, setCustomRoutines, isLoading, setIsLoading } = useStretchingStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setRoutines(BUILT_IN_ROUTINES);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [logsRes, routinesRes] = await Promise.all([
          supabase.from('stretching_logs').select('*').order('date', { ascending: false }).limit(20),
          supabase.from('stretching_routines').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        ]);
        if (logsRes.data) setLogs(logsRes.data);
        if (routinesRes.data) {
          setCustomRoutines(routinesRes.data.map((r: any) => ({
            ...r, is_custom: true,
            muscle_groups: r.muscle_groups ?? [],
            exercises: r.exercises ?? [],
          })));
        }
      }
    } catch {}
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const totalThisWeek = logs.filter((l) => {
    const d = new Date(l.date);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Stretching</Text>
        <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>Mobilité & récupération</Text>

        {/* Weekly stats */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 16, padding: 16,
          marginTop: 20, borderWidth: 1, borderColor: theme.border,
          flexDirection: 'row', justifyContent: 'space-around',
        }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.primary, fontSize: 24, fontWeight: '800' }}>{totalThisWeek}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Cette semaine</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.primary, fontSize: 24, fontWeight: '800' }}>{logs.length}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Total sessions</Text>
          </View>
        </View>

        {/* Routines */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
            Routines prédéfinies
          </Text>
        </View>

        {/* Suggestion based on last workout */}
        {(() => {
          const lastLog = logs[0];
          const today = new Date().toISOString().split('T')[0];
          const didStretchToday = lastLog?.date === today;
          if (didStretchToday) return null;
          return (
            <View style={{
              backgroundColor: theme.primary + '12', borderRadius: 14, padding: 14, marginBottom: 16,
              borderWidth: 1, borderColor: theme.primary + '33', flexDirection: 'row', alignItems: 'center', gap: 12,
            }}>
              <Ionicons name="bulb-outline" size={20} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>Pensez à vous étirer !</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Aucun stretching aujourd'hui. Essayez un retour au calme après votre séance.</Text>
              </View>
            </View>
          );
        })()}

        {BUILT_IN_ROUTINES.map((r) => (
          <RoutineCard key={r.id} routine={r} theme={theme} />
        ))}

        {/* Custom routines */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
            Mes routines
          </Text>
          <TouchableOpacity onPress={() => router.push('/(app)/(plugins)/stretching/manager' as any)}>
            <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 14 }}>Gérer</Text>
          </TouchableOpacity>
        </View>

        {customRoutines.length === 0 ? (
          <TouchableOpacity
            onPress={() => router.push('/(app)/(plugins)/stretching/editor' as any)}
            style={{
              borderWidth: 2, borderColor: theme.primary + '44', borderStyle: 'dashed',
              borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12, gap: 8,
            }}
          >
            <Ionicons name="add-circle-outline" size={28} color={theme.primary} />
            <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 14 }}>Créer ma routine</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Compose ta propre séance d'étirements</Text>
          </TouchableOpacity>
        ) : (
          <>
            {customRoutines.map((r) => (
              <RoutineCard key={r.id} routine={r} theme={theme} />
            ))}
            <TouchableOpacity
              onPress={() => router.push('/(app)/(plugins)/stretching/editor' as any)}
              style={{
                borderWidth: 2, borderColor: theme.primary + '44', borderStyle: 'dashed',
                borderRadius: 14, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
              <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 14 }}>Nouvelle routine</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Quick links to related plugins */}
        <View style={{ marginTop: 20, gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push('/(app)/workout/session' as any)}
            style={{
              backgroundColor: theme.surface, borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="flash" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Séance rapide</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>Démarrer un workout libre</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(app)/(plugins)/sleep/dashboard' as any)}
            style={{
              backgroundColor: theme.surface, borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#9C27B018', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="moon" size={18} color="#9C27B0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Sommeil & Récupération</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>Le stretching améliore le sommeil</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
