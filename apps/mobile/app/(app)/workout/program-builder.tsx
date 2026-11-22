import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';
import { showAlert, getActionPrimary, exerciseNames } from '@ziko/plugin-sdk';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../src/lib/supabase';
import {
  buildWizardProgramRow,
  activationToast,
  validateWizardExercises,
  wizardActivationPlan,
  type ProgramItem,
} from '../../../src/lib/programs';
import { goToTrainingDashboard, refreshProgramQueries } from '../../../src/lib/workoutNav';
import { neutralToast } from '../../../src/lib/neutralToast';
import { loadAllPrograms, setActiveProgram } from '../../../src/lib/programsService';
import { suggestExercises, checkWizardExerciseEntry, exerciseRowLabel, type CatalogRow } from '../../../src/lib/exerciseMatch';
import { fetchCatalogCandidates } from '../../../src/lib/exerciseCatalog';

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
  const actionBg = getActionPrimary(theme);
  const queryClient = useQueryClient();

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

  // Un exercice doit exister dans le catalogue (meme appariement que le demarrage de seance) : sinon le programme
  // serait actif mais "Séance indisponible". Suggestions pendant la frappe ; texte libre non reconnu = erreur inline.
  const [candidates, setCandidates] = useState<CatalogRow[]>([]);
  const [searchedFor, setSearchedFor] = useState('');
  const [searchFailed, setSearchFailed] = useState(false);
  const entryText = exerciseInput.trim();

  useEffect(() => {
    if (entryText.length < 2) {
      setCandidates([]);
      setSearchedFor(entryText);
      setSearchFailed(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const rows = await fetchCatalogCandidates(supabase as any, entryText, exerciseNames);
        if (cancelled) return;
        setCandidates(rows);
        setSearchFailed(false);
      } catch {
        if (cancelled) return;
        setCandidates([]);
        setSearchFailed(true);
      }
      setSearchedFor(entryText);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [entryText]);

  const settled = searchedFor === entryText;
  const entryCheck = settled && !searchFailed ? checkWizardExerciseEntry(entryText, candidates, exerciseNames) : null;
  const suggestions = settled && !searchFailed ? suggestExercises(entryText, candidates, exerciseNames, 5) : [];
  // Saisie en cours qui ne peut pas (encore) etre ajoutee : bloque "Creer mon programme".
  const entryBlocked = entryText !== '' && (!settled || searchFailed || entryCheck?.status !== 'resolved');
  const entryError =
    entryText.length >= 2 && settled
      ? searchFailed
        ? 'Catalogue indisponible. Vérifie ta connexion puis réessaie.'
        : entryCheck?.status === 'unresolved'
          ? entryCheck.message
          : null
      : null;

  const addResolved = (label: string) => {
    setExercises((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setExerciseInput('');
  };

  const addExercise = async () => {
    if (!entryText) return;
    let check = entryCheck;
    if (!check) {
      try {
        const rows = await fetchCatalogCandidates(supabase as any, entryText, exerciseNames);
        setCandidates(rows);
        setSearchFailed(false);
        setSearchedFor(entryText);
        check = checkWizardExerciseEntry(entryText, rows, exerciseNames);
      } catch {
        setSearchFailed(true);
        setSearchedFor(entryText);
        return;
      }
    }
    if (check.status === 'resolved') addResolved(check.label);
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const canContinue = () => {
    if (step === 1) return !!goal;
    if (step === 2) return true;
    if (step === 3) return selectedDays.length > 0;
    return !entryBlocked;
  };

  // ── Submit ───────────────────────────────────────────────────

  const handleFinish = async () => {
    if (isSaving) return;
    // UATN-03 : jamais de programme sans exercice (seances vides, impossibles a demarrer).
    // Texte saisi mais pas encore ajoute : reconnu -> ajoute d'office ; sinon bloque avec le message d'erreur.
    let finalExercises = exercises;
    let blockedEntry: string | null = null;
    if (entryText) {
      if (entryCheck?.status === 'resolved') {
        finalExercises = exercises.includes(entryCheck.label) ? exercises : [...exercises, entryCheck.label];
      } else {
        blockedEntry = entryText;
      }
    }
    const check = validateWizardExercises(finalExercises, blockedEntry);
    if (!check.ok) {
      showAlert(check.title, check.message);
      return;
    }
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecte');

      // D-10: name / split_type / days_per_week are NOT NULL; the previous insert omitted them.
      const { data: row, error } = await supabase
        .from('ziko_ai_generated_programs')
        .insert(buildWizardProgramRow(user.id, { goal, weeks, selectedDays, exercises: finalExercises }))
        .select('id,name,program_data')
        .single();

      if (error || !row) throw error ?? new Error('Programme non enregistre');

      // Lu AVANT toute activation : decide si le programme devient actif d'office (aucun programme actif) ou non.
      let current: ProgramItem | null | 'error' = null;
      try {
        current = (await loadAllPrograms(supabase as any, user.id)).find((i) => i.isActive && i.id !== String(row.id)) ?? null;
      } catch {
        current = 'error';
      }
      const programId = String(row.id);
      const programName = String(row.name);
      const plan = wizardActivationPlan(current);

      if (plan.kind === 'auto') {
        try {
          await setActiveProgram(supabase as any, 'ai', programId);
        } catch {
          await refreshProgramQueries(queryClient);
          showAlert('Programme créé', `« ${programName} » est enregistré, mais son activation a échoué. Active-le depuis la liste de tes programmes.`, [
            { text: 'Mes programmes', onPress: () => router.replace('/(app)/workout/programs' as any) },
          ]);
          return;
        }
        await refreshProgramQueries(queryClient);
        neutralToast(activationToast(programName));
        goToTrainingDashboard(router);
        return;
      }

      await refreshProgramQueries(queryClient);
      const toPrograms = () => router.replace('/(app)/workout/programs' as any);
      const keep =
        plan.kind === 'offer'
          ? `« ${plan.currentName} » reste ton programme actif.`
          : 'Ton programme actif n’a pas été modifié.';
      const buttons: Array<{ text: string; style?: 'cancel' | 'default' | 'destructive'; onPress?: () => void }> = [
        { text: 'Plus tard', style: 'cancel', onPress: toPrograms },
      ];
      if (plan.kind === 'offer' && plan.canActivate) {
        buttons.push({
          text: 'Définir comme programme actif',
          onPress: async () => {
            try {
              await setActiveProgram(supabase as any, 'ai', programId);
              await refreshProgramQueries(queryClient);
              neutralToast(activationToast(programName));
              goToTrainingDashboard(router);
            } catch {
              showAlert('Activation impossible', "Active-le depuis la liste de tes programmes.");
              toPrograms();
            }
          },
        });
      } else {
        buttons.push({ text: 'Voir mes programmes', onPress: toPrograms });
      }
      showAlert('Programme créé', `« ${programName} » est dans ta liste. ${keep}`, buttons);
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
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: entryError || suggestions.length > 0 ? 8 : 16 }}>
        <TextInput
          value={exerciseInput}
          onChangeText={setExerciseInput}
          placeholder="Nom de l'exercice..."
          placeholderTextColor={theme.muted}
          onSubmitEditing={addExercise}
          returnKeyType="done"
          autoCorrect={false}
          style={{
            flex: 1, fontSize: 14, fontWeight: '600', color: theme.text,
            backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
            borderWidth: 1.5, borderColor: entryError ? theme.danger : '#E2E0DA',
          }}
        />
        <TouchableOpacity
          onPress={addExercise}
          accessibilityLabel="Ajouter l'exercice"
          style={{
            width: 46, height: 46, borderRadius: 12,
            backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Erreur inline : texte libre hors catalogue (bloque "Creer mon programme") */}
      {entryError && (
        <Text testID="exercise-entry-error" style={{ fontSize: 12, fontWeight: '600', color: theme.danger, marginBottom: 10, lineHeight: 17 }}>
          {entryError}
        </Text>
      )}

      {/* Suggestions du catalogue pendant la frappe */}
      {suggestions.length > 0 && (
        <View style={{ marginBottom: 16, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', overflow: 'hidden' }}>
          {suggestions.map((row, i) => (
            <TouchableOpacity
              key={row.id}
              testID={`exercise-suggestion-${i}`}
              onPress={() => addResolved(exerciseRowLabel(row))}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#E2E0DA',
              }}
            >
              <Ionicons name="barbell-outline" size={16} color={theme.muted} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: theme.text }}>{exerciseRowLabel(row)}</Text>
              <Ionicons name="add-circle-outline" size={18} color="#FF5C1A" />
            </TouchableOpacity>
          ))}
        </View>
      )}

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
      {/* Clavier ouvert : le pied (Continuer / Creer mon programme) remonte au-dessus du clavier, le contenu est
          un ScrollView (keyboardShouldPersistTaps="handled") donc les suggestions restent touchables. */}
      <KeyboardAvoidingView
        testID="program-builder-keyboard-avoiding"
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
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
        {/* Appeles comme des fonctions (pas <StepN />) : un composant defini dans le rendu change de type a chaque
            frappe, ce qui remontait le TextInput et lui faisait perdre le focus apres 1 caractere. */}
        {step === 1 && Step1()}
        {step === 2 && Step2()}
        {step === 3 && Step3()}
        {step === 4 && Step4()}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
