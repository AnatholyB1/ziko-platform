import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';
import { useSupplementsStore, MAX_COMPARE } from '../store';
import type { Supplement, SupplementPrice } from '../store';

export default function SupplementDetailScreen({ supabase }: { supabase: any }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const { favorites, toggleFavorite, addToCompare, compareList } = useSupplementsStore();
  const [supplement, setSupplement] = useState<Supplement | null>(null);
  const [prices, setPrices] = useState<SupplementPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('supplements')
      .select('*, supplement_brands(*), supplement_categories(*)')
      .eq('id', id)
      .single();
    if (data) setSupplement(data);

    const { data: priceData } = await supabase
      .from('supplement_prices')
      .select('*')
      .eq('supplement_id', id)
      .order('price', { ascending: true });
    if (priceData) setPrices(priceData);
    setLoading(false);
  };

  const handleToggleFavorite = async () => {
    if (!supplement) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const isFav = favorites.includes(supplement.id);
    if (isFav) {
      await supabase.from('user_supplement_favorites').delete()
        .eq('user_id', user.id).eq('supplement_id', supplement.id);
    } else {
      await supabase.from('user_supplement_favorites').insert({
        user_id: user.id, supplement_id: supplement.id,
      });
    }
    toggleFavorite(supplement.id);
  };

  if (loading || !supplement) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.muted }}>{t('general.loading')}</Text>
      </SafeAreaView>
    );
  }

  const isFav = favorites.includes(supplement.id);
  const inCompare = compareList.some((c) => c.id === supplement.id);
  const nutrition = supplement.nutrition_per_serving ?? {};
  const nutritionKeys = Object.keys(nutrition);
  const cheapest = prices.length > 0 ? prices[0] : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.muted} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: theme.text }} numberOfLines={1}>
          {supplement.name}
        </Text>
        <TouchableOpacity onPress={handleToggleFavorite} style={{ marginLeft: 8 }}>
          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={24}
            color={isFav ? '#F44336' : theme.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        {/* Image + Brand */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          {supplement.image_url ? (
            <Image source={{ uri: supplement.image_url }}
              style={{ width: 180, height: 180, borderRadius: 20, backgroundColor: theme.border, marginBottom: 16 }}
              transition={300}
              contentFit="cover"
              cachePolicy="disk" />
          ) : (
            <View style={{
              width: 180, height: 180, borderRadius: 20, backgroundColor: theme.primary + '14',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Ionicons name="flask" size={60} color={theme.primary} />
            </View>
          )}
          <Text style={{ color: theme.muted, fontSize: 14 }}>
            {supplement.supplement_brands?.name}
            {supplement.supplement_categories ? ` · ${supplement.supplement_categories.name}` : ''}
          </Text>
        </View>

        {/* Best price card */}
        {cheapest && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: theme.primary + '44',
          }}>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
              {t('supplements.bestPrice')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 28 }}>
                {cheapest.price.toFixed(2)}€
              </Text>
              {cheapest.price_per_serving && (
                <Text style={{ color: theme.muted, fontSize: 13 }}>
                  ({cheapest.price_per_serving.toFixed(2)}€/{t('supplements.serving')})
                </Text>
              )}
            </View>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>
              {t('supplements.source')}: {cheapest.source}
            </Text>
          </View>
        )}

        {/* Compare button */}
        <TouchableOpacity
          onPress={() => {
            if (inCompare) return;
            if (!addToCompare({ ...supplement, latest_price: cheapest })) {
              Alert.alert(t('supplements.compareFull'), t('supplements.compareFullMsg'));
            }
          }}
          style={{
            backgroundColor: inCompare ? '#4CAF50' : theme.surface,
            borderRadius: 12, padding: 14, marginBottom: 16,
            borderWidth: 1, borderColor: inCompare ? '#4CAF50' : theme.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          <Ionicons name={inCompare ? 'checkmark-circle' : 'git-compare-outline'} size={20}
            color={inCompare ? '#fff' : theme.primary} />
          <Text style={{ color: inCompare ? '#fff' : theme.primary, fontWeight: '700', fontSize: 14 }}>
            {inCompare ? t('supplements.addedToCompare') : `${t('supplements.addToCompare')} (${compareList.length}/${MAX_COMPARE})`}
          </Text>
        </TouchableOpacity>

        {/* Serving info */}
        {(supplement.serving_size || supplement.servings_per_container) && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: theme.border,
          }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
              {t('supplements.servingInfo')}
            </Text>
            {supplement.serving_size && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>{t('supplements.servingSize')}</Text>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{supplement.serving_size}</Text>
              </View>
            )}
            {supplement.servings_per_container && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>{t('supplements.servingsPerContainer')}</Text>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{supplement.servings_per_container}</Text>
              </View>
            )}
          </View>
        )}

        {/* Nutrition per serving */}
        {nutritionKeys.length > 0 && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: theme.border,
          }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
              {t('supplements.nutritionPerServing')}
            </Text>
            {nutritionKeys.map((key) => (
              <View key={key} style={{
                flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border,
              }}>
                <Text style={{ color: theme.text, fontSize: 13 }}>
                  {t(`supplements.nutrient.${key}`) !== `supplements.nutrient.${key}` ? t(`supplements.nutrient.${key}`) : key}
                </Text>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{nutrition[key]}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Flavors */}
        {supplement.flavors && supplement.flavors.length > 0 && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: theme.border,
          }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
              {t('supplements.flavors')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {supplement.flavors.map((flavor) => (
                <View key={flavor} style={{
                  backgroundColor: theme.primary + '14', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
                }}>
                  <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 12 }}>{flavor}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Ingredients */}
        {supplement.ingredients && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: theme.border,
          }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
              {t('supplements.ingredients')}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>
              {supplement.ingredients}
            </Text>
          </View>
        )}

        {/* All prices comparison */}
        {prices.length > 0 && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: theme.border,
          }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
              {t('supplements.priceComparison')} ({prices.length})
            </Text>
            {prices.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => p.source_url ? Linking.openURL(p.source_url) : undefined}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderBottomWidth: i < prices.length - 1 ? 1 : 0,
                  borderBottomColor: theme.border,
                }}>
                <View>
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{p.source}</Text>
                  {p.price_per_serving && (
                    <Text style={{ color: theme.muted, fontSize: 11 }}>
                      {p.price_per_serving.toFixed(2)}€/{t('supplements.serving')}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{
                    color: i === 0 ? '#4CAF50' : theme.text,
                    fontWeight: '800', fontSize: 16,
                  }}>
                    {p.price.toFixed(2)}€
                  </Text>
                  {!p.in_stock && (
                    <View style={{ backgroundColor: '#F4433622', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                      <Text style={{ color: '#F44336', fontSize: 9, fontWeight: '700' }}>
                        {t('supplements.outOfStock')}
                      </Text>
                    </View>
                  )}
                  {p.source_url && (
                    <Ionicons name="open-outline" size={14} color={theme.muted} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Description */}
        {supplement.description && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: theme.border,
          }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
              {t('supplements.description')}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>
              {supplement.description}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
