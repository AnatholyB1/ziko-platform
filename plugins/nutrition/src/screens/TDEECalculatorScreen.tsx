import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNutritionStore, calculateTDEE } from '../store';
import type { TDEEProfile } from '../store';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';

// Cross-plugin stores (optional)
let useHydrationStore: any = null;
let useSleepStore: any = null;
try { useHydrationStore = require('@ziko/plugin-hydration').useHydrationStore; } catch {}
try { useSleepStore = require('@ziko/plugin-sleep').useSleepStore; } catch {}

const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Sédentaire', desc: 'Peu ou pas d\'exercice', multiplier: 1.2 },
  { key: 'light', label: 'Légèrement actif', desc: '1-3 jours/semaine', multiplier: 1.375 },
  { key: 'moderate', label: 'Modérément actif', desc: '3-5 jours/semaine', multiplier: 1.55 },
  { key: 'active', label: 'Très actif', desc: '6-7 jours/semaine', multiplier: 1.725 },
  { key: 'extreme', label: 'Extrêmement actif', desc: '2x par jour / physique', multiplier: 1.9 },
];

const GOALS = [
  { key: 'fat_loss', label: 'Perte de gras', emoji: '🔥', calorieAdjust: -500 },
  { key: 'maintenance', label: 'Maintien', emoji: '⚖️', calorieAdjust: 0 },
  { key: 'muscle_gain', label: 'Prise de muscle', emoji: '💪', calorieAdjust: 300 },
  { key: 'endurance', label: 'Endurance', emoji: '🏃', calorieAdjust: 200 },
] as const;

type GoalKey = typeof GOALS[number]['key'];

function computeFullProfile(
  gender: 'male' | 'female',
  age: number,
  weightKg: number,
  heightCm: number,
  activityLevel: number,
  goal: GoalKey,
): TDEEProfile {
  const isMale = gender === 'male';
  const bmr = isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const tdee = Math.round(bmr * activityLevel);
  const goalObj = GOALS.find((g) => g.key === goal)!;
  const targetCalories = Math.round(tdee + goalObj.calorieAdjust);

  // Macro split based on goal
  let proteinMultiplier: number;
  let fatPct: number;
  switch (goal) {
    case 'fat_loss':
      proteinMultiplier = 2.2; // g per kg
      fatPct = 0.25;
      break;
    case 'muscle_gain':
      proteinMultiplier = 2.0;
      fatPct = 0.25;
      break;
    case 'endurance':
      proteinMultiplier = 1.6;
      fatPct = 0.20;
      break;
    default: // maintenance
      proteinMultiplier = 1.8;
      fatPct = 0.25;
  }
  const proteinGoal = Math.round(weightKg * proteinMultiplier);
  const fatGoal = Math.round((targetCalories * fatPct) / 9);
  const proteinCals = proteinGoal * 4;
  const fatCals = fatGoal * 9;
  const carbsGoal = Math.round((targetCalories - proteinCals - fatCals) / 4);

  // Water: ~35ml/kg, more if active
  const waterBase = weightKg * 35;
  const waterBonus = activityLevel >= 1.55 ? 500 : activityLevel >= 1.375 ? 250 : 0;
  const waterGoalMl = Math.round((waterBase + waterBonus) / 100) * 100;

  // Sleep goal based on goal
  let sleepGoalHours: number;
  switch (goal) {
    case 'muscle_gain': sleepGoalHours = 8.5; break;
    case 'fat_loss': sleepGoalHours = 8; break;
    case 'endurance': sleepGoalHours = 8; break;
    default: sleepGoalHours = 7.5;
  }

  return {
    gender, age, weightKg, heightCm, activityLevel, goal,
    bmr: Math.round(bmr),
    tdee,
    targetCalories,
    proteinGoal,
    carbsGoal,
    fatGoal,
    waterGoalMl,
    sleepGoalHours,
  };
}

type Step = 'form' | 'results';

