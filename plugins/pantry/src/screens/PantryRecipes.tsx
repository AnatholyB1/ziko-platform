import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTranslation, useThemeStore } from '@ziko/plugin-sdk';
import { usePantryStore } from '../store';
import type { Recipe, MacroBudget } from '../types/recipe';

interface Props {
  supabase: SupabaseClient;
}

// ── Skeleton card ────────────────────────────────────────
function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        height: 120,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
        opacity,
      }}
    />
  );
}

// ── Macro pill ───────────────────────────────────────────
function MacroPill({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: '#FFF5F0',
        borderRadius: 8,
        padding: 8,
        marginHorizontal: 3,
      }}
    >
      <Text style={{ fontSize: 12, color: '#6B6963' }}>{label}</Text>
      <Text style={{ fontSize: 12, color: '#1C1A17', fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

// ── Recipe card ──────────────────────────────────────────
function RecipeCard({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
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
      {/* Row 1: name + prep time */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text
          style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17', flex: 1, marginRight: 8 }}
          numberOfLines={1}
        >
          {recipe.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="time-outline" size={12} color="#6B6963" />
          <Text style={{ fontSize: 12, color: '#6B6963' }}>{recipe.prep_time_min} min</Text>
        </View>
      </View>

      {/* Row 2: description */}
      <Text style={{ fontSize: 14, color: '#6B6963', marginBottom: 10 }} numberOfLines={2}>
        {recipe.description}
      </Text>

      {/* Row 3: ingredient count + calories */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: '#6B6963' }}>
          {recipe.ingredients.length} ingrédients
        </Text>
        <Text style={{ fontSize: 12, color: '#FF5C1A', fontWeight: '700' }}>
          {recipe.macros.calories} kcal
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── PantryTabBar ─────────────────────────────────────────
function PantryTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const tabs = [
    { path: '/(app)/(plugins)/pantry/dashboard', segment: 'dashboard', label: 'pantry.tab_dashboard', icon: 'storefront-outline' },
    { path: '/(app)/(plugins)/pantry/recipes', segment: 'recipes', label: 'pantry.tab_recipes', icon: 'restaurant-outline' },
  ] as const;
  return (
    <View style={{ flexDirection: 'row', backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, paddingBottom: insets.bottom, paddingTop: 8, height: 56 + insets.bottom }}>
      {tabs.map((tab) => {
        const isActive = pathname.includes(tab.segment);
        return (
          <TouchableOpacity key={tab.path} onPress={() => router.replace(tab.path as any)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <Ionicons name={tab.icon as any} size={22} color={isActive ? theme.primary : theme.muted} />
            <Text style={{ fontSize: 11, fontWeight: isActive ? '600' : '400', color: isActive ? theme.primary : theme.muted }}>{t(tab.label)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────
export default function PantryRecipes({ supabase }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  const {
    recipes,
    recipesLoading,
    recipesError,
    setRecipes,
    setRecipesLoading,
    setRecipesError,
  } = usePantryStore();

  const [preferences, setPreferences] = useState('');
  const [remainingMacros, setRemainingMacros] = useState<MacroBudget | null>(null);

  const fetchSuggestions = async () => {
    try {
      setRecipesLoading(true);
      setRecipesError(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setRecipesError('Non authentifié');
        setRecipesLoading(false);
        return;
      }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/pantry/recipes/suggest`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ preferences: preferences.trim() || undefined }),
        }
      );

      const data = await res.json();

      if (!res.ok || data.error) {
        setRecipesError(data.error || t('pantry.recipes_error'));
        setRecipesLoading(false);
        return;
      }

      setRecipes(data.recipes);
      setRemainingMacros(data.remaining_macros);
      setRecipesLoading(false);
    } catch {
      setRecipesError(t('pantry.recipes_error'));
      setRecipesLoading(false);
    }
  };

  const navigateToDetail = (recipe: Recipe) => {
    router.push({
      pathname: '/(plugins)/pantry/recipe-detail' as any,
      params: { recipe: JSON.stringify(recipe) },
    });
  };

  // ── Render ───────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen title */}
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#1C1A17', marginBottom: 16 }}>
          {t('pantry.recipes_title')}
        </Text>

        {/* Preferences input */}
        <TextInput
          value={preferences}
          onChangeText={setPreferences}
          placeholder={t('pantry.recipes_preferences_placeholder')}
          placeholderTextColor="#6B6963"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 10,
            padding: 12,
            fontSize: 14,
            color: '#1C1A17',
            borderWidth: 1,
            borderColor: '#E2E0DA',
            marginBottom: 12,
          }}
        />

        {/* Suggest button */}
        <TouchableOpacity
          onPress={fetchSuggestions}
          disabled={recipesLoading}
          style={{
            backgroundColor: recipesLoading ? '#CCCCCC' : '#FF5C1A',
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
            {t('pantry.recipes_suggest_btn')}
          </Text>
        </TouchableOpacity>

        {/* Macro budget banner */}
        {remainingMacros !== null && (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#FFF5F0',
              borderRadius: 8,
              padding: 10,
              marginBottom: 16,
              alignItems: 'center',
            }}
          >
            <MacroPill label="Cal" value={remainingMacros.calories} />
            <MacroPill label={`P`} value={remainingMacros.protein_g} />
            <MacroPill label={`G`} value={remainingMacros.carbs_g} />
            <MacroPill label={`L`} value={remainingMacros.fat_g} />
          </View>
        )}

        {/* Regenerate button (only when recipes exist) */}
        {recipes.length > 0 && !recipesLoading && (
          <TouchableOpacity
            onPress={fetchSuggestions}
            style={{
              borderWidth: 1,
              borderColor: '#FF5C1A',
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ color: '#FF5C1A', fontSize: 14, fontWeight: '600' }}>
              {t('pantry.recipes_regenerate_btn')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Content area */}
        {recipesLoading ? (
          // Skeleton loading
          <View>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : recipesError ? (
          // Error state
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Ionicons name="alert-circle-outline" size={40} color="#FF5C1A" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 14, color: '#CC3300', textAlign: 'center', marginBottom: 16 }}>
              {recipesError}
            </Text>
            <TouchableOpacity
              onPress={fetchSuggestions}
              style={{
                backgroundColor: '#FF5C1A',
                borderRadius: 8,
                paddingVertical: 10,
                paddingHorizontal: 24,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
                {t('pantry.recipes_retry_btn')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : recipes.length === 0 ? (
          // Empty / initial state
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Ionicons name="restaurant-outline" size={48} color="#E2E0DA" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1C1A17', marginBottom: 8, textAlign: 'center' }}>
              {t('pantry.recipes_empty_title')}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B6963', textAlign: 'center', lineHeight: 20 }}>
              {t('pantry.recipes_empty_body')}
            </Text>
          </View>
        ) : (
          // Recipe cards
          <View>
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() => navigateToDetail(recipe)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <PantryTabBar />
    </View>
  );
}
