import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useTimerStore } from '../store';
import type { TimerExercise } from '../store';

const TYPES = [
  { key: 'hiit', label: 'HIIT', color: '#FF9800', icon: 'flash' as const },
  { key: 'tabata', label: 'Tabata', color: '#F44336', icon: 'flame' as const },
  { key: 'emom', label: 'EMOM', color: '#2196F3', icon: 'repeat' as const },
  { key: 'hyrox', label: 'Hyrox', color: '#FF5C1A', icon: 'trophy' as const },
  { key: 'functional', label: 'Fonctionnel', color: '#4CAF50', icon: 'barbell' as const },
  { key: 'custom', label: 'Custom', color: '#9C27B0', icon: 'settings' as const },
];

const EMPTY_EXERCISE: TimerExercise = { name: '', reps: undefined, distance_m: undefined, weight_kg: undefined, notes: '' };

function formatExerciseLabel(ex: TimerExercise): string {
  const parts: string[] = [];
  if (ex.reps) parts.push(`${ex.reps} reps`);
  if (ex.distance_m) parts.push(`${ex.distance_m}m`);
  if (ex.weight_kg) parts.push(`${ex.weight_kg}kg`);
  if (ex.notes) parts.push(ex.notes);
  return parts.length > 0 ? parts.join(' · ') : 'Détails à préciser';
}

