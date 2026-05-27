import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIMARY = '#FF5C1A';
const TABS = ['Inventaire', 'Recettes', 'Shopping'];

const CATEGORIES = [
  { id: 'fridge', label: 'Frigo', icon: 'snow-outline' as const, color: '#2E7BF6' },
  { id: 'freezer', label: 'Congél.', icon: 'thermometer-outline' as const, color: '#7B5BD0' },
  { id: 'pantry', label: 'Placard', icon: 'grid-outline' as const, color: '#F59E0B' },
];

const RECIPE_STUBS = [
  {
    name: 'Omelette protéinée',
    ingredients: ['oeufs', 'fromage', 'épinards', 'ail'],
    time: '10 min',
    kcal: 320,
  },
  {
    name: 'Bowl riz-poulet',
    ingredients: ['riz', 'poulet', 'brocoli', 'sauce soja'],
    time: '25 min',
    kcal: 520,
  },
  {
    name: 'Smoothie protéiné',
    ingredients: ['banane', 'lait', 'whey', 'beurre de cacahuète'],
    time: '5 min',
    kcal: 380,
  },
  {
    name: 'Salade Niçoise',
    ingredients: ['thon', 'oeufs', 'tomates', 'olives', 'haricots verts'],
    time: '15 min',
    kcal: 410,
  },
];

// ─── PantryPlugin ─────────────────────────────────────────────────────────────

