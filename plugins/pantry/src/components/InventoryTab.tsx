import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { COPY } from '../utils/copy';
import {
  LOCATIONS, countByLocation, filterByLocation, filterBySearch, expiryBadge, formatQuantity,
  type PantryRow, type StorageLocation,
} from '../utils/pantryLogic';
import { Chip, TextBadge, StateCard, PrimaryButton, SecondaryButton, useCardStyle } from './parts';

export interface InventoryTabProps {
  items: PantryRow[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  filter: StorageLocation | null;
  onFilter: (loc: StorageLocation | null) => void;
  searchOpen: boolean;
  search: string;
  onSearch: (q: string) => void;
  today: string;
  onOpenItem: (item: PantryRow) => void;
  onAdd: () => void;
  onScan: () => void;
}

export default function InventoryTab(p: InventoryTabProps) {
  const theme = useThemeStore((s) => s.theme);
  const card = useCardStyle();

  if (p.loading) {
    // Squelettes (#ECEAE4), jamais un spinner orange.
    return (
      <View style={{ gap: 8, marginTop: 16 }} accessibilityLabel="Chargement">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ height: 64, borderRadius: 16, backgroundColor: '#ECEAE4' }} />
        ))}
      </View>
    );
  }

  if (p.error) {
    return (
      <StateCard icon="alert-circle-outline" title={COPY.loadError}>
        <PrimaryButton label={COPY.retry} onPress={p.onRetry} />
      </StateCard>
    );
  }

  if (p.items.length === 0) {
    return (
      <StateCard icon="basket-outline" title={COPY.emptyTitle} body={COPY.emptyBody}>
        <PrimaryButton label={COPY.emptyScan} icon="barcode-outline" onPress={p.onScan} />
        <SecondaryButton label={COPY.emptyManual} icon="create-outline" onPress={p.onAdd} />
      </StateCard>
    );
  }

  const counts = countByLocation(p.items);
  const inLocation = filterByLocation(p.items, p.filter);
  const visible = p.searchOpen ? filterBySearch(inLocation, p.search) : inLocation;

  return (
    <View>
      {p.searchOpen ? (
        <View
          style={{
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            minHeight: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search-outline" size={18} color={theme.muted} />
          <TextInput
            value={p.search}
            onChangeText={p.onSearch}
            placeholder={COPY.searchPlaceholder}
            placeholderTextColor={theme.muted}
            accessibilityLabel={COPY.searchLabel}
            autoFocus
            style={{ flex: 1, fontSize: 15, color: theme.text, paddingVertical: 10 }}
          />
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 16, marginBottom: 12, marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {LOCATIONS.map((loc) => (
          <Chip
            key={loc.id}
            label={`${loc.label} ${counts[loc.id]}`}
            accessibilityLabel={`${loc.label}, ${counts[loc.id]} article${counts[loc.id] > 1 ? 's' : ''}`}
            selected={p.filter === loc.id}
            onPress={() => p.onFilter(p.filter === loc.id ? null : loc.id)}
          />
        ))}
      </ScrollView>

      {visible.length === 0 ? (
        <StateCard
          icon={p.searchOpen && p.search ? 'search-outline' : 'file-tray-outline'}
          title={p.searchOpen && p.search ? COPY.noResult : COPY.emptyLocation}
          body={p.searchOpen && p.search ? undefined : COPY.emptyLocationBody}
        />
      ) : (
        <View style={{ ...card, paddingVertical: 4 }}>
          {visible.map((it, idx) => {
            const badge = expiryBadge(it.expiration_date, p.today);
            const qty = formatQuantity(it.quantity, String(it.unit));
            return (
              <TouchableOpacity
                key={it.id}
                onPress={() => p.onOpenItem(it)}
                accessibilityRole="button"
                accessibilityLabel={`${it.name}, ${qty}${badge ? ', ' + badge.text.toLowerCase() : ''}`}
                activeOpacity={0.8}
                style={{
                  minHeight: 64,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }} numberOfLines={2}>
                    {it.name}
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.muted, marginTop: 2 }}>{qty}</Text>
                </View>
                {badge ? <TextBadge text={badge.text} tone={badge.tone} /> : null}
                <Ionicons name="chevron-forward" size={16} color={theme.muted} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
