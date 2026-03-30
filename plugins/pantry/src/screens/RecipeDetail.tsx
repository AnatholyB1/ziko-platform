import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTranslation, useThemeStore } from '@ziko/plugin-sdk';
import type { Recipe } from '../types/recipe';

interface Props {
  supabase: SupabaseClient; // passed by Expo Router wrapper, available for future use
}

export default function RecipeDetail({ supabase }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  // ── Route param parsing ──────────────────────────────
  const { recipe: recipeStr } = useLocalSearchParams<{ recipe: string }>();
  const recipe: Recipe = JSON.parse(recipeStr as string);

  // ── Serving state ────────────────────────────────────
  const [servings, setServings] = useState(recipe.base_servings);

  // ── Nutrition plugin gate ─────────────────────────────
  const [nutritionInstalled, setNutritionInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setNutritionInstalled(false); return; }
      supabase
        .from('user_plugins')
        .select('is_enabled')
        .eq('user_id', user.id)
        .eq('plugin_id', 'nutrition')
        .eq('is_enabled', true)
        .maybeSingle()
        .then(({ data }) => {
          setNutritionInstalled(!!data);
        });
    });
  }, []);

  const decrement = () => setServings((s) => Math.max(1, s - 1));
  const increment = () => setServings((s) => Math.min(8, s + 1));

  // ── Adjusted macros (client-side, no backend call) ──
  const ratio = servings / recipe.base_servings;
  const adjustedMacros = {
    calories: Math.round(recipe.macros.calories * ratio),
    protein_g: Math.round(recipe.macros.protein_g * ratio),
    carbs_g: Math.round(recipe.macros.carbs_g * ratio),
    fat_g: Math.round(recipe.macros.fat_g * ratio),
  };

  // ── Helpers ──────────────────────────────────────────
  const scaleQuantity = (qty: number) =>
    Math.round(qty * ratio * 10) / 10;

  // ── Render ───────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            gap: 4,
          }}
        >
          <Ionicons name="chevron-back-outline" size={20} color="#FF5C1A" />
          <Text style={{ fontSize: 15, color: '#FF5C1A', fontWeight: '600' }}>
            {t('pantry.recipe_detail_back')}
          </Text>
        </TouchableOpacity>

        {/* Recipe header card */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#1C1A17' }}>
            {recipe.name}
          </Text>
          <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 4, marginBottom: 10 }}>
            {recipe.description}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={14} color="#6B6963" />
            <Text style={{ fontSize: 13, color: '#6B6963' }}>
              {recipe.prep_time_min} min
            </Text>
          </View>
        </View>

        {/* Serving stepper */}
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17', marginTop: 16, marginBottom: 12 }}>
          {t('pantry.recipe_detail_servings')}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 24,
            marginBottom: 16,
          }}
        >
          <TouchableOpacity
            onPress={decrement}
            disabled={servings <= 1}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: servings <= 1 ? '#E2E0DA' : '#FF5C1A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name="remove-outline"
              size={20}
              color={servings <= 1 ? '#E2E0DA' : '#FF5C1A'}
            />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1C1A17', minWidth: 20, textAlign: 'center' }}>
            {servings.toString()}
          </Text>

          <TouchableOpacity
            onPress={increment}
            disabled={servings >= 8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: servings >= 8 ? '#E2E0DA' : '#FF5C1A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name="add-outline"
              size={20}
              color={servings >= 8 ? '#E2E0DA' : '#FF5C1A'}
            />
          </TouchableOpacity>
        </View>

        {/* I cooked this CTA — only shown when nutrition plugin is installed */}
        {nutritionInstalled === true && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/(plugins)/pantry/confirm' as any,
                params: {
                  recipe: JSON.stringify(recipe),
                  servings: String(servings),
                },
              })
            }
            style={{
              backgroundColor: theme.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginTop: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
              {t('pantry.cooked_this_cta')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Macro summary card */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17', marginBottom: 12 }}>
            {t('pantry.recipe_detail_macros')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Calories */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1C1A17' }}>
                {adjustedMacros.calories}
              </Text>
              <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 2 }}>
                {t('pantry.recipe_detail_kcal')}
              </Text>
            </View>
            {/* Protein */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1C1A17' }}>
                {adjustedMacros.protein_g}g
              </Text>
              <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 2 }}>
                {t('pantry.recipe_detail_protein')}
              </Text>
            </View>
            {/* Carbs */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1C1A17' }}>
                {adjustedMacros.carbs_g}g
              </Text>
              <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 2 }}>
                {t('pantry.recipe_detail_carbs')}
              </Text>
            </View>
            {/* Fat */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1C1A17' }}>
                {adjustedMacros.fat_g}g
              </Text>
              <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 2 }}>
                {t('pantry.recipe_detail_fat')}
              </Text>
            </View>
          </View>
        </View>

        {/* Ingredients section */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17', marginBottom: 12 }}>
            {t('pantry.recipe_detail_ingredients')}
          </Text>
          {recipe.ingredients.map((ingredient, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                borderBottomWidth: index < recipe.ingredients.length - 1 ? 1 : 0,
                borderBottomColor: '#E2E0DA',
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 14, color: '#FF5C1A', fontWeight: '700' }}>·</Text>
              <Text style={{ fontSize: 14, color: '#6B6963', minWidth: 80 }}>
                {scaleQuantity(ingredient.quantity)} {ingredient.unit}
              </Text>
              <Text style={{ fontSize: 14, color: '#1C1A17', flex: 1 }}>
                {ingredient.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Steps section */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17', marginBottom: 16 }}>
            {t('pantry.recipe_detail_steps')}
          </Text>
          {recipe.steps.map((step, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: 12,
                gap: 12,
              }}
            >
              {/* Step number circle */}
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: '#FF5C1A',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Text style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '700' }}>
                  {index + 1}
                </Text>
              </View>
              {/* Step text */}
              <Text style={{ fontSize: 14, color: '#1C1A17', flex: 1, lineHeight: 20, paddingTop: 4 }}>
                {step}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
