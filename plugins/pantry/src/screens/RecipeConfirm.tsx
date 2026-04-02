import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useThemeStore, useTranslation, showAlert } from '@ziko/plugin-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Recipe } from '../types/recipe';

// ── Helpers ──────────────────────────────────────────────

function getMealTypeForHour(h: number): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  if (h >= 6 && h <= 10) return 'breakfast';
  if (h >= 11 && h <= 14) return 'lunch';
  if (h >= 18 && h <= 22) return 'dinner';
  return 'snack';
}

// ── Props ─────────────────────────────────────────────────

interface Props {
  supabase: SupabaseClient;
}

// ── RecipeConfirm ─────────────────────────────────────────

export default function RecipeConfirm({ supabase }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  // Route param parsing
  const { recipe: recipeStr, servings: servingsStr } = useLocalSearchParams<{
    recipe: string;
    servings: string;
  }>();
  const recipe: Recipe = JSON.parse(recipeStr as string);
  const servings = parseInt(servingsStr as string, 10);

  // Meal-type pre-fill by time of day
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(
    getMealTypeForHour(new Date().getHours()),
  );

  // Macro state — pre-fill from scaled values (no re-scaling on state init)
  const ratio = servings / recipe.base_servings;
  const [calories, setCalories] = useState(String(Math.round(recipe.macros.calories * ratio)));
  const [protein, setProtein] = useState(String(Math.round(recipe.macros.protein_g * ratio)));
  const [carbs, setCarbs] = useState(String(Math.round(recipe.macros.carbs_g * ratio)));
  const [fat, setFat] = useState(String(Math.round(recipe.macros.fat_g * ratio)));
  const [saving, setSaving] = useState(false);

  // ── Confirm handler ──────────────────────────────────────

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Get auth session for Bearer token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showAlert(t('pantry.confirm_error_title'), t('pantry.confirm_error'));
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/ai/tools/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tool_name: 'pantry_log_recipe_cooked',
          parameters: {
            recipe: JSON.stringify(recipe),
            servings,
            meal_type: mealType,
            macros_override: JSON.stringify({
              calories: parseInt(calories, 10),
              protein_g: parseFloat(protein),
              carbs_g: parseFloat(carbs),
              fat_g: parseFloat(fat),
            }),
          },
        }),
      });

      if (!res.ok) throw new Error('Tool execution failed');

      // Navigate to Nutrition dashboard on success
      router.replace('/(app)/(plugins)/nutrition/dashboard' as any);
    } catch {
      showAlert(t('pantry.confirm_error_title'), t('pantry.confirm_error'));
    } finally {
      setSaving(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────

  const textInputStyle = {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.background,
    marginBottom: 16,
  };

  const fieldLabelStyle = {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    marginBottom: 8,
  };

  const sectionLabelStyle = {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    marginBottom: 12,
    marginTop: 8,
  };

  // ── Meal-type options ─────────────────────────────────────

  const mealTypeOptions: Array<{ value: 'breakfast' | 'lunch' | 'dinner' | 'snack'; labelKey: string }> = [
    { value: 'breakfast', labelKey: 'pantry.confirm_meal_breakfast' },
    { value: 'lunch', labelKey: 'pantry.confirm_meal_lunch' },
    { value: 'dinner', labelKey: 'pantry.confirm_meal_dinner' },
    { value: 'snack', labelKey: 'pantry.confirm_meal_snack' },
  ];

  // ── Render ────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}>

          {/* Recipe name header */}
          <View style={{ marginTop: 24, marginBottom: 8 }}>
            <Text
              style={{ fontSize: 22, fontWeight: '700', color: theme.text }}
              numberOfLines={2}
            >
              {recipe.name}
            </Text>
          </View>

          {/* Meal-type section */}
          <Text style={sectionLabelStyle}>{t('pantry.confirm_meal_type')}</Text>
          <View
            style={{
              flexDirection: 'row',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            {mealTypeOptions.map((option, idx) => {
              const active = mealType === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setMealType(option.value)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    alignItems: 'center',
                    backgroundColor: active ? theme.primary : theme.surface,
                    borderLeftWidth: idx > 0 ? 1 : 0,
                    borderLeftColor: theme.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: active ? '#FFFFFF' : theme.muted,
                    }}
                  >
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Macros section */}
          <Text style={sectionLabelStyle}>{t('pantry.confirm_macros_title')}</Text>

          {/* Calories */}
          <Text style={fieldLabelStyle}>{t('pantry.confirm_field_calories')}</Text>
          <TextInput
            value={calories}
            onChangeText={setCalories}
            keyboardType="numeric"
            placeholderTextColor={theme.muted}
            style={textInputStyle}
          />

          {/* Protein */}
          <Text style={fieldLabelStyle}>{t('pantry.confirm_field_protein')}</Text>
          <TextInput
            value={protein}
            onChangeText={setProtein}
            keyboardType="numeric"
            placeholderTextColor={theme.muted}
            style={textInputStyle}
          />

          {/* Carbs */}
          <Text style={fieldLabelStyle}>{t('pantry.confirm_field_carbs')}</Text>
          <TextInput
            value={carbs}
            onChangeText={setCarbs}
            keyboardType="numeric"
            placeholderTextColor={theme.muted}
            style={textInputStyle}
          />

          {/* Fat */}
          <Text style={fieldLabelStyle}>{t('pantry.confirm_field_fat')}</Text>
          <TextInput
            value={fat}
            onChangeText={setFat}
            keyboardType="numeric"
            placeholderTextColor={theme.muted}
            style={textInputStyle}
          />

          {/* Confirm CTA */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={saving}
            style={{
              backgroundColor: saving ? theme.muted : theme.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                {t('pantry.confirm_cta')}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
