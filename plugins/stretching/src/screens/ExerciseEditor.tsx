import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { createExercise } from '../data';
import { ZONES, zoneLabel, validateExerciseDraft, type ExerciseDraft, type Measure } from '../lib';
import { Chip, PrimaryButton, Stepper } from '../components/ui';

/** Creation d'un exercice perso (STRE-02, maquette C03). Aucune image ni video (v2). */
export default function ExerciseEditor({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const { data: authData } = useQuery({
    queryKey: ['auth_user'],
    queryFn: async () => (await supabase.auth.getUser()).data?.user ?? null,
  });

  const [draft, setDraft] = useState<ExerciseDraft>({
    name: '', zone: null, measure: 'duration', duration_seconds: 30, reps: 10, sides: 1, instructions: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<ExerciseDraft>) => setDraft((d) => ({ ...d, ...p }));

  const submit = async () => {
    const problem = validateExerciseDraft(draft);
    if (problem) return showAlert('Exercice incomplet', problem);
    const userId = authData?.id;
    if (!userId) return showAlert('Erreur', 'Session expirée, reconnecte-toi.');
    setSaving(true);
    try {
      await createExercise(supabase, userId, draft);
      await queryClient.invalidateQueries({ queryKey: ['stretching_library'] });
      router.back();
    } catch (e: any) {
      showAlert('Erreur', e?.message ?? "Impossible d'enregistrer l'exercice");
    }
    setSaving(false);
  };

  const label = (t: string) => (
    <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 8 }}>{t}</Text>
  );
  const segment = (value: Measure, text: string) => {
    const active = draft.measure === value;
    return (
      <TouchableOpacity
        key={value}
        onPress={() => set({ measure: value })}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={{
          flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
          backgroundColor: active ? getActionPrimary(theme) : theme.surface,
          borderWidth: 1, borderColor: active ? getActionPrimary(theme) : theme.border,
        }}
      >
        <Text style={{ color: active ? '#FFFFFF' : theme.text, fontSize: 14, fontWeight: '600' }}>{text}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>Nouvel exercice</Text>
        </View>

        {label('Nom')}
        <TextInput
          value={draft.name}
          onChangeText={(v) => set({ name: v })}
          placeholder="Pigeon sur le dos"
          placeholderTextColor={theme.muted}
          accessibilityLabel="Nom de l'exercice"
          maxLength={80}
          style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 14, minHeight: 48, borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: 16, fontWeight: '600' }}
        />

        {label('Zone')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ZONES.map((z) => (
            <Chip key={z} label={zoneLabel(z)} active={draft.zone === z} onPress={() => set({ zone: z })} />
          ))}
        </View>

        {label('Mesure')}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {segment('duration', 'Durée')}
          {segment('reps', 'Répétitions')}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 20, gap: 12 }}>
          <View>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>
              {draft.measure === 'duration' ? 'Durée' : 'Répétitions'}
            </Text>
            {draft.measure === 'duration' ? (
              <Stepper
                label="Durée en secondes"
                value={`${draft.duration_seconds} s`}
                onDec={() => set({ duration_seconds: Math.max(5, draft.duration_seconds - 5) })}
                onInc={() => set({ duration_seconds: Math.min(600, draft.duration_seconds + 5) })}
              />
            ) : (
              <Stepper
                label="Nombre de répétitions"
                value={`${draft.reps}`}
                onDec={() => set({ reps: Math.max(1, draft.reps - 1) })}
                onInc={() => set({ reps: Math.min(100, draft.reps + 1) })}
              />
            )}
          </View>
          <View>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>Côtés</Text>
            <Stepper
              label="Nombre de côtés"
              value={draft.sides === 2 ? '2' : '1'}
              onDec={() => set({ sides: 1 })}
              onInc={() => set({ sides: 2 })}
            />
          </View>
        </View>
        <Text style={{ color: theme.muted, fontSize: 13, marginTop: 6 }}>
          {draft.sides === 2 ? 'Gauche + droite : la mesure s\'applique à chaque côté.' : 'Un seul côté (ou symétrique).'}
        </Text>

        {label('Consigne (facultatif)')}
        <TextInput
          value={draft.instructions}
          onChangeText={(v) => set({ instructions: v })}
          placeholder="Allongé, cheville sur le genou opposé…"
          placeholderTextColor={theme.muted}
          accessibilityLabel="Consigne"
          multiline
          style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 14, minHeight: 80, borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: 15, textAlignVertical: 'top' }}
        />

        <View style={{ marginTop: 24 }}>
          <PrimaryButton label={saving ? 'Enregistrement…' : "Enregistrer l'exercice"} onPress={submit} disabled={saving} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
