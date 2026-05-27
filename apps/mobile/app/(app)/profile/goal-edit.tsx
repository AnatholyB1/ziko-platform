import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';

// ── Types ──────────────────────────────────────────────────────

type GoalType = 'weight_loss' | 'strength' | 'endurance' | 'body_comp' | 'wellness';

interface GoalOption {
  id: GoalType;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  color: string;
}

// ── Goal options (5 cards) ────────────────────────────────────

const GOAL_OPTIONS: GoalOption[] = [
  { id: 'weight_loss', icon: 'flame-outline',   label: 'Perte de poids', sub: 'Deficit calorique + cardio',  color: '#2E7BF6' },
  { id: 'strength',    icon: 'barbell-outline', label: 'Force',          sub: '5x5, 3x3, intensite maximale', color: '#FF5C1A' },
  { id: 'endurance',   icon: 'heart-outline',   label: 'Endurance',      sub: 'Cardio, zones de frequence',   color: '#E8A33A' },
  { id: 'body_comp',   icon: 'body-outline',    label: 'Composition',    sub: 'Recomposition corporelle',     color: '#2E9E5B' },
  { id: 'wellness',    icon: 'leaf-outline',    label: 'Bien-etre',      sub: 'Sante globale, mobilite',      color: '#9B59B6' },
];

// ── Screen ────────────────────────────────────────────────────

export default function GoalEditScreen() {
  const { currentGoal } = useLocalSearchParams<{ currentGoal?: string }>();
  const theme = useThemeStore((s) => s.theme);

  const [initialGoal, setInitialGoal] = useState<GoalType | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);
  const [loading, setLoading] = useState(!currentGoal);
  const [isSaving, setIsSaving] = useState(false);

  // Load from DB if no param passed
  useEffect(() => {
    if (currentGoal) {
      const g = currentGoal as GoalType;
      setInitialGoal(g);
      setSelectedGoal(g);
      setLoading(false);
      return;
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('user_profiles')
        .select('goal')
        .eq('id', user.id)
        .single();

      if (data?.goal) {
        const g = data.goal as GoalType;
        setInitialGoal(g);
        setSelectedGoal(g);
      }
      setLoading(false);
    })();
  }, [currentGoal]);

  const isUnchanged = selectedGoal === initialGoal;

  const handleSave = async () => {
    if (!selectedGoal || isSaving) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecte');

      const { error } = await supabase
        .from('user_profiles')
        .update({ goal: selectedGoal })
        .eq('id', user.id);

      if (error) throw error;

      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde';
      showAlert('Erreur', msg);
    } finally {
      setIsSaving(false);
    }
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
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
            <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 20, lineHeight: 20 }}>
              Selectionne l'objectif qui correspond le mieux a ta situation actuelle.
            </Text>

            {/* 5 goal cards */}
            <View style={{ gap: 10 }}>
              {GOAL_OPTIONS.map((g) => {
                const selected = selectedGoal === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => setSelectedGoal(g.id)}
                    activeOpacity={0.75}
                    style={{
                      borderRadius: 16, borderWidth: 2,
                      borderColor: selected ? '#FF5C1A' : '#E2E0DA',
                      padding: 16, marginHorizontal: 0,
                      backgroundColor: selected ? 'rgba(255,92,26,0.05)' : '#FFFFFF',
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: selected ? 0.12 : 0.06, shadowRadius: 12, elevation: selected ? 4 : 2,
                    }}
                  >
                    <View style={{
                      width: 44, height: 44, borderRadius: 12,
                      backgroundColor: `${g.color}1A`,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={g.icon} size={22} color={g.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17' }}>{g.label}</Text>
                      <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 2 }}>{g.sub}</Text>
                    </View>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: selected ? '#FF5C1A' : 'transparent',
                      borderWidth: selected ? 0 : 1.5,
                      borderColor: '#E2E0DA',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Fixed bottom save button */}
          <View style={{
            paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24,
            borderTopWidth: 1, borderTopColor: theme.border,
            backgroundColor: theme.background,
          }}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isUnchanged || isSaving || !selectedGoal}
              style={{
                backgroundColor: (isUnchanged || !selectedGoal) ? `${theme.text}1A` : '#FF5C1A',
                borderRadius: 14, padding: 16, alignItems: 'center',
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              <Text style={{
                fontSize: 15, fontWeight: '700',
                color: (isUnchanged || !selectedGoal) ? '#6B6963' : '#fff',
              }}>
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
