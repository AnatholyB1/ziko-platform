import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';

// ── Types ──────────────────────────────────────────────────────

interface GoalOption {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// ── Constants ─────────────────────────────────────────────────

const GOAL_OPTIONS: GoalOption[] = [
  { id: 'weight_loss',  label: 'Perte de poids', icon: 'flame-outline' },
  { id: 'strength',     label: 'Force',           icon: 'barbell-outline' },
  { id: 'endurance',    label: 'Endurance',       icon: 'heart-outline' },
  { id: 'body_comp',    label: 'Composition',     icon: 'body-outline' },
  { id: 'wellness',     label: 'Bien-etre',       icon: 'leaf-outline' },
];

const DURATION_CHIPS = [4, 6, 8, 12];

const DAYS_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// ── Screen ────────────────────────────────────────────────────

export default function ProgramBuilderScreen() {
  const theme = useThemeStore((s) => s.theme);

  // Step state (1-4)
  const [step, setStep] = useState(1);

  // Step 1 — Objectif
  const [goal, setGoal] = useState<string>('');

  // Step 2 — Duree
  const [weeks, setWeeks] = useState(8);

  // Step 3 — Jours
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Step 4 — Exercices
  const [exerciseInput, setExerciseInput] = useState('');
  const [exercises, setExercises] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────

  const toggleDay = (idx: number) => {
    setSelectedDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
    );
  };

