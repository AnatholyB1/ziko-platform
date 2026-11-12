import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { fetchLibrary, fetchRoutine, saveRoutine, deleteRoutine } from '../data';
import {
  ZONES, zoneLabel, formatMeasure, isPerso, moveItem, routineSummary, exerciseFromLibrary,
  filterLibrary, filterCounts,
  type LibraryFilter, type RoutineExercise,
} from '../lib';
import {
  CARD_SHADOW, ORANGE_TEXT, Badge, Chip, ErrorCard, PrimaryButton, SecondaryButton, Skeleton,
} from '../components/ui';

/** Creation / edition d'une routine : ordre, duree totale, routine par defaut (STRE-03, STRE-05, maquette C05). */
export default function RoutineEditor({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const { editId } = useLocalSearchParams<{ editId?: string }>();

  const { data: authData } = useQuery({
    queryKey: ['auth_user'],
    queryFn: async () => (await supabase.auth.getUser()).data?.user ?? null,
  });
  const userId: string | undefined = authData?.id;

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hydrated, setHydrated] = useState(!editId);

  const { data: existing, isLoading: loadingExisting, isError, error, refetch } = useQuery({
    queryKey: ['stretching_routine', userId, editId],
    queryFn: () => fetchRoutine(supabase, userId as string, editId as string),
    enabled: !!userId && !!editId,
  });

  useEffect(() => {
    if (existing && !hydrated) {
      setName(existing.name);
      setExercises(existing.exercises);
      setIsDefault(existing.is_default);
      setHydrated(true);
    }
  }, [existing, hydrated]);

  const summary = useMemo(() => routineSummary(exercises), [exercises]);
  const primary = getActionPrimary(theme);

  const updateValue = (idx: number, delta: number) =>
    setExercises((list) => list.map((e, i) => {
      if (i !== idx) return e;
      return e.measure === 'reps'
        ? { ...e, reps: Math.min(100, Math.max(1, e.reps + delta)) }
        : { ...e, duration_seconds: Math.min(600, Math.max(5, e.duration_seconds + delta * 5)) };
    }));

  const handleSave = async () => {
    if (!name.trim()) return showAlert('Routine incomplète', 'Donne un nom à ta routine');
    if (exercises.length === 0) return showAlert('Routine incomplète', 'Ajoute au moins un exercice');
    if (!userId) return showAlert('Erreur', 'Session expirée, reconnecte-toi.');
    setSaving(true);
    try {
      await saveRoutine(supabase, userId, { id: editId, name, exercises, is_default: isDefault });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stretching_routines'] }),
        queryClient.invalidateQueries({ queryKey: ['stretching_routine'] }),
        queryClient.invalidateQueries({ queryKey: ['stretching_default'] }),
      ]);
      router.back();
    } catch (e: any) {
      showAlert('Erreur', e?.message ?? 'Impossible de sauvegarder');
    }
    setSaving(false);
  };

  const handleDelete = () => {
    if (!editId || !userId) return;
    showAlert('Supprimer la routine ?', `« ${name || 'Cette routine'} » sera supprimée. Cette action est définitive.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoutine(supabase, userId, editId);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['stretching_routines'] }),
              queryClient.invalidateQueries({ queryKey: ['stretching_default'] }),
            ]);
            router.back();
          } catch (e: any) {
            showAlert('Erreur', e?.message ?? 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  const iconBtn = { width: 44, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={iconBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>
            {editId ? 'Modifier la routine' : 'Nouvelle routine'}
          </Text>
        </View>

        {isError ? (
          <ErrorCard message={(error as Error)?.message ?? 'Impossible de charger la routine'} onRetry={() => refetch()} />
        ) : editId && (loadingExisting || !hydrated) ? (
          <Skeleton count={3} />
        ) : (
          <>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>Nom</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Réveil articulaire"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Nom de la routine"
              maxLength={60}
              style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 14, minHeight: 48, borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: 16, fontWeight: '600' }}
            />

            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 22, marginBottom: 2 }}>Exercices</Text>
            <Text style={{ color: theme.muted, fontSize: 14, marginBottom: 10 }}>{summary}</Text>

            <View style={{ gap: 8 }}>
              {exercises.map((ex, idx) => (
                <View
                  key={`${ex.exercise_id ?? ex.name}-${idx}`}
                  style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 10, ...CARD_SHADOW }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: ORANGE_TEXT, fontWeight: '800', fontSize: 15, width: 26, textAlign: 'center' }}>{idx + 1}</Text>
                    <View style={{ flex: 1, paddingHorizontal: 6 }}>
                      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>{ex.name}</Text>
                      <Text style={{ color: theme.muted, fontSize: 13, marginTop: 1 }}>{zoneLabel(ex.muscle_group)} · {formatMeasure(ex)}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setExercises((l) => moveItem(l, idx, -1))}
                      disabled={idx === 0}
                      accessibilityRole="button"
                      accessibilityLabel={`Monter ${ex.name}`}
                      accessibilityState={{ disabled: idx === 0 }}
                      style={iconBtn}
                    >
                      <Ionicons name="chevron-up" size={22} color={idx === 0 ? theme.border : theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setExercises((l) => moveItem(l, idx, 1))}
                      disabled={idx === exercises.length - 1}
                      accessibilityRole="button"
                      accessibilityLabel={`Descendre ${ex.name}`}
                      accessibilityState={{ disabled: idx === exercises.length - 1 }}
                      style={iconBtn}
                    >
                      <Ionicons name="chevron-down" size={22} color={idx === exercises.length - 1 ? theme.border : theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setExercises((l) => l.filter((_, i) => i !== idx))}
                      accessibilityRole="button"
                      accessibilityLabel={`Supprimer ${ex.name}`}
                      style={iconBtn}
                    >
                      <Ionicons name="trash-outline" size={22} color="#B3261E" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 4 }}>
                    <TouchableOpacity
                      onPress={() => updateValue(idx, -1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Moins, ${ex.measure === 'reps' ? 'répétitions' : 'durée'} de ${ex.name}`}
                      style={{ ...iconBtn, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}
                    >
                      <Ionicons name="remove" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, minWidth: 64, textAlign: 'center' }}>
                      {ex.measure === 'reps' ? `${ex.reps} rép.` : `${ex.duration_seconds} s`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => updateValue(idx, 1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Plus, ${ex.measure === 'reps' ? 'répétitions' : 'durée'} de ${ex.name}`}
                      style={{ ...iconBtn, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}
                    >
                      <Ionicons name="add" size={20} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setPicking(true)}
              accessibilityRole="button"
              accessibilityLabel="Ajouter un exercice"
              style={{
                marginTop: 10, minHeight: 52, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: primary,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Ionicons name="add-circle-outline" size={22} color={ORANGE_TEXT} />
              <Text style={{ color: ORANGE_TEXT, fontWeight: '700', fontSize: 15 }}>Ajouter un exercice</Text>
            </TouchableOpacity>

            <View
              style={{
                marginTop: 22, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
                paddingLeft: 14, paddingRight: 8, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>Routine par défaut</Text>
                <Text style={{ color: theme.muted, fontSize: 13, marginTop: 1 }}>Ajoutée au début de chaque séance</Text>
              </View>
              <View style={{ width: 52, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Switch
                  value={isDefault}
                  onValueChange={setIsDefault}
                  accessibilityRole="switch"
                  accessibilityLabel="Routine par défaut"
                  accessibilityState={{ checked: isDefault }}
                  trackColor={{ false: theme.border, true: primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
            {isDefault ? (
              <Text style={{ color: theme.muted, fontSize: 13, marginTop: 6 }}>
                Une seule routine est par défaut : l'actuelle sera remplacée à l'enregistrement.
              </Text>
            ) : null}

            <View style={{ marginTop: 22 }}>
              <PrimaryButton label={saving ? 'Enregistrement…' : 'Enregistrer'} onPress={handleSave} disabled={saving} />
            </View>
            {editId ? (
              <View style={{ marginTop: 10 }}>
                <SecondaryButton label="Supprimer la routine" danger onPress={handleDelete} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <ExercisePicker
        visible={picking}
        supabase={supabase}
        userId={userId}
        count={exercises.length}
        onClose={() => setPicking(false)}
        onPick={(e) => setExercises((l) => [...l, e])}
      />
    </SafeAreaView>
  );
}

// ─── Selecteur d'exercices (bibliotheque) ─────────────────────────────────────

function ExercisePicker({
  visible, supabase, userId, count, onClose, onPick,
}: {
  visible: boolean; supabase: any; userId?: string; count: number;
  onClose: () => void; onPick: (e: RoutineExercise) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const { data: library = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stretching_library', userId],
    queryFn: () => fetchLibrary(supabase),
    enabled: !!userId && visible,
    staleTime: 60_000,
  });
  const counts = useMemo(() => filterCounts(library), [library]);
  const rows = useMemo(() => filterLibrary(library, filter), [library, filter]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 }}>
          <Text style={{ flex: 1, color: theme.text, fontSize: 20, fontWeight: '800' }}>Ajouter un exercice</Text>
          <SecondaryButton label={count > 0 ? `Terminé (${count})` : 'Terminé'} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
          {isError ? (
            <ErrorCard message={(error as Error)?.message ?? 'Impossible de charger la bibliothèque'} onRetry={() => refetch()} />
          ) : isLoading ? (
            <Skeleton />
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                <Chip label="Tous" count={counts.all} active={filter === 'all'} onPress={() => setFilter('all')} />
                {ZONES.filter((z) => counts[z] > 0).map((z) => (
                  <Chip key={z} label={zoneLabel(z)} count={counts[z]} active={filter === z} onPress={() => setFilter(z)} />
                ))}
                <Chip label="Mes exercices" count={counts.mine} active={filter === 'mine'} onPress={() => setFilter('mine')} />
              </ScrollView>
              <View style={{ gap: 8 }}>
                {rows.map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => onPick(exerciseFromLibrary(ex))}
                    accessibilityRole="button"
                    accessibilityLabel={`Ajouter ${ex.name}`}
                    style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 12, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>{ex.name}</Text>
                      <Text style={{ color: theme.muted, fontSize: 13, marginTop: 1 }}>
                        {zoneLabel(ex.muscle_group)} · {formatMeasure({ measure: ex.measure, duration_seconds: ex.duration_seconds ?? 30, reps: ex.reps ?? 10, sides: ex.sides })}
                      </Text>
                    </View>
                    {isPerso(ex) ? <Badge label="PERSO" /> : null}
                    <Ionicons name="add-circle" size={26} color={ORANGE_TEXT} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
