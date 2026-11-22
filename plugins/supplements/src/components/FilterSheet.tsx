import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { BottomSheet, Chip, PrimaryButton } from './ui';
import {
  fetchCatalogCount,
  formatShowButton,
  toggleId,
  type CatalogFilters,
  type FilterOption,
} from '../lib/catalog';

/** C14 : marques et categories en multi-choix, resultat annonce avant d'appliquer ("Afficher N produits"). */
export default function FilterSheet({
  visible,
  supabase,
  brands,
  categories,
  value,
  onApply,
  onClose,
}: {
  visible: boolean;
  supabase: any;
  brands: FilterOption[];
  categories: FilterOption[];
  value: CatalogFilters;
  onApply: (next: CatalogFilters) => void;
  onClose: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setBrandIds([...value.brandIds]);
      setCategoryIds([...value.categoryIds]);
    }
  }, [visible, value]);

  const draft: CatalogFilters = { search: value.search, brandIds, categoryIds };
  const { data: count = null } = useQuery<number>({
    queryKey: ['supplements_filter_count', draft.search, brandIds, categoryIds],
    queryFn: () => fetchCatalogCount(supabase, draft),
    enabled: visible,
  });

  const section = (
    title: string,
    options: FilterOption[],
    selected: string[],
    toggle: (id: string) => void,
    prefix: string,
  ) => (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800', marginBottom: 10 }}>
        {title} ({options.length})
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Chip
            key={o.id}
            testID={`${prefix}-${o.id}`}
            label={o.name}
            selected={selected.includes(o.id)}
            onPress={() => toggle(o.id)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filtres"
      right={
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Tout effacer"
          onPress={() => {
            setBrandIds([]);
            setCategoryIds([]);
          }}
        >
          <Text style={{ color: theme.muted, fontSize: 13.5, fontWeight: '700' }}>Tout effacer</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
        {section('Marque', brands, brandIds, (id) => setBrandIds((c) => toggleId(c, id)), 'supp-filter-brand')}
        {section('Catégorie', categories, categoryIds, (id) => setCategoryIds((c) => toggleId(c, id)), 'supp-filter-cat')}
      </ScrollView>
      <View style={{ marginTop: 12 }}>
        <PrimaryButton
          testID="supp-filter-apply"
          label={formatShowButton(count)}
          disabled={count === 0}
          onPress={() => onApply({ search: value.search, brandIds, categoryIds })}
        />
      </View>
    </BottomSheet>
  );
}