  const addExercise = () => {
    const trimmed = exerciseInput.trim();
    if (!trimmed) return;
    setExercises((prev) => [...prev, trimmed]);
    setExerciseInput('');
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const canContinue = () => {
    if (step === 1) return !!goal;
    if (step === 2) return true;
    if (step === 3) return selectedDays.length > 0;
    return true;
  };

  // ── Submit ───────────────────────────────────────────────────

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecte');

      const { error } = await supabase
        .from('ai_generated_programs')
        .insert({
          user_id: user.id,
          goal,
          program_data: {
            weeks,
            days: selectedDays,
            exercises,
            generated: true,
          },
        });

      if (error) throw error;

      showAlert('Programme cree !', 'Ton programme est pret.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la creation';
      showAlert('Erreur', msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step indicator ───────────────────────────────────────────

  const StepIndicator = () => (
    <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
      <Text style={{
        fontSize: 10, fontWeight: '800', color: theme.primary,
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
      }}>
        Etape {step}/4
      </Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 999,
              backgroundColor: i <= step ? '#FF5C1A' : '#E2E0DA',
            }}
          />
        ))}
      </View>
    </View>
  );

  // ── Step 1: Objectif ─────────────────────────────────────────

  const Step1 = () => (
    <View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>
        Quel est ton objectif ?
      </Text>
      <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 20, lineHeight: 20 }}>
        Choisis l'objectif qui correspond le mieux a ton programme.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {GOAL_OPTIONS.map((g) => {
          const selected = goal === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              onPress={() => setGoal(g.id)}
              style={{
                width: '47%',
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14,
                backgroundColor: selected ? '#FF5C1A' : theme.surface,
                borderWidth: 1.5,
                borderColor: selected ? '#FF5C1A' : '#E2E0DA',
              }}
            >
              <Ionicons name={g.icon} size={18} color={selected ? '#FFFFFF' : theme.muted} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: selected ? '#FFFFFF' : '#1C1A17', flex: 1 }}>
                {g.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── Step 2: Duree ────────────────────────────────────────────

  const Step2 = () => (
    <View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>
        Combien de semaines ?
      </Text>
      <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 20, lineHeight: 20 }}>
        Choisis la duree de ton programme.
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {DURATION_CHIPS.map((n) => {
          const selected = weeks === n;
          return (
            <TouchableOpacity
              key={n}
              onPress={() => setWeeks(n)}
              style={{
                flex: 1, paddingVertical: 18, borderRadius: 14, alignItems: 'center',
                backgroundColor: selected ? '#FF5C1A' : theme.surface,
                borderWidth: 1.5, borderColor: selected ? '#FF5C1A' : '#E2E0DA',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '800', color: selected ? '#FFFFFF' : '#1C1A17' }}>
                {n}
              </Text>
              <Text style={{ fontSize: 11, color: selected ? 'rgba(255,255,255,0.8)' : theme.muted, marginTop: 2 }}>
                sem.
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── Step 3: Jours ────────────────────────────────────────────

  const Step3 = () => (
    <View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>
        Quels jours ?
      </Text>
      <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 20, lineHeight: 20 }}>
        Selectionne les jours d'entrainement par semaine.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {DAYS_LABELS.map((label, idx) => {
          const selected = selectedDays.includes(idx);
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => toggleDay(idx)}
              style={{
                flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center',
                backgroundColor: selected ? '#FF5C1A' : theme.surface,
                borderWidth: 1.5, borderColor: selected ? '#FF5C1A' : '#E2E0DA',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: selected ? '#FFFFFF' : '#1C1A17' }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedDays.length > 0 && (
        <Text style={{ fontSize: 12, color: theme.muted, marginTop: 12, textAlign: 'center' }}>
          {selectedDays.length} jour{selectedDays.length > 1 ? 's' : ''} selectionne{selectedDays.length > 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );

  // ── Step 4: Exercices ────────────────────────────────────────

  const Step4 = () => (
    <View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>
        Ajoute tes exercices.
      </Text>
      <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 20, lineHeight: 20 }}>
        Liste les exercices cles de ton programme.
      </Text>

      {/* Input row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TextInput
          value={exerciseInput}
          onChangeText={setExerciseInput}
          placeholder="Nom de l'exercice..."
          placeholderTextColor={theme.muted}
          onSubmitEditing={addExercise}
          returnKeyType="done"
          style={{
            flex: 1, fontSize: 14, fontWeight: '600', color: theme.text,
            backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
            borderWidth: 1.5, borderColor: '#E2E0DA',
          }}
        />
        <TouchableOpacity
          onPress={addExercise}
          style={{
            width: 46, height: 46, borderRadius: 12,
            backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Exercise list */}
      {exercises.length === 0 ? (
        <View style={{
          paddingVertical: 28, alignItems: 'center',
          backgroundColor: theme.surface, borderRadius: 14,
          borderWidth: 1, borderColor: '#E2E0DA',
        }}>
          <Ionicons name="barbell-outline" size={28} color={theme.muted} />
          <Text style={{ fontSize: 13, color: theme.muted, marginTop: 8 }}>
            Aucun exercice ajoute
          </Text>
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(_, i) => String(i)}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          renderItem={({ item, index }) => (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
              borderWidth: 1, borderColor: '#E2E0DA',
            }}>
              <View style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: 'rgba(255,92,26,0.12)', alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#FF5C1A' }}>{index + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: theme.text }}>{item}</Text>
              <TouchableOpacity onPress={() => removeExercise(index)}>
                <Ionicons name="trash-outline" size={16} color={theme.muted} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Summary recap */}
      <View style={{
        backgroundColor: '#1C1A17', borderRadius: 14, padding: 16, marginTop: 16,
        overflow: 'hidden',
      }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#FF5C1A', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
          Recapitulatif
        </Text>
        {[
          { label: 'Objectif', value: GOAL_OPTIONS.find((g) => g.id === goal)?.label ?? goal },
          { label: 'Duree', value: `${weeks} semaines` },
          { label: 'Jours', value: selectedDays.map((d) => DAYS_LABELS[d]).join(', ') || '—' },
          { label: 'Exercices', value: `${exercises.length} exercice${exercises.length > 1 ? 's' : ''}` },
        ].map((row, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{row.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)' }}>{row.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ── Render ───────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, gap: 10,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 11,
            backgroundColor: `${theme.text}0F`,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>
          Nouveau programme
        </Text>
      </View>

      <StepIndicator />

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24,
        borderTopWidth: 1, borderTopColor: theme.border,
        backgroundColor: theme.background,
        flexDirection: 'row', gap: 10,
      }}>
        {step > 1 && (
          <TouchableOpacity
            onPress={() => setStep((s) => s - 1)}
            style={{
              paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14,
              backgroundColor: `${theme.text}0F`,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>Retour</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => step < 4 ? setStep((s) => s + 1) : handleFinish()}
          disabled={!canContinue() || isSaving}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: 14,
            backgroundColor: canContinue() ? '#FF5C1A' : `${theme.text}22`,
            alignItems: 'center',
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: canContinue() ? '#fff' : theme.muted }}>
            {isSaving ? 'Creation...' : step < 4 ? 'Continuer' : 'Creer mon programme'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