export default function TDEECalculatorScreen({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { tdeeProfile, setTDEEProfile, saveTDEEProfile } = useNutritionStore();

  // Form state
  const [gender, setGender] = useState<'male' | 'female'>(tdeeProfile?.gender ?? 'male');
  const [age, setAge] = useState(tdeeProfile?.age ?? 25);
  const [weightKg, setWeightKg] = useState(tdeeProfile?.weightKg ?? 70);
  const [heightCm, setHeightCm] = useState(tdeeProfile?.heightCm ?? 175);
  const [activityIdx, setActivityIdx] = useState(
    tdeeProfile ? ACTIVITY_LEVELS.findIndex((a) => a.multiplier === tdeeProfile.activityLevel) : 2
  );
  const [goal, setGoal] = useState<GoalKey>(tdeeProfile?.goal ?? 'maintenance');
  const [step, setStep] = useState<Step>('form');
  const [result, setResult] = useState<TDEEProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Pre-fill from user profile
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('age, weight_kg, height_cm, goal')
          .eq('id', user.id)
          .single();
        if (profile) {
          if (profile.age) setAge(profile.age);
          if (profile.weight_kg) setWeightKg(profile.weight_kg);
          if (profile.height_cm) setHeightCm(profile.height_cm);
          if (profile.goal && GOALS.some((g) => g.key === profile.goal)) {
            setGoal(profile.goal as GoalKey);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCalculate = () => {
    const profile = computeFullProfile(
      gender, age, weightKg, heightCm,
      ACTIVITY_LEVELS[activityIdx].multiplier, goal,
    );
    setResult(profile);
    setStep('results');
  };

  const handleApply = async () => {
    if (!result) return;
    setSaving(true);
    try {
      // 1. Update nutrition goals
      setTDEEProfile(result);
      await saveTDEEProfile(supabase);

      // 2. Update hydration goal
      if (useHydrationStore) {
        const hydStore = useHydrationStore.getState();
        hydStore.setGoalMl(result.waterGoalMl);
        if (hydStore.saveSettings) await hydStore.saveSettings(supabase);
      }

      // 3. Update sleep goal
      if (useSleepStore) {
        const sleepStore = useSleepStore.getState();
        sleepStore.setSleepGoalHours(result.sleepGoalHours);
        if (sleepStore.saveSleepGoal) await sleepStore.saveSleepGoal(supabase);
      }

      showAlert(
        'Objectifs mis à jour ✅',
        `Calories: ${result.targetCalories} kcal\nProtéines: ${result.proteinGoal}g\nGlucides: ${result.carbsGoal}g\nLipides: ${result.fatGoal}g\nEau: ${(result.waterGoalMl / 1000).toFixed(1)}L\nSommeil: ${result.sleepGoalHours}h`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch {
      showAlert('Erreur', 'Impossible de sauvegarder les objectifs.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  // ─── Results screen ─────────────────────────────────────
  if (step === 'results' && result) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => setStep('form')} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color="#7A7670" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: theme.text }}>
            📊 Résultats
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
          {/* BMR & TDEE */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
              <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 4 }}>Métabolisme basal</Text>
              <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>{result.bmr}</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>kcal/jour</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
              <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 4 }}>TDEE</Text>
              <Text style={{ color: theme.primary, fontSize: 28, fontWeight: '800' }}>{result.tdee}</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>kcal/jour</Text>
            </View>
          </View>

          {/* Target calories */}
          <View style={{ backgroundColor: theme.primary + '12', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.primary + '33', alignItems: 'center' }}>
            <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 4 }}>Objectif calorique</Text>
            <Text style={{ color: theme.primary, fontSize: 36, fontWeight: '900' }}>{result.targetCalories}</Text>
            <Text style={{ color: theme.muted, fontSize: 13 }}>kcal / jour</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 6 }}>
              {GOALS.find((g) => g.key === result.goal)?.emoji} {GOALS.find((g) => g.key === result.goal)?.label}
              {' '}({result.tdee > result.targetCalories ? `-${result.tdee - result.targetCalories}` : `+${result.targetCalories - result.tdee}`} kcal)
            </Text>
          </View>

          {/* Macros */}
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>
            🥩 Répartition des macros
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Protéines', value: result.proteinGoal, unit: 'g', color: '#4CAF50', kcal: result.proteinGoal * 4 },
              { label: 'Glucides', value: result.carbsGoal, unit: 'g', color: '#FF9800', kcal: result.carbsGoal * 4 },
              { label: 'Lipides', value: result.fatGoal, unit: 'g', color: '#FF6584', kcal: result.fatGoal * 9 },
            ].map((m) => (
              <View key={m.label} style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
                <Text style={{ color: m.color, fontWeight: '800', fontSize: 22 }}>{m.value}</Text>
                <Text style={{ color: theme.muted, fontSize: 11 }}>{m.unit}</Text>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 12, marginTop: 4 }}>{m.label}</Text>
                <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>{m.kcal} kcal</Text>
              </View>
            ))}
          </View>

          {/* Water & Sleep */}
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>
            🎯 Autres objectifs
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2196F3' + '33', alignItems: 'center' }}>
              <Ionicons name="water" size={24} color="#2196F3" />
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 20, marginTop: 6 }}>
                {(result.waterGoalMl / 1000).toFixed(1)}L
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>Eau / jour</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#9C27B0' + '33', alignItems: 'center' }}>
              <Ionicons name="moon" size={24} color="#9C27B0" />
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 20, marginTop: 6 }}>
                {result.sleepGoalHours}h
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>Sommeil / nuit</Text>
            </View>
          </View>

          {/* Apply button */}
          <TouchableOpacity
            onPress={handleApply}
            disabled={saving}
            style={{
              backgroundColor: theme.primary, borderRadius: 14, padding: 18,
              alignItems: 'center', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                Appliquer tous les objectifs
              </Text>
            )}
          </TouchableOpacity>

          {/* Recalculate */}
          <TouchableOpacity onPress={() => setStep('form')}
            style={{ marginTop: 12, alignItems: 'center', padding: 14 }}>
            <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 14 }}>
              ← Modifier les paramètres
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Form screen ─────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: theme.text }}>
          🧮 Calculateur TDEE
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        {/* Gender */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>Sexe</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          {([
            { key: 'male' as const, label: 'Homme', icon: 'male' as const },
            { key: 'female' as const, label: 'Femme', icon: 'female' as const },
          ]).map((g) => (
            <TouchableOpacity
              key={g.key}
              onPress={() => setGender(g.key)}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: gender === g.key ? theme.primary + '15' : theme.surface,
                borderRadius: 12, padding: 14,
                borderWidth: 1.5,
                borderColor: gender === g.key ? theme.primary : theme.border,
              }}
            >
              <Ionicons name={g.icon} size={20} color={gender === g.key ? theme.primary : theme.muted} />
              <Text style={{ color: gender === g.key ? theme.primary : theme.text, fontWeight: '600' }}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Age / Weight / Height */}
        {[
          { label: 'Âge', value: age, set: setAge, unit: 'ans', min: 14, max: 80, step: 1 },
          { label: 'Poids', value: weightKg, set: setWeightKg, unit: 'kg', min: 30, max: 250, step: 1 },
          { label: 'Taille', value: heightCm, set: setHeightCm, unit: 'cm', min: 120, max: 230, step: 1 },
        ].map((field) => (
          <View key={field.label} style={{ marginBottom: 20 }}>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              {field.label}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: theme.surface, borderRadius: 12,
              borderWidth: 1, borderColor: theme.border, padding: 4,
            }}>
              <TouchableOpacity
                onPress={() => field.set(Math.max(field.min, field.value - field.step))}
                style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="remove-circle" size={28} color={theme.primary} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700' }}>
                  {field.value}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{field.unit}</Text>
              </View>
              <TouchableOpacity
                onPress={() => field.set(Math.min(field.max, field.value + field.step))}
                style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="add-circle" size={28} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Activity level */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
          Niveau d'activité
        </Text>
        <View style={{ marginBottom: 20, gap: 8 }}>
          {ACTIVITY_LEVELS.map((level, idx) => (
            <TouchableOpacity
              key={level.key}
              onPress={() => setActivityIdx(idx)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: activityIdx === idx ? theme.primary + '12' : theme.surface,
                borderRadius: 12, padding: 14,
                borderWidth: 1.5,
                borderColor: activityIdx === idx ? theme.primary : theme.border,
              }}
            >
              <View style={{
                width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
                backgroundColor: activityIdx === idx ? theme.primary : theme.border,
              }}>
                <Text style={{ color: activityIdx === idx ? '#fff' : theme.muted, fontWeight: '700', fontSize: 11 }}>
                  x{level.multiplier}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: activityIdx === idx ? theme.primary : theme.text, fontWeight: '600', fontSize: 14 }}>
                  {level.label}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{level.desc}</Text>
              </View>
              {activityIdx === idx && (
                <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Goal */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
          Objectif
        </Text>
        <View style={{ marginBottom: 24, gap: 8 }}>
          {GOALS.map((g) => (
            <TouchableOpacity
              key={g.key}
              onPress={() => setGoal(g.key)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: goal === g.key ? theme.primary + '12' : theme.surface,
                borderRadius: 12, padding: 14,
                borderWidth: 1.5,
                borderColor: goal === g.key ? theme.primary : theme.border,
              }}
            >
              <Text style={{ fontSize: 22 }}>{g.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: goal === g.key ? theme.primary : theme.text, fontWeight: '600', fontSize: 14 }}>
                  {g.label}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  {g.calorieAdjust > 0 ? `+${g.calorieAdjust}` : g.calorieAdjust} kcal / TDEE
                </Text>
              </View>
              {goal === g.key && (
                <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Calculate button */}
        <TouchableOpacity
          onPress={handleCalculate}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 18,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            Calculer mes objectifs
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
