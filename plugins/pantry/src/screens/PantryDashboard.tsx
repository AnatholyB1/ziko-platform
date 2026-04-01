import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';
import { usePantryStore, type PantryItem } from '../store';
import { getExpiryStatus, EXPIRY_COLORS, getExpiryLabel } from '../utils/expiry';
import PantryTabBar from '../components/PantryTabBar';

// ── Category display label map ───────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  fruits: 'Fruits',
  vegetables: 'Légumes',
  meat: 'Viande',
  fish_seafood: 'Poisson',
  dairy: 'Produits laitiers',
  eggs: 'Oeufs',
  grains_pasta: 'Féculents',
  snacks: 'Snacks',
  drinks: 'Boissons',
  other: 'Autre',
};

// ── PantryItemRow ────────────────────────────────────────
function PantryItemRow({ item, theme, t }: { item: PantryItem; theme: any; t: (key: string, opts?: any) => string }) {
  const status = getExpiryStatus(item.expiration_date);
  const colors = EXPIRY_COLORS[status];
  const isOutOfStock = item.quantity === 0;
  const isLowStock = !isOutOfStock && item.low_stock_threshold !== null && item.quantity <= item.low_stock_threshold;
  const expiryLabel = getExpiryLabel(item.expiration_date, t);
  const rowBg = colors.bg === 'transparent' ? theme.surface : colors.bg;

  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: '/(app)/(plugins)/pantry/edit' as any,
          params: { id: item.id },
        })
      }
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 8,
        backgroundColor: rowBg,
      }}
    >
      {/* Expiry dot */}
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.dot,
          marginRight: 4,
        }}
      />

      {/* Item name + expiry label */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{item.name}</Text>
        {expiryLabel && (
          <Text style={{ fontSize: 14, fontWeight: '400', color: theme.muted, marginTop: 2 }}>
            {expiryLabel}
          </Text>
        )}
      </View>

      {/* Quantity + unit */}
      <Text style={{ fontSize: 14, fontWeight: '400', color: theme.muted }}>
        {item.quantity} {item.unit}
      </Text>

      {/* Stock status badge */}
      {isOutOfStock && (
        <View style={{ backgroundColor: '#FF000018', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#CC0000' }}>
            {t('pantry.out_of_stock_badge')}
          </Text>
        </View>
      )}
      {isLowStock && (
        <View style={{ backgroundColor: '#FF980022', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF9800' }}>
            {t('pantry.low_stock_badge')}
          </Text>
        </View>
      )}

      {/* Category tag */}
      <View
        style={{
          backgroundColor: theme.border,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '400', color: theme.muted }}>
          {CATEGORY_LABELS[item.food_category] ?? item.food_category}
        </Text>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color={theme.muted} />
    </TouchableOpacity>
  );
}

// ── PantryDashboard ──────────────────────────────────────
export default function PantryDashboard({ supabase }: { supabase: any }) {
  const { items, setItems, loading, setLoading, getItemsByLocation } = usePantryStore();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      setItems(data ?? []);
    } finally {
      setLoading(false);
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

  // Stats for subtitle
  const totalCount = items.length;
  const warningCount = items.filter((item) => {
    const status = getExpiryStatus(item.expiration_date);
    const needsAttention = item.quantity === 0 || (item.low_stock_threshold !== null && item.quantity <= item.low_stock_threshold);
    return status === 'expired' || status === 'today' || status === 'soon' || needsAttention;
  }).length;

  const fridgeItems = getItemsByLocation('fridge');
  const freezerItems = getItemsByLocation('freezer');
  const pantryItems = getItemsByLocation('pantry');

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header */}
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
              {t('pantry.title')}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '400', color: theme.muted, marginTop: 4 }}>
              {t('pantry.subtitle', { count: totalCount, warning: warningCount })}
            </Text>
          </View>

          {/* Add button */}
          <TouchableOpacity
            onPress={() => router.push('/(app)/(plugins)/pantry/add' as any)}
            accessibilityLabel={t('pantry.add_item')}
            style={{ padding: 4 }}
          >
            <Ionicons name="add-circle" size={32} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Empty state */}
        {items.length === 0 && (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 80,
              paddingBottom: 40,
            }}
          >
            <Ionicons name="storefront-outline" size={64} color={theme.muted} style={{ marginBottom: 16 }} />
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: theme.text,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              {t('pantry.empty_title')}
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '400',
                color: theme.muted,
                textAlign: 'center',
                paddingHorizontal: 32,
                lineHeight: 24,
              }}
            >
              {t('pantry.empty_body')}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(app)/(plugins)/pantry/add' as any)}
              style={{
                backgroundColor: theme.primary,
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 24,
                marginTop: 24,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                {t('pantry.add_item_cta')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Grouped sections */}
        {fridgeItems.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: theme.text,
                marginBottom: 16,
              }}
            >
              {t('pantry.section_fridge')}
            </Text>
            {fridgeItems.map((item) => (
              <PantryItemRow key={item.id} item={item} theme={theme} t={t} />
            ))}
          </View>
        )}

        {freezerItems.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: theme.text,
                marginBottom: 16,
              }}
            >
              {t('pantry.section_freezer')}
            </Text>
            {freezerItems.map((item) => (
              <PantryItemRow key={item.id} item={item} theme={theme} t={t} />
            ))}
          </View>
        )}

        {pantryItems.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: theme.text,
                marginBottom: 16,
              }}
            >
              {t('pantry.section_pantry')}
            </Text>
            {pantryItems.map((item) => (
              <PantryItemRow key={item.id} item={item} theme={theme} t={t} />
            ))}
          </View>
        )}
      </ScrollView>
      <PantryTabBar />
    </SafeAreaView>
  );
}