export default function TimerEditor({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const params = useLocalSearchParams<{ presetId?: string }>();
  const { customPresets, addCustomPreset, updateCustomPreset } = useTimerStore();

  const existing = params.presetId
    ? customPresets.find((p) => p.id === params.presetId)
    : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<string>(existing?.type ?? 'hiit');
  const [workSec, setWorkSec] = useState(existing ? String(existing.work_seconds) : '30');
  const [restSec, setRestSec] = useState(existing ? String(existing.rest_seconds) : '15');
  const [rounds, setRounds] = useState(existing ? String(existing.rounds) : '8');
  const [exercises, setExercises] = useState<TimerExercise[]>(existing?.exercises ?? []);
  const [saving, setSaving] = useState(false);

  // Exercise modal state
  const [showExModal, setShowExModal] = useState(false);
  const [editingExIdx, setEditingExIdx] = useState<number | null>(null);
  const [draftEx, setDraftEx] = useState<TimerExercise>(EMPTY_EXERCISE);

  const isValid = name.trim().length > 0
    && parseInt(rounds) > 0
    && (parseInt(workSec) > 0 || parseInt(restSec) > 0);

  const totalSeconds = (parseInt(workSec || '0') + parseInt(restSec || '0')) * parseInt(rounds || '1');
  const totalMin = Math.ceil(totalSeconds / 60);

  const openAddExercise = () => {
    setEditingExIdx(null);
    setDraftEx(EMPTY_EXERCISE);
    setShowExModal(true);
  };

  const openEditExercise = (idx: number) => {
    setEditingExIdx(idx);
    setDraftEx({ ...exercises[idx] });
    setShowExModal(true);
  };

  const saveExercise = () => {
    if (!draftEx.name.trim()) {
      Alert.alert('Erreur', 'Le nom de l\'exercice est requis');
      return;
    }
    const cleaned: TimerExercise = {
      name: draftEx.name.trim(),
      ...(draftEx.reps ? { reps: draftEx.reps } : {}),
      ...(draftEx.distance_m ? { distance_m: draftEx.distance_m } : {}),
      ...(draftEx.weight_kg ? { weight_kg: draftEx.weight_kg } : {}),
      ...(draftEx.notes?.trim() ? { notes: draftEx.notes.trim() } : {}),
    };
    if (editingExIdx !== null) {
      setExercises((prev) => prev.map((e, i) => (i === editingExIdx ? cleaned : e)));
    } else {
      setExercises((prev) => [...prev, cleaned]);
    }
    setShowExModal(false);
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const preset = {
        name: name.trim(),
        type: type as 'hiit' | 'tabata' | 'emom' | 'custom' | 'hyrox' | 'functional',
        work_sec: parseInt(workSec) || 0,
        rest_sec: parseInt(restSec) || 0,
        rounds: parseInt(rounds) || 1,
        exercises: exercises.length > 0 ? exercises : undefined,
      };

      if (existing) {
        const { error } = await supabase
          .from('timer_presets')
          .update(preset)
          .eq('id', existing.id);
        if (error) throw error;
        updateCustomPreset(existing.id, {
          name: preset.name,
          type: preset.type,
          work_seconds: preset.work_sec,
          rest_seconds: preset.rest_sec,
          rounds: preset.rounds,
          exercises: exercises.length > 0 ? exercises : undefined,
        });
      } else {
        const { data, error } = await supabase
          .from('timer_presets')
          .insert({ ...preset, user_id: user.id })
          .select('*')
          .single();
        if (error) throw error;
        addCustomPreset({
          id: data.id,
          name: data.name,
          type: data.type,
          work_seconds: data.work_sec,
          rest_seconds: data.rest_sec,
          rounds: data.rounds,
          is_builtin: false,
          exercises: data.exercises ?? undefined,
        });
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    color: theme.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>
            {existing ? 'Modifier le chrono' : 'Nouveau chrono'}
          </Text>
        </View>

        {/* Name */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>Nom *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Mon chrono HIIT"
          placeholderTextColor={theme.muted}
          style={inputStyle}
        />

        {/* Type selector */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>Type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {TYPES.map((t) => {
            const selected = type === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setType(t.key)}
                style={{
                  width: '30%', alignItems: 'center', padding: 12, borderRadius: 12,
                  backgroundColor: selected ? t.color + '22' : theme.surface,
                  borderWidth: 2, borderColor: selected ? t.color : theme.border,
                }}
              >
                <Ionicons name={t.icon} size={20} color={selected ? t.color : theme.muted} />
                <Text style={{
                  color: selected ? t.color : theme.muted, fontWeight: '700',
                  fontSize: 11, marginTop: 4,
                }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Work seconds */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
          Travail (secondes)
        </Text>
        <TextInput
          value={workSec}
          onChangeText={setWorkSec}
          placeholder="30"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {/* Rest seconds */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
          Repos (secondes)
        </Text>
        <TextInput
          value={restSec}
          onChangeText={setRestSec}
          placeholder="15"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {/* Rounds */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
          Nombre de rounds *
        </Text>
        <TextInput
          value={rounds}
          onChangeText={setRounds}
          placeholder="8"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {/* Exercises */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
            Exercices par round
          </Text>
          <TouchableOpacity onPress={openAddExercise} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="add-circle" size={20} color={theme.primary} />
            <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>Ajouter</Text>
          </TouchableOpacity>
        </View>
        {exercises.length === 0 ? (
          <TouchableOpacity
            onPress={openAddExercise}
            style={{
              backgroundColor: theme.surface, borderRadius: 12, padding: 16,
              borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
              alignItems: 'center', marginBottom: 20,
            }}
          >
            <Ionicons name="barbell-outline" size={24} color={theme.muted} />
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 6 }}>
              Aucun exercice — optionnel
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ marginBottom: 20, gap: 8 }}>
            {exercises.map((ex, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: theme.surface, borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center',
                }}
              >
                <View style={{
                  width: 28, height: 28, borderRadius: 14, backgroundColor: theme.primary + '20',
                  justifyContent: 'center', alignItems: 'center', marginRight: 12,
                }}>
                  <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>{idx + 1}</Text>
                </View>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openEditExercise(idx)}>
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{ex.name}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
                    {formatExerciseLabel(ex)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeExercise(idx)} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Preview */}
        {isValid && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: theme.border, marginBottom: 20,
          }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 6 }}>
              Aperçu
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              {parseInt(workSec) > 0 ? `${workSec}s travail` : ''}
              {parseInt(restSec) > 0 ? ` / ${restSec}s repos` : ''}
              {' · '}{rounds} rounds · ~{totalMin} min
              {exercises.length > 0 ? ` · ${exercises.length} exercice${exercises.length > 1 ? 's' : ''}` : ''}
            </Text>
          </View>
        )}

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isValid || saving}
          style={{
            backgroundColor: isValid ? theme.primary : theme.border,
            borderRadius: 14, padding: 18, alignItems: 'center',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {saving ? 'Enregistrement...' : existing ? 'Modifier' : 'Créer le chrono'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise Modal */}
      <Modal visible={showExModal} transparent animationType="slide" onRequestClose={() => setShowExModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, marginBottom: 20 }}>
              {editingExIdx !== null ? 'Modifier l\'exercice' : 'Ajouter un exercice'}
            </Text>

            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13, marginBottom: 6 }}>Nom *</Text>
            <TextInput
              value={draftEx.name}
              onChangeText={(v) => setDraftEx((d) => ({ ...d, name: v }))}
              placeholder="ex: Wall Balls, Ski Erg..."
              placeholderTextColor={theme.muted}
              style={{
                backgroundColor: theme.surface, borderRadius: 12, padding: 14,
                color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border, marginBottom: 12,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13, marginBottom: 6 }}>Reps</Text>
                <TextInput
                  value={draftEx.reps ? String(draftEx.reps) : ''}
                  onChangeText={(v) => setDraftEx((d) => ({ ...d, reps: v ? parseInt(v) || undefined : undefined }))}
                  placeholder="20"
                  placeholderTextColor={theme.muted}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: theme.surface, borderRadius: 12, padding: 14,
                    color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13, marginBottom: 6 }}>Distance (m)</Text>
                <TextInput
                  value={draftEx.distance_m ? String(draftEx.distance_m) : ''}
                  onChangeText={(v) => setDraftEx((d) => ({ ...d, distance_m: v ? parseInt(v) || undefined : undefined }))}
                  placeholder="1000"
                  placeholderTextColor={theme.muted}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: theme.surface, borderRadius: 12, padding: 14,
                    color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13, marginBottom: 6 }}>Poids (kg)</Text>
                <TextInput
                  value={draftEx.weight_kg ? String(draftEx.weight_kg) : ''}
                  onChangeText={(v) => setDraftEx((d) => ({ ...d, weight_kg: v ? parseFloat(v) || undefined : undefined }))}
                  placeholder="16"
                  placeholderTextColor={theme.muted}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: theme.surface, borderRadius: 12, padding: 14,
                    color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border,
                  }}
                />
              </View>
            </View>

            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13, marginBottom: 6 }}>Notes</Text>
            <TextInput
              value={draftEx.notes ?? ''}
              onChangeText={(v) => setDraftEx((d) => ({ ...d, notes: v }))}
              placeholder="ex: 6kg ball, tempo contrôlé..."
              placeholderTextColor={theme.muted}
              style={{
                backgroundColor: theme.surface, borderRadius: 12, padding: 14,
                color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border, marginBottom: 20,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowExModal(false)}
                style={{
                  flex: 1, padding: 16, borderRadius: 14, alignItems: 'center',
                  borderWidth: 1, borderColor: theme.border,
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveExercise}
                style={{ flex: 2, padding: 16, borderRadius: 14, alignItems: 'center', backgroundColor: theme.primary }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {editingExIdx !== null ? 'Modifier' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
