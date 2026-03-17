import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNutritionStore } from '../store';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof MEAL_TYPES[number];

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

interface CustomEntry {
  name: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  serving_g: string;
}

const EMPTY_CUSTOM: CustomEntry = {
  name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', serving_g: '100',
};

export default function LogMealScreen({ supabase }: { supabase: any }) {
  const { addLog, selectedDate } = useNutritionStore();
  const [tab, setTab] = useState<'search' | 'custom'>('search');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState<CustomEntry>(EMPTY_CUSTOM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.from('food_database').select('*').ilike('name', `%${query}%`).limit(30);
      setResults((data ?? []) as FoodItem[]);
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const saveLog = async (entry: Omit<any, 'id' | 'created_at'>) => {
    setSaving(true);
    const { data, error } = await supabase.from('nutrition_logs').insert({
      ...entry,
      date: selectedDate,
      meal_type: mealType,
    }).select().single();
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    addLog(data);
    router.back();
  };

  const logFood = (food: FoodItem) => {
    saveLog({
      food_name: food.name,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      serving_g: food.serving_g,
    });
  };

  const submitCustom = () => {
    if (!custom.name.trim() || !custom.calories) {
      Alert.alert('Required', 'Food name and calories are required.');
      return;
    }
    saveLog({
      food_name: custom.name.trim(),
      calories: parseFloat(custom.calories) || 0,
      protein_g: parseFloat(custom.protein_g) || 0,
      carbs_g: parseFloat(custom.carbs_g) || 0,
      fat_g: parseFloat(custom.fat_g) || 0,
      serving_g: parseFloat(custom.serving_g) || 100,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color="#8888A8" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: '#F0F0F5' }}>Log Meal</Text>
          {saving && <ActivityIndicator color="#6C63FF" />}
        </View>

        {/* Meal type selector */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 }}>
          {MEAL_TYPES.map((t) => (
            <TouchableOpacity key={t} onPress={() => setMealType(t)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: mealType === t ? '#6C63FF' : '#1A1A24', alignItems: 'center', borderWidth: 1, borderColor: mealType === t ? '#6C63FF' : '#2E2E40' }}>
              <Text style={{ color: mealType === t ? '#fff' : '#8888A8', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab toggle */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#1A1A24', borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {(['search', 'custom'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: tab === t ? '#6C63FF' : 'transparent', alignItems: 'center' }}>
              <Text style={{ color: tab === t ? '#fff' : '#8888A8', fontWeight: '600', fontSize: 14, textTransform: 'capitalize' }}>{t === 'custom' ? 'Custom Entry' : 'Search'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'search' ? (
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search food database…"
              placeholderTextColor="#8888A8"
              style={{ backgroundColor: '#1A1A24', borderRadius: 12, borderWidth: 1, borderColor: '#2E2E40', paddingHorizontal: 16, paddingVertical: 12, color: '#F0F0F5', marginBottom: 12, fontSize: 15 }}
              autoFocus
            />

            {loading ? (
              <ActivityIndicator color="#6C63FF" style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => logFood(item)}
                    style={{ backgroundColor: '#1A1A24', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#2E2E40', flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#F0F0F5', fontWeight: '600', fontSize: 14 }}>{item.name}</Text>
                      {item.brand && <Text style={{ color: '#8888A8', fontSize: 11 }}>{item.brand}</Text>}
                      <Text style={{ color: '#8888A8', fontSize: 11, marginTop: 2 }}>
                        {item.serving_g}g · P{item.protein_g}g · C{item.carbs_g}g · F{item.fat_g}g
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#6C63FF', fontWeight: '700' }}>{item.calories}</Text>
                      <Text style={{ color: '#8888A8', fontSize: 11 }}>kcal</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  query ? <Text style={{ color: '#8888A8', textAlign: 'center', marginTop: 32 }}>No results for "{query}"</Text> : null
                }
              />
            )}
          </View>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            {[
              { key: 'name', label: 'Food name', placeholder: 'e.g. Grilled Chicken', keyboard: 'default' },
              { key: 'calories', label: 'Calories (kcal)', placeholder: '0', keyboard: 'numeric' },
              { key: 'serving_g', label: 'Serving (g)', placeholder: '100', keyboard: 'numeric' },
              { key: 'protein_g', label: 'Protein (g)', placeholder: '0', keyboard: 'numeric' },
              { key: 'carbs_g', label: 'Carbs (g)', placeholder: '0', keyboard: 'numeric' },
              { key: 'fat_g', label: 'Fat (g)', placeholder: '0', keyboard: 'numeric' },
            ].map(({ key, label, placeholder, keyboard }) => (
              <View key={key} style={{ marginBottom: 12 }}>
                <Text style={{ color: '#8888A8', fontSize: 12, marginBottom: 4 }}>{label}</Text>
                <TextInput
                  value={(custom as any)[key]}
                  onChangeText={(v) => setCustom((c) => ({ ...c, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor="#8888A8"
                  keyboardType={keyboard as any}
                  style={{ backgroundColor: '#1A1A24', borderRadius: 10, borderWidth: 1, borderColor: '#2E2E40', paddingHorizontal: 14, paddingVertical: 10, color: '#F0F0F5', fontSize: 15 }}
                />
              </View>
            ))}

            <TouchableOpacity onPress={submitCustom} disabled={saving}
              style={{ backgroundColor: '#6C63FF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8, opacity: saving ? 0.6 : 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Entry</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
