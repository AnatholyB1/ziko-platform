import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { PluginHeader } from '@ziko/ui';
import { usePantryStore } from '../store';
import type { Recipe } from '../types/recipe';
import { COPY } from '../utils/copy';
import { fetchPantryItems, fetchShoppingRows } from '../utils/data';
import { LOCATIONS, countByLocation, todayLocalISO, type PantryRow, type StorageLocation } from '../utils/pantryLogic';
import InventoryTab from '../components/InventoryTab';
import RecipesTab from '../components/RecipesTab';
import ShoppingTab from '../components/ShoppingTab';
import ItemSheet from '../components/ItemSheet';
import { PrimaryButton } from '../components/parts';

export type PantryTab = 'inventory' | 'recipes' | 'shopping';

const TAB_ORDER: Array<{ id: PantryTab; label: string }> = [
  { id: 'inventory', label: COPY.tabs.inventory },
  { id: 'recipes', label: COPY.tabs.recipes },
  { id: 'shopping', label: COPY.tabs.shopping },
];

interface Props {
  supabase: any;
  initialTab?: PantryTab;
  /** Cout d'une generation de recettes (CREDIT_COSTS.recipes cote app) ; 1 par defaut. */
  recipeCreditCost?: number;
}

/**
 * Garde-manger (v1.20 Phase 10) : un seul ecran, trois onglets (Inventaire, Recettes, Courses).
 * Lieux = filtre de la liste (jamais une alerte), fiche article en feuille basse.
 */
export default function PantryPlugin({ supabase, initialTab = 'inventory', recipeCreditCost = 1 }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setItems, setShoppingItems } = usePantryStore();

  const [tab, setTab] = useState<PantryTab>(initialTab);
  const [filter, setFilter] = useState<StorageLocation | null>(null);
  const [filterTouched, setFilterTouched] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PantryRow | null>(null);
  const today = todayLocalISO();

  const { data: user } = useQuery({
    queryKey: ['pantry-auth'],
    queryFn: async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      return u;
    },
  });
  const userId: string | undefined = user?.id;

  const itemsQuery = useQuery({
    queryKey: ['pantry-items', userId],
    queryFn: () => fetchPantryItems(supabase, userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const shoppingQuery = useQuery({
    queryKey: ['shopping-list', userId],
    queryFn: () => fetchShoppingRows(supabase, userId as string),
    enabled: !!userId,
    staleTime: 0,
  });
  const items: PantryRow[] = itemsQuery.data ?? [];
  const rows = shoppingQuery.data ?? [];

  // Les ecrans historiques (detail recette) lisent encore le store.
  useEffect(() => {
    if (itemsQuery.data) setItems(itemsQuery.data as any);
  }, [itemsQuery.data]);
  useEffect(() => {
    if (shoppingQuery.data) setShoppingItems(shoppingQuery.data);
  }, [shoppingQuery.data]);

  // Lieu affiche au depart : le premier qui contient des articles (maquette B14 : Frigo).
  useEffect(() => {
    if (filterTouched || !itemsQuery.data || itemsQuery.data.length === 0) return;
    const counts = countByLocation(itemsQuery.data);
    const first = LOCATIONS.find((l) => counts[l.id] > 0);
    setFilter(first ? first.id : null);
  }, [itemsQuery.data, filterTouched]);

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pantry-items'] });
    queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    queryClient.invalidateQueries({ queryKey: ['pantry-macros'] });
  }, [queryClient]);

  // Retour depuis le formulaire ou le detail d'une recette : on relit les donnees.
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      reload();
    }, [reload]),
  );

  const goAdd = (scan = false) =>
    router.push({ pathname: '/(plugins)/pantry/add' as any, params: scan ? { scan: '1' } : {} });
  const openRecipe = (recipe: Recipe) =>
    router.push({ pathname: '/(plugins)/pantry/recipe-detail' as any, params: { recipe: JSON.stringify(recipe) } });

  const showSearch = tab === 'inventory' && items.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader
        title={COPY.title}
        onBack={() => router.back()}
        right={
          showSearch ? (
            <TouchableOpacity
              onPress={() => {
                setSearchOpen((v) => !v);
                setSearch('');
              }}
              accessibilityRole="button"
              accessibilityLabel={COPY.searchLabel}
              accessibilityState={{ selected: searchOpen }}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={searchOpen ? 'close' : 'search-outline'} size={22} color={theme.text} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <View
        accessibilityRole="tablist"
        style={{ flexDirection: 'row', marginHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}
      >
        {TAB_ORDER.map((t) => {
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderBottomWidth: 3,
                borderBottomColor: active ? theme.primary : 'transparent',
                marginBottom: -1,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: active ? '700' : '500', color: active ? theme.text : theme.muted }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'inventory' ? (
          <InventoryTab
            items={items}
            loading={!userId || itemsQuery.isLoading}
            error={itemsQuery.isError}
            onRetry={() => itemsQuery.refetch()}
            filter={filter}
            onFilter={(loc) => {
              setFilterTouched(true);
              setFilter(loc);
            }}
            searchOpen={searchOpen}
            search={search}
            onSearch={setSearch}
            today={today}
            onOpenItem={setSelected}
            onAdd={() => goAdd(false)}
            onScan={() => goAdd(true)}
          />
        ) : null}
        {tab === 'recipes' ? (
          <RecipesTab
            supabase={supabase}
            userId={userId}
            pantry={items}
            creditCost={recipeCreditCost}
            onOpenRecipe={openRecipe}
          />
        ) : null}
        {tab === 'shopping' ? (
          <ShoppingTab supabase={supabase} userId={userId} pantry={items} rows={rows} today={today} onChanged={reload} />
        ) : null}
      </ScrollView>

      {tab === 'inventory' && items.length > 0 ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
          <PrimaryButton label={COPY.addItem} icon="add" onPress={() => goAdd(false)} />
        </View>
      ) : null}

      <ItemSheet
        item={selected}
        supabase={supabase}
        userId={userId}
        today={today}
        onClose={() => setSelected(null)}
        onChanged={reload}
        onEdit={(id) => router.push({ pathname: '/(plugins)/pantry/edit' as any, params: { id } })}
      />
    </SafeAreaView>
  );
}
