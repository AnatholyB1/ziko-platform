import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Svg, { Circle } from 'react-native-svg';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NutritionLog {
  id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_g?: number;
  created_at?: string;
}

interface UserGoals {
  calorie_goal: number;
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Aujourd\'hui', 'Ajouter', 'Historique', 'Réglages'];

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Petit-déjeuner', icon: 'sunny-outline' as const },
  { key: 'lunch', label: 'Déjeuner', icon: 'restaurant-outline' as const },
  { key: 'snack', label: 'Collation', icon: 'nutrition-outline' as const },
  { key: 'dinner', label: 'Dîner', icon: 'moon-outline' as const },
] as const;

const DEFAULT_GOALS: UserGoals = {
  calorie_goal: 2000,
  protein_goal_g: 140,
  carbs_goal_g: 200,
  fat_goal_g: 60,
};

const CARD_STYLE = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E2E0DA',
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

// ─── SVG Calorie Ring ─────────────────────────────────────────────────────────

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const r = 38;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const progress = pct * circumference;

  return (
    <Svg width={92} height={92} style={{ transform: [{ rotate: '-90deg' }] }}>
      {/* Base ring */}
      <Circle
        cx={46}
        cy={46}
        r={r}
        strokeWidth={strokeWidth}
        stroke="rgba(46,123,246,0.15)"
        fill="none"
      />
      {/* Progress arc */}
      <Circle
        cx={46}
        cy={46}
        r={r}
        strokeWidth={strokeWidth}
        stroke="#FF5C1A"
        fill="none"
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NutritionPlugin({ supabase }: { supabase: SupabaseClient }) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Aujourd\'hui');
  const [userId, setUserId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [calorieSlider, setCalorieSlider] = useState(2000);

  const today = new Date().toISOString().split('T')[0];

  // Get userId
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user?: { id?: string } | null } }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, [supabase]);

  // ── Aujourd'hui: today's logs ──────────────────────────────────────────────
  const { data: todayLogs = [], isLoading: loadingToday, isError: errorToday, refetch: refetchToday } =
    useQuery<NutritionLog[]>({
      queryKey: ['nutrition_today', userId, today],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('nutrition_logs')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data ?? [];
      },
      enabled: !!userId,
    });

  // ── Réglages: nutrition goals from user_profiles ──────────────────────────
  const { data: goals = DEFAULT_GOALS, isLoading: loadingGoals } =
    useQuery<UserGoals>({
      queryKey: ['nutrition_goals', userId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('weight_kg, goal')
          .eq('id', userId)
          .single();
        if (error) throw error;
        // Derive sensible defaults from goal field (maintenance / fat_loss / muscle_gain)
        const goal = data?.goal ?? 'maintenance';
        const weight = data?.weight_kg ?? 75;
        const baseCalories = goal === 'fat_loss' ? 1800 : goal === 'muscle_gain' ? 2400 : 2000;
        const protein = Math.round(weight * 1.8);
        return {
          calorie_goal: baseCalories,
          protein_goal_g: protein,
          carbs_goal_g: Math.round((baseCalories * 0.45) / 4),
          fat_goal_g: Math.round((baseCalories * 0.25) / 9),
        };
      },
      enabled: !!userId,
    });

  // Sync slider with goals
  useEffect(() => {
    if (goals) setCalorieSlider(goals.calorie_goal);
  }, [goals.calorie_goal]);

  // ── Historique: last 7 days ────────────────────────────────────────────────
  const { data: historyLogs = [], isLoading: loadingHistory } =
    useQuery<NutritionLog[]>({
      queryKey: ['nutrition_history', userId],
      queryFn: async () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fromDate = sevenDaysAgo.toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('nutrition_logs')
          .select('*')
          .eq('user_id', userId)
          .gte('date', fromDate)
          .order('date', { ascending: false });
        if (error) throw error;
        return data ?? [];
      },
      enabled: !!userId,
    });

  // ── Quick-add mutation ─────────────────────────────────────────────────────
  const quickAddMutation = useMutation({
    mutationFn: async (entry: Omit<NutritionLog, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('nutrition_logs').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition_today'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition_history'] });
    },
    onError: () => {
      showAlert('Erreur', 'Impossible d\'ajouter l\'entrée. Réessayez.');
    },
  });

  // ── Computed totals ────────────────────────────────────────────────────────
  const totals = todayLogs.reduce(
    (acc, l) => ({
      kcal: acc.kcal + (l.calories ?? 0),
      protein: acc.protein + (l.protein_g ?? 0),
      carbs: acc.carbs + (l.carbs_g ?? 0),
      fat: acc.fat + (l.fat_g ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  // ── Last 5 unique recent foods ─────────────────────────────────────────────
  const recentFoods = (() => {
    const seen = new Set<string>();
    const result: NutritionLog[] = [];
    for (const log of [...todayLogs].reverse()) {
      if (!seen.has(log.food_name)) {
        seen.add(log.food_name);
        result.push(log);
        if (result.length >= 5) break;
      }
    }
    return result;
  })();

  // ── 7-day chart data ───────────────────────────────────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const dailyKcal = last7Days.map((date) => ({
    date,
    kcal: historyLogs
      .filter((l) => l.date === date)
      .reduce((s, l) => s + (l.calories ?? 0), 0),
    isToday: date === today,
  }));

  const maxKcal = Math.max(...dailyKcal.map((d) => d.kcal), goals.calorie_goal, 1);

  // ── Average macros 7 days ─────────────────────────────────────────────────
  const avg7 = (() => {
    const uniqueDays = new Set(historyLogs.map((l) => l.date)).size || 1;
    return {
      kcal: Math.round(historyLogs.reduce((s, l) => s + l.calories, 0) / uniqueDays),
      protein: Math.round(historyLogs.reduce((s, l) => s + l.protein_g, 0) / uniqueDays),
      carbs: Math.round(historyLogs.reduce((s, l) => s + l.carbs_g, 0) / uniqueDays),
      fat: Math.round(historyLogs.reduce((s, l) => s + l.fat_g, 0) / uniqueDays),
    };
  })();

  // ─────────────────────────────────────────────────────────────────────────
  // TAB RENDERS
  // ─────────────────────────────────────────────────────────────────────────

  const renderTodayTab = () => {
    if (loadingToday) {
      return (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      );
    }

    if (errorToday) {
      return (
        <View style={{ alignItems: 'center', paddingTop: 40, gap: 12 }}>
          <Text style={{ color: theme.muted, fontSize: 14 }}>Impossible de charger tes données</Text>
          <TouchableOpacity onPress={() => refetchToday()}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        {/* Calorie ring card */}
        <View style={{ ...CARD_STYLE, padding: 20, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              <CalorieRing consumed={totals.kcal} target={goals.calorie_goal} />
              <View style={{ position: 'absolute', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>
                  {Math.round(totals.kcal)}
                </Text>
                <Text style={{ fontSize: 9, color: theme.muted }}>kcal</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>
                {Math.round(totals.kcal)}
                <Text style={{ fontSize: 14, fontWeight: '400', color: theme.muted }}>
                  {' '}/ {goals.calorie_goal} kcal
                </Text>
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: goals.calorie_goal - totals.kcal > 0 ? '#22C55E' : '#EF4444',
                  marginTop: 2,
                  fontWeight: '600',
                }}
              >
                {goals.calorie_goal - totals.kcal > 0
                  ? `${Math.round(goals.calorie_goal - totals.kcal)} kcal restantes`
                  : `${Math.round(totals.kcal - goals.calorie_goal)} kcal au-dessus`}
              </Text>
            </View>
          </View>

          {/* Macro bars */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {[
              { label: 'Protéines', value: totals.protein, target: goals.protein_goal_g, color: '#FF5C1A', unit: 'g' },
              { label: 'Glucides', value: totals.carbs, target: goals.carbs_goal_g, color: '#2E7BF6', unit: 'g' },
              { label: 'Lipides', value: totals.fat, target: goals.fat_goal_g, color: '#F59E0B', unit: 'g' },
            ].map((macro) => {
              const pct = Math.min((macro.value / Math.max(macro.target, 1)) * 100, 100);
              return (
                <View key={macro.label} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: theme.muted, marginBottom: 4 }}>{macro.label}</Text>
                  <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: macro.color,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Text style={{ fontSize: 11, color: theme.text, marginTop: 2, fontWeight: '600' }}>
                    {Math.round(macro.value)}{macro.unit}
                    <Text style={{ color: theme.muted, fontWeight: '400' }}> / {macro.target}{macro.unit}</Text>
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* AI Suggestion: protein rule (PLUG-N-06) */}
        {(() => {
          const proteinPct = totals.protein / Math.max(goals.protein_goal_g, 1);
          const tipText = proteinPct < 0.30
            ? `Tu n'as consommé que ${Math.round(totals.protein)}g de protéines sur ${goals.protein_goal_g}g. Pense à ajouter une source de protéines lors de ton prochain repas (ex: poulet, oeufs, yaourt grec).`
            : `Super travail ! Continue à équilibrer tes macros pour atteindre tes objectifs. Tu es à ${Math.round(totals.kcal)} kcal aujourd'hui.`;
          return (
            <View style={{ marginBottom: 16 }}>
              <AISuggestion text={tipText} />
            </View>
          );
        })()}

        {/* Meal cards */}
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 12 }}>
          Repas du jour
        </Text>
        {MEAL_TYPES.map((meal) => {
          const logs = todayLogs.filter((l) => l.meal_type === meal.key);
          const mealKcal = logs.reduce((s, l) => s + l.calories, 0);
          return (
            <View key={meal.key} style={{ ...CARD_STYLE, padding: 16, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: logs.length > 0 ? 10 : 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={meal.icon} size={18} color={theme.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{meal.label}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {mealKcal > 0 && (
                    <Text style={{ fontSize: 13, color: theme.primary, fontWeight: '700' }}>
                      {Math.round(mealKcal)} kcal
                    </Text>
                  )}
                  <TouchableOpacity onPress={() => router.push('/(app)/(plugins)/nutrition/log' as any)}>
                    <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              {logs.length === 0 ? (
                <Text style={{ fontSize: 13, color: theme.muted, opacity: 0.65 }}>Rien enregistré</Text>
              ) : (
                logs.map((log) => (
                  <View
                    key={log.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 6,
                      borderTopWidth: 1,
                      borderTopColor: '#E2E0DA',
                    }}
                  >
                    <Ionicons name="ellipse" size={6} color={theme.muted} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: theme.text, fontWeight: '500' }}>{log.food_name}</Text>
                      <Text style={{ fontSize: 11, color: theme.muted }}>
                        P: {log.protein_g}g · G: {log.carbs_g}g · L: {log.fat_g}g
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600' }}>
                      {Math.round(log.calories)} kcal
                    </Text>
                  </View>
                ))
              )}
            </View>
          );
        })}
      </>
    );
  };

  const renderAddTab = () => (
    <>
      {/* Search input */}
      <View style={{ ...CARD_STYLE, marginBottom: 16, position: 'relative' }}>
        <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
          <Ionicons name="search-outline" size={18} color={theme.muted} />
        </View>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Rechercher un aliment..."
          placeholderTextColor={theme.muted}
          style={{
            paddingLeft: 40,
            paddingRight: 16,
            paddingVertical: 14,
            fontSize: 14,
            color: theme.text,
          }}
          onSubmitEditing={() => router.push('/(app)/(plugins)/nutrition/log' as any)}
          returnKeyType="search"
        />
      </View>

      {/* 3 shortcut cards */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Scanner', icon: 'barcode-outline' as const, color: '#FF5C1A', onPress: () => router.push('/(app)/(plugins)/nutrition/log' as any) },
          { label: 'Photo IA', icon: 'camera-outline' as const, color: '#2E7BF6', onPress: () => router.push('/(app)/(plugins)/nutrition/log' as any) },
          { label: 'Repas vite', icon: 'flash-outline' as const, color: '#F59E0B', onPress: () => router.push('/(app)/(plugins)/nutrition/log' as any) },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            onPress={item.onPress}
            style={{
              flex: 1,
              ...CARD_STYLE,
              padding: 14,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: item.color + '18',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text, textAlign: 'center' }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* AI Suggestion: Photo IA tip */}
      <View style={{ marginBottom: 16 }}>
        <AISuggestion
          text="Prends une photo de ton repas et l'IA identifie automatiquement les aliments et leurs macros."
          actionLabel="Essayer Photo IA"
          onAction={() => router.push('/(app)/(plugins)/nutrition/log' as any)}
          tintColor="#2E7BF6"
        />
      </View>

      {/* Récents */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 10 }}>
        Récents
      </Text>
      {recentFoods.length === 0 ? (
        <View style={{ ...CARD_STYLE, padding: 20, alignItems: 'center' }}>
          <Text style={{ color: theme.muted, fontSize: 13 }}>Aucun aliment récent</Text>
        </View>
      ) : (
        recentFoods.map((food) => (
          <TouchableOpacity
            key={food.id}
            style={{
              ...CARD_STYLE,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              marginBottom: 8,
            }}
            onPress={() => {
              if (!userId) return;
              quickAddMutation.mutate({
                user_id: userId,
                date: today,
                meal_type: 'snack',
                food_name: food.food_name,
                calories: food.calories,
                protein_g: food.protein_g,
                carbs_g: food.carbs_g,
                fat_g: food.fat_g,
              } as any);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{food.food_name}</Text>
              <Text style={{ fontSize: 12, color: theme.muted }}>
                {Math.round(food.calories)} kcal · P:{food.protein_g}g G:{food.carbs_g}g L:{food.fat_g}g
              </Text>
            </View>
            <View
              style={{
                backgroundColor: theme.primary + '18',
                borderRadius: 8,
                padding: 8,
              }}
            >
              <Ionicons name="add" size={16} color={theme.primary} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </>
  );

  const renderHistoriqueTab = () => {
    if (loadingHistory) {
      return (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      );
    }

    const chartMaxHeight = 112;

    return (
      <>
        {/* 7-bar chart */}
        <View style={{ ...CARD_STYLE, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 16 }}>
            7 derniers jours
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: chartMaxHeight }}>
            {dailyKcal.map((day) => {
              const barHeight = maxKcal > 0 ? (day.kcal / maxKcal) * chartMaxHeight : 4;
              const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3);
              return (
                <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(barHeight, 4),
                      backgroundColor: day.isToday ? '#FF5C1A' : 'rgba(255,92,26,0.22)',
                      borderRadius: 4,
                    }}
                  />
                  <Text style={{ fontSize: 10, color: theme.muted, marginTop: 4 }}>{dayLabel}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Macros moyens 7j */}
        <View style={{ ...CARD_STYLE, padding: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 12 }}>
            Macros moyens 7j
          </Text>
          {[
            { label: 'Calories', value: avg7.kcal, unit: 'kcal', target: goals.calorie_goal, color: '#FF5C1A' },
            { label: 'Protéines', value: avg7.protein, unit: 'g', target: goals.protein_goal_g, color: '#FF5C1A' },
            { label: 'Glucides', value: avg7.carbs, unit: 'g', target: goals.carbs_goal_g, color: '#2E7BF6' },
            { label: 'Lipides', value: avg7.fat, unit: 'g', target: goals.fat_goal_g, color: '#F59E0B' },
          ].map((macro) => {
            const pct = Math.min((macro.value / Math.max(macro.target, 1)) * 100, 100);
            return (
              <View key={macro.label} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: theme.text }}>{macro.label}</Text>
                  <Text style={{ fontSize: 13, color: theme.muted }}>
                    {macro.value}{macro.unit} / {macro.target}{macro.unit}
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: macro.color, borderRadius: 3 }} />
                </View>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  const renderReglagesTab = () => {
    if (loadingGoals) {
      return (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      );
    }

    return (
      <>
        {/* Calorie goal slider */}
        <View style={{ ...CARD_STYLE, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
            Objectif calorique
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.primary, marginBottom: 8 }}>
            {Math.round(calorieSlider)} kcal
          </Text>
          {/* Custom calorie stepper (50 kcal steps, range 1200–4000) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
            {[
              { label: '−100', delta: -100 },
              { label: '−50', delta: -50 },
              { label: '+50', delta: 50 },
              { label: '+100', delta: 100 },
            ].map((btn) => (
              <TouchableOpacity
                key={btn.label}
                onPress={() =>
                  setCalorieSlider((v) => Math.min(4000, Math.max(1200, v + btn.delta)))
                }
                style={{
                  flex: 1,
                  backgroundColor: '#FF5C1A18',
                  borderRadius: 8,
                  paddingVertical: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF5C1A' }}>
                  {btn.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: theme.muted }}>min 1 200 kcal</Text>
            <Text style={{ fontSize: 11, color: theme.muted }}>max 4 000 kcal</Text>
          </View>
        </View>

        {/* AI Suggestion: TDEE recalculation */}
        <View style={{ marginBottom: 16 }}>
          <AISuggestion
            text="Recalcule ton TDEE pour des objectifs personnalisés basés sur ton poids, ta taille et ton activité."
            actionLabel="Calculer mon TDEE"
            onAction={() => router.push('/(app)/(plugins)/nutrition/calculator' as any)}
          />
        </View>

        {/* Settings list */}
        <View style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          {[
            { label: 'Recalculer TDEE', icon: 'calculator-outline' as const, onPress: () => router.push('/(app)/(plugins)/nutrition/calculator' as any), active: true },
            { label: 'Objectif protéines', icon: 'barbell-outline' as const, onPress: null, active: false },
            { label: 'Objectif glucides', icon: 'leaf-outline' as const, onPress: null, active: false },
            { label: 'Objectif lipides', icon: 'water-outline' as const, onPress: null, active: false },
            { label: 'Notifications repas', icon: 'notifications-outline' as const, onPress: null, active: false },
          ].map((row, index) => (
            <TouchableOpacity
              key={row.label}
              onPress={row.onPress ?? undefined}
              activeOpacity={row.active ? 0.7 : 1}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: '#E2E0DA',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: theme.primary + '18',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name={row.icon} size={18} color={theme.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, color: theme.text, fontWeight: '500' }}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PluginHeader
        title="Nutrition"
        onBack={() => router.back()}
        right={
          activeTab === 'Aujourd\'hui' ? (
            <TouchableOpacity
              onPress={() => setActiveTab('Ajouter')}
              style={{
                backgroundColor: '#FF5C1A',
                borderRadius: 999,
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>+ Ajouter</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 100,
        }}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {activeTab === 'Aujourd\'hui' && renderTodayTab()}
        {activeTab === 'Ajouter' && renderAddTab()}
        {activeTab === 'Historique' && renderHistoriqueTab()}
        {activeTab === 'Réglages' && renderReglagesTab()}
      </ScrollView>
    </SafeAreaView>
  );
}
