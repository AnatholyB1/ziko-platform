import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { usePantryStore } from '../store';
import type { Recipe, MacroBudget } from '../types/recipe';
import { COPY } from '../utils/copy';
import { fetchRemainingMacros } from '../utils/data';
import {
  fitsRemainingMacros, formatThousands, recipeAvailability, todayLocalISO, type PantryRow,
} from '../utils/pantryLogic';
import { PrimaryButton, StateCard, useCardStyle } from './parts';

interface Props {
  supabase: any;
  userId: string | undefined;
  pantry: PantryRow[];
  /** Cout en credits d'une generation (lu dans la config de l'app, defaut 1). */
  creditCost: number;
  onOpenRecipe: (recipe: Recipe) => void;
}

interface CreditsOut {
  balance: number;
  hint: string | null;
}

export default function RecipesTab({ supabase, userId, pantry, creditCost, onOpenRecipe }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const card = useCardStyle();
  const { recipes, recipesLoading, recipesError, setRecipes, setRecipesLoading, setRecipesError } = usePantryStore();
  const [preferences, setPreferences] = useState('');
  const [serverMacros, setServerMacros] = useState<MacroBudget | null>(null);
  const [creditsOut, setCreditsOut] = useState<CreditsOut | null>(null);

  const { data: localMacros } = useQuery({
    queryKey: ['pantry-macros', userId, todayLocalISO()],
    queryFn: () => fetchRemainingMacros(supabase, userId as string, todayLocalISO()),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const remaining: MacroBudget | null = serverMacros ?? localMacros ?? null;

  const generate = async () => {
    setRecipesLoading(true);
    setRecipesError(null);
    setCreditsOut(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setRecipesError(COPY.notSignedIn);
        return;
      }
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/pantry/recipes/suggest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        // P-4 : date LOCALE du client ; le serveur calcule les macros restantes depuis les objectifs.
        body: JSON.stringify({ date: todayLocalISO(), preferences: preferences.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setCreditsOut({ balance: Number(data?.balance) || 0, hint: null });
        return;
      }
      if (!res.ok || data.error) {
        setRecipesError(COPY.recipesError);
        return;
      }
      setRecipes(data.recipes ?? []);
      if (data.remaining_macros) setServerMacros(data.remaining_macros);
    } catch {
      setRecipesError(COPY.recipesError);
    } finally {
      setRecipesLoading(false);
    }
  };

  const hasPantry = pantry.length > 0;
  const buttonLabel = recipes.length > 0 ? COPY.regenerate(creditCost) : COPY.generate(creditCost);

  return (
    <View style={{ gap: 12, marginTop: 16 }}>
      {remaining ? (
        <View style={{ ...card, padding: 16 }}>
          <Text style={{ fontSize: 14, color: theme.muted }}>{COPY.macrosLeft}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>{formatThousands(remaining.calories)}</Text>
            <Text style={{ fontSize: 15, color: theme.muted }}>kcal</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, marginLeft: 8 }}>
              {Math.round(remaining.protein_g)}
            </Text>
            <Text style={{ fontSize: 15, color: theme.muted }}>{COPY.macrosUnit}</Text>
          </View>
          {hasPantry ? (
            <Text style={{ fontSize: 14, color: theme.muted, marginTop: 6 }}>{COPY.macrosBasis(pantry.length)}</Text>
          ) : null}
        </View>
      ) : null}

      <TextInput
        value={preferences}
        onChangeText={setPreferences}
        placeholder={COPY.preferencesPlaceholder}
        placeholderTextColor={theme.muted}
        accessibilityLabel={COPY.preferencesPlaceholder}
        style={{
          minHeight: 48,
          backgroundColor: theme.surface,
          borderRadius: 12,
          paddingHorizontal: 14,
          fontSize: 15,
          color: theme.text,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      />

      <PrimaryButton
        label={recipesLoading ? COPY.generating : buttonLabel}
        icon="sparkles-outline"
        disabled={recipesLoading || !hasPantry}
        onPress={generate}
      />

      {creditsOut ? (
        <StateCard icon="flash-off-outline" title={COPY.creditsOutTitle} body={COPY.creditsOutBody} />
      ) : recipesLoading ? (
        <View style={{ gap: 8 }} accessibilityLabel={COPY.generating}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 112, borderRadius: 16, backgroundColor: '#ECEAE4' }} />
          ))}
        </View>
      ) : recipesError ? (
        <StateCard icon="alert-circle-outline" title={recipesError}>
          <PrimaryButton label={COPY.retry} onPress={generate} />
        </StateCard>
      ) : recipes.length === 0 ? (
        <StateCard
          icon="restaurant-outline"
          title={hasPantry ? COPY.recipesEmptyTitle : COPY.emptyTitle}
          body={hasPantry ? COPY.recipesEmptyBody : COPY.recipesEmptyPantry}
        />
      ) : (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 4 }}>
            {COPY.proposals}
          </Text>
          {recipes.map((recipe) => {
            const av = recipeAvailability(recipe, pantry);
            const fits = fitsRemainingMacros(recipe, remaining);
            return (
              <TouchableOpacity
                key={recipe.id}
                onPress={() => onOpenRecipe(recipe)}
                accessibilityRole="button"
                accessibilityLabel={`${recipe.name}, ${recipe.macros.calories} kcal, ${COPY.ingredientsOf(av.available, av.total)}`}
                activeOpacity={0.85}
                style={{ ...card, padding: 16, gap: 6 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: theme.text }}>{recipe.name}</Text>
                  <Ionicons name="time-outline" size={14} color={theme.muted} />
                  <Text style={{ fontSize: 14, color: theme.muted }}>{recipe.prep_time_min} min</Text>
                </View>
                <Text style={{ fontSize: 14, color: theme.text }}>
                  {recipe.macros.calories} kcal · {Math.round(recipe.macros.protein_g)} g prot.
                  {fits ? ` · ${COPY.fitsMacros}` : ''}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: av.missing.length ? '#8A5700' : '#17703D' }}>
                  {COPY.ingredientsOf(av.available, av.total)}
                </Text>
                {av.missing.length > 0 ? (
                  <Text style={{ fontSize: 14, color: theme.muted }}>
                    {COPY.missingPrefix}
                    {av.missing.join(', ')}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
