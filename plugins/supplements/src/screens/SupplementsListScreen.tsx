import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, TextInput, RefreshControl,
  ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';
import { useSupplementsStore, MAX_COMPARE } from '../store';
import type { Supplement, SupplementCategory, SupplementBrand } from '../store';

export default function SupplementsListScreen({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const {
    categories, brands, supplements, favorites,
    setCategories, setBrands, setSupplements, setFavorites,
    selectedCategory, selectedBrand, searchQuery,
    setSelectedCategory, setSelectedBrand, setSearchQuery,
    addToCompare, compareList, toggleFavorite,
    isLoading, setLoading,
  } = useSupplementsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showBrands, setShowBrands] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 30;

  const loadData = async () => {
    setLoading(true);
    try {
      const [catRes, brandRes, favRes] = await Promise.all([
        supabase.from('supplement_categories').select('*').order('display_order'),
        supabase.from('supplement_brands').select('*').order('name'),
        supabase.auth.getUser().then(async ({ data: { user } }: any) => {
          if (!user) return { data: [] };
          return supabase.from('user_supplement_favorites').select('supplement_id').eq('user_id', user.id);
        }),
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (brandRes.data) setBrands(brandRes.data);
      if (favRes.data) setFavorites(favRes.data.map((f: any) => f.supplement_id));
    } catch {}
    setLoading(false);
  };

  const loadSupplements = async (append = false) => {
    const offset = append ? supplements.length : 0;

    let query = supabase
      .from('supplements')
      .select('*, supplement_brands(*), supplement_categories(*)');

    if (selectedCategory) query = query.eq('category_id', selectedCategory);
    if (selectedBrand) query = query.eq('brand_id', selectedBrand);
    if (searchQuery.trim()) query = query.ilike('name', `%${searchQuery.trim()}%`);

    // Sort by most recently scraped (trending = recently active products)
    query = query.order('last_scraped_at', { ascending: false, nullsFirst: false });

    query = query.range(offset, offset + PAGE_SIZE - 1);

    const { data } = await query;
    if (data) {
      const ids = data.map((s: any) => s.id);
      let latestPrices: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: prices } = await supabase
          .from('supplement_prices')
          .select('*')
          .in('supplement_id', ids)
          .order('scraped_at', { ascending: false });

        (prices ?? []).forEach((p: any) => {
          if (!latestPrices[p.supplement_id]) latestPrices[p.supplement_id] = p;
        });
      }

      const mapped = data.map((s: any) => ({
        ...s,
        latest_price: latestPrices[s.id] || null,
      }));

      if (append) {
        setSupplements([...supplements, ...mapped]);
      } else {
        setSupplements(mapped);
      }
      setHasMore(data.length === PAGE_SIZE);
    } else if (!append) {
      setSupplements([]);
      setHasMore(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadSupplements(true);
    setLoadingMore(false);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setHasMore(true); loadSupplements(); }, [selectedCategory, selectedBrand, searchQuery]);
  useFocusEffect(useCallback(() => { setHasMore(true); loadSupplements(); }, [selectedCategory, selectedBrand, searchQuery]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadSupplements();
    setRefreshing(false);
  };

  const handleToggleFavorite = async (supplementId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const isFav = favorites.includes(supplementId);
    if (isFav) {
      await supabase.from('user_supplement_favorites').delete()
        .eq('user_id', user.id).eq('supplement_id', supplementId);
    } else {
      await supabase.from('user_supplement_favorites').insert({
        user_id: user.id, supplement_id: supplementId,
      });
    }
    toggleFavorite(supplementId);
  };

  const openDetail = (s: Supplement) => {
    router.push({ pathname: '/(app)/(plugins)/supplements/detail' as any, params: { id: s.id } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.muted} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 24, fontWeight: '800', color: theme.text }}>
          🧪 {t('supplements.title')}
        </Text>
        {compareList.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(app)/(plugins)/supplements/compare' as any)}
            style={{
              backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}>
            <Ionicons name="git-compare" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{compareList.length}/{MAX_COMPARE}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
          borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14,
        }}>
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('supplements.searchPlaceholder')}
            placeholderTextColor={theme.muted}
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: theme.text, fontSize: 15 }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexShrink: 0, marginBottom: 8 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 6, gap: 8, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => setSelectedCategory(null)}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
            backgroundColor: !selectedCategory ? theme.primary : theme.surface,
            borderWidth: 1, borderColor: !selectedCategory ? theme.primary : theme.border,
          }}>
          <Text style={{ color: !selectedCategory ? '#fff' : theme.text, fontWeight: '600', fontSize: 13 }}>
            {t('supplements.allCategories')}
          </Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
              backgroundColor: selectedCategory === cat.id ? theme.primary : theme.surface,
              borderWidth: 1, borderColor: selectedCategory === cat.id ? theme.primary : theme.border,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {cat.icon ? (
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={selectedCategory === cat.id ? '#fff' : theme.text}
                />
              ) : null}
              <Text style={{
                color: selectedCategory === cat.id ? '#fff' : theme.text,
                fontWeight: '600', fontSize: 13,
              }}>
                {cat.name}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Brand filter toggle */}
      <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
        <TouchableOpacity
          onPress={() => setShowBrands(!showBrands)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={showBrands ? 'chevron-down' : 'chevron-forward'} size={16} color={theme.muted} />
          <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600' }}>
            {t('supplements.filterByBrand')}
            {selectedBrand ? ` (1)` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {showBrands && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ flexShrink: 0, marginBottom: 4 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 6, gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedBrand(null)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
              backgroundColor: !selectedBrand ? theme.primary : theme.surface,
              borderWidth: 1, borderColor: !selectedBrand ? theme.primary : theme.border,
            }}>
            <Text style={{ color: !selectedBrand ? '#fff' : theme.text, fontSize: 12, fontWeight: '600' }}>
              {t('supplements.allBrands')}
            </Text>
          </TouchableOpacity>
          {brands.map((b) => (
            <TouchableOpacity
              key={b.id}
              onPress={() => setSelectedBrand(selectedBrand === b.id ? null : b.id)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                backgroundColor: selectedBrand === b.id ? theme.primary : theme.surface,
                borderWidth: 1, borderColor: selectedBrand === b.id ? theme.primary : theme.border,
              }}>
              <Text style={{
                color: selectedBrand === b.id ? '#fff' : theme.text,
                fontSize: 12, fontWeight: '600',
              }}>
                {b.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Product list */}
      <FlatList
        data={supplements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={!isLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="flask-outline" size={48} color={theme.muted} />
            <Text style={{ color: theme.muted, fontSize: 15, marginTop: 12 }}>{t('supplements.noResults')}</Text>
          </View>
        ) : null}
        ListFooterComponent={loadingMore ? (
          <ActivityIndicator size="small" color={theme.primary} style={{ paddingVertical: 16 }} />
        ) : null}
        renderItem={({ item: s }) => {
          const isFav = favorites.includes(s.id);
          const inCompare = compareList.some((c) => c.id === s.id);
          return (
            <TouchableOpacity
              onPress={() => openDetail(s)}
              activeOpacity={0.7}
              style={{
                backgroundColor: theme.surface, borderRadius: 16, padding: 16,
                marginBottom: 12, borderWidth: 1, borderColor: theme.border,
                flexDirection: 'row', gap: 14,
              }}>
              {/* Image */}
              {s.image_url ? (
                <Image
                  source={{ uri: s.image_url }}
                  style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: theme.border }}
                  transition={200}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              ) : (
                <View style={{
                  width: 64, height: 64, borderRadius: 12, backgroundColor: theme.primary + '14',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="flask" size={28} color={theme.primary} />
                </View>
              )}

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {s.supplement_brands?.name ?? ''}
                  {s.supplement_categories ? ` · ${s.supplement_categories.name}` : ''}
                </Text>

                {/* Price */}
                {s.latest_price && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                    <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 16 }}>
                      {s.latest_price.price.toFixed(2)}€
                    </Text>
                    {s.latest_price.price_per_serving && (
                      <Text style={{ color: theme.muted, fontSize: 11 }}>
                        ({s.latest_price.price_per_serving.toFixed(2)}€/{t('supplements.serving')})
                      </Text>
                    )}
                    {!s.latest_price.in_stock && (
                      <View style={{
                        backgroundColor: '#F4433622', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                      }}>
                        <Text style={{ color: '#F44336', fontSize: 10, fontWeight: '700' }}>
                          {t('supplements.outOfStock')}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Nutrition highlight */}
                {s.nutrition_per_serving && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    {s.nutrition_per_serving.protein_g != null && (
                      <Text style={{ color: '#4CAF50', fontSize: 11, fontWeight: '600' }}>
                        P: {s.nutrition_per_serving.protein_g}g
                      </Text>
                    )}
                    {s.nutrition_per_serving.calories != null && (
                      <Text style={{ color: theme.muted, fontSize: 11 }}>
                        {s.nutrition_per_serving.calories} kcal
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Actions */}
              <View style={{ gap: 8, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => handleToggleFavorite(s.id)}>
                  <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22}
                    color={isFav ? '#F44336' : theme.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  if (inCompare) return;
                  if (!addToCompare(s)) {
                    Alert.alert(t('supplements.compareFull'), t('supplements.compareFullMsg'));
                  }
                }}>
                  <Ionicons name={inCompare ? 'checkmark-circle' : 'git-compare-outline'} size={20}
                    color={inCompare ? '#4CAF50' : theme.muted} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
