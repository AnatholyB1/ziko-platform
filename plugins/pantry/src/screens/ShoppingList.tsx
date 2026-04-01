import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, useTranslation, showAlert } from '@ziko/plugin-sdk';
import { usePantryStore } from '../store';
import type { ShoppingListItem } from '../types/shopping';
import PantryTabBar from '../components/PantryTabBar';

// ── ShoppingListItemRow ──────────────────────────────────
function ShoppingListItemRow({
  item,
  theme,
  t,
  onPress,
}: {
  item: ShoppingListItem;
  theme: any;
  t: (key: string, opts?: any) => string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 8,
        backgroundColor: theme.surface,
      }}
    >
      {/* Checkbox circle */}
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: theme.primary,
        }}
      />
      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{item.name}</Text>
        {item.quantity != null && item.unit ? (
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 2 }}>
            {item.quantity} {item.unit}
          </Text>
        ) : null}
        {item.source === 'recipe' && item.recipe_name ? (
          <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
            {t('pantry.shop_from_recipe', { name: item.recipe_name })}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── ShoppingList ─────────────────────────────────────────
export default function ShoppingList({ supabase }: { supabase: any }) {
  const { shoppingItems, shoppingLoading, setShoppingItems, setShoppingLoading, addShoppingItem, removeShoppingItem, updateItem } =
    usePantryStore();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setShoppingLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch current shopping list items
      const { data: existingItems } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      const currentList: ShoppingListItem[] = existingItems ?? [];
      setShoppingItems(currentList);

      // 2. Fetch pantry items and auto-populate low-stock entries
      const { data: pantryData } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id);

      const pantryRows = pantryData ?? [];
      const existingPantryIds = new Set(
        currentList
          .filter((i) => i.pantry_item_id != null)
          .map((i) => i.pantry_item_id)
      );

      const toInsert = pantryRows.filter(
        (item: any) =>
          (item.quantity === 0 || (item.low_stock_threshold !== null && item.quantity <= item.low_stock_threshold)) &&
          !existingPantryIds.has(item.id)
      );

      if (toInsert.length > 0) {
        const newRows = toInsert.map((item: any) => ({
          user_id: user.id,
          name: item.name,
          quantity: item.low_stock_threshold ?? 1,
          unit: item.unit,
          pantry_item_id: item.id,
          source: 'low_stock' as const,
          recipe_name: null,
        }));

        const { data: inserted } = await supabase
          .from('shopping_list_items')
          .insert(newRows)
          .select();

        if (inserted) {
          // Reload full list after insertions
          const { data: refreshed } = await supabase
            .from('shopping_list_items')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });
          setShoppingItems(refreshed ?? []);
        }
      }
    } finally {
      setShoppingLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Check-off handler ─────────────────────────────────
  async function handleCheckOff(item: ShoppingListItem) {
    // 1. Optimistic remove
    removeShoppingItem(item.id);
    try {
      // 2. Delete from shopping_list_items
      await supabase.from('shopping_list_items').delete().eq('id', item.id);
      // 3. Restore pantry quantity if pantry_item_id is set
      if (item.pantry_item_id) {
        const { data: pantryRow } = await supabase
          .from('pantry_items')
          .select('low_stock_threshold')
          .eq('id', item.pantry_item_id)
          .single();
        const restoreQty = pantryRow?.low_stock_threshold ?? 1;
        await supabase
          .from('pantry_items')
          .update({ quantity: restoreQty })
          .eq('id', item.pantry_item_id);
        // Update pantry store in memory
        updateItem(item.pantry_item_id, { quantity: restoreQty });
      }
    } catch {
      // Re-add item on error
      addShoppingItem(item);
      showAlert(t('pantry.error_save_title'), t('pantry.shop_error_checkoff'));
    }
  }

  // ── Export handler ────────────────────────────────────
  async function handleExport() {
    const sorted = [...shoppingItems].sort((a, b) => a.name.localeCompare(b.name));
    const lines = sorted.map((item) => {
      if (item.quantity != null && item.unit) {
        return `- ${item.name} \u00d7 ${item.quantity} ${item.unit}`;
      }
      return `- ${item.name}`;
    });
    const message = `Liste de courses Ziko\n\n${lines.join('\n')}`;
    await Share.share({ message });
  }

  // ── Derived data ──────────────────────────────────────
  const lowStockItems = shoppingItems.filter((i) => i.source === 'low_stock');
  const missingItems = shoppingItems.filter((i) => i.source === 'recipe');
  const totalCount = shoppingItems.length;

  // ── Loading state ─────────────────────────────────────
  if (shoppingLoading && shoppingItems.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
        <PantryTabBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Screen header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: theme.text }}>
              {t('pantry.shop_title')}
            </Text>
            <Text style={{ fontSize: 14, color: theme.muted, marginTop: 4 }}>
              {t('pantry.shop_subtitle', { count: totalCount })}
            </Text>
          </View>
          <TouchableOpacity onPress={handleExport} style={{ padding: 10 }} accessibilityLabel="Export">
            <Ionicons name="share-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Full empty state */}
        {totalCount === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Ionicons name="cart-outline" size={64} color={theme.muted} style={{ marginBottom: 16 }} />
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: theme.text,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              {t('pantry.shop_empty_title')}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: theme.muted,
                textAlign: 'center',
                paddingHorizontal: 32,
                lineHeight: 24,
              }}
            >
              {t('pantry.shop_empty_body')}
            </Text>
          </View>
        )}

        {/* Section 1: Rupture / Bas stock */}
        {totalCount > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
              {t('pantry.shop_section_low_stock')}
            </Text>
            <Text style={{ fontSize: 14, color: theme.muted, marginBottom: 12 }}>
              {t('pantry.shop_section_low_stock_count', { count: lowStockItems.length })}
            </Text>
            {lowStockItems.length === 0 && (
              <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center', paddingVertical: 12 }}>
                {t('pantry.shop_section_low_stock_empty')}
              </Text>
            )}
            {lowStockItems.map((item) => (
              <ShoppingListItemRow
                key={item.id}
                item={item}
                theme={theme}
                t={t}
                onPress={() => handleCheckOff(item)}
              />
            ))}
          </View>
        )}

        {/* Section 2: Ingredients manquants */}
        {totalCount > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
              {t('pantry.shop_section_missing')}
            </Text>
            <Text style={{ fontSize: 14, color: theme.muted, marginBottom: 12 }}>
              {t('pantry.shop_section_missing_count', { count: missingItems.length })}
            </Text>
            {missingItems.length === 0 && (
              <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center', paddingVertical: 12 }}>
                {t('pantry.shop_section_missing_empty')}
              </Text>
            )}
            {missingItems.map((item) => (
              <ShoppingListItemRow
                key={item.id}
                item={item}
                theme={theme}
                t={t}
                onPress={() => handleCheckOff(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <PantryTabBar />
    </SafeAreaView>
  );
}
