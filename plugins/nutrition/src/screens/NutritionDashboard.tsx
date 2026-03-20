import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNutritionStore } from '../store';
import { format, parseISO } from 'date-fns';

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_g: number;
  brand?: string;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof MEAL_TYPES[number];

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

function MacroBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = Math.min((value / goal) * 100, 100);
  return (
    <View style={{ height: 6, backgroundColor: '#E2E0DA', borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export default function NutritionDashboard({ supabase }: { supabase: any }) {
  const { todayLogs, setTodayLogs, calorieGoal, proteinGoal, addLog, removeLog, selectedDate } = useNutritionStore();
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('breakfast');
  const [foodSearch, setFoodSearch] = useState('');
  const [foodResults, setFoodResults] = useState<FoodItem[]>([]);
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

  const searchFood = async (query: string) => {
    if (!query) return;
    const { data } = await supabase
      .from('food_database')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(20);
    setFoodResults((data ?? []) as FoodItem[]);
  };

  const logFood = async (food: FoodItem) => {
    const entry = {
      date: selectedDate,
      meal_type: selectedMeal,
      food_name: food.name,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      serving_g: food.serving_g,
    };
    const { data, error } = await supabase.from('nutrition_logs').insert(entry).select().single();
    if (!error && data) {
      addLog(data);
      setShowLogModal(false);
      setFoodSearch('');
      setFoodResults([]);
    }
  };

  const deleteLog = (id: string) => {
    Alert.alert('Remove', 'Remove this food entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 24, fontWeight: '800', color: '#1C1A17' }}>
          🥗 Nutrition
        </Text>
        <TouchableOpacity onPress={() => setShowLogModal(true)}
          style={{ backgroundColor: '#FF5C1A', borderRadius: 10, padding: 8 }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5C1A" />}>

        {/* Date */}
        <Text style={{ color: '#7A7670', fontSize: 14, marginBottom: 16 }}>
          {format(parseISO(selectedDate), 'EEEE, MMMM d')}
        </Text>

        {/* Calories ring summary */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E2E0DA' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <View>
              <Text style={{ color: '#1C1A17', fontWeight: '800', fontSize: 32 }}>{Math.round(totals.kcal)}</Text>
              <Text style={{ color: '#7A7670', fontSize: 13 }}>of {calorieGoal} kcal</Text>
            </View>
            <Text style={{ color: calorieGoal - totals.kcal > 0 ? '#4CAF50' : '#F44336', fontWeight: '600' }}>
              {calorieGoal - totals.kcal > 0 ? `${Math.round(calorieGoal - totals.kcal)} remaining` : 'Over goal'}
            </Text>
          </View>
          <MacroBar value={totals.kcal} goal={calorieGoal} color="#FF5C1A" />
        </View>

        {/* Macros */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Protein', value: totals.protein, goal: proteinGoal, unit: 'g', color: '#4CAF50' },
            { label: 'Carbs', value: totals.carbs, goal: calorieGoal / 4, unit: 'g', color: '#FF9800' },
            { label: 'Fat', value: totals.fat, goal: calorieGoal / 9, unit: 'g', color: '#FF6584' },
          ].map((macro) => (
            <View key={macro.label} style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E0DA' }}>
              <Text style={{ color: macro.color, fontWeight: '700', fontSize: 16 }}>{Math.round(macro.value)}</Text>
              <Text style={{ color: '#7A7670', fontSize: 11 }}>{macro.unit}</Text>
              <Text style={{ color: '#7A7670', fontSize: 11, marginTop: 4 }}>{macro.label}</Text>
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
              <Text style={{ color: '#1C1A17', fontWeight: '600', fontSize: 15 }}>
                {MEAL_ICONS[mealType]} {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
              </Text>
              <TouchableOpacity onPress={() => { setSelectedMeal(mealType); setShowLogModal(true); }}>
                <Ionicons name="add-circle-outline" size={20} color="#FF5C1A" />
              </TouchableOpacity>
            </View>

            {mealGroups[mealType].length === 0 ? (
              <Text style={{ color: '#7A7670', fontSize: 13, paddingLeft: 4 }}>Nothing logged yet</Text>
            ) : (
              mealGroups[mealType].map((log) => (
                <TouchableOpacity key={log.id} onLongPress={() => deleteLog(log.id)}
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E2E0DA', flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1C1A17', fontWeight: '500', fontSize: 14 }}>{log.food_name}</Text>
                    <Text style={{ color: '#7A7670', fontSize: 11, marginTop: 2 }}>
                      P: {log.protein_g}g · C: {log.carbs_g}g · F: {log.fat_g}g
                    </Text>
                  </View>
                  <Text style={{ color: '#FF5C1A', fontWeight: '600' }}>{Math.round(log.calories)} kcal</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        ))}
      </ScrollView>

      {/* Log modal */}
      <Modal visible={showLogModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#F7F6F3', padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: '#1C1A17', fontSize: 20, fontWeight: '700' }}>Log Food</Text>
            <TouchableOpacity onPress={() => { setShowLogModal(false); setFoodSearch(''); setFoodResults([]); }}>
              <Ionicons name="close" size={24} color="#7A7670" />
            </TouchableOpacity>
          </View>

          {/* Meal type selector */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
            {MEAL_TYPES.map((type) => (
              <TouchableOpacity key={type} onPress={() => setSelectedMeal(type)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: selectedMeal === type ? '#FF5C1A' : '#FFFFFF', alignItems: 'center', borderWidth: 1, borderColor: selectedMeal === type ? '#FF5C1A' : '#E2E0DA' }}>
                <Text style={{ fontSize: 16 }}>{MEAL_ICONS[type]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            value={foodSearch}
            onChangeText={(v) => { setFoodSearch(v); searchFood(v); }}
            placeholder="Search food…"
            placeholderTextColor="#7A7670"
            style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 16, paddingVertical: 12, color: '#1C1A17', marginBottom: 16 }}
          />

          <ScrollView>
            {foodResults.map((food) => (
              <TouchableOpacity key={food.id} onPress={() => logFood(food)}
                style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E0DA', flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1C1A17', fontWeight: '500' }}>{food.name}</Text>
                  <Text style={{ color: '#7A7670', fontSize: 12, marginTop: 2 }}>
                    per {food.serving_g}g · P:{food.protein_g}g C:{food.carbs_g}g F:{food.fat_g}g
                  </Text>
                </View>
                <Text style={{ color: '#FF5C1A', fontWeight: '600' }}>{food.calories} kcal</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
