import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';

type GoalType = 'loss' | 'hypertrophy' | 'strength' | 'maintain';

interface GoalOption {
  id: GoalType;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  color: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  { id: 'loss', icon: 'trending-down-outline', label: 'Perte de poids', sub: 'Déficit calorique + cardio', color: '#2E7BF6' },
  { id: 'hypertrophy', icon: 'barbell-outline', label: 'Prise de masse', sub: 'Surplus + hypertrophie', color: '#FF5C1A' },
  { id: 'strength', icon: 'flash-outline', label: 'Gain de force', sub: '5×5, 3×3, intensité', color: '#E8A33A' },
  { id: 'maintain', icon: 'shield-outline', label: 'Maintien', sub: 'Stabilité + santé', color: '#2E9E5B' },
];

const CURRENT_WEIGHT = 82;

export default function GoalEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useThemeStore((s) => s.theme);
  const isNew = !id || id === 'new';

  const [goalType, setGoalType] = useState<GoalType>('hypertrophy');
  const [targetWeight, setTargetWeight] = useState(78);
  const [deadlineWeeks, setDeadlineWeeks] = useState(12);
  const [isSaving, setIsSaving] = useState(false);

  const weightDiff = targetWeight - CURRENT_WEIGHT;
  const weightDiffLabel = weightDiff < 0 ? `${weightDiff} kg` : `+${weightDiff} kg`;
  const weeklyRate = Math.abs(weightDiff / deadlineWeeks);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      // Update goal in user_profiles — map our goalType to DB goal field
      const dbGoal = goalType === 'hypertrophy' ? 'muscle_gain'
        : goalType === 'loss' ? 'fat_loss'
        : goalType === 'strength' ? 'muscle_gain'
        : 'maintenance';

      await supabase
        .from('user_profiles')
        .update({ goal: dbGoal })
        .eq('id', user.id);

      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde';
      showAlert('Erreur', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    showAlert(
      'Supprimer l\'objectif',
      'Confirmes-tu la suppression de cet objectif ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
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
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Modifier
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, lineHeight: 24 }}>
            Mon objectif
          </Text>
        </View>
        {!isNew && (
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={theme.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Goal type */}
        <Text style={{
          fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
        }}>
          Type d'objectif
        </Text>
        <View style={{ gap: 8, marginBottom: 20 }}>
          {GOAL_OPTIONS.map((g) => {
            const selected = goalType === g.id;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => setGoalType(g.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: selected ? `${theme.primary}0F` : theme.surface,
                  borderRadius: 14, padding: 14,
                  borderWidth: 1.5,
                  borderColor: selected ? theme.primary : theme.border,
                }}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 11,
                  backgroundColor: `${g.color}22`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={g.icon} size={18} color={g.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{g.label}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{g.sub}</Text>
                </View>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: selected ? theme.primary : 'transparent',
                  borderWidth: selected ? 0 : 1.5,
                  borderColor: theme.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Target weight */}
        <Text style={{
          fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
        }}>
          Poids cible
        </Text>
        <View style={{
          backgroundColor: theme.surface, borderRadius: 14, padding: 18,
          borderWidth: 1, borderColor: theme.border, marginBottom: 20,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
            <Text style={{ fontSize: 48, fontWeight: '800', color: theme.primary, lineHeight: 52 }}>
              {targetWeight}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.muted }}>kg</Text>
          </View>
          <Text style={{ textAlign: 'center', fontSize: 12, color: theme.muted, marginTop: 4 }}>
            Actuel · {CURRENT_WEIGHT} kg · {weightDiffLabel}
          </Text>

          {/* Weight slider (manual +/- buttons since RN has no range input) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => setTargetWeight((w) => Math.max(50, w - 0.5))}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: `${theme.text}0F`,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="remove" size={24} color={theme.text} />
            </TouchableOpacity>
            <TextInput
              value={String(targetWeight)}
              onChangeText={(t) => {
                const n = parseFloat(t);
                if (!isNaN(n) && n >= 50 && n <= 120) setTargetWeight(n);
              }}
              keyboardType="numeric"
              style={{
                fontSize: 24, fontWeight: '800', color: theme.text, textAlign: 'center',
                minWidth: 70, borderBottomWidth: 1.5, borderBottomColor: theme.border, paddingBottom: 2,
              }}
            />
            <TouchableOpacity
              onPress={() => setTargetWeight((w) => Math.min(120, w + 0.5))}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: `${theme.primary}22`,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700' }}>50 kg</Text>
            <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700' }}>120 kg</Text>
          </View>
        </View>

        {/* Deadline */}
        <Text style={{
          fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
        }}>
          Échéance
        </Text>
        <View style={{
          backgroundColor: theme.surface, borderRadius: 14, padding: 16,
          borderWidth: 1, borderColor: theme.border, marginBottom: 20,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 36 }}>
              {deadlineWeeks}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.muted }}>semaines</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12 }}>
            <TouchableOpacity
              onPress={() => setDeadlineWeeks((w) => Math.max(4, w - 1))}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: `${theme.text}0F`,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="remove" size={20} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, height: 4, backgroundColor: `${theme.text}11`, borderRadius: 2 }}>
              <View style={{
                width: `${((deadlineWeeks - 4) / (52 - 4)) * 100}%`,
                height: '100%', backgroundColor: theme.primary, borderRadius: 2,
              }} />
            </View>
            <TouchableOpacity
              onPress={() => setDeadlineWeeks((w) => Math.min(52, w + 1))}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: `${theme.primary}22`,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700' }}>1 mois</Text>
            <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700' }}>1 an</Text>
          </View>
        </View>

        {/* AI recommendation */}
        <View style={{
          flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, marginBottom: 20,
          backgroundColor: `${theme.primary}0D`,
          borderWidth: 1, borderColor: `${theme.primary}33`,
        }}>
          <View style={{
            width: 30, height: 30, borderRadius: 9,
            backgroundColor: theme.primary,
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Ionicons name="sparkles" size={15} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, lineHeight: 20, color: theme.text }}>
              <Text style={{ fontWeight: '700' }}>Ziko recommande</Text>
              {` · ${Math.abs(weightDiff)} kg en ${deadlineWeeks} sem., soit ${weeklyRate.toFixed(1)} kg/sem. `}
              <Text style={{ color: theme.success, fontWeight: '700' }}>Rythme sain.</Text>
            </Text>
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={{
            backgroundColor: theme.text, borderRadius: 14, padding: 16,
            alignItems: 'center', opacity: isSaving ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
            {isSaving ? 'Enregistrement…' : 'Enregistrer l\'objectif'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
