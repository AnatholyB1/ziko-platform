import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';
import { useSupplementsStore } from '../store';

export default function SupplementCompareScreen() {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const { compareList, removeFromCompare, clearCompare } = useSupplementsStore();

  // Collect all unique nutrition keys across compared supplements
  const allNutritionKeys = Array.from(new Set(
    compareList.flatMap((s) => Object.keys(s.nutrition_per_serving ?? {}))
  ));

  if (compareList.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color={theme.muted} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>
            {t('supplements.compare')}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Ionicons name="git-compare-outline" size={60} color={theme.muted} />
          <Text style={{ color: theme.muted, fontSize: 15, textAlign: 'center', marginTop: 16 }}>
            {t('supplements.emptyCompare')}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
              marginTop: 20,
            }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t('supplements.browseSupplements')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const colWidth = Math.max(140, (300 / compareList.length));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.muted} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: theme.text }}>
          {t('supplements.compare')} ({compareList.length})
        </Text>
        <TouchableOpacity onPress={clearCompare}>
          <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 13 }}>{t('supplements.clearAll')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 20 }}>
          <View>
            {/* Product headers */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              {compareList.map((s) => (
                <View key={s.id} style={{
                  width: colWidth, alignItems: 'center',
                  backgroundColor: theme.surface, borderRadius: 16, padding: 12,
                  borderWidth: 1, borderColor: theme.border,
                }}>
                  <TouchableOpacity
                    onPress={() => removeFromCompare(s.id)}
                    style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
                    <Ionicons name="close-circle" size={20} color={theme.muted} />
                  </TouchableOpacity>
                  {s.image_url ? (
                    <Image source={{ uri: s.image_url }}
                      style={{ width: 60, height: 60, borderRadius: 10, marginBottom: 8 }} />
                  ) : (
                    <View style={{
                      width: 60, height: 60, borderRadius: 10, backgroundColor: theme.primary + '14',
                      alignItems: 'center', justifyContent: 'center', marginBottom: 8,
                    }}>
                      <Ionicons name="flask" size={24} color={theme.primary} />
                    </View>
                  )}
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12, textAlign: 'center' }}
                    numberOfLines={2}>
                    {s.name}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>
                    {s.supplement_brands?.name}
                  </Text>
                </View>
              ))}
            </View>

            {/* Price row */}
            <CompareRow
              label={t('supplements.price')}
              theme={theme}
              colWidth={colWidth}
              values={compareList.map((s) => (
                s.latest_price ? `${s.latest_price.price.toFixed(2)}€` : '-'
              ))}
              highlightBest
              compareList={compareList}
              getBestIdx={(items) => {
                let bestIdx = -1; let bestVal = Infinity;
                items.forEach((s, i) => {
                  const p = s.latest_price?.price;
                  if (p != null && p < bestVal) { bestVal = p; bestIdx = i; }
                });
                return bestIdx;
              }}
            />

            {/* Price per serving */}
            <CompareRow
              label={t('supplements.pricePerServing')}
              theme={theme}
              colWidth={colWidth}
              values={compareList.map((s) => (
                s.latest_price?.price_per_serving
                  ? `${s.latest_price.price_per_serving.toFixed(2)}€`
                  : '-'
              ))}
              highlightBest
              compareList={compareList}
              getBestIdx={(items) => {
                let bestIdx = -1; let bestVal = Infinity;
                items.forEach((s, i) => {
                  const p = s.latest_price?.price_per_serving;
                  if (p != null && p < bestVal) { bestVal = p; bestIdx = i; }
                });
                return bestIdx;
              }}
            />

            {/* Serving size */}
            <CompareRow
              label={t('supplements.servingSize')}
              theme={theme}
              colWidth={colWidth}
              values={compareList.map((s) => s.serving_size ?? '-')}
            />

            {/* Servings per container */}
            <CompareRow
              label={t('supplements.servingsPerContainer')}
              theme={theme}
              colWidth={colWidth}
              values={compareList.map((s) => (
                s.servings_per_container ? String(s.servings_per_container) : '-'
              ))}
              highlightBest
              compareList={compareList}
              getBestIdx={(items) => {
                let bestIdx = -1; let bestVal = 0;
                items.forEach((s, i) => {
                  const v = s.servings_per_container;
                  if (v != null && v > bestVal) { bestVal = v; bestIdx = i; }
                });
                return bestIdx;
              }}
            />

            {/* Nutrition rows */}
            {allNutritionKeys.map((key) => (
              <CompareRow
                key={key}
                label={t(`supplements.nutrient.${key}`) !== `supplements.nutrient.${key}`
                  ? t(`supplements.nutrient.${key}`) : key}
                theme={theme}
                colWidth={colWidth}
                values={compareList.map((s) => {
                  const val = s.nutrition_per_serving?.[key];
                  return val != null ? String(val) : '-';
                })}
              />
            ))}

            {/* Flavors count */}
            <CompareRow
              label={t('supplements.flavors')}
              theme={theme}
              colWidth={colWidth}
              values={compareList.map((s) => (
                s.flavors ? String(s.flavors.length) : '-'
              ))}
            />
          </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

function CompareRow({ label, values, theme, colWidth, highlightBest, compareList, getBestIdx }: {
  label: string;
  values: string[];
  theme: any;
  colWidth: number;
  highlightBest?: boolean;
  compareList?: any[];
  getBestIdx?: (items: any[]) => number;
}) {
  const bestIdx = highlightBest && compareList && getBestIdx ? getBestIdx(compareList) : -1;

  return (
    <View style={{
      flexDirection: 'row', gap: 12, marginBottom: 2,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    }}>
      <View style={{ width: 110, justifyContent: 'center', paddingVertical: 10 }}>
        <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      </View>
      {values.map((val, i) => (
        <View key={i} style={{ width: colWidth, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
          <Text style={{
            fontSize: 13, fontWeight: bestIdx === i ? '800' : '500',
            color: bestIdx === i ? '#4CAF50' : theme.text,
          }}>
            {val}
          </Text>
        </View>
      ))}
    </View>
  );
}
