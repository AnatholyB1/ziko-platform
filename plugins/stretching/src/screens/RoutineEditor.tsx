import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useStretchingStore } from '../store';
import type { StretchExercise, StretchRoutine } from '../store';

const MUSCLE_GROUPS = [
  'shoulders', 'chest', 'back', 'quads', 'hamstrings',
  'glutes', 'calves', 'hip_flexors', 'arms', 'core', 'full_body',
];

const MUSCLE_LABELS: Record<string, string> = {
  shoulders: 'Épaules', chest: 'Pecs', back: 'Dos', quads: 'Quadriceps',
  hamstrings: 'Ischio-jambiers', glutes: 'Fessiers', calves: 'Mollets',
  hip_flexors: 'Psoas', arms: 'Bras', core: 'Abdos', full_body: 'Corps entier',
};

const TYPE_OPTIONS: { value: StretchRoutine['type']; label: string }[] = [
  { value: 'pre_workout', label: '🔥 Pré-workout' },
  { value: 'post_workout', label: '❄️ Post-workout' },
  { value: 'recovery', label: '💆 Récupération' },
  { value: 'full_body', label: '🧘 Corps entier' },
  { value: 'custom', label: '✨ Personnalisé' },
];

function generateId() {
  return 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

export default function RoutineEditor({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { customRoutines, addCustomRoutine, updateCustomRoutine } = useStretchingStore();

  const existing = editId ? customRoutines.find((r) => r.id === editId) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<StretchRoutine['type']>(existing?.type ?? 'custom');
  const [exercises, setExercises] = useState<StretchExercise[]>(existing?.exercises ?? []);
  const [saving, setSaving] = useState(false);

  const totalDuration = exercises.reduce((s, e) => s + e.duration_seconds, 0);
  const muscleGroups = [...new Set(exercises.map((e) => e.muscle_group))];

  const addExercise = () => {
    setExercises([...exercises, {
      id: generateId(),
      name: '',
      muscle_group: 'full_body',
      duration_seconds: 30,
      instructions: '',
      image_url: null,
    }]);
  };

  const updateExercise = (idx: number, field: keyof StretchExercise, value: any) => {
    setExercises(exercises.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const removeExercise = (idx: number) => {
    setExercises(exercises.filter((_, i) => i !== idx));
  };

  const moveExercise = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= exercises.length) return;
    const next = [...exercises];
    [next[idx], next[target]] = [next[target], next[idx]];
    setExercises(next);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Erreur', 'Donne un nom à ta routine');
    if (exercises.length === 0) return Alert.alert('Erreur', 'Ajoute au moins un exercice');
    const empty = exercises.find((e) => !e.name.trim());
    if (empty) return Alert.alert('Erreur', 'Tous les exercices doivent avoir un nom');

    setSaving(true);
    const routine: StretchRoutine = {
      id: existing?.id ?? generateId(),
      name: name.trim(),
      type,
      muscle_groups: muscleGroups,
      duration_minutes: Math.ceil(totalDuration / 60),
      exercises,
      is_custom: true,
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      if (existing) {
        await supabase.from('stretching_routines').update({
          name: routine.name, type: routine.type,
          muscle_groups: routine.muscle_groups,
          duration_minutes: routine.duration_minutes,
          exercises: routine.exercises,
        }).eq('id', routine.id).eq('user_id', user.id);
        updateCustomRoutine(routine);
      } else {
        const { data, error } = await supabase.from('stretching_routines').insert({
          id: routine.id, user_id: user.id,
          name: routine.name, type: routine.type,
          muscle_groups: routine.muscle_groups,
          duration_minutes: routine.duration_minutes,
          exercises: routine.exercises,
        }).select().single();
        if (error) throw error;
        addCustomRoutine(routine);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de sauvegarder');
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginLeft: 12 }}>
            {existing ? 'Modifier la routine' : 'Nouvelle routine'}
          </Text>
        </View>

        {/* Routine name */}
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginBottom: 8 }}>Nom</Text>
        <TextInput
          value={name} onChangeText={setName}
          placeholder="Ma routine d'étirements" placeholderTextColor={theme.muted}
          style={{
            backgroundColor: theme.surface, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: theme.border, color: theme.text,
            fontSize: 16, fontWeight: '600',
          }}
        />

        {/* Type */}
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 8 }}>Type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TYPE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setType(opt.value)}
              style={{
                backgroundColor: type === opt.value ? theme.primary + '20' : theme.surface,
                borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
                borderWidth: 1, borderColor: type === opt.value ? theme.primary : theme.border,
              }}
            >
              <Text style={{ color: type === opt.value ? theme.primary : theme.text, fontWeight: '600', fontSize: 13 }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Duration summary */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 12, padding: 14,
          marginTop: 20, borderWidth: 1, borderColor: theme.border,
          flexDirection: 'row', justifyContent: 'space-around',
        }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.primary, fontSize: 20, fontWeight: '800' }}>{exercises.length}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>exercices</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.primary, fontSize: 20, fontWeight: '800' }}>{Math.ceil(totalDuration / 60)}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>min</Text>
          </View>
        </View>

        {/* Exercises */}
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 24, marginBottom: 12 }}>Exercices</Text>

        {exercises.map((ex, idx) => (
          <View key={ex.id} style={{
            backgroundColor: theme.surface, borderRadius: 14, padding: 14,
            marginBottom: 12, borderWidth: 1, borderColor: theme.border,
          }}>
            {/* Exercise header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 14, width: 24 }}>{idx + 1}</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => moveExercise(idx, -1)} style={{ padding: 4 }}>
                <Ionicons name="chevron-up" size={18} color={idx === 0 ? theme.border : theme.muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveExercise(idx, 1)} style={{ padding: 4 }}>
                <Ionicons name="chevron-down" size={18} color={idx === exercises.length - 1 ? theme.border : theme.muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeExercise(idx)} style={{ padding: 4, marginLeft: 4 }}>
                <Ionicons name="trash-outline" size={18} color="#F44336" />
              </TouchableOpacity>
            </View>

            {/* Name */}
            <TextInput
              value={ex.name} onChangeText={(v) => updateExercise(idx, 'name', v)}
              placeholder="Nom de l'exercice" placeholderTextColor={theme.muted}
              style={{
                backgroundColor: theme.background, borderRadius: 10, padding: 10,
                borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: 14, fontWeight: '600',
              }}
            />

            {/* Muscle group selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {MUSCLE_GROUPS.map((mg) => (
                  <TouchableOpacity
                    key={mg}
                    onPress={() => updateExercise(idx, 'muscle_group', mg)}
                    style={{
                      backgroundColor: ex.muscle_group === mg ? theme.primary + '20' : theme.background,
                      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                      borderWidth: 1, borderColor: ex.muscle_group === mg ? theme.primary : theme.border,
                    }}
                  >
                    <Text style={{ color: ex.muscle_group === mg ? theme.primary : theme.muted, fontSize: 11, fontWeight: '600' }}>
                      {MUSCLE_LABELS[mg] ?? mg}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Duration */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
              <Ionicons name="timer-outline" size={16} color={theme.muted} />
              <TouchableOpacity
                onPress={() => updateExercise(idx, 'duration_seconds', Math.max(10, ex.duration_seconds - 5))}
                style={{ backgroundColor: theme.background, borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}
              >
                <Ionicons name="remove" size={16} color={theme.primary} />
              </TouchableOpacity>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, minWidth: 40, textAlign: 'center' }}>
                {ex.duration_seconds}s
              </Text>
              <TouchableOpacity
                onPress={() => updateExercise(idx, 'duration_seconds', Math.min(300, ex.duration_seconds + 5))}
                style={{ backgroundColor: theme.background, borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}
              >
                <Ionicons name="add" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>

            {/* Instructions */}
            <TextInput
              value={ex.instructions} onChangeText={(v) => updateExercise(idx, 'instructions', v)}
              placeholder="Instructions (optionnel)" placeholderTextColor={theme.muted}
              multiline
              style={{
                backgroundColor: theme.background, borderRadius: 10, padding: 10, marginTop: 10,
                borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: 13, minHeight: 44,
              }}
            />
          </View>
        ))}

        {/* Add exercise button */}
        <TouchableOpacity
          onPress={addExercise}
          style={{
            borderWidth: 2, borderColor: theme.primary + '44', borderStyle: 'dashed',
            borderRadius: 14, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
          }}
        >
          <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 15 }}>Ajouter un exercice</Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave} disabled={saving}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 16,
            alignItems: 'center', marginTop: 24, opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {saving ? 'Sauvegarde...' : existing ? 'Mettre à jour' : 'Créer la routine'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
