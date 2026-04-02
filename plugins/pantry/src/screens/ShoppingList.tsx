import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, useTranslation, showAlert } from '@ziko/plugin-sdk';
import { usePantryStore, type PantryItem } from '../store';
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
  // Low-stock items come directly from pantry_items — no DB insert needed
  const [lowStockPantry, setLowStockPantry] = useState<PantryItem[]>([]);

  // ── Modal state ───────────────────────────────────────
  const [pendingPantry, setPendingPantry] = useState<PantryItem | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<ShoppingListItem | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    setShoppingLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch pantry items and compute low-stock directly (no insert)
      const { data: pantryData } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id);

      const pantryRows: PantryItem[] = pantryData ?? [];
      setLowStockPantry(
        pantryRows.filter(
          (item) =>
            item.quantity === 0 ||
            (item.low_stock_threshold !== null && item.quantity <= item.low_stock_threshold)
        )
      );

      // 2. Fetch only recipe-sourced shopping list items
      const { data: recipeItems } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('source', 'recipe')
        .order('created_at', { ascending: true });

      setShoppingItems(recipeItems ?? []);
    } finally {
      setShoppingLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Check-off: pantry low-stock item (tap → opens modal) ──
  function handleCheckOffPantryTap(item: PantryItem) {
    setPendingPantry(item);
    setPendingRecipe(null);
    setQtyInput('');
    setModalVisible(true);
  }

  // ── Confirm: low-stock pantry item (D-05: set quantity to purchased amount directly) ──
  async function confirmCheckOffPantry() {
    const purchased = parseFloat(qtyInput);
    if (!pendingPantry || isNaN(purchased) || purchased <= 0) return;
    const item = pendingPantry;
    setModalVisible(false);
    setPendingPantry(null);
    setQtyInput('');
    setLowStockPantry((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await supabase.from('pantry_items').update({ quantity: purchased }).eq('id', item.id);
      updateItem(item.id, { quantity: purchased });
    } catch {
      setLowStockPantry((prev) => [item, ...prev]);
      showAlert(t('pantry.error_save_title'), t('pantry.shop_error_checkoff'));
    }
  }

  // ── Check-off: recipe shopping item (tap → opens modal) ──
  function handleCheckOffRecipeTap(item: ShoppingListItem) {
    setPendingRecipe(item);
    setPendingPantry(null);
    setQtyInput('');
    setModalVisible(true);
  }

  // ── Confirm: recipe ingredient (D-03: add to existing; D-04: insert new) ──
  async function confirmCheckOffRecipe() {
    const purchased = parseFloat(qtyInput);
    if (!pendingRecipe || isNaN(purchased) || purchased <= 0) return;
    const item = pendingRecipe;
    setModalVisible(false);
    setPendingRecipe(null);
    setQtyInput('');
    removeShoppingItem(item.id);
    try {
      if (item.pantry_item_id) {
        // D-03: match exists — add purchased to existing quantity
        const { data: existing } = await supabase
          .from('pantry_items')
          .select('quantity')
          .eq('id', item.pantry_item_id)
          .single();
        const newQty = (existing?.quantity ?? 0) + purchased;
        await supabase.from('pantry_items').update({ quantity: newQty }).eq('id', item.pantry_item_id);
        updateItem(item.pantry_item_id, { quantity: newQty });
      } else {
        // D-04: no match — insert new pantry item with purchased quantity
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('pantry_items').insert({
            user_id: user.id,
            name: item.name,
            quantity: purchased,
            unit: item.unit ?? 'g',
            storage_location: 'pantry',
            food_category: 'other',
            low_stock_threshold: 1,
          });
        }
      }
      await supabase.from('shopping_list_items').delete().eq('id', item.id);
    } catch {
      addShoppingItem(item);
      showAlert(t('pantry.error_save_title'), t('pantry.shop_error_checkoff'));
    }
  }

  // ── Modal cancel — item stays in list (D-02) ─────────
  function handleModalCancel() {
    setModalVisible(false);
    setPendingPantry(null);
    setPendingRecipe(null);
    setQtyInput('');
  }

  // ── Unified confirm dispatcher ────────────────────────
  function handleModalConfirm() {
    if (pendingPantry) confirmCheckOffPantry();
    else if (pendingRecipe) confirmCheckOffRecipe();
  }

  // ── Export handler ────────────────────────────────────
  async function handleExport() {
    const allItems = [
      ...lowStockPantry.map((p) => ({ name: p.name, quantity: p.quantity, unit: p.unit as string })),
      ...shoppingItems.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
    ];
    const lines = allItems
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) =>
        item.quantity != null && item.unit
          ? `- ${item.name} \u00d7 ${item.quantity} ${item.unit}`
          : `- ${item.name}`
      );
    await Share.share({ message: `Liste de courses Ziko\n\n${lines.join('\n')}` });
  }

  // ── Derived data ──────────────────────────────────────
  const lowStockItems = lowStockPantry;
  const missingItems = shoppingItems; // recipe items only
  const totalCount = lowStockItems.length + missingItems.length;

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
                item={{ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit, source: 'low_stock', recipe_name: null, pantry_item_id: item.id, user_id: item.user_id, created_at: item.created_at }}
                theme={theme}
                t={t}
                onPress={() => handleCheckOffPantryTap(item)}
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
                onPress={() => handleCheckOffRecipeTap(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <PantryTabBar />

      {/* Quantity Modal — opened by both check-off handlers */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={handleModalCancel}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 8 }}>
              {t('pantry.shop_qty_title')}
            </Text>
            <Text style={{ fontSize: 15, color: theme.muted, marginBottom: 16 }}>
              {pendingPantry?.name ?? pendingRecipe?.name ?? ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <TextInput
                value={qtyInput}
                onChangeText={setQtyInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.muted}
                autoFocus
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 10,
                  padding: 14,
                  fontSize: 18,
                  color: theme.text,
                  backgroundColor: theme.background,
                }}
              />
              <Text style={{ fontSize: 16, color: theme.muted, minWidth: 30 }}>
                {pendingPantry?.unit ?? pendingRecipe?.unit ?? 'g'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={handleModalCancel}
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.border }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.muted }}>{t('pantry.shop_qty_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleModalConfirm}
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10, backgroundColor: theme.primary }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>{t('pantry.shop_qty_confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
