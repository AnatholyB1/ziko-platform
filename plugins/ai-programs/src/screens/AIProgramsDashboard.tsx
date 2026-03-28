import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
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

/** Parse reps string like "8-12" or "10" → integer (first number) */
function parseReps(reps: string | number | undefined): number | null {
  if (reps === undefined || reps === null) return null;
  const n = parseInt(String(reps), 10);
  return isNaN(n) ? null : n;
}

/** Import an AI program into workout_programs + program_workouts + program_exercises */
async function importProgramToWorkout(
  supabase: any,
  userId: string,
  aiProgram: any,
): Promise<string> {
  const programData = aiProgram.program_data ?? {};
  const days: any[] = programData.days ?? [];

  // 1. Create workout_programs row
  const { data: wp, error: wpErr } = await supabase
    .from('workout_programs')
    .insert({
      user_id: userId,
      name: aiProgram.name,
      description: `${GOAL_LABELS[aiProgram.goal] ?? aiProgram.goal} · ${SPLIT_LABELS[aiProgram.split_type] ?? aiProgram.split_type}`,
      days_per_week: aiProgram.days_per_week,
      is_active: false,
    })
    .select('id')
    .single();
  if (wpErr || !wp) throw new Error(wpErr?.message ?? 'Failed to create program');

  const programId = wp.id;

  // 2. For each day, create program_workouts + program_exercises (best-effort)
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const { data: pwRow, error: pwErr } = await supabase
      .from('program_workouts')
      .insert({
        program_id: programId,
        day_of_week: ((i % 7) + 1),
        name: day.name ?? `Jour ${i + 1}`,
        order_index: i,
      })
      .select('id')
      .single();
    if (pwErr || !pwRow) continue;

    const exercises: any[] = day.exercises ?? [];
    for (let j = 0; j < exercises.length; j++) {
      const ex = exercises[j];
      // Look up exercise by name (case-insensitive)
      const { data: exRow } = await supabase
        .from('exercises')
        .select('id')
        .ilike('name', ex.name ?? '')
        .limit(1)
        .maybeSingle();
      if (!exRow) continue; // skip unknown exercises

      await supabase.from('program_exercises').insert({
        workout_id: pwRow.id,
        exercise_id: exRow.id,
        sets: ex.sets ?? 3,
        reps: parseReps(ex.reps),
        rest_seconds: ex.rest_sec ?? ex.rest_seconds ?? 90,
        notes: ex.reps ? `${ex.reps} reps` : null,
        order_index: j,
      });
    }
  }

  return programId;
}

export default function AIProgramsDashboard({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { programs, setPrograms, isLoading, setIsLoading } = useAIProgramsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

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

  const handleImport = async (p: any) => {
    showAlert(
      'Ajouter aux entraînements',
      `Importer "${p.name}" dans ta liste de programmes pour pouvoir le lancer depuis la page Entraînements ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Importer',
          onPress: async () => {
            setImportingId(p.id);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');
              const programId = await importProgramToWorkout(supabase, user.id, p);
              showAlert('✅ Importé !', 'Le programme est maintenant dans tes entraînements.', [
                { text: 'Voir le programme', onPress: () => router.push(`/(app)/workout/${programId}` as any) },
                { text: 'Rester ici', style: 'cancel' },
              ]);
            } catch (err: any) {
              showAlert('Erreur', err.message ?? 'Impossible d\'importer le programme');
            } finally {
              setImportingId(null);
            }
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{p.name}</Text>
                    <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
                      {GOAL_LABELS[p.goal] ?? p.goal} · {SPLIT_LABELS[p.split_type] ?? p.split_type} · {p.days_per_week}j/sem
                    </Text>
                    {p.program_data?.days && (
                      <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
                        {p.program_data.days.length} séances · {p.program_data.days.reduce((acc: number, d: any) => acc + (d.exercises?.length ?? 0), 0)} exercices
                      </Text>
                    )}
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
                {/* Import button */}
                <TouchableOpacity
                  onPress={() => handleImport(p)}
                  disabled={importingId === p.id}
                  style={{
                    marginTop: 12, borderRadius: 10, borderWidth: 1.5,
                    borderColor: theme.primary, paddingVertical: 8,
                    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
                  }}
                >
                  {importingId === p.id
                    ? <ActivityIndicator size="small" color={theme.primary} />
                    : <>
                        <Ionicons name="barbell-outline" size={16} color={theme.primary} />
                        <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '600' }}>
                          Ajouter aux entraînements
                        </Text>
                      </>
                  }
                </TouchableOpacity>
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
