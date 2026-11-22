import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useThemeStore, getActionPrimary } from '@ziko/plugin-sdk';
import { Card, EmptyBlock, SecondaryButton, ACCENT_TEXT } from '../../components/ui';
import FilterSheet from '../../components/FilterSheet';
import {
  EMPTY_FILTERS,
  CATALOG_PAGE_SIZE,
  activeFilterCount,
  fetchCatalogPage,
  fetchFilterOptions,
  formatResultCount,
  hasAnyFilter,
  type CatalogFilters,
  type CatalogItem,
} from '../../lib/catalog';
import { formatFromPrice, PRICE_UNAVAILABLE } from '../../lib/pricing';

/** C13 / C14 / C18 : recherche live, filtres Marque + Categorie, compteur, etat vide. */
export default function CatalogTab({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  const onSearch = (value: string) => {
    setText(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setFilters((f) => ({ ...f, search: value })), 300);
  };

  const clearSearch = () => {
    setText('');
    if (debounce.current) clearTimeout(debounce.current);
    setFilters((f) => ({ ...f, search: '' }));
  };

  const { data: options } = useQuery({
    queryKey: ['supplements_filter_options'],
    queryFn: () => fetchFilterOptions(supabase),
    staleTime: 10 * 60 * 1000,
  });

  const query = useInfiniteQuery({
    queryKey: ['supplements_catalog', filters.search, filters.brandIds, filters.categoryIds],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchCatalogPage(supabase, filters, pageParam as number),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.count && last.items.length === CATALOG_PAGE_SIZE ? all.length : undefined;
    },
    staleTime: 60_000,
  });

  const items: CatalogItem[] = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.count ?? 0;
  const nFilters = activeFilterCount(filters);

  const pill = (label: string, active: boolean) => (
    <TouchableOpacity
      testID={`supp-filter-pill-${label.split(' ')[0].toLowerCase()}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => setSheetOpen(true)}
      style={{
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: active ? getActionPrimary(theme) : theme.surface,
        borderWidth: 1,
        borderColor: active ? getActionPrimary(theme) : theme.border,
      }}
    >
      <Text style={{ color: active ? '#FFFFFF' : theme.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color={active ? '#FFFFFF' : theme.muted} />
    </TouchableOpacity>
  );

  return (
    <View>
      {/* Recherche */}
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 12,
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Ionicons name="search-outline" size={18} color={theme.muted} />
        <TextInput
          testID="supp-search"
          accessibilityLabel="Rechercher un complément"
          value={text}
          onChangeText={onSearch}
          placeholder="Rechercher un complément"
          placeholderTextColor={theme.muted}
          autoCorrect={false}
          style={{ flex: 1, fontSize: 14.5, color: theme.text, paddingVertical: 10 }}
        />
        {text.length > 0 ? (
          <TouchableOpacity onPress={clearSearch} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
            <Ionicons name="close-circle" size={18} color={theme.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filtres */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        {pill(filters.brandIds.length > 0 ? `Marque : ${filters.brandIds.length}` : 'Marque', filters.brandIds.length > 0)}
        {pill(filters.categoryIds.length > 0 ? `Catégorie : ${filters.categoryIds.length}` : 'Catégorie', filters.categoryIds.length > 0)}
        {nFilters > 0 ? (
          <TouchableOpacity
            testID="supp-filter-clear"
            accessibilityRole="button"
            accessibilityLabel="Effacer les filtres"
            onPress={() => setFilters((f) => ({ ...f, brandIds: [], categoryIds: [] }))}
            style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }}
          >
            <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '700' }}>Effacer</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {query.isLoading ? (
        <ActivityIndicator color={getActionPrimary(theme)} style={{ marginTop: 24 }} />
      ) : query.isError ? (
        <EmptyBlock
          icon="cloud-offline-outline"
          title="Catalogue indisponible"
          message="Impossible de charger les produits. Vérifie ta connexion."
          ctaLabel="Réessayer"
          onCta={() => query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyBlock
          icon="search-outline"
          title={filters.search.trim() ? `Aucun produit pour « ${filters.search.trim()} »` : 'Aucun produit'}
          message="Vérifie l'orthographe ou retire un filtre."
          ctaLabel={hasAnyFilter(filters) ? (filters.search.trim() ? 'Effacer la recherche' : 'Effacer les filtres') : undefined}
          onCta={() => (filters.search.trim() ? clearSearch() : setFilters(EMPTY_FILTERS))}
        />
      ) : (
        <>
          <Text testID="supp-result-count" style={{ color: theme.muted, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
            {formatResultCount(total)}
          </Text>
          <Card style={{ padding: 4, marginBottom: 12 }}>
            {items.map((item, i) => {
              const price = formatFromPrice(item.fromPrice);
              const unavailable = price === PRICE_UNAVAILABLE;
              return (
                <TouchableOpacity
                  key={item.id}
                  testID={`supp-product-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${price}`}
                  onPress={() =>
                    router.push({ pathname: '/(app)/(plugins)/supplements/detail', params: { id: item.id } } as any)
                  }
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    minHeight: 64,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                      {[item.brandName, item.categoryName].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text
                    testID={`supp-price-${item.id}`}
                    style={{ color: unavailable ? theme.muted : ACCENT_TEXT, fontSize: 13, fontWeight: '700', textAlign: 'right', maxWidth: 110 }}
                  >
                    {price}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.muted} />
                </TouchableOpacity>
              );
            })}
          </Card>
          {query.hasNextPage ? (
            <SecondaryButton
              testID="supp-load-more"
              label={query.isFetchingNextPage ? 'Chargement…' : 'Afficher plus'}
              onPress={() => query.fetchNextPage()}
            />
          ) : null}
        </>
      )}

      <FilterSheet
        visible={sheetOpen}
        supabase={supabase}
        brands={options?.brands ?? []}
        categories={options?.categories ?? []}
        value={filters}
        onClose={() => setSheetOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
      />
    </View>
  );
}