export default function PantryPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // ─── Auth ──────────────────────────────────────────────────────────────────

  const { data: authData } = useQuery({
    queryKey: ['pantry-auth'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
  const userId = authData?.id;

  // ─── Pantry Items ──────────────────────────────────────────────────────────

  const { data: pantryItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['pantry-items', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('pantry_items')
        .select('id, name, storage_location, category')
        .eq('user_id', userId);
      if (error) return [];
      return (data ?? []) as Array<{
        id: string;
        name: string;
        storage_location?: string;
        category?: string;
      }>;
    },
    enabled: !!userId,
  });

  // ─── Shopping List ─────────────────────────────────────────────────────────

  const { data: shoppingItems = [], isLoading: loadingShopping } = useQuery({
    queryKey: ['shopping-list', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .eq('user_id', userId);
      if (error) return [];
      return (data ?? []) as Array<{ id: string; name: string; quantity?: string }>;
    },
    enabled: !!userId,
  });

  // ─── Category Counts ───────────────────────────────────────────────────────

  const getCategoryCount = (catId: string) => {
    return pantryItems.filter((item) => {
      const loc = item.storage_location ?? item.category ?? '';
      return loc === catId;
    }).length;
  };

  // ─── Recipe Match % ────────────────────────────────────────────────────────

  const pantryNames = pantryItems.map((i) => i.name.toLowerCase());

  const recipesWithMatch = RECIPE_STUBS.map((recipe) => {
    const matchCount = recipe.ingredients.filter((ing) =>
      pantryNames.some((n) => n.includes(ing.toLowerCase()))
    ).length;
    const match = (matchCount / recipe.ingredients.length) * 100;
    return { ...recipe, match, missing: recipe.ingredients.length - matchCount };
  }).sort((a, b) => b.match - a.match);

  // ─── Toggle Shopping Item ──────────────────────────────────────────────────

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Pantry" onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* ── TAB: Inventaire ── */}
        {activeTab === 'Inventaire' && (
          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: theme.text,
                marginBottom: 8,
              }}
            >
              Mes stocks
            </Text>

            {loadingItems ? (
              <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 20 }} />
            ) : (
              CATEGORIES.map((cat) => {
                const count = getCategoryCount(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() =>
                      showAlert(
                        cat.label,
                        `${count} article(s) dans votre ${cat.label.toLowerCase()}.`
                      )
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: theme.surface,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.border,
                      padding: 16,
                      gap: 12,
                      marginBottom: 10,
                      shadowColor: '#1C1A17',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.08,
                      shadowRadius: 12,
                      elevation: 3,
                    }}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        backgroundColor: `${cat.color}1F`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={cat.icon} size={22} color={cat.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: theme.text,
                        }}
                      >
                        {cat.label}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}
                      >
                        {count} article{count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.muted} />
                  </TouchableOpacity>
                );
              })
            )}

            <View style={{ marginTop: 8 }}>
              <AISuggestion
                tintColor={PRIMARY}
                text="Voici ce que tu peux cuisiner ce soir avec ce que tu as."
              />
            </View>
          </View>
        )}

        {/* ── TAB: Recettes ── */}
        {activeTab === 'Recettes' && (
          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: theme.text,
                marginBottom: 8,
              }}
            >
              Recettes suggérées
            </Text>

            {loadingItems ? (
              <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 20 }} />
            ) : (
              recipesWithMatch.map((recipe) => {
                const matchColor =
                  recipe.match >= 80
                    ? '#2E9E5B'
                    : recipe.match >= 50
                    ? '#F59E0B'
                    : theme.muted;
                return (
                  <View
                    key={recipe.name}
                    style={{
                      backgroundColor: theme.surface,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.border,
                      padding: 14,
                      marginBottom: 10,
                      shadowColor: '#1C1A17',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.08,
                      shadowRadius: 12,
                      elevation: 3,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: theme.text,
                          }}
                        >
                          {recipe.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: theme.muted,
                            marginTop: 2,
                          }}
                        >
                          {recipe.time} · {recipe.kcal} kcal
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '800',
                            color: matchColor,
                          }}
                        >
                          {recipe.match.toFixed(0)}%
                        </Text>
                        {recipe.match >= 80 ? (
                          <View
                            style={{
                              backgroundColor: 'rgba(46,158,91,0.12)',
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: '#2E9E5B',
                              }}
                            >
                              Pret a cuisiner
                            </Text>
                          </View>
                        ) : recipe.match >= 50 ? (
                          <View
                            style={{
                              backgroundColor: 'rgba(245,158,11,0.12)',
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: '#F59E0B',
                              }}
                            >
                              Presque
                            </Text>
                          </View>
                        ) : (
                          <Text
                            style={{ fontSize: 10, color: theme.muted }}
                          >
                            {`-${recipe.missing} ingr.`}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── TAB: Shopping ── */}
        {activeTab === 'Shopping' && (
          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: theme.text,
                marginBottom: 8,
              }}
            >
              Liste de courses
            </Text>

            {loadingShopping ? (
              <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 20 }} />
            ) : shoppingItems.length === 0 ? (
              <View
                style={{
                  alignItems: 'center',
                  paddingVertical: 40,
                  gap: 12,
                }}
              >
                <Ionicons name="cart-outline" size={48} color={theme.muted} />
                <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center' }}>
                  Liste vide — ajoute des articles
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    showAlert(
                      'Ajouter un article',
                      'Naviguez vers le scanner ou le formulaire pour ajouter des articles.'
                    )
                  }
                  style={{
                    backgroundColor: PRIMARY,
                    borderRadius: 10,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                    Ajouter
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {shoppingItems.map((item) => {
                  const checked = !!checkedItems[item.id];
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => toggleItem(item.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: theme.surface,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: theme.border,
                        padding: 12,
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: checked ? 0 : 2,
                          borderColor: PRIMARY,
                          backgroundColor: checked ? PRIMARY : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {checked && (
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: theme.text,
                            textDecorationLine: checked ? 'line-through' : 'none',
                          }}
                        >
                          {item.name}
                        </Text>
                        {item.quantity ? (
                          <Text
                            style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}
                          >
                            {item.quantity}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() =>
                    showAlert('Vider la liste', 'Supprimer tous les articles de la liste ?', [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Vider',
                        style: 'destructive',
                        onPress: () => setCheckedItems({}),
                      },
                    ])
                  }
                  style={{
                    marginTop: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, color: theme.muted, fontWeight: '600' }}>
                    Vider la liste
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
