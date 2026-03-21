import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useNutritionStore } from '../store';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';
import { format, parseISO } from 'date-fns';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof MEAL_TYPES[number];

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

function MacroBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const theme = useThemeStore((s) => s.theme);
  const pct = Math.min((value / goal) * 100, 100);
  return (
    <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export default function NutritionDashboard({ supabase }: { supabase: any }) {
  const { todayLogs, setTodayLogs, calorieGoal, proteinGoal, removeLog, selectedDate } = useNutritionStore();
  const theme = useThemeStore((s) => s.theme);
  const { t, tMeal } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = async () => {
    const { data } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('date', selectedDate)
      .order('created_at');
    setTodayLogs((data ?? []).map((d: any) => ({ ...d })));
  };

  useEffect(() => { loadLogs(); }, [selectedDate]);

  // Reload when screen gets focus (e.g. returning from LogMealScreen)
  useFocusEffect(useCallback(() => { loadLogs(); }, [selectedDate]));

  const goToLog = () => router.push('/(app)/(plugins)/nutrition/log');

  const deleteLog = (id: string) => {
    Alert.alert(t('general.remove'), t('nutrition.removeEntry'), [
      { text: t('general.cancel'), style: 'cancel' },
      { text: t('general.remove'), style: 'destructive', onPress: async () => {
        await supabase.from('nutrition_logs').delete().eq('id', id);
        removeLog(id);
      }},
    ]);
  };

  const onRefresh = async () => { setRefreshing(true); await loadLogs(); setRefreshing(false); };

  const totals = todayLogs.reduce(
    (acc, l) => ({
      kcal: acc.kcal + (l.calories ?? 0),
      protein: acc.protein + (l.protein_g ?? 0),
      carbs: acc.carbs + (l.carbs_g ?? 0),
      fat: acc.fat + (l.fat_g ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const mealGroups = MEAL_TYPES.reduce((acc, type) => ({
    ...acc,
    [type]: todayLogs.filter((l) => l.meal_type === type),
  }), {} as Record<MealType, typeof todayLogs>);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 24, fontWeight: '800', color: theme.text }}>
          🥗 {t('nutrition.title')}
        </Text>
        <TouchableOpacity onPress={goToLog}
          style={{ backgroundColor: theme.primary, borderRadius: 10, padding: 8 }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>

        {/* Date */}
        <Text style={{ color: theme.muted, fontSize: 14, marginBottom: 16 }}>
          {format(parseISO(selectedDate), 'EEEE, MMMM d')}
        </Text>

        {/* Calories ring summary */}
        <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <View>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 32 }}>{Math.round(totals.kcal)}</Text>
              <Text style={{ color: theme.muted, fontSize: 13 }}>{t('nutrition.of', { goal: String(calorieGoal) })}</Text>
            </View>
            <Text style={{ color: calorieGoal - totals.kcal > 0 ? '#4CAF50' : '#F44336', fontWeight: '600' }}>
              {calorieGoal - totals.kcal > 0 ? t('nutrition.remaining', { count: String(Math.round(calorieGoal - totals.kcal)) }) : t('nutrition.overGoal')}
            </Text>
          </View>
          <MacroBar value={totals.kcal} goal={calorieGoal} color={theme.primary} />
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {[
            { icon: 'camera' as const, label: t('nutrition.scan'), color: theme.primary, onPress: goToLog },
            { icon: 'search' as const, label: t('nutrition.search'), color: '#3b82f6', onPress: goToLog },
            { icon: 'create' as const, label: t('nutrition.custom'), color: '#8b5cf6', onPress: goToLog },

          ].map((action) => (
            <TouchableOpacity key={action.label} onPress={action.onPress}
              style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: action.color + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 12 }}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Macros */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {[
            { label: t('macro.protein'), value: totals.protein, goal: proteinGoal, unit: 'g', color: '#4CAF50' },
            { label: t('macro.carbs'), value: totals.carbs, goal: calorieGoal / 4, unit: 'g', color: '#FF9800' },
            { label: t('macro.fat'), value: totals.fat, goal: calorieGoal / 9, unit: 'g', color: '#FF6584' },
          ].map((macro) => (
            <View key={macro.label} style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ color: macro.color, fontWeight: '700', fontSize: 16 }}>{Math.round(macro.value)}</Text>
              <Text style={{ color: theme.muted, fontSize: 11 }}>{macro.unit}</Text>
              <Text style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>{macro.label}</Text>
              <View style={{ marginTop: 6 }}>
                <MacroBar value={macro.value} goal={macro.goal} color={macro.color} />
              </View>
            </View>
          ))}
        </View>

        {/* Meal sections */}
        {MEAL_TYPES.map((mealType) => (
          <View key={mealType} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>
                {MEAL_ICONS[mealType]} {tMeal(mealType)}
              </Text>
              <TouchableOpacity onPress={goToLog}>
                <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>

            {mealGroups[mealType].length === 0 ? (
              <Text style={{ color: theme.muted, fontSize: 13, paddingLeft: 4 }}>{t('nutrition.nothingLogged')}</Text>
            ) : (
              mealGroups[mealType].map((log) => (
                <TouchableOpacity key={log.id} onLongPress={() => deleteLog(log.id)}
                  style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '500', fontSize: 14 }}>{log.food_name}</Text>
                    <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>
                      P: {log.protein_g}g · C: {log.carbs_g}g · F: {log.fat_g}g
                    </Text>
                  </View>
                  <Text style={{ color: theme.primary, fontWeight: '600' }}>{Math.round(log.calories)} kcal</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        ))}
      </ScrollView>


    </SafeAreaView>
  );
}
